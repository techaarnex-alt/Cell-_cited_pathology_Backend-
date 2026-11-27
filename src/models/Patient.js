const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    laboratoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference is required'],
      index: true,
    },
    patientNumber: {
      type: String,
      required: [true, 'Patient number is required'],
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      maxlength: 120,
    },
    age: {
      type: Number,
      required: [true, 'Patient age is required'],
      min: [0, 'Age cannot be negative'],
    },
    ageUnit: {
      type: String,
      enum: ['Years', 'Months', 'Days'],
      default: 'Years',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: [true, 'Gender is required'],
    },
    mobile: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    aadhaar: {
      type: String,
      trim: true,
      default: '',
    },
    patientHistory: {
      type: String,
      trim: true,
      default: '',
    },
    onlineReportRequested: {
      type: Boolean,
      default: false,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    doctorNameSnapshot: {
      type: String,
      trim: true,
      default: 'Self',
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

patientSchema.index({ laboratoryId: 1, patientNumber: 1 }, { unique: true });
patientSchema.index({ laboratoryId: 1, name: 'text', mobile: 'text' });
patientSchema.index({ laboratoryId: 1, createdAt: -1 });

patientSchema.virtual('fullName').get(function () {
  return [this.title, this.name].filter(Boolean).join(' ');
});

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
