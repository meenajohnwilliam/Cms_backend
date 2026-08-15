// src/routes/publicApi.routes.js

const express = require("express");

const {
  getPublicCollection,
} = require("../controllers/publicApi.controller");

const router = express.Router();

// ============================================================
// PUBLIC GET API
// ============================================================

router.get(
  "/:projectSlug/:collectionSlug",
  getPublicCollection
);

module.exports = router;