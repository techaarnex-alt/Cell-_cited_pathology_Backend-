const request = require('supertest');
const assert = require('assert');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const { seedInitialData } = require('../src/utils/seeder');

const runTests = async () => {
  console.log('\n======================================================');
  console.log('  CELL CITED PATHOLOGY LAB - BACKEND TEST SUITE');
  console.log('======================================================\n');

  let adminToken = '';
  let pathologistToken = '';
  let patientId = '';
  let doctorId = '';
  let testId = '';
  let reportId = '';
  let invoiceId = '';

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.response) {
        console.error(`    Status: ${err.response.status}`);
        console.error(`    Body: ${JSON.stringify(err.response.body)}`);
      }
      failed++;
    }
  };

  try {
    // 1. Database Connection & Seeding
    await test('1. MongoDB Atlas Connection & Seeding', async () => {
      await connectDB();
      await seedInitialData();
    });

    // 2. Health Endpoint
    await test('2. GET /api/v1/health - System Health Check', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'ok');
      assert.strictEqual(res.body.data.database.status, 'connected');
      assert.ok(res.body.meta.requestId);
    });

    // 3. Swagger Endpoints
    await test('3. GET /api-docs.json - OpenAPI 3.0 Specification', async () => {
      const res = await request(app).get('/api-docs.json');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.openapi, '3.0.0');
      assert.ok(Object.keys(res.body.paths).length >= 10);
    });

    // 4. Authentication - Login
    await test('4. POST /api/v1/auth/login - Admin Login with Valid Credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'CCPL@2026' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.strictEqual(res.body.data.user.role, 'administrator');
      adminToken = res.body.data.token;
    });

    await test('5. POST /api/v1/auth/login - Pathologist Login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pathologist', password: 'CCPL@2026' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.user.role, 'pathologist');
      pathologistToken = res.body.data.token;
    });

    await test('6. POST /api/v1/auth/login - Reject Invalid Password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'WrongPassword' });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'AUTHENTICATION_ERROR');
    });

    // 5. Auth - /me
    await test('7. GET /api/v1/me - Profile with Laboratory Context', async () => {
      const res = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.username, 'admin');
      assert.ok(res.body.data.laboratory.name.includes('Cell Cited'));
    });

    // 6. Request Validation
    await test('8. POST /api/v1/patients - Validation Error for Missing Required Fields', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Mr.' }); // Missing name, age, gender

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
    });

    // 7. Doctors API
    await test('9. POST /api/v1/doctors - Create Doctor with Referral Percentage', async () => {
      const res = await request(app)
        .post('/api/v1/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Test Physician',
          specialty: 'Internal Medicine',
          mobile: '9988776655',
          referralPercentage: 40,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.name, 'Dr. Test Physician');
      assert.strictEqual(res.body.data.referralPercentage, 40);
      doctorId = res.body.data._id;
    });

    await test('10. GET /api/v1/doctors - List Doctors with Pagination', async () => {
      const res = await request(app)
        .get('/api/v1/doctors?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.meta.pagination);
    });

    // 8. Tests & Test Groups
    await test('11. GET /api/v1/tests - Catalogue Availability', async () => {
      const res = await request(app)
        .get('/api/v1/tests')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.length >= 10);
      testId = res.body.data[0]._id;
    });

    await test('12. GET /api/v1/test-groups - Curated Panels (e.g. CBC, LFT)', async () => {
      const res = await request(app)
        .get('/api/v1/test-groups')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.length >= 5);
      const cbc = res.body.data.find((g) => g.code === 'CBC');
      assert.ok(cbc);
      assert.ok(cbc.testNames.length > 5);
    });

    // 9. Patients API - Atomic Creation with Test Selection
    await test('13. POST /api/v1/patients - Atomic Patient Registration with CBC Panel', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Mr.',
          name: 'Rohan Sharma',
          age: 32,
          ageUnit: 'Years',
          gender: 'Male',
          mobile: '9876543210',
          address: 'Civil Lines, Barabanki',
          doctorId: doctorId,
          testGroups: ['CBC'],
        });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data.patient);
      assert.ok(res.body.data.report);
      assert.strictEqual(res.body.data.report.status, 'Draft');
      assert.ok(res.body.data.report.items.length >= 5);

      patientId = res.body.data.patient._id;
      reportId = res.body.data.report._id;
    });

    await test('14. GET /api/v1/patients/:id - Demographics & Report History', async () => {
      const res = await request(app)
        .get(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.name, 'Rohan Sharma');
      assert.ok(Array.isArray(res.body.data.reports));
    });

    // 10. Reports API - Results Entry & Biological Range Checks
    await test('15. PATCH /api/v1/reports/:id/results - Save Observation Results', async () => {
      const res = await request(app)
        .patch(`/api/v1/reports/${reportId}/results`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            { testName: 'Haemoglobin', value: '11.2', unit: 'g/dL', referenceRange: '12.00–15.00' },
            { testName: 'Platelet Count', value: '250', unit: 'thou/mm³', referenceRange: '150.00–410.00' },
          ],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'Draft');
      const hb = res.body.data.items.find((i) => i.testNameSnapshot === 'Haemoglobin');
      assert.strictEqual(hb.value, '11.2');
      assert.strictEqual(hb.isOutOfRange, true); // 11.2 is below 12.00
    });

    // 11. Finalization - Reject Incomplete Reports
    await test('16. POST /api/v1/reports/:id/finalize - Reject When Incomplete', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/${reportId}/finalize`)
        .set('Authorization', `Bearer ${pathologistToken}`)
        .send({}); // Missing values for other CBC tests

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INCOMPLETE_REPORT');
    });

    // 12. Finalization - Complete All Observations & Finalize
    await test('17. POST /api/v1/reports/:id/finalize - Authorized Finalization', async () => {
      // First, fill in values for all remaining items in the report
      const rep = await request(app).get(`/api/v1/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`);
      const allItems = rep.body.data.items.map((item) => ({
        reportItemId: item._id,
        testName: item.testNameSnapshot,
        value: item.value || '10.0', // Provide mock observed values
      }));

      const res = await request(app)
        .post(`/api/v1/reports/${reportId}/finalize`)
        .set('Authorization', `Bearer ${pathologistToken}`)
        .send({ items: allItems });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'Final');
      assert.ok(res.body.data.finalisedAt);
    });

    // 13. Immutability - Reject Editing Finalised Report
    await test('18. PATCH /api/v1/reports/:id/results - Reject Modifying Final Report (Immutability)', async () => {
      const res = await request(app)
        .patch(`/api/v1/reports/${reportId}/results`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ testName: 'Haemoglobin', value: '14.0' }],
        });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.error.code, 'REPORT_IMMUTABLE');
    });

    // 14. Controlled Reopen
    await test('19. POST /api/v1/reports/:id/reopen - Controlled Reopening with Reason & Audit', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/${reportId}/reopen`)
        .set('Authorization', `Bearer ${pathologistToken}`)
        .send({
          reason: 'Pathologist review: Repeat CBC requested to verify platelet count consistency.',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'Draft');
      assert.strictEqual(res.body.data.version, 2);
      assert.ok(res.body.data.reopenedAt);
    });

    // 15. Invoices & Payments - Append-Only Ledger & Overpayment Prevention
    await test('20. GET /api/v1/invoices - Invoice Ledger Inspection', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices?reportId=${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.length >= 1);
      invoiceId = res.body.data[0]._id;
    });

    await test('21. POST /api/v1/invoices/:id/payments - Reject Overpayment', async () => {
      const invoiceRes = await request(app).get('/api/v1/invoices').set('Authorization', `Bearer ${adminToken}`);
      const inv = invoiceRes.body.data.find((i) => String(i._id) === String(invoiceId));
      const excessiveAmount = (inv.total || 100) + 5000;

      const res = await request(app)
        .post(`/api/v1/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: excessiveAmount,
          method: 'Cash',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'OVERPAYMENT_NOT_ALLOWED');
    });

    await test('22. POST /api/v1/invoices/:id/payments - Record Valid Partial Payment', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 50,
          method: 'UPI',
          reference: 'UPI-TEST-1234',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.payment.amount, 50);
      assert.strictEqual(res.body.data.invoice.paid, 50);
    });

    // 16. Doctor Earnings - Calculated From Frozen Report Percentage
    await test('23. GET /api/v1/doctors/:id/earnings - Historical Snapshot Earnings', async () => {
      const res = await request(app)
        .get(`/api/v1/doctors/${doctorId}/earnings`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.summary);
      assert.ok(res.body.data.summary.totalEarnings >= 0);
    });

    // 17. Dashboard Stats - Aggregation Pipeline
    await test('24. GET /api/v1/dashboard/stats - Real-Time Dashboard Metrics', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.metrics.registeredPatients >= 1);
      assert.ok(Array.isArray(res.body.data.recentReports));
    });

    // 18. Billing Summary
    await test('25. GET /api/v1/billing/summary - Financial Aggregates', async () => {
      const res = await request(app)
        .get('/api/v1/billing/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.data.totalBilled === 'number');
      assert.ok(typeof res.body.data.totalCollected === 'number');
    });

  } catch (globalErr) {
    console.error('Fatal test execution error:', globalErr);
  } finally {
    await disconnectDB();
    console.log('\n======================================================');
    console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
