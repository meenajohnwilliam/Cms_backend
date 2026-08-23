// src/routes/collection.routes.js

const express = require("express");

const {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  publishCollection,
  unpublishCollection,
} = require("../controllers/collection.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

const router = express.Router();

// ============================================================
// CREATE
// ============================================================

router.post(
  "/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createCollection
);

// ============================================================
// GET ALL
// ============================================================

router.get(
  "/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getCollections
);

// ============================================================
// GET ONE
// ============================================================

router.get(
  "/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getCollection
);

// ============================================================
// UPDATE
// ============================================================

router.put(
  "/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  updateCollection
);

// ============================================================
// DELETE
// ============================================================

router.delete(
  "/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  deleteCollection
);

// ============================================================
// PUBLISH
// ============================================================

router.put(
  "/:collectionId/publish",
  authMiddleware,
  roleMiddleware("ADMIN"),
  publishCollection
);

// ============================================================
// UNPUBLISH
// ============================================================

router.put(
  "/:collectionId/unpublish",
  authMiddleware,
  roleMiddleware("ADMIN"),
  unpublishCollection
);

module.exports = router;