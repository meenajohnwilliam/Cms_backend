
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const {
  connectGateway,
  createTestOrder,
  getGatewayStatus,
  testWebhookConnection,


} = require("../controllers/tenantPaymentGateway.controller");


router.post("/config",
  authMiddleware, roleMiddleware("ADMIN"),
  connectGateway
);

router.post("/test",
    //   authMiddleware, roleMiddleware("ADMIN"),
    testWebhookConnection
    );

router.post("/test-order",
  authMiddleware, roleMiddleware("ADMIN"),
  createTestOrder
);

router.get("/status",
  authMiddleware, roleMiddleware("ADMIN"),
  getGatewayStatus
);






module.exports = router;