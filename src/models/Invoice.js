const mongoose = require('mongoose');
const { INVOICE_STATUS } = require('../constants/status');

const invoiceSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
      uppercase: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      required: [true, 'Report reference is required'],
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required'],
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    total: {
      type: Number,
      required: [true, 'Invoice total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    discount: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      default: 0,
    },
    paid: {
      type: Number,
      min: [0, 'Paid amount cannot be negative'],
      default: 0,
    },
    balance: {
      type: Number,
      min: [0, 'Balance cannot be negative'],
      default: function () {
        return Math.max(0, (this.total || 0) - (this.discount || 0));
      },
    },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.PENDING,
      index: true,
    },
    itemSnapshots: [
      {
        testName: { type: String, required: true },
        rate: { type: Number, default: 0 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ laboratoryId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ laboratoryId: 1, status: 1 });
invoiceSchema.index({ laboratoryId: 1, createdAt: -1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
