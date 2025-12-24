import { pool } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES;

export async function getAllUsers(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, surname, email, username, role FROM user WHERE deleted_at IS NULL ORDER BY id ASC"
    );
    res.json(rows); 
  } catch (err) {
    next(err);
  }
}

const ALLOWED_REGISTER_ROLES = new Set(["Organizer", "Student"]);
export async function createUser({ name, surname, email, username, password, role }) {
  if (!name || !surname || !email || !username || !password || !role) {
    throw new Error("Missing required fields");
  }

  const roleNorm = (role || "").toLowerCase();
  const roleFinal =
    roleNorm === "organizer" ? "Organizer" :
    roleNorm === "student"   ? "Student"   :
    role;

  if (!ALLOWED_REGISTER_ROLES.has(roleFinal)) {
    throw new Error("Role must be Organizer or Student");
  }

  const [dupe] = await pool.query(
    "SELECT id FROM `user` WHERE email = ? OR username = ? LIMIT 1",
    [email, username]
  );
  if (dupe.length) throw new Error("Email or username already in use");

  const hash = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    "INSERT INTO `user` (username, name, surname, email, password, role) VALUES (?, ?, ?, ?, ?, ?)",
    [username, name, surname, email, hash, roleFinal]
  );

  const [rows] = await pool.query(
    "SELECT id, username, name, surname, email, role FROM `user` WHERE id = ?",
    [result.insertId]
  );
  return rows[0];
}



export async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, username, name, surname, email, role FROM `user` WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateUserById(req, res, next) {
  try {
    const { id } = req.params;
    const { name, surname, role } = req.body;

    if (!name && !surname && !role) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const targetUserId = Number(id);
    if (req.user.role !== "Admin" && req.user.id !== targetUserId) {
      return res.status(403).json({ error: "You can only update your own profile" });
    }

    if (role && req.user.role !== "Admin") {
      return res.status(403).json({ error: "Only admins can change user roles" });
    }

    const fields = [];
    const values = [];

    if (name) { fields.push("name = ?"); values.push(name); }
    if (surname) { fields.push("surname = ?"); values.push(surname); }
    if (role && req.user.role === "Admin") { fields.push("role = ?"); values.push(role); }

    values.push(id);

    const [result] = await pool.query(
      `UPDATE \`user\` SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const [rows] = await pool.query(
      "SELECT id, username, name, surname, email, role FROM `user` WHERE id = ?",
      [id]
    );

    const updatedUser = rows[0];

    let newToken = null;
    if (req.user.id === targetUserId) {
      const payload = {
        sub: String(updatedUser.id),
        jti: req.user.jti, 
        username: updatedUser.username,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        role: updatedUser.role,
      };
      newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    }

    res.json({ 
      user: updatedUser, 
      ...(newToken && { token: newToken })
    });

  } catch (err) {
    next(err);
  }
}

export async function deleteUserById(req, res, next) {
  try {
    const { id } = req.params;

    const [existingUser] = await pool.query(
      "SELECT id, username, role FROM `user` WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [id]
    );

    if (!existingUser.length) {
      return res.status(404).json({ error: "User not found or already deleted" });
    }

    if (existingUser[0].role === "Admin") {
      return res.status(403).json({ error: "Cannot delete admin users" });
    }

    // Soft delete: postavi deleted_at
    const [result] = await pool.query(
      "UPDATE `user` SET deleted_at = NOW() WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ 
      message: "User deleted successfully (soft delete)", 
      deletedUser: existingUser[0] 
    });

  } catch (err) {
    next(err);
  }
}

// VRATI DEAKTIVIRANOG KORISNIKA
export async function restoreUserById(req, res, next) {
  try {
    const { id } = req.params;

    const [existingUser] = await pool.query(
      "SELECT id, username, role FROM `user` WHERE id = ? AND deleted_at IS NOT NULL LIMIT 1",
      [id]
    );

    if (!existingUser.length) {
      return res.status(404).json({ error: "User not found or not deleted" });
    }

    const [result] = await pool.query(
      "UPDATE `user` SET deleted_at = NULL WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Failed to restore user" });
    }

    res.json({ 
      message: "User restored successfully",
      restoredUser: existingUser[0]
    });

  } catch (err) {
    next(err);
  }
}

// DOHVATI OBRISENE (DEAKTIVIRANE) KORISNIKE
export async function getDeletedUsers(_req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, surname, email, username, role, deleted_at
      FROM user 
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}