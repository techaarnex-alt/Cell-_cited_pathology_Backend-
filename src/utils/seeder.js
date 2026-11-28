const mongoose = require('mongoose');
const Laboratory = require('../models/Laboratory');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Test = require('../models/Test');
const TestGroup = require('../models/TestGroup');
const { ROLES } = require('../constants/roles');
const logger = require('./logger');

const DEFAULT_DOCTORS = [
  { doctorCode: 'DR-001', name: 'Dr. P.S. Patel', specialty: 'General Physician', referralPercentage: 60, mobile: '9554448906', address: 'Barabanki' },
  { doctorCode: 'DR-002', name: 'Satguru Hospital', specialty: 'Multi-specialty Hospital', referralPercentage: 60, mobile: '6307342505', address: 'Barabanki' },
  { doctorCode: 'DR-003', name: 'Dr. RUMAN', specialty: 'Consultant Pathologist', referralPercentage: 70, mobile: '8601463398', address: 'Barabanki' },
];

const CURATED_TESTS = [];
const CURATED_GROUPS = [];

const seedInitialData = async () => {
  try {
    let lab = await Laboratory.findOne({ code: 'CCPL' });
    if (!lab) {
      lab = await Laboratory.create({
        name: 'Cell Cited Pathology Lab (CCPL)',
        code: 'CCPL',
        address: 'Shop No. 17, City Trade Centre, Lakhperabagh Chauraha, Barabanki - 225001',
        phones: ['9554448906', '6307342505', '8601463398'],
        email: 'ccpath11@gmail.com',
        medicalCertificate: 'CMEE26151240',
        authorisedSignatory: 'Dr. Sanjay Singh, MBBS, MD Pathologist',
      });
      logger.info('[Seeder] Default Laboratory CCPL created.');
    }

    // Default admin user
    let admin = await User.findOne({ username: 'admin', laboratoryId: lab._id });
    if (!admin) {
      admin = await User.create({
        laboratoryId: lab._id,
        name: 'Super Administrator',
        username: 'admin',
        email: 'admin@cellcited.com',
        password: 'CCPL@2026', // Hashed by User model pre-save hook
        role: ROLES.ADMINISTRATOR,
      });
      logger.info('[Seeder] Default admin user (admin / CCPL@2026) created.');
    }

    // Default pathologist user
    let pathologist = await User.findOne({ username: 'pathologist', laboratoryId: lab._id });
    if (!pathologist) {
      pathologist = await User.create({
        laboratoryId: lab._id,
        name: 'Dr. Sanjay Singh',
        username: 'pathologist',
        email: 'sanjay@cellcited.com',
        password: 'CCPL@2026',
        role: ROLES.PATHOLOGIST,
      });
      logger.info('[Seeder] Default pathologist user created.');
    }

    // Default doctors
    for (const doc of DEFAULT_DOCTORS) {
      const exists = await Doctor.findOne({ laboratoryId: lab._id, name: doc.name });
      if (!exists) {
        await Doctor.create({
          laboratoryId: lab._id,
          ...doc,
        });
      }
    }
    logger.info('[Seeder] Default doctors seeded.');

    // Default tests
    for (const testData of CURATED_TESTS) {
      const exists = await Test.findOne({ laboratoryId: lab._id, name: testData.name });
      if (!exists) {
        await Test.create({
          laboratoryId: lab._id,
          ...testData,
        });
      }
    }
    logger.info('[Seeder] Curated tests catalogue seeded.');

    // Default test groups
    for (const groupData of CURATED_GROUPS) {
      const exists = await TestGroup.findOne({ laboratoryId: lab._id, code: groupData.code });
      if (!exists) {
        const tests = await Test.find({
          laboratoryId: lab._id,
          name: { $in: groupData.testNames },
        }).select('_id');

        await TestGroup.create({
          laboratoryId: lab._id,
          code: groupData.code,
          name: groupData.name,
          description: groupData.description,
          category: groupData.category,
          testNames: groupData.testNames,
          testIds: tests.map((t) => t._id),
        });
      }
    }
    logger.info('[Seeder] Curated test groups seeded.');

    return lab;
  } catch (error) {
    logger.error('[Seeder] Error during seeding:', error);
  }
};

module.exports = {
  seedInitialData,
};
