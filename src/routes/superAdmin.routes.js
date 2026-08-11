const express = require("express")
const { createSuperAdmin } = require("../controllers/superAdmin.controller")
const router = express.Router()

router.post("/create",createSuperAdmin)

module.exports=router