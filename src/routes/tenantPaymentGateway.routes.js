// const express = require("express");

// const authMiddleware = require("../middleware/auth.middleware");

// const {
//   updateTenantPaymentGateway,
//   getTenantPaymentGatewayWebhook,
//   checkRazorpayWebhook,
//   handleRazorpayWebhook,
// } = require("../controllers/tenantPaymentGateway.controller");

// const router = express.Router();

// // ============================================================
// // TENANT PAYMENT GATEWAY
// // ============================================================

// router.put(
//   "/config",
// //   authMiddleware,
//   updateTenantPaymentGateway
// );

// router.get(
//   "/",
//   authMiddleware,
//   getTenantPaymentGatewayWebhook
// );

// router.post(
//   "/razorpay/test",
//   authMiddleware,
//   checkRazorpayWebhook
// );

// // ============================================================
// // PUBLIC RAZORPAY WEBHOOK
// // ============================================================

// router.post(
//   "/public/payments/razorpay/webhook/:tenantId",
//   handleRazorpayWebhook
// );

// module.exports = router;



const express = require("express");

const {
  updateRazorpayConfig,
  getRazorpayConfig,
  testRazorpayConnection,
  razorpayWebhook,
} = require("../controllers/tenantPaymentGateway.controller")
const authMiddleware =
  require("../middleware/auth.middleware");

const router = express.Router();


// ============================================================
// GET RAZORPAY CONFIG
// ============================================================

router.get(
  "/config",
//   authMiddleware,
  getRazorpayConfig
);


// ============================================================
// SAVE / UPDATE RAZORPAY CONFIG
// ============================================================

router.put(
  "/config",
//   authMiddleware,
  updateRazorpayConfig
);


// ============================================================
// TEST RAZORPAY CONNECTION
// ============================================================

router.post(
  "/tenant/razorpay/test",
//   authMiddleware,
  testRazorpayConnection
);


// ============================================================
// RAZORPAY WEBHOOK
// ============================================================

router.post(
  "/razorpay",
  express.raw({
    type: "application/json",
  }),
  razorpayWebhook
);


module.exports = router;