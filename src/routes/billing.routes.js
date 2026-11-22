const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const {
  createInvoiceSchema,
  recordPaymentSchema,
  queryInvoiceSchema,
} = require('../validators/billing.validator');

/**
 * @openapi
 * /api/v1/invoices:
 *   get:
 *     summary: List invoices
 *     description: Retrieve all patient billing invoices and outstanding balances.
 *     tags:
 *       - Invoices & Billing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Pending, Partial, Paid] }
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 *   post:
 *     summary: Create invoice
 *     tags:
 *       - Invoices & Billing
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportId]
 *             properties:
 *               reportId: { type: string }
 *               total: { type: number }
 *     responses:
 *       201:
 *         description: Invoice created successfully
 */
router.get(
  '/invoices',
  authenticate,
  validateRequest(queryInvoiceSchema, 'query'),
  billingController.getInvoices
);

router.post(
  '/invoices',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.BILLING, ROLES.RECEPTIONIST),
  validateRequest(createInvoiceSchema),
  billingController.createInvoice
);

/**
 * @openapi
 * /api/v1/invoices/{id}/payments:
 *   post:
 *     summary: Record invoice payment
 *     description: Append-only payment ledger entry. Server computes balance and rejects any overpayment.
 *     tags:
 *       - Invoices & Billing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentRequest'
 *     responses:
 *       201:
 *         description: Payment recorded successfully
 *       400:
 *         description: Overpayment or invalid payment amount
 */
router.post('/invoices/:id/payments', authenticate, authorize(ROLES.ADMINISTRATOR, ROLES.BILLING, ROLES.RECEPTIONIST),
  validateRequest(recordPaymentSchema),
  billingController.recordPayment
);

/**
 * @openapi
 * /api/v1/billing/summary:
 *   get:
 *     summary: Billing summary dashboard
 *     description: Aggregated total billed, collected, and outstanding balances.
 *     tags:
 *       - Invoices & Billing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
 */
router.get('/billing/summary', authenticate, billingController.getBillingSummary);

module.exports = router;
