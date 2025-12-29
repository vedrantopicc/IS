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

// ✅ Nova funkcija za odobrenje organizatora
export async function sendOrganizerApprovalEmail(email, username) {
  const dashboardUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "StudLife – Vaš zahtjev za organizatora je odobren!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
        <h2 style="color: #0d6efd; text-align: center;">Čestitamo, ${username}!</h2>
        <p style="font-size: 16px; color: #333;">
          Vaš zahtjev da postanete <strong>organizator</strong> je uspješno odobren od strane administratora.
        </p>
        <p style="font-size: 16px; color: #333;">
          Sada možete:
        </p>
        <ul style="font-size: 16px; color: #333; padding-left: 20px;">
          <li>Kreirati i upravljati svojim događajima</li>
          <li>Pratiti rezervacije i prodaju ulaznica</li>
          <li>Pristupiti svom organizer dashboardu</li>
        </ul>
        <p style="margin-top: 20px; text-align: center;">
          <a href="${dashboardUrl}" 
             style="display: inline-block; padding: 10px 20px; background-color: #0d6efd; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Idi na Dashboard
          </a>
        </p>
        <hr style="margin: 20px 0; border-color: #ddd;">
        <p style="font-size: 14px; color: #666; text-align: center;">
          Ovo je automatska poruka. Molimo Vas da ne odgovarate na nju.
        </p>
      </div>
    `,
  });
}

// ✅ Funkcija za odbijanje zahtjeva
export async function sendOrganizerRejectionEmail(email, username) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "StudLife – Vaš zahtjev za organizatora je odbijen",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fff9f9;">
        <h2 style="color: #d32f2f; text-align: center;">Poštovani, ${username}</h2>
        <p style="font-size: 16px; color: #333;">
          Žao nam je, ali Vaš zahtjev da postanete <strong>organizator</strong> nije odobren od strane administratora.
        </p>
        <p style="font-size: 16px; color: #333;">
          Možete ponovo poslati zahtjev u budućnosti.
        </p>
        <p style="margin-top: 20px; text-align: center; color: #d32f2f;">
          Hvala na interesovanju za StudLife platformu!
        </p>
        <hr style="margin: 20px 0; border-color: #ddd;">
        <p style="font-size: 14px; color: #666; text-align: center;">
          Ovo je automatska poruka. Molimo Vas da ne odgovarate na nju.
        </p>
      </div>
    `,
  });
}