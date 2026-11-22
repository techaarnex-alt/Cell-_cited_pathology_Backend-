const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Send OTP for Password Reset using EmailJS REST API
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email
 * @param {string} params.toName - Recipient full name
 * @param {string} params.otp - 6-digit OTP string
 * @returns {Promise<{ sent: boolean, devMode?: boolean, message: string, otp?: string }>}
 */
const sendOtpEmail = async ({ toEmail, toName, otp }) => {
  const isConfigured = Boolean(
    env.EMAILJS_SERVICE_ID &&
    env.EMAILJS_TEMPLATE_ID &&
    env.EMAILJS_PUBLIC_KEY
  );

  const templateParams = {
    to_email: toEmail,
    email: toEmail,
    to_name: toName || 'User',
    name: toName || 'User',
    otp: String(otp),
    passcode: String(otp),
    expiry_minutes: 10,
    expiry: '10 minutes',
    message: `Your OTP for password reset is ${otp}. Valid for 10 minutes. Please do not share this OTP with anyone.`,
    laboratory_name: 'Cell Cited Pathology Lab (CCPL)',
  };

  const payload = {
    service_id: env.EMAILJS_SERVICE_ID,
    template_id: env.EMAILJS_TEMPLATE_ID,
    user_id: env.EMAILJS_PUBLIC_KEY,
    ...(env.EMAILJS_PRIVATE_KEY ? { accessToken: env.EMAILJS_PRIVATE_KEY } : {}),
    template_params: templateParams,
  };

  if (!isConfigured) {
    logger.warn('[EmailService] EmailJS credentials not set in .env. OTP generated in dev/test mode:', {
      toEmail,
      otp,
    });
    return {
      sent: false,
      devMode: true,
      message: 'EmailJS credentials not configured in .env; OTP logged to server console for testing.',
      otp: env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CellCitedPathology/1.0',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.error('[EmailService] EmailJS API responded with error', {
        status: response.status,
        response: responseText,
      });
      // In dev mode, return fallback info instead of blocking developer
      if (env.NODE_ENV === 'development') {
        logger.warn('[EmailService] Dev mode fallback: OTP is ' + otp);
        return {
          sent: false,
          devMode: true,
          error: responseText || response.statusText,
          message: 'EmailJS failed; falling back to dev mode OTP logging.',
          otp,
        };
      }
      throw new Error(`EmailJS sending failed (${response.status}): ${responseText || response.statusText}`);
    }

    logger.info('[EmailService] OTP email sent successfully via EmailJS', { toEmail });
    return {
      sent: true,
      devMode: false,
      message: 'OTP email sent successfully via EmailJS.',
    };
  } catch (error) {
    logger.error('[EmailService] EmailJS request failed', error);
    if (env.NODE_ENV === 'development') {
      logger.warn('[EmailService] Dev mode fallback: OTP is ' + otp);
      return {
        sent: false,
        devMode: true,
        error: error.message,
        message: 'EmailJS request failed; OTP available for dev testing.',
        otp,
      };
    }
    throw error;
  }
};

module.exports = {
  sendOtpEmail,
};
