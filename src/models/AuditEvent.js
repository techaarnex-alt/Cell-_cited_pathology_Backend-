const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: '',
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      uppercase: true,
      index: true,
    },
    beforeJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    requestId: {
      type: String,
      default: '',
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

auditEventSchema.index({ laboratoryId: 1, entityType: 1, entityId: 1 });
auditEventSchema.index({ laboratoryId: 1, occurredAt: -1 });

const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);

module.exports = AuditEvent;
