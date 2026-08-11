
const express = require("express")
const {adminRegister,verifyEmail,
    //    userRegister,
       login } = require("../controllers/auth.controller");
  
const router = express.Router();
  
router.post("/register",adminRegister);
router.get("/verify-email", verifyEmail);
// router.post("/user/register",userRegister);
router.post("/login",login);

module.exports = router