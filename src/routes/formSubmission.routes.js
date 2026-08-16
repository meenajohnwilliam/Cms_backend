// src/routes/formSubmission.routes.js

const express = require("express");

const {
  getFormSubmissions,
  getFormSubmission,
  deleteFormSubmission,
} = require("../controllers/formSubmission.controller");

const authMiddleware = require("../middleware/auth.middleware");

const roleMiddleware = require("../middleware/role.middleware");

const clientRecordAccess = require("../middleware/clientRecordAccess.middleware")  

const router = express.Router();

// ============================================================
// GET ALL SUBMISSIONS
// ============================================================

router.get(
  "/:formId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  clientRecordAccess,
  getFormSubmissions
);

// ============================================================
// GET SINGLE SUBMISSION
// ============================================================

router.get(
  "/:submissionId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  clientRecordAccess,
  getFormSubmission
);

// ============================================================
// DELETE SUBMISSION
// ============================================================

router.delete(
  "/:submissionId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  clientRecordAccess,
  deleteFormSubmission
);

module.exports = router;