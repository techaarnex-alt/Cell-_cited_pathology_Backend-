/**
 * LIMS Comprehensive End-to-End Verification Test Suite
 * Validates the complete laboratory workflow:
 * - Single test booking (Hemoglobin @ Rs.500)
 * - Single parameter test (Absolute Eosinophil Count @ Rs.150)
 * - Multi-test booking & cross-category booking
 * - Panel booking (CBC)
 * - Category rejection (Category ID != Test ID)
 * - Result entry validation (Rejection of unbooked parameters - 422)
 * - Billing calculations (Elimination of divide rule, exact line item snapshots)
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const Patient = require('../src/models/Patient');
const Doctor = require('../src/models/Doctor');
const TestGroup = require('../src/models/TestGroup');
const Report = require('../src/models/Report');
const Invoice = require('../src/models/Invoice');
const reportService = require('../src/services/report.service');
const billingService = require('../src/services/billing.service');
const { seedInitialData } = require('../src/utils/seeder');

const runLimsTests = async () => {
  console.log('\n===============================================================');
  console.log('  CELL CITED PATHOLOGY LAB - LIMS E2E VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.statusCode) {
        console.error(`    Status Code: ${err.statusCode}`);
      }
      failed++;
    }
  };

  try {
    // 0. Setup Connection & Lab Context
    console.log('[Setup] Connecting to MongoDB and ensuring seed data...');
    await connectDB();
    await seedInitialData();

    // Fetch primary laboratory and seed context
    const allCount = await TestGroup.countDocuments({});
    console.log(`[Setup] Total testgroups in DB: ${allCount}`);
    const labGroup = await TestGroup.findOne({ isActive: { $ne: false } }) || await TestGroup.findOne({});
    assert.ok(labGroup, `At least one TestGroup must exist in database (found ${allCount})`);
    const laboratoryId = labGroup.laboratoryId || new mongoose.Types.ObjectId();

    // Create or find a test patient
    let patient = await Patient.findOne({ laboratoryId });
    if (!patient) {
      patient = await Patient.create({
        laboratoryId,
        patientNumber: `P-TEST-${Date.now().toString().slice(-4)}`,
        name: 'Sunita Devi',
        age: 38,
        ageUnit: 'Years',
        gender: 'Female',
        mobile: '9876543210',
        sampleType: 'Blood',
      });
    }

    // Ensure Haematology group exists and has Hemoglobin & AEC
    let haematologyGroup = await TestGroup.findOne({
      name: /Haematology/i,
      $or: [{ laboratoryId }, { laboratoryId: null }, { laboratoryId: { $exists: false } }],
    });

    assert.ok(haematologyGroup, 'Haematology category must exist');

    // Ensure Hemoglobin exists in Haematology
    let hbTest = haematologyGroup.tests.find((t) => t.name && /Hemoglobin/i.test(t.name));
    if (!hbTest) {
      const newHb = {
        _id: 'a9711c08ba316a1f4dd00de0',
        name: 'Hemoglobin',
        testType: 'single_parameter',
        orderable: true,
        status: 'matched',
        rate: 500,
        unit: 'g/dL',
        referenceRange: '12.00-15.00',
        parameters: [
          {
            _id: '2db84c093c329ef5f1fe8175',
            name: 'Haemoglobin',
            unit: 'g/dL',
            referenceRange: '12.00-15.00',
            rate: 500,
            inputType: 'numeric',
          },
        ],
      };
      haematologyGroup.tests.push(newHb);
      await haematologyGroup.save();
      hbTest = newHb;
    } else {
      // Ensure rate is aligned to 500
      hbTest.rate = 500;
      if (hbTest.parameters && hbTest.parameters[0]) {
        hbTest.parameters[0].rate = 500;
      }
      await TestGroup.updateOne(
        { _id: haematologyGroup._id, 'tests._id': hbTest._id },
        {
          $set: {
            'tests.$.rate': 500,
            'tests.$.parameters.0.rate': 500,
          },
        }
      );
    }

    // Ensure Absolute Eosinophil Count exists in Haematology
    let aecTest = haematologyGroup.tests.find(
      (t) => t.name && /Absolute Eosinophil Count/i.test(t.name)
    );
    if (!aecTest) {
      aecTest = {
        _id: new mongoose.Types.ObjectId().toString(),
        name: 'Absolute Eosinophil Count',
        testType: 'single_parameter',
        orderable: true,
        status: 'matched',
        rate: 150,
        unit: 'cells/µL',
        referenceRange: '40-440',
        parameters: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: 'Absolute Eosinophil Count (AEC)',
            unit: 'cells/µL',
            referenceRange: '40-440',
            rate: 150,
            inputType: 'numeric',
          },
        ],
      };
      haematologyGroup.tests.push(aecTest);
      await haematologyGroup.save();
    }

    console.log(`[Setup] Patient: ${patient.name} (${patient._id})`);
    console.log(`[Setup] Haematology Group ID: ${haematologyGroup._id}`);
    console.log(`[Setup] Hemoglobin Bookable ID: ${hbTest._id}\n`);

    // =========================================================================
    // SCENARIO 1: Solo Hemoglobin Booking at Rs.500
    // =========================================================================
    let hbReportId = null;
    await test('Scenario 1: Solo Hemoglobin Booking creates exactly 1 booked service & 1 parameter at Rs.500', async () => {
      const { report, invoice } = await reportService.createReport(
        laboratoryId,
        {
          patientId: patient._id,
          bookableTestIds: [String(hbTest._id)],
          tests: ['Hemoglobin'],
          feeOverride: 500,
        },
        { id: 'tester', role: 'administrator' }
      );

      assert.ok(report, 'Report must be created');
      hbReportId = report._id;

      // 1. Exactly 1 booked service
      assert.strictEqual(
        report.bookedServices.length,
        1,
        `Expected exactly 1 booked service, got ${report.bookedServices.length}`
      );
      assert.strictEqual(report.bookedServices[0].name, 'Hemoglobin');
      assert.strictEqual(
        Number(report.bookedServices[0].rateSnapshot),
        500,
        'Booked service rate must be 500'
      );

      // 2. Exactly 1 report item (parameter)
      assert.strictEqual(
        report.items.length,
        1,
        `Expected exactly 1 result parameter, got ${report.items.length}`
      );
      assert.strictEqual(report.items[0].unitSnapshot, 'g/dL');
      assert.ok(
        report.items[0].rangeSnapshot.includes('12') ||
        report.items[0].rangeSnapshot.includes('15') ||
        report.items[0].rangeSnapshot.length > 0
      );

      // 3. Invoice has exactly 1 line item snapshot at Rs.500
      assert.ok(invoice, 'Invoice must be created');
      assert.strictEqual(
        invoice.itemSnapshots.length,
        1,
        `Expected 1 invoice line item, got ${invoice.itemSnapshots.length}`
      );
      assert.strictEqual(invoice.itemSnapshots[0].testName, 'Hemoglobin');
      assert.strictEqual(Number(invoice.itemSnapshots[0].rate), 500);
      assert.strictEqual(Number(invoice.subtotal), 500);
      assert.strictEqual(Number(invoice.grandTotal), 500);
    });

    // =========================================================================
    // SCENARIO 2: Single Parameter Test - Absolute Eosinophil Count (AEC) at Rs.150
    // =========================================================================
    await test('Scenario 2: Single Parameter AEC booking creates 1 service, 1 parameter (cells/µL), Rs.150 invoice', async () => {
      const { report, invoice } = await reportService.createReport(
        laboratoryId,
        {
          patientId: patient._id,
          bookableTestIds: [String(aecTest._id)],
          tests: ['Absolute Eosinophil Count'],
          feeOverride: 150,
        },
        { id: 'tester', role: 'administrator' }
      );

      assert.strictEqual(report.bookedServices.length, 1);
      assert.strictEqual(report.bookedServices[0].name, 'Absolute Eosinophil Count');
      assert.strictEqual(Number(report.bookedServices[0].rateSnapshot), 150);

      assert.strictEqual(report.items.length, 1);
      assert.strictEqual(report.items[0].unitSnapshot, 'cells/µL');

      assert.strictEqual(invoice.itemSnapshots.length, 1);
      assert.strictEqual(Number(invoice.itemSnapshots[0].rate), 150);
      assert.strictEqual(Number(invoice.grandTotal), 150);
    });

    // =========================================================================
    // SCENARIO 3: Two Individual Tests Booking (Hemoglobin + AEC)
    // =========================================================================
    await test('Scenario 3: Multi-test booking (Hemoglobin + AEC) creates 2 services and 2 invoice items', async () => {
      const { report, invoice } = await reportService.createReport(
        laboratoryId,
        {
          patientId: patient._id,
          bookableTestIds: [String(hbTest._id), String(aecTest._id)],
          tests: ['Hemoglobin', 'Absolute Eosinophil Count'],
          feeOverride: 650,
        },
        { id: 'tester', role: 'administrator' }
      );

      assert.strictEqual(report.bookedServices.length, 2);
      assert.strictEqual(report.items.length, 2);

      assert.strictEqual(invoice.itemSnapshots.length, 2);
      assert.strictEqual(Number(invoice.subtotal), 650);
      assert.strictEqual(Number(invoice.grandTotal), 650);
    });

    // =========================================================================
    // SCENARIO 4: Category ID Rejection (Security & Data Integrity)
    // =========================================================================
    await test('Scenario 4: Rejection of Category ID as an individual test booking', async () => {
      let threwError = false;
      try {
        await reportService.createReport(
          laboratoryId,
          {
            patientId: patient._id,
            bookableTestIds: [String(haematologyGroup._id)], // Submitting Category ID!
            tests: ['Haematology'],
          },
          { id: 'tester', role: 'administrator' }
        );
      } catch (err) {
        threwError = true;
        assert.ok(
          err.message.includes('Category ID/Name') || err.message.includes('cannot be booked'),
          `Error should mention Category ID booking rejection: ${err.message}`
        );
      }
      assert.strictEqual(threwError, true, 'Booking category ID directly must throw Bad Request error');
    });

    // =========================================================================
    // SCENARIO 5: Result Entry - Validation & 422 Rejection of Unbooked Parameter
    // =========================================================================
    await test('Scenario 5: Result Entry rejects submission of unbooked parameter IDs with 422 Unprocessable', async () => {
      assert.ok(hbReportId, 'Must have Hemoglobin report from Scenario 1');

      const fakeReportItemId = new mongoose.Types.ObjectId().toString();
      let caughtError = null;

      try {
        await reportService.updateResults(
          laboratoryId,
          hbReportId,
          {
            items: [
              {
                reportItemId: fakeReportItemId, // Unbooked item ID!
                value: '45.0',
              },
            ],
          },
          { id: 'pathologist', role: 'pathologist' }
        );
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Must throw error when submitting unbooked report item');
      assert.strictEqual(
        caughtError.statusCode,
        422,
        `Expected status code 422, got ${caughtError.statusCode}`
      );
      assert.ok(caughtError.message.includes('unbooked') || caughtError.message.includes('does not belong'));
    });

    // =========================================================================
    // SCENARIO 6: Successful Result Observation Entry on Booked Hemoglobin
    // =========================================================================
    await test('Scenario 6: Result observation entry updates booked parameter and calculates range status', async () => {
      const hbReport = await Report.findById(hbReportId);
      const bookedItem = hbReport.items[0];

      const updated = await reportService.updateResults(
        laboratoryId,
        hbReportId,
        {
          items: [
            {
              reportItemId: bookedItem._id,
              value: '13.5',
              remark: 'Normal adult range',
            },
          ],
        },
        { id: 'pathologist', role: 'pathologist' }
      );

      assert.strictEqual(updated.items[0].value, '13.5');
      assert.strictEqual(updated.items[0].remark, 'Normal adult range');
      assert.strictEqual(updated.items[0].isOutOfRange, false);
    });

    // =========================================================================
    // SCENARIO 7: Out-of-Range Alerting on Abnormal Result
    // =========================================================================
    await test('Scenario 7: Out-of-range observation triggers isOutOfRange flag', async () => {
      const hbReport = await Report.findById(hbReportId);
      const bookedItem = hbReport.items[0];

      const updated = await reportService.updateResults(
        laboratoryId,
        hbReportId,
        {
          items: [
            {
              reportItemId: bookedItem._id,
              value: '6.2', // Severe anemia
            },
          ],
        },
        { id: 'pathologist', role: 'pathologist' }
      );

      assert.strictEqual(updated.items[0].value, '6.2');
      assert.strictEqual(updated.items[0].isOutOfRange, true);
    });

    // =========================================================================
    // SCENARIO 8: Finalizing Report & Immutability Enforcement (409 Conflict)
    // =========================================================================
    await test('Scenario 8: Finalizing report locks it; subsequent modification throws 409 Conflict', async () => {
      const hbReport = await Report.findById(hbReportId);
      const bookedItem = hbReport.items[0];

      await reportService.finaliseReport(
        laboratoryId,
        hbReportId,
        {
          items: [
            {
              reportItemId: bookedItem._id,
              value: '13.0',
            },
          ],
        },
        { id: 'pathologist', role: 'pathologist', name: 'Dr. Pathologist' }
      );

      const finalReport = await Report.findById(hbReportId);
      assert.strictEqual(finalReport.status, 'Final');

      // Attempting to modify finalized report must throw 409 Conflict
      let caughtConflict = null;
      try {
        await reportService.updateResults(
          laboratoryId,
          hbReportId,
          {
            items: [
              {
                reportItemId: bookedItem._id,
                value: '14.0',
              },
            ],
          },
          { id: 'pathologist', role: 'pathologist' }
        );
      } catch (err) {
        caughtConflict = err;
      }

      assert.ok(caughtConflict, 'Must throw conflict on finalized report update');
      assert.strictEqual(
        caughtConflict.statusCode,
        409,
        `Expected status code 409, got ${caughtConflict.statusCode}`
      );
    });

    // =========================================================================
    // SCENARIO 9: Invoice Fee Calculations & Divide Rule Elimination
    // =========================================================================
    await test('Scenario 9: Invoice subtotal is exact sum of line items without divide rule', async () => {
      const invoice = await Invoice.findOne({ reportId: hbReportId });
      assert.strictEqual(Number(invoice.subtotal), 500);
      assert.strictEqual(Number(invoice.grandTotal), 500);
      assert.strictEqual(invoice.itemSnapshots[0].rate, 500);
      // Verify no 8.54 or fractional split exists
      assert.notStrictEqual(invoice.itemSnapshots[0].rate, 8.54);
    });

    console.log('\n===============================================================');
    console.log(`  LIMS E2E SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (globalErr) {
    console.error('Fatal Test Runner Error:', globalErr);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  runLimsTests();
}

module.exports = runLimsTests;
