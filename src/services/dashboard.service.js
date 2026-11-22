const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Report = require('../models/Report');
const Invoice = require('../models/Invoice');
const { REPORT_STATUS } = require('../constants/status');

const getDashboardStats = async (laboratoryId) => {
  const labObjectId = new mongoose.Types.ObjectId(String(laboratoryId));

  const [
    patientCount,
    reportStats,
    billingStats,
    recentReports,
  ] = await Promise.all([
    Patient.countDocuments({ laboratoryId, isActive: true }),
    Report.aggregate([
      { $match: { laboratoryId: labObjectId } },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          draftReports: {
            $sum: { $cond: [{ $eq: ['$status', REPORT_STATUS.DRAFT] }, 1, 0] },
          },
          readyReports: {
            $sum: { $cond: [{ $eq: ['$status', REPORT_STATUS.FINAL] }, 1, 0] },
          },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { laboratoryId: labObjectId } },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: '$total' },
          totalCollected: { $sum: '$paid' },
          totalOutstanding: { $sum: '$balance' },
        },
      },
    ]),
    Report.find({ laboratoryId })
      .populate('patientId', 'patientNumber title name')
      .sort({ createdAt: -1 })
      .limit(6)
      .select('reportNumber patientId patientSnapshot fee paid status testGroupNames createdAt reportedOn')
      .lean(),
  ]);

  const reportAgg = reportStats[0] || { totalReports: 0, draftReports: 0, readyReports: 0 };
  const billingAgg = billingStats[0] || { totalBilled: 0, totalCollected: 0, totalOutstanding: 0 };

  return {
    metrics: {
      registeredPatients: patientCount,
      draftReports: reportAgg.draftReports,
      readyReports: reportAgg.readyReports,
      totalReports: reportAgg.totalReports,
      totalBilled: billingAgg.totalBilled,
      totalCollected: billingAgg.totalCollected,
      totalOutstanding: billingAgg.totalOutstanding,
    },
    recentReports,
  };
};

module.exports = {
  getDashboardStats,
};
