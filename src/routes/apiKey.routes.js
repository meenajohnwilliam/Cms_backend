// src/routes/apiKey.routes.js

const express = require("express");

const {
  createApiKey,
  getApiKeys,
  getApiKey,
  revokeApiKey,
  activateApiKey,
  deleteApiKey,
} = require("../controllers/apiKey.controller");

// const authMiddleware =
//   require("../middleware/auth.middleware");

// const roleMiddleware =
//   require("../middleware/role.middleware");

const router = express.Router();

// ============================================================
// CREATE API KEY
// ============================================================

router.post(
  "/projects/:projectId",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  createApiKey
);

// ============================================================
// GET ALL API KEYS
// ============================================================

router.get(
  "/projects/:projectId",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  getApiKeys
);

// ============================================================
// GET SINGLE API KEY
// ============================================================

router.get(
  "/:apiKeyId",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  getApiKey
);

// ============================================================
// REVOKE API KEY
// ============================================================

router.put(
  "/:apiKeyId/revoke",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  revokeApiKey
);

// ============================================================
// ACTIVATE API KEY
// ============================================================

router.put(
  "/:apiKeyId/activate",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  activateApiKey
);

// ============================================================
// DELETE API KEY
// ============================================================

router.delete(
  "/:apiKeyId",
//   authMiddleware,
//   roleMiddleware("ADMIN"),
  deleteApiKey
);

module.exports = router;