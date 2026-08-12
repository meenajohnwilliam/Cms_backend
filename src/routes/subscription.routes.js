// routes/subscription.routes.js

const express = require("express");

const {
  getCurrentSubscription,
  getAvailablePlans,
  razorpayWebhook
} = require("../controllers/subscription.controller");

// const authMiddleware = require("../middleware/auth.middleware");
// const roleMiddleware = require("../middleware/role.middleware");

const router = express.Router();

router.get(
  "/current/:tenantId",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  getCurrentSubscription
);


router.post(
    "/razorpay/webhook",
  
    express.raw({
      type: "application/json",
    }),
  
    razorpayWebhook
  );

router.get(
  "/plans",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  getAvailablePlans
);

module.exports = router;