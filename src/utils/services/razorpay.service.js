// services/razorpay.service.js

const Razorpay = require("razorpay");
const config = require("../../config/config");

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

const createRazorpayPlan = async ({
    name,
    amount,
    period,
    description,
  }) => {
    return await razorpay.plans.create({
      period,
      interval: 1,
      item: {
        name,
        amount: Number(amount) * 100,
        currency: "INR",
        description,
      },
    });
  };

module.exports = {
    razorpay,
    createRazorpayPlan,
  };