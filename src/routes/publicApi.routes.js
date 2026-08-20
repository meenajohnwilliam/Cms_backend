// src/routes/publicApi.routes.js

const express = require("express");
const upload = require("../config/upload")

const {
  getPublicCollection,
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