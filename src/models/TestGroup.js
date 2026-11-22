const mongoose = require('mongoose');

const testGroupSchema = new mongoose.Schema(
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
      required: [true, 'Test group code is required'],
    },
    name: {
      type: String,
      required: [true, 'Test group name is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    testIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
      },
    ],
    testNames: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

testGroupSchema.index({ laboratoryId: 1, code: 1 }, { unique: true });
testGroupSchema.index({ laboratoryId: 1, name: 1 });

const TestGroup = mongoose.model('TestGroup', testGroupSchema);

module.exports = TestGroup;
