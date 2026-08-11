// routes/plan.routes.js

const express = require("express");

const {
  createPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan,
} = require("../controllers/plan.controller");


const router = express.Router();

router.post("/", createPlan);

router.get("/", getPlans);

router.get("/:planId", getPlan);

router.put("/:planId", updatePlan);

router.delete("/:planId", deletePlan);

module.exports = router;