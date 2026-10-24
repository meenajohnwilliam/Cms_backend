
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


router.post("/:projectId/config",
  authMiddleware, roleMiddleware("ADMIN"),
  connectGateway
);

router.post("/projects/:projectId/test",
      authMiddleware, roleMiddleware("ADMIN"),
    testWebhookConnection
    );

router.post("/projects/:projectId/test-order",
  authMiddleware, roleMiddleware("ADMIN"),
  createTestOrder
);

router.get("/projects/:projectId/status",
  authMiddleware, roleMiddleware("ADMIN"),
  getGatewayStatus
);





module.exports = router;