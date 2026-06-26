// src/services/email.service.js

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"My App" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Mail Sent:", info.messageId);

    return info;
  } catch (error) {
    console.log("Mail Error:", error);
    throw error;
  }
};
