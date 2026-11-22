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

const CURATED_TESTS = [
  // Haematology
  { name: 'Haemoglobin', category: 'Haematology', unit: 'g/dL', referenceRange: '12.00–15.00', rate: 100, alertable: true },
  { name: 'Packed Cell Volume (PCV)', category: 'Haematology', unit: '%', referenceRange: '36.00–46.00', rate: 100, alertable: true },
  { name: 'RBC Count', category: 'Haematology', unit: 'million/µL', referenceRange: '3.80–4.80', rate: 120, alertable: true },
  { name: 'MCV', category: 'Haematology', unit: 'fL', referenceRange: '80–100', rate: 80, alertable: true },
  { name: 'Mentzer Index', category: 'Haematology', unit: '', referenceRange: 'Screening index: <13 suggests thalassaemia trait; >13 suggests iron deficiency', rate: 0, alertable: false },
  { name: 'MCH', category: 'Haematology', unit: 'pg', referenceRange: '27–33', rate: 80, alertable: true },
  { name: 'MCHC', category: 'Haematology', unit: 'g/dL', referenceRange: '32–36', rate: 80, alertable: true },
  { name: 'RDW-CV', category: 'Haematology', unit: '%', referenceRange: '11.50–14.00', rate: 80, alertable: true },
  { name: 'Total Leucocyte Count (TLC)', category: 'Haematology', unit: 'thou/mm³', referenceRange: '4.00–10.00', rate: 100, alertable: true },
  { name: 'Neutrophils', category: 'Haematology', unit: '%', referenceRange: '40–70', rate: 60, alertable: true },
  { name: 'Lymphocytes', category: 'Haematology', unit: '%', referenceRange: '20–40', rate: 60, alertable: true },
  { name: 'Monocytes', category: 'Haematology', unit: '%', referenceRange: '2–8', rate: 60, alertable: true },
  { name: 'Eosinophils', category: 'Haematology', unit: '%', referenceRange: '1–6', rate: 60, alertable: true },
  { name: 'Basophils', category: 'Haematology', unit: '%', referenceRange: '<2.00', rate: 60, alertable: true },
  { name: 'Metamyelocytes', category: 'Haematology', unit: '%', referenceRange: '0–0% (peripheral blood)', rate: 50, alertable: true },
  { name: 'Myelocytes', category: 'Haematology', unit: '%', referenceRange: '0–0% (peripheral blood)', rate: 50, alertable: true },
  { name: 'Promyelocytes', category: 'Haematology', unit: '%', referenceRange: '0–0% (peripheral blood)', rate: 50, alertable: true },
  { name: 'Blasts', category: 'Haematology', unit: '%', referenceRange: '0–0% (peripheral blood)', rate: 50, alertable: true },
  { name: 'Absolute Neutrophil Count', category: 'Haematology', unit: 'thou/mm³', referenceRange: '2.00–7.00', rate: 70, alertable: true },
  { name: 'Absolute Lymphocyte Count', category: 'Haematology', unit: 'thou/mm³', referenceRange: '1.00–3.00', rate: 70, alertable: true },
  { name: 'Absolute Monocyte Count', category: 'Haematology', unit: 'thou/mm³', referenceRange: '0.20–1.00', rate: 70, alertable: true },
  { name: 'Absolute Eosinophil Count', category: 'Haematology', unit: 'thou/mm³', referenceRange: '0.02–0.50', rate: 70, alertable: true },
  { name: 'Absolute Basophil Count', category: 'Haematology', unit: 'thou/mm³', referenceRange: '0.02–0.10', rate: 70, alertable: true },
  { name: 'Platelet Count', category: 'Haematology', unit: 'thou/mm³', referenceRange: '150.00–410.00', rate: 100, alertable: true },
  { name: 'Mean Platelet Volume', category: 'Haematology', unit: 'fL', referenceRange: '7.00–12.00', rate: 70, alertable: true },
  { name: 'HCT', category: 'Haematology', unit: '%', referenceRange: '35–50', rate: 100, alertable: true },
  { name: 'ESR', category: 'Haematology', unit: 'mm/hr', referenceRange: 'Male: 0–15 · Female: 0–20', rate: 80, alertable: true },

  // Glucose and diabetes
  { name: 'Glucose Fasting', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '70–100', rate: 70, alertable: true },
  { name: 'Glucose Post Prandial', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '70–140', rate: 70, alertable: true },
  { name: 'Glucose Random, Plasma', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '70.00–140.00', rate: 70, alertable: true },
  { name: 'HbA1c', category: 'Biochemistry', unit: '%', referenceRange: '4.0–5.6 (non-diabetic) · 5.7–6.4 (at risk) · ≥6.5 (diabetes)', rate: 450, alertable: true },
  { name: 'Average Glucose', category: 'Biochemistry', unit: 'mg/dL', referenceRange: 'Calculated eAG = (28.7 × HbA1c) − 46.7 mg/dL', rate: 0, alertable: false },

  // Liver function
  { name: 'Total Bilirubin', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '0.20–1.20', rate: 100, alertable: true },
  { name: 'Direct Bilirubin', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<0.30', rate: 100, alertable: true },
  { name: 'Indirect Bilirubin', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<1.10', rate: 100, alertable: true },
  { name: 'AST (SGOT)', category: 'Biochemistry', unit: 'U/L', referenceRange: '15.00–40.00', rate: 120, alertable: true },
  { name: 'ALT (SGPT)', category: 'Biochemistry', unit: 'U/L', referenceRange: '10.00–49.00', rate: 120, alertable: true },
  { name: 'AST:ALT Ratio', category: 'Biochemistry', unit: 'ratio', referenceRange: '<1.00', rate: 0, alertable: true },
  { name: 'GGT', category: 'Biochemistry', unit: 'U/L', referenceRange: '0–73', rate: 180, alertable: true },
  { name: 'Alkaline Phosphatase (ALP)', category: 'Biochemistry', unit: 'U/L', referenceRange: '30.00–120.00', rate: 120, alertable: true },
  { name: 'Total Protein', category: 'Biochemistry', unit: 'g/dL', referenceRange: '6.0–8.30', rate: 100, alertable: true },
  { name: 'Albumin', category: 'Biochemistry', unit: 'g/dL', referenceRange: '3.5–5.0', rate: 100, alertable: true },
  { name: 'Globulin', category: 'Biochemistry', unit: 'g/dL', referenceRange: '2.0–3.5', rate: 100, alertable: true },
  { name: 'A/G Ratio', category: 'Biochemistry', unit: 'ratio', referenceRange: '1.0–2.2', rate: 0, alertable: true },

  // Renal function and electrolytes
  { name: 'Blood Urea', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '13.00–43.00', rate: 100, alertable: true },
  { name: 'Blood Urea Nitrogen (BUN)', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '6.00–20.00', rate: 100, alertable: true },
  { name: 'Serum Creatinine', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '0.55–1.02', rate: 100, alertable: true },
  { name: 'Estimated GFR', category: 'Biochemistry', unit: 'mL/min/1.73 m²', referenceRange: '≥90', rate: 0, alertable: true },
  { name: 'Uric Acid, Serum', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '2.60–6.00', rate: 120, alertable: true },
  { name: 'Calcium, Total', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '8.70–10.40', rate: 150, alertable: true },
  { name: 'Phosphorus', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '2.40–5.10', rate: 150, alertable: true },
  { name: 'Sodium', category: 'Biochemistry', unit: 'mEq/L', referenceRange: '136.00–145.00', rate: 150, alertable: true },
  { name: 'Potassium', category: 'Biochemistry', unit: 'mEq/L', referenceRange: '3.50–5.10', rate: 150, alertable: true },
  { name: 'Chloride', category: 'Biochemistry', unit: 'mEq/L', referenceRange: '98.00–107.00', rate: 150, alertable: true },

  // Lipids
  { name: 'Total Cholesterol', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<200', rate: 120, alertable: true },
  { name: 'Triglycerides', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<150', rate: 140, alertable: true },
  { name: 'HDL Cholesterol', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '>40', rate: 130, alertable: true },
  { name: 'LDL Cholesterol, Direct', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<100', rate: 150, alertable: true },
  { name: 'VLDL Cholesterol', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<30', rate: 80, alertable: true },
  { name: 'Non-HDL Cholesterol', category: 'Biochemistry', unit: 'mg/dL', referenceRange: '<130', rate: 80, alertable: true },

  // Thyroid
  { name: 'T3, Total', category: 'Hormones', unit: 'ng/mL', referenceRange: '0.60–1.81', rate: 180, alertable: true },
  { name: 'T4, Total', category: 'Hormones', unit: 'µg/dL', referenceRange: '5–12', rate: 180, alertable: true },
  { name: 'TSH', category: 'Hormones', unit: 'µIU/mL', referenceRange: '0.35–5.50', rate: 200, alertable: true },

  // Serology
  { name: 'C-Reactive Protein (CRP)', category: 'Serology', unit: 'mg/L', referenceRange: '<3.3', rate: 300, alertable: true },
  { name: 'Dengue NS1', category: 'Serology', unit: '', referenceRange: 'Negative', rate: 450, alertable: true },
  { name: 'Dengue IgG', category: 'Serology', unit: '', referenceRange: 'Negative', rate: 400, alertable: true },
  { name: 'Dengue IgM', category: 'Serology', unit: '', referenceRange: 'Negative', rate: 400, alertable: true },
  { name: 'Widal Salmonella typhi O (TO)', category: 'Serology', unit: '', referenceRange: 'Non-reactive', rate: 150, alertable: true },
  { name: 'Widal Salmonella typhi H (TH)', category: 'Serology', unit: '', referenceRange: 'Non-reactive', rate: 150, alertable: true },
  { name: 'Widal Salmonella typhi A, H (AH)', category: 'Serology', unit: '', referenceRange: 'Reactive up to titre 1:320', rate: 150, alertable: true },
  { name: 'Widal Salmonella typhi B, H (BH)', category: 'Serology', unit: '', referenceRange: 'Non-reactive', rate: 150, alertable: true },
];

const CURATED_GROUPS = [
  {
    code: 'CBC',
    name: 'Complete Blood Count (CBC)',
    description: 'Core blood count with differential and platelets',
    category: 'Haematology',
    testNames: [
      'Haemoglobin', 'Packed Cell Volume (PCV)', 'RBC Count', 'MCV', 'MCH',
      'MCHC', 'RDW-CV', 'Total Leucocyte Count (TLC)', 'Neutrophils',
      'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils', 'Platelet Count', 'Mean Platelet Volume'
    ],
  },
  {
    code: 'DIABETES',
    name: 'Diabetes Profile',
    description: 'Fasting, post-meal glucose and long-term control',
    category: 'Biochemistry',
    testNames: ['Glucose Fasting', 'Glucose Post Prandial', 'HbA1c', 'Average Glucose'],
  },
  {
    code: 'LFT',
    name: 'Liver Function Test (LFT)',
    description: 'Bilirubin, enzymes and protein profile',
    category: 'Biochemistry',
    testNames: [
      'Total Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin', 'AST (SGOT)',
      'ALT (SGPT)', 'AST:ALT Ratio', 'GGT', 'Alkaline Phosphatase (ALP)',
      'Total Protein', 'Albumin', 'Globulin', 'A/G Ratio'
    ],
  },
  {
    code: 'RFT',
    name: 'Renal Function Test (RFT)',
    description: 'Kidney markers and electrolytes',
    category: 'Biochemistry',
    testNames: [
      'Blood Urea', 'Blood Urea Nitrogen (BUN)', 'Serum Creatinine', 'Estimated GFR',
      'Uric Acid, Serum', 'Sodium', 'Potassium', 'Chloride', 'Calcium, Total', 'Phosphorus'
    ],
  },
  {
    code: 'LIPID',
    name: 'Lipid Profile',
    description: 'Cholesterol and triglyceride assessment',
    category: 'Biochemistry',
    testNames: [
      'Total Cholesterol', 'Triglycerides', 'HDL Cholesterol',
      'LDL Cholesterol, Direct', 'VLDL Cholesterol', 'Non-HDL Cholesterol'
    ],
  },
  {
    code: 'THYROID',
    name: 'Thyroid Profile',
    description: 'T3, T4 and TSH',
    category: 'Hormones',
    testNames: ['T3, Total', 'T4, Total', 'TSH'],
  },
  {
    code: 'DENGUE',
    name: 'Dengue Profile',
    description: 'Dengue antigen and antibody screening',
    category: 'Serology',
    testNames: ['Dengue NS1', 'Dengue IgG', 'Dengue IgM'],
  },
  {
    code: 'WIDAL',
    name: 'Widal Test',
    description: 'Salmonella antibody titres',
    category: 'Serology',
    testNames: [
      'Widal Salmonella typhi O (TO)', 'Widal Salmonella typhi H (TH)',
      'Widal Salmonella typhi A, H (AH)', 'Widal Salmonella typhi B, H (BH)'
    ],
  },
];

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
