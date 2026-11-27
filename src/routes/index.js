const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const patientRoutes = require('./patient.routes');
const doctorRoutes = require('./doctor.routes');
const testRoutes = require('./test.routes');
const testGroupRoutes = require('./testGroup.routes');
const testCatalogueRoutes = require('./testCatalogue.routes');
const reportRoutes = require('./report.routes');
const documentRoutes = require('./document.routes');
const billingRoutes = require('./billing.routes');
const dashboardRoutes = require('./dashboard.routes');
const healthRoutes = require('./health.routes');
const laboratoryRoutes = require('./laboratory.routes');

// Mount API v1 modules
router.use('/auth', authRoutes);
router.use('/', authRoutes); // Exposes /api/v1/me
router.use('/patients', patientRoutes);
router.use('/doctors', doctorRoutes);
router.use('/tests', testRoutes);
router.use('/test-groups', testGroupRoutes);
router.use('/test-catalogue', testCatalogueRoutes);
router.use('/reports', reportRoutes);
router.use('/documents', documentRoutes);
router.use('/laboratory', laboratoryRoutes);
router.use('/', billingRoutes); // Exposes /api/v1/invoices and /api/v1/billing/summary
router.use('/dashboard', dashboardRoutes);
router.use('/', healthRoutes); // Exposes /api/v1/health

module.exports = router;
