const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
  {
    // Laboratory reference
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      index: true,
      default: null,
    },

    // Standard Application Fields
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 250,
      index: true,
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

    // Custom Dataset Fields (from Catalog / Labcorp Directory)
    testCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    investigation: {
      type: String,
      trim: true,
      index: true,
    },
    sampleInstructions: {
      type: String,
      trim: true,
      default: '',
    },
    temperature: {
      type: String,
      trim: true,
      default: '',
    },
    method: {
      type: String,
      trim: true,
      default: '',
    },
    cutoffTime: {
      type: String,
      trim: true,
      default: '',
    },
    reportingTime: {
      type: String,
      trim: true,
      default: '',
    },
    pricing: {
      net: {
        type: Number,
        default: 0,
      },
      mrp: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    sourcePage: {
      type: Number,
      default: null,
    },
    catalog: {
      provider: { type: String, default: '' },
      document: { type: String, default: '' },
      edition: { type: String, default: '' },
    },
    sourceDocument: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    strict: false, // Allows flexible document attributes while maintaining strict validation on defined fields
  }
);

// Pre-validate & pre-save hook to synchronize matching fields automatically
testSchema.pre('validate', function (next) {
  // Sync name & investigation
  if (!this.name && this.investigation) {
    this.name = this.investigation.trim();
  } else if (!this.investigation && this.name) {
    this.investigation = this.name.trim();
  }

  // Sync code & testCode
  if (!this.code && this.testCode) {
    this.code = this.testCode.trim().toUpperCase();
  } else if (!this.testCode && this.code) {
    this.testCode = this.code.trim().toUpperCase();
  }

  // Sync rate & pricing
  if ((this.rate === undefined || this.rate === 0) && this.pricing) {
    this.rate = Number(this.pricing.mrp || this.pricing.net || 0);
  } else if (this.rate !== undefined && (!this.pricing || (!this.pricing.mrp && !this.pricing.net))) {
    this.pricing = {
      mrp: Number(this.rate),
      net: Number(this.rate),
      currency: 'INR',
    };
  }

  // Default category fallback
  if (!this.category) {
    this.category = 'General';
  }

  next();
});

// Compound indexes for high-performance searches and filtering
testSchema.index({ laboratoryId: 1, name: 1 });
testSchema.index({ laboratoryId: 1, code: 1 });
testSchema.index({ laboratoryId: 1, category: 1 });
testSchema.index({ laboratoryId: 1, isActive: 1 });
testSchema.index({ name: 'text', investigation: 'text', code: 'text', testCode: 'text' });

const Test = mongoose.model('Test', testSchema);

module.exports = Test;
