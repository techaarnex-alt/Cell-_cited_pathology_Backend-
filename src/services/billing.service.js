const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Report = require('../models/Report');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { INVOICE_STATUS } = require('../constants/status');
const { logAuditEvent } = require('./audit.service');

const getInvoices = async (laboratoryId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { laboratoryId };

  if (query.status) {
    filter.status = query.status;
  }
  if (query.reportId) {
    filter.reportId = query.reportId;
  }
  if (query.patientId) {
    filter.patientId = query.patientId;
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('patientId', 'patientNumber title name mobile')
      .populate('reportId', 'reportNumber fee discount paid paymentMethod status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const createInvoice = async (laboratoryId, data, actor = null, req = null) => {
  const report = await Report.findOne({ _id: data.reportId, laboratoryId });
  if (!report) {
    throw ApiError.notFound('Report not found');
  }

  const existingInvoice = await Invoice.findOne({ reportId: report._id, laboratoryId });
  if (existingInvoice) {
    return existingInvoice;
  }

  const invoiceCount = await Invoice.countDocuments({ laboratoryId });
  const invoiceNumber = `CCPL/INV/${String(invoiceCount + 1).padStart(4, '0')}`;
  const total = data.total != null ? Number(data.total) : Number(report.fee || 0);
  const discount = data.discount != null ? Number(data.discount) : Number(report.discount || 0);
  const netTotal = Math.max(0, total - discount);

  const invoice = await Invoice.create({
    laboratoryId,
    invoiceNumber,
    reportId: report._id,
    patientId: report.patientId,
    total,
    discount,
    paid: 0,
    balance: netTotal,
    status: INVOICE_STATUS.PENDING,
    itemSnapshots: (report.items || []).map((item) => ({
      testName: item.testNameSnapshot,
      rate: item.rateSnapshot,
    })),
  });

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Invoice',
    entityId: invoice._id,
    action: 'CREATE',
    afterJson: invoice.toObject(),
    req,
  });

  return invoice;
};

const recordPayment = async (laboratoryId, invoiceId, data, actor = null, req = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, laboratoryId }).session(session);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (invoice.status === INVOICE_STATUS.PAID || Number(invoice.balance || 0) <= 0) {
      throw new ApiError(
        400,
        'Payment has already been collected in full for this invoice.',
        ERROR_CODES.OVERPAYMENT_NOT_ALLOWED
      );
    }

    const paymentAmount = Number(data.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw ApiError.badRequest('Payment amount must be a positive number');
    }

    if (data.discount != null) {
      invoice.discount = Math.max(0, Number(data.discount));
    }

    const currentPaid = Number(invoice.paid || 0);
    const invoiceTotal = Number(invoice.total || 0);
    const invoiceDiscount = Number(invoice.discount || 0);
    const invoiceNetTotal = Math.max(0, invoiceTotal - invoiceDiscount);
    const newPaid = currentPaid + paymentAmount;

    // Prevent overpayment
    if (newPaid > invoiceNetTotal) {
      throw new ApiError(
        400,
        `Payment of ₹${paymentAmount.toFixed(2)} exceeds remaining balance of ₹${Math.max(0, invoiceNetTotal - currentPaid).toFixed(2)}`,
        ERROR_CODES.OVERPAYMENT_NOT_ALLOWED
      );
    }

    // Append-only payment record
    const [payment] = await Payment.create(
      [
        {
          laboratoryId,
          invoiceId: invoice._id,
          reportId: invoice.reportId,
          amount: paymentAmount,
          method: data.method || 'Cash',
          reference: data.reference ? data.reference.trim() : '',
          notes: data.notes ? data.notes.trim() : '',
          receivedBy: actor?._id || null,
          paidAt: new Date(),
        },
      ],
      { session }
    );

    // Update invoice balance and status
    invoice.paid = newPaid;
    invoice.balance = Math.max(0, invoiceNetTotal - newPaid);
    invoice.status = invoice.balance === 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIAL;
    await invoice.save({ session });

    // Update report paid amount
    await Report.updateOne(
      { _id: invoice.reportId, laboratoryId },
      { $set: { paid: newPaid, discount: invoiceDiscount, paymentMethod: data.method || 'Cash' } },
      { session }
    );

    await logAuditEvent({
      laboratoryId,
      actorId: actor?._id,
      actorRole: actor?.role,
      entityType: 'Payment',
      entityId: payment._id,
      action: 'PAYMENT_RECORDED',
      afterJson: payment.toObject(),
      req,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    return {
      payment,
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        paid: invoice.paid,
        balance: invoice.balance,
        status: invoice.status,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getBillingSummary = async (laboratoryId, options = {}) => {
  const matchFilter = { laboratoryId: new mongoose.Types.ObjectId(String(laboratoryId)) };

  if (options.startDate || options.endDate) {
    matchFilter.createdAt = {};
    if (options.startDate) matchFilter.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) matchFilter.createdAt.$lte = new Date(options.endDate);
  }

  // Aggregation pipeline for billing summary metrics
  const summaryResult = await Invoice.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalBilled: { $sum: '$total' },
        totalCollected: { $sum: '$paid' },
        totalOutstanding: { $sum: '$balance' },
        paidInvoices: {
          $sum: { $cond: [{ $eq: ['$status', INVOICE_STATUS.PAID] }, 1, 0] },
        },
        partialInvoices: {
          $sum: { $cond: [{ $eq: ['$status', INVOICE_STATUS.PARTIAL] }, 1, 0] },
        },
        pendingInvoices: {
          $sum: { $cond: [{ $eq: ['$status', INVOICE_STATUS.PENDING] }, 1, 0] },
        },
      },
    },
  ]);

  const summary = summaryResult[0] || {
    totalInvoices: 0,
    totalBilled: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    paidInvoices: 0,
    partialInvoices: 0,
    pendingInvoices: 0,
  };

  delete summary._id;

  return summary;
};

module.exports = {
  getInvoices,
  createInvoice,
  recordPayment,
  getBillingSummary,
};
