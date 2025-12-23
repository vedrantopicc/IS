// backend/utils/emailService.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "StudLife – Reset lozinke",
    html: `
      <p>Zaboravili ste lozinku?</p>
      <p>Kliknite na link da biste je resetovali:</p>
      <a href="${resetUrl}" target="_blank" 
         style="display:inline-block; padding:10px 20px; background:#0d6efd; color:white; text-decoration:none; border-radius:4px;">
        Resetuj lozinku
      </a>
      <p>Link važi 30 minuta.</p>
    `,
  });
}