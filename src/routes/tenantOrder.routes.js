const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");
const  clientRecordAccess = require("../middleware/clientRecordAccess.middleware")


const {
  createOrder,
//   getTenantOrders,
  getOrders
} = require("../controllers/tenantOrder.controller");

// Create a payment order
router.post("/", createOrder);

// Get tenant orders with pagination
// router.get("/", getTenantOrders);
router.get("/:projectId", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN","USER"), getOrders);

module.exports = router;