const express = require("express");

const {
  getSubscriptionHistory,
  getPaymentHistory,
} = require("../controllers/tenant.controller");

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const router = express.Router();


// ============================================================
// SUBSCRIPTION HISTORY
// ============================================================

router.get(
  "/subscription-history",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getSubscriptionHistory
);


// ============================================================
// PAYMENT HISTORY
// ============================================================

router.get(
  "/payment-history",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getPaymentHistory
);


module.exports = router;