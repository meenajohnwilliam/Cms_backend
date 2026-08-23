// src/routes/field.routes.js

const express = require("express");

const {
  createField,
  getFields,
  getField,
  updateField,
  deleteField,
} = require("../controllers/field.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

const router = express.Router();

router.post(
  "/collections/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createField
);

router.get(
  "/collections/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getFields
);

router.get(
  "/:fieldId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getField
);

router.put(
  "/:fieldId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  updateField
);

router.delete(
  "/:fieldId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  deleteField
);

module.exports = router;