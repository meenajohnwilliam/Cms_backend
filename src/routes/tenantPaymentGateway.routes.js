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



// const express = require("express");
// const router = express.Router();

// const {
//   connectGateway,
//   createTestOrder,
//   getGatewayStatus,
// } = require("../controllers/tenantPaymentGateway.controller");

// const authTenant = require("../middleware/auth.middleware");

// router.post("/connect", authTenant, connectGateway);
// router.post("/test-order", authTenant, createTestOrder);
// router.get("/status", authTenant, getGatewayStatus);

// module.exports = router;


const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const {
  connectGateway,
  createTestOrder,
  getGatewayStatus,
  triggerDummyPaymentCaptured

} = require("../controllers/tenantPaymentGateway.controller");


router.post("/config",
//   authMiddleware, roleMiddleware("ADMIN"),
  connectGateway
);

// router.post("/webhook-test",testWebhookConnection)

router.post("/test-order",
//   authMiddleware, roleMiddleware("ADMIN"),
  createTestOrder
);

router.get("/status",
  authMiddleware, roleMiddleware("ADMIN"),
  getGatewayStatus
);

router.get("/test",
//   authMiddleware, roleMiddleware("ADMIN"),
triggerDummyPaymentCaptured
);


module.exports = router;