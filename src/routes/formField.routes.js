// src/routes/formField.routes.js

const express = require("express");

const {
  createFormField,
  getFormFields,
  getFormField,
  updateFormField,
  deleteFormField,
} = require("../controllers/formField.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

const router = express.Router();


// ============================================================
// CREATE FIELD
// ============================================================

router.post(
  "/fields/forms/:formId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createFormField
);


// ============================================================
// GET ALL FIELDS
// ============================================================

router.get(
  "/fields/forms/:formId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getFormFields
);


// ============================================================
// GET SINGLE FIELD
// ============================================================

router.get(
  "/:fieldId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getFormField
);


// ============================================================
// UPDATE FIELD
// ============================================================

router.put(
  "/:fieldId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  updateFormField
);


// ============================================================
// DELETE FIELD
// ============================================================

router.delete(
  "/:fieldId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  deleteFormField
);


module.exports = router;