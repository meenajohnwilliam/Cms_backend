// src/routes/publicApi.routes.js

const express = require("express");
const upload = require("../config/upload")

const {
  getPublicCollection,
  getPublicRecord,
  getPublicForm,
  submitPublicForm,
} = require("../controllers/publicApi.controller");


const router = express.Router();

// ============================================================
// PUBLIC GET COLLECTION API
// ============================================================

router.get(
  "/:projectSlug/:collectionSlug",
  getPublicCollection
);



// ============================================================
// PUBLIC GET SINGLE RECORD API
// ============================================================
// Get one record from a published collection
//
// Example:
// GET /api/v1/my-project/blog/recordId
// ============================================================

router.get(
  "/:projectSlug/:collectionSlug/:recordId",
  getPublicRecord
);

// ============================================================
// PUBLIC GET FORM API
// ============================================================

router.get(
  "/:projectSlug/forms/:formSlug",
  getPublicForm
);

// ============================================================
// PUBLIC SUBMIT FORM API
// ============================================================

router.post(
  "/:projectSlug/forms/:formSlug/submit",
  upload.any(),
  submitPublicForm
);

module.exports = router;