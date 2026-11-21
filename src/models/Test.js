const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Test investigation name is required'],
      trim: true,
      maxlength: 150,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
      index: true,
    },
    unit: {
      type: String,
      trim: true,
      default: '',
    },
    referenceRange: {
      type: String,
      trim: true,
      default: '',
    },
    rate: {
      type: Number,
      required: [true, 'Test rate is required'],
      min: [0, 'Rate cannot be negative'],
      default: 0,
    },
    alertable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

testSchema.index({ laboratoryId: 1, name: 1 });
testSchema.index({ laboratoryId: 1, isActive: 1 });
testSchema.index({ laboratoryId: 1, category: 1 });

const Test = mongoose.model('Test', testSchema);

module.exports = Test;
