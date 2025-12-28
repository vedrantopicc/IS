import { createUser } from "./users-controller.js";
import { pool } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { sendPasswordResetEmail } from "../utils/emailService.js";
import { randomBytes } from "crypto";

export async function register(req, res, _next) {
  try {
    const user = await createUser(req.body ?? {});
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES;

export async function login(req, res, _next) {
  try {
    const { email, username, password } = req.body ?? {};
    if ((!email && !username) || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    const identifier = email || username;
    const [rows] = await pool.query(
      "SELECT id, username, name, surname, email, password, role FROM `user` WHERE email = ? OR username = ? LIMIT 1",
      [identifier, identifier]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const { password: _pw, ...safeUser } = user;

    const jti = uuidv4();

    const payload = {
      sub: String(user.id),
      jti,
      username: user.username,
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    await pool.query("DELETE FROM token WHERE user_id = ?", [user.id]);

    await pool.query(
      "INSERT INTO token (id, user_id, valid, expires_at) VALUES (?, ?, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))",
      [jti, user.id]
    );

    return res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: e.message || "Login failed" });
  }
}

export async function changePassword(req, res, next) {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const [rows] = await pool.query(
      "SELECT id, password FROM `user` WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const user = rows[0];

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE `user` SET password = ? WHERE id = ?", [hash, userId]);

    try {
      await pool.query("UPDATE `token` SET valid = 0 WHERE user_id = ?", [userId]);
    } catch {}

    return res.json({ message: "Password changed" });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const jti = req.user?.jti;
    const userId = req.user?.id;

    if (jti && userId) {
      try {
        await pool.query("DELETE FROM `token` WHERE id = ? AND user_id = ?", [jti, userId]);
      } catch (e) {}
    }

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// === NOVE FUNKCIJE ZA ZABORAVLJENU LOZINKU ===

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const [rows] = await pool.query("SELECT id FROM `user` WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.json({ message: "Poslat vam je email za reset." });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // +30 minuta

    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [rows[0].id, token, expiresAt]
    );

    await sendPasswordResetEmail(email, token);

    return res.json({ message: "Poslat vam je email za reset." });
  } catch (e) {
    console.error("Forgot password error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const [rows] = await pool.query(
      "SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()",
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE `user` SET password = ? WHERE id = ?", [hash, rows[0].user_id]);
    await pool.query("DELETE FROM password_reset_tokens WHERE token = ?", [token]);

    return res.json({ message: "Lozinka uspješno promenjena!" });
  } catch (e) {
    console.error("Reset password error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}