const express = require("express");
const router = express.Router();

const {
  createOrder,
  getTenantOrders,
} = require("../controllers/tenantOrder.controller");

// Create a payment order
router.post("/", createOrder);

// Get tenant orders with pagination
router.get("/", getTenantOrders);

module.exports = router;