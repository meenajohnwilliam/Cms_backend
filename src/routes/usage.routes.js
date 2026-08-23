const express = require("express");
const router = express.Router();

const {
  getUsage,
} = require("../controllers/usage.controller");

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

// ========================================================
// GET TENANT USAGE
// ========================================================

router.get(
  "/details",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  getUsage
);

module.exports = router;