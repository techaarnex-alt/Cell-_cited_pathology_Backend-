const mongoose = require('mongoose');

const reportItemSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      index: true,
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
    },
    testNameSnapshot: {
      type: String,
      required: [true, 'Test name snapshot is required'],
      trim: true,
    },
    unitSnapshot: {
      type: String,
      trim: true,
      default: '',
    },
    rangeSnapshot: {
      type: String,
      trim: true,
      default: '',
    },
    categorySnapshot: {
      type: String,
      trim: true,
      default: 'General',
    },
    rateSnapshot: {
      type: Number,
      default: 0,
    },
    alertableSnapshot: {
      type: Boolean,
      default: true,
    },
    value: {
      type: String,
      trim: true,
      default: '',
    },
    isOutOfRange: {
      type: Boolean,
      default: false,
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    bookedServiceId: {
      type: String,
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestGroup',
      default: null,
    },
    bookableTestId: {
      type: String,
      default: '',
    },
    parameterDefId: {
      type: String,
      default: '',
    },
    masterParamRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
    },
    parentPanelName: {
      type: String,
      default: '',
    },
    testType: {
      type: String,
      default: 'single_parameter',
    },
    inputType: {
      type: String,
      default: 'numeric',
    },
    optional: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const ReportItem = mongoose.model('ReportItem', reportItemSchema);

module.exports = {
  ReportItem,
  reportItemSchema,
};
