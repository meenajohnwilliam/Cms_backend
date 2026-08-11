// services/email.service.js

const { Resend } = require("resend");
const config = require("../../config/config");

const resend = new Resend(
  config.resend.apiKey
);

const sendVerificationEmail = async (
  email,
  name,
  otp
) => {
  await resend.emails.send({
    from: config.resend.fromEmail,

    to: email,

    subject: "Verify your email",

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 30px;
      ">
        <h2>Hello ${name},</h2>

        <p>
          Thank you for registering.
          Please use the OTP below to verify your email address.
        </p>

        <div style="
          margin: 30px 0;
          text-align: center;
        ">
          <span style="
            display: inline-block;
            padding: 15px 25px;
            background: #f4f4f4;
            border-radius: 8px;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
          ">
            ${otp}
          </span>
        </div>

        <p>
          This OTP will expire in 10 minutes.
        </p>

        <p>
          Do not share this OTP with anyone.
        </p>

        <p>
          If you did not create this account,
          you can safely ignore this email.
        </p>
      </div>
    `,
  });
};

module.exports = {
  sendVerificationEmail,
};