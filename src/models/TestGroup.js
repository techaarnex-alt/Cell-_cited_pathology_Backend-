const mongoose = require('mongoose');

const testGroupSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      index: true,
      default: null,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Test group name is required'],
      trim: true,
      maxlength: 150,
    },
    order: {
      type: Number,
      default: 0,
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
    labSmartCategoryId: {
      type: Number,
      default: null,
    },
    tests: {
      type: Array,
      default: [],
    },
    panels: {
      type: Array,
      default: [],
    },
    referenceCoverage: {
      type: Object,
      default: {},
    },
    recordType: {
      type: String,
      default: 'catalog_category',
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
    strict: false,
  }
);

testGroupSchema.index({ laboratoryId: 1, code: 1 });
testGroupSchema.index({ laboratoryId: 1, name: 1 });
testGroupSchema.index({ laboratoryId: 1, isActive: 1 });

const TestGroup = mongoose.model('TestGroup', testGroupSchema);

module.exports = TestGroup;
