const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const {
  loginSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate laboratory staff and receive JWT access token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/login', validateRequest(loginSchema), authController.login);

/**
 * @openapi
 * /api/v1/auth/forget-password:
 *   post:
 *     summary: Request password reset OTP
 *     description: Generates a 6-digit OTP, stores its expiration (10 mins), and sends an email via EmailJS.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgetPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP generated and sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       404:
 *         description: Account not found
 */
router.post('/forget-password', validateRequest(forgetPasswordSchema), authController.forgetPassword);
router.post('/forgot-password', validateRequest(forgetPasswordSchema), authController.forgetPassword);

/**
 * @openapi
 * /api/v1/auth/password-reset:
 *   post:
 *     summary: Reset password with OTP
 *     description: Validates the 6-digit OTP and resets the user password.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/password-reset', validateRequest(resetPasswordSchema), authController.resetPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);
router.post('/change-password', validateRequest(resetPasswordSchema), authController.resetPassword);

/**
 * @openapi
 * /api/v1/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     description: Retrieve current user identity, role, and laboratory context.
 *     tags:
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
