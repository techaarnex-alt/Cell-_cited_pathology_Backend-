const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    doctorCode: {
      type: String,
      required: [true, 'Doctor code is required'],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      maxlength: 120,
    },
    specialty: {
      type: String,
      trim: true,
      default: '',
    },
    mobile: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    referralPercentage: {
      type: Number,
      required: [true, 'Referral percentage is required'],
      min: [0, 'Referral percentage cannot be negative'],
      max: [100, 'Referral percentage cannot exceed 100%'],
      default: 0,
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

doctorSchema.index({ laboratoryId: 1, doctorCode: 1 }, { unique: true });
doctorSchema.index({ laboratoryId: 1, name: 1 });
doctorSchema.index({ laboratoryId: 1, isActive: 1 });

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;
