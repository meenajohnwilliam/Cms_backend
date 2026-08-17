// src/routes/form.routes.js

const express = require("express");

const {
  createForm,
  getForms,
  getForm,
  updateForm,
  deleteForm,
  publishForm,
  unpublishForm,
} = require("../controllers/form.controller");

const authMiddleware = require("../middleware/auth.middleware");

const roleMiddleware = require("../middleware/role.middleware");

const router = express.Router();


// ============================================================
// CREATE FORM
// ============================================================

router.post(
  "/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createForm
);


// ============================================================
// GET ALL FORMS
// ============================================================

router.get(
  "/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  getForms
);


// ============================================================
// GET SINGLE FORM
// ============================================================

router.get(
  "/:formId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  getForm
);


// ============================================================
// UPDATE FORM
// ============================================================

router.put(
  "/:formId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  updateForm
);


// ============================================================
// DELETE FORM
// ============================================================

router.delete(
  "/:formId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  deleteForm
);


// ============================================================
// PUBLISH FORM
// ============================================================

router.patch(
  "/:formId/publish",
  authMiddleware,
  roleMiddleware("ADMIN"),
  publishForm
);


// ============================================================
// UNPUBLISH FORM
// ============================================================

router.patch(
  "/:formId/unpublish",
  authMiddleware,
  roleMiddleware("ADMIN"),
  unpublishForm
);


module.exports = router;