const mongoose = require('mongoose');

const laboratorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Laboratory name is required'],
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: [true, 'Laboratory code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      default: 'CCPL',
    },
    address: {
      type: String,
      required: [true, 'Laboratory address is required'],
      trim: true,
    },
    phones: {
      type: [String],
      default: ['9554448906', '6307342505', '8601463398'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'ccpath11@gmail.com',
    },
    medicalCertificate: {
      type: String,
      trim: true,
      default: 'CMEE26151240',
    },
    authorisedSignatory: {
      type: String,
      trim: true,
      default: 'Dr. Sanjay Singh, MBBS, MD Pathologist',
    },
    registrationDetails: {
      type: String,
      trim: true,
      default: 'Provisional registration certificate issued by Office of the Chief Medical Officer, Barabanki',
    },
    letterheadAssetUrl: {
      type: String,
      default: '/report-letterhead.jpg',
    },
    watermarkAssetUrl: {
      type: String,
      default: '/report-watermark.png',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
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

laboratorySchema.index({ code: 1, isActive: 1 });

const Laboratory = mongoose.model('Laboratory', laboratorySchema);

module.exports = Laboratory;
