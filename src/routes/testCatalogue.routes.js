const express = require('express');
const router = express.Router();
const testCatalogueController = require('../controllers/testCatalogue.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

// Categories overview & dynamic counts
router.get('/categories', authenticate, testCatalogueController.getCategories);

// 3-Level Reordering: Level 1 - Categories
router.put(
  '/categories/reorder',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.reorderCategories
);

// 3-Level Reordering: Level 2 - Tests within a category
router.put(
  '/categories/:category/reorder',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.reorderCategoryTests
);

// 3-Level Reordering: Level 3 - Parameters within a test
router.put(
  '/tests/:testId/parameters/reorder',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.reorderTestParameters
);

// Parameter CRUD
router.post(
  '/tests/:testId/parameters',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.addParameter
);

router.put(
  '/tests/:testId/parameters/:paramId',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.updateParameter
);

router.delete(
  '/tests/:testId/parameters/:paramId',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.removeParameter
);

// Test CRUD & Details
router.get('/tests/:testId', authenticate, testCatalogueController.getTestById);

router.put(
  '/tests/:testId',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.updateTest
);

router.delete(
  '/tests/:testId',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.deleteTest
);

// Create test in category
router.post(
  '/categories/:category/tests',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testCatalogueController.createTest
);

// Category tests listing (All or by category)
router.get('/categories/:category/tests', authenticate, testCatalogueController.getCategoryTests);

// Default fallback list for root or all
router.get('/tests', authenticate, testCatalogueController.getCategoryTests);

module.exports = router;
