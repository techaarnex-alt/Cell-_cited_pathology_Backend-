const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Laboratory, Test, TestGroup, Doctor } = require('../src/models');

const run = async () => {
  await connectDB();
  const lab = await Laboratory.findOne({ code: 'CCPL' });
  if (!lab) {
    console.error('Laboratory CCPL not found!');
    process.exit(1);
  }

  const mainJsxPath = path.resolve(__dirname, '../../Cell cited pathology/Cell cited pathology/src/main.jsx');
  const content = fs.readFileSync(mainJsxPath, 'utf-8');

  // Extract DEFAULT_DOCTORS
  const doctorsMatch = content.match(/const DEFAULT_DOCTORS = (\[[\s\S]*?\]);/);
  let doctors = [];
  if (doctorsMatch) {
    // eslint-disable-next-line no-eval
    doctors = eval(doctorsMatch[1]);
  }

  // Extract TESTS
  const testsMatch = content.match(/const TESTS = (\[[\s\S]*?\]);[\r\n]+\/\/ Panels are shortcuts/);
  let tests = [];
  if (testsMatch) {
    // eslint-disable-next-line no-eval
    tests = eval(testsMatch[1]);
  }

  // Extract TEST_GROUPS
  const groupsMatch = content.match(/const TEST_GROUPS = (\[[\s\S]*?\]);/);
  let groups = [];
  if (groupsMatch) {
    // eslint-disable-next-line no-eval
    groups = eval(groupsMatch[1]);
  }

  // Extract GROUP_CATEGORIES
  const groupCategoriesMatch = content.match(/const GROUP_CATEGORIES = ({[\s\S]*?});/);
  let groupCategories = {};
  if (groupCategoriesMatch) {
    // eslint-disable-next-line no-eval
    groupCategories = eval(`(${groupCategoriesMatch[1]})`);
  }

  const categoryForTest = (name) => {
    const group = groups.find((item) => item.tests.includes(name));
    return groupCategories[group?.id] || 'General';
  };

  console.log(`Parsed from frontend: ${doctors.length} doctors, ${tests.length} tests, ${groups.length} groups`);

  // 1. Seed Doctors
  for (const doc of doctors) {
    const exists = await Doctor.findOne({ laboratoryId: lab._id, name: doc.name });
    if (!exists) {
      await Doctor.create({
        laboratoryId: lab._id,
        doctorCode: doc.doctorCode || 'DR-001',
        name: doc.name,
        referralPercentage: doc.referralPercentage || 0,
        specialty: doc.specialty || 'Referring Doctor',
        address: 'Barabanki',
      });
      console.log(`Added doctor: ${doc.name}`);
    }
  }

  // 2. Seed Tests
  let addedTests = 0;
  for (const t of tests) {
    const existing = await Test.findOne({ laboratoryId: lab._id, name: t.name });
    const category = categoryForTest(t.name);
    if (!existing) {
      await Test.create({
        laboratoryId: lab._id,
        name: t.name,
        category,
        unit: t.unit || '',
        referenceRange: t.range || '',
        rate: t.rate || 100,
        alertable: t.alertable !== false,
      });
      addedTests++;
    } else {
      existing.referenceRange = t.range || existing.referenceRange;
      existing.unit = t.unit || existing.unit;
      existing.category = category;
      existing.alertable = t.alertable !== false;
      await existing.save();
    }
  }
  console.log(`Seeded tests: ${addedTests} new, updated existing to match full frontend catalogue.`);

  // 3. Seed Groups
  for (const g of groups) {
    let group = await TestGroup.findOne({ laboratoryId: lab._id, name: g.name });
    const testsInGroup = await Test.find({ laboratoryId: lab._id, name: { $in: g.tests } }).select('_id');
    const category = groupCategories[g.id] || 'General';

    if (!group) {
      await TestGroup.create({
        laboratoryId: lab._id,
        code: g.id.toUpperCase(),
        name: g.name,
        description: g.description || '',
        category,
        testNames: g.tests,
        testIds: testsInGroup.map((t) => t._id),
      });
      console.log(`Added test group: ${g.name}`);
    } else {
      group.testNames = g.tests;
      group.testIds = testsInGroup.map((t) => t._id);
      group.category = category;
      await group.save();
    }
  }

  console.log('Catalogue & panel import completed successfully.');
  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
