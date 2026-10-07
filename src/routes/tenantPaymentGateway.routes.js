const express = require("express");

const authMiddleware = require("../middleware/auth.middleware");

const {
  updateTenantPaymentGateway,
  getTenantPaymentGatewayWebhook,
  checkRazorpayWebhook,
  handleRazorpayWebhook,
} = require("../controllers/tenantPaymentGateway.controller");

const router = express.Router();

// ============================================================
// TENANT PAYMENT GATEWAY
// ============================================================

router.put(
  "/config",
//   authMiddleware,
  updateTenantPaymentGateway
);

router.get(
  "/",
  authMiddleware,
  getTenantPaymentGatewayWebhook
);

router.post(
  "/razorpay/test",
  authMiddleware,
  checkRazorpayWebhook
);

// ============================================================
// PUBLIC RAZORPAY WEBHOOK
// ============================================================

router.post(
  "/public/payments/razorpay/webhook/:tenantId",
  handleRazorpayWebhook
);

module.exports = router;