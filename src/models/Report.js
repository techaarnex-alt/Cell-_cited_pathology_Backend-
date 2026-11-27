const mongoose = require('mongoose');
const { REPORT_STATUS } = require('../constants/status');
const { reportItemSchema } = require('./ReportItem');

const patientSnapshotSchema = new mongoose.Schema(
  {
    patientNumber: { type: String, trim: true },
    title: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, required: true },
    age: { type: Number, required: true },
    ageUnit: { type: String, default: 'Years' },
    gender: { type: String, required: true },
    mobile: { type: String, default: '' },
    email: { type: String, default: '' },
    aadhaar: { type: String, default: '' },
    patientHistory: { type: String, default: '' },
    onlineReportRequested: { type: Boolean, default: false },
    address: { type: String, default: '' },
    sampleType: { type: String, default: 'Blood' },
    registeredOn: { type: String, default: '' },
  },
  { _id: false }
);

const doctorSnapshotSchema = new mongoose.Schema(
  {
    doctorCode: { type: String, trim: true },
    name: { type: String, trim: true },
    specialty: { type: String, default: '' },
    referralPercentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    reportNumber: {
      type: String,
      required: [true, 'Report number is required'],
      trim: true,
      uppercase: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required'],
      index: true,
    },
    patientSnapshot: {
      type: patientSnapshotSchema,
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true,
    },
    doctorSnapshot: {
      type: doctorSnapshotSchema,
      default: () => ({ referralPercentage: 0, name: 'Self' }),
    },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.DRAFT,
      index: true,
    },
    fee: {
      type: Number,
      required: [true, 'Report fee is required'],
      min: [0, 'Fee cannot be negative'],
      default: 0,
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
    paymentMethod: {
      type: String,
      default: 'Cash',
    },
    testGroupNames: {
      type: [String],
      default: [],
    },
    items: [reportItemSchema],
    hasCustomItemOrder: {
      type: Boolean,
      default: false,
      index: true,
    },
    customOrderSavedAt: {
      type: Date,
      default: null,
    },
    sampleType: {
      type: String,
      trim: true,
      default: 'Blood',
    },
    registeredOn: {
      type: String,
      trim: true,
      default: '',
    },
    collectedOn: {
      type: String,
      trim: true,
      default: '',
    },
    reportedOn: {
      type: String,
      default: '',
    },
    finalisedAt: {
      type: Date,
      default: null,
    },
    finalisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenReason: {
      type: String,
      default: '',
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reportSchema.index({ laboratoryId: 1, reportNumber: 1 }, { unique: true });
reportSchema.index({ laboratoryId: 1, status: 1 });
reportSchema.index({ laboratoryId: 1, createdAt: -1 });
reportSchema.index({ laboratoryId: 1, doctorId: 1, createdAt: -1 });

reportSchema.virtual('balance').get(function () {
  return Math.max(0, (this.fee || 0) - (this.discount || 0) - (this.paid || 0));
});

reportSchema.virtual('doctorEarnings').get(function () {
  const percentage = this.doctorSnapshot?.referralPercentage || 0;
  return ((this.fee || 0) * percentage) / 100;
});

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
