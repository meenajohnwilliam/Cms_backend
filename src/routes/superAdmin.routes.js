const express = require("express")
const { createSuperAdmin,getDashboard } = require("../controllers/superAdmin.controller")

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware"); 
const router = express.Router()
  
    
  router.post("/create",createSuperAdmin)
  
  // ============================================================
  // SUPER ADMIN DASHBOARD
  // ============================================================
  
  router.get(
    "/dashboard",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getDashboard
  );
  


module.exports=router