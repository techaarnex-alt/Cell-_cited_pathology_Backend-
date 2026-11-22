const mongoose = require('mongoose');
const { DOCUMENT_TYPES } = require('../constants/status');

const documentSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      default: DOCUMENT_TYPES.REPORT_WITH_LETTERHEAD,
    },
    fileName: {
      type: String,
      required: [true, 'Document filename is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'application/pdf',
    },
    storageKey: {
      type: String,
      default: '',
    },
    version: {
      type: Number,
      default: 1,
    },
    checksum: {
      type: String,
      default: '',
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastDownloadedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ laboratoryId: 1, reportId: 1 });
documentSchema.index({ laboratoryId: 1, createdAt: -1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
