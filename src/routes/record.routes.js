// src/routes/record.routes.js

const express = require("express");

const {
  createRecord,
  getRecords,
  getRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/record.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

const router = express.Router();

router.post(
  "/collections/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createRecord
);

router.get(
  "/collections/:collectionId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  getRecords
);

router.get(
  "/:recordId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  getRecord
);

router.put(
  "/:recordId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  updateRecord
);

router.delete(
  "/:recordId",
  authMiddleware,
  roleMiddleware("ADMIN","USER"),
  deleteRecord
);

module.exports = router;