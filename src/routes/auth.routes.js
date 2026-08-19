
const express = require("express");

const {
  adminRegister,
  verifyEmail,
  resendOtp,
  login,
  logout,
} = require("../controllers/auth.controller");

const router = express.Router();

router.post(
  "/admin/register",
  adminRegister
);

router.post(
  "/verify-email",
  verifyEmail
);

router.post(
  "/resend-otp",
  resendOtp
);

router.post(
  "/login",
  login
);

router.post(
  "/logout",
  logout
);

module.exports = router;