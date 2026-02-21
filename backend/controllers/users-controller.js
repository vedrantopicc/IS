import { pool } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES;

// 1. DOHVATI SVE KORISNIKE (Koji nisu obrisani)
export async function getAllUsers(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, surname, email, username, role, is_organizer FROM user WHERE deleted_at IS NULL ORDER BY id ASC"
    );
    res.json(rows); 
  } catch (err) {
    next(err);
  }
}

// 2. KREIRANJE KORISNIKA
export async function createUser({ name, surname, email, username, password, isOrganizer = false }) {
  if (!name || !surname || !email || !username || !password) {
    throw new Error("Missing required fields");
  }

  const [dupe] = await pool.query(
    "SELECT id FROM `user` WHERE email = ? OR username = ? LIMIT 1",
    [email, username]
  );
  if (dupe.length) throw new Error("Email or username already in use");

  const hash = await bcrypt.hash(password, 10);
  const role = isOrganizer ? "Organizer" : "Student";

  const [result] = await pool.query(
    "INSERT INTO `user` (username, name, surname, email, password, role, is_organizer) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [username, name, surname, email, hash, role, isOrganizer]
  );

  const [rows] = await pool.query(
    "SELECT id, username, name, surname, email, role, is_organizer FROM `user` WHERE id = ?",
    [result.insertId]
  );
  return rows[0];
}

// 3. DOHVATI KORISNIKA PO ID-u
export async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, username, name, surname, email, role, is_organizer FROM `user` WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// 4. AŽURIRANJE KORISNIKA
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
    
    if (role && req.user.role === "Admin") { 
      fields.push("role = ?"); 
      values.push(role); 
      
      const isOrgValue = (role === "Organizer") ? 1 : 0;
      fields.push("is_organizer = ?");
      values.push(isOrgValue);
    }

    values.push(id);

    const [result] = await pool.query(
      `UPDATE \`user\` SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "User not found" });

    const [rows] = await pool.query(
      "SELECT id, username, name, surname, email, role, is_organizer FROM `user` WHERE id = ?",
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

    res.json({ user: updatedUser, ...(newToken && { token: newToken }) });
  } catch (err) {
    next(err);
  }
}

// 5. MEKO BRISANJE (Soft Delete)
export async function deleteUserById(req, res, next) {
  try {
    const { id } = req.params;
    const [existingUser] = await pool.query(
      "SELECT id, username, role FROM `user` WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [id]
    );

    if (!existingUser.length) return res.status(404).json({ error: "User not found" });
    if (existingUser[0].role === "Admin") return res.status(403).json({ error: "Cannot delete admin" });

    await pool.query("UPDATE `user` SET deleted_at = NOW() WHERE id = ?", [id]);
    res.json({ message: "User deleted successfully", deletedUser: existingUser[0] });
  } catch (err) {
    next(err);
  }
}

// 6. VRAĆANJE OBRISANOG KORISNIKA
export async function restoreUserById(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      "UPDATE `user` SET deleted_at = NULL WHERE id = ?", 
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "User not found or not deleted" });
    res.json({ message: "User restored successfully" });
  } catch (err) {
    next(err);
  }
}

// 7. DOHVATI SVE OBRISANE KORISNIKE
export async function getDeletedUsers(_req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, surname, email, username, role, is_organizer, deleted_at 
      FROM user WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// 8. STATISTIKA ULOGA (Role Share)
export async function getUserRoleStats(req, res, next) {
  try {
    const query = `
      SELECT 
        CAST(SUM(CASE WHEN is_organizer = 0 AND role != 'Admin' THEN 1 ELSE 0 END) AS UNSIGNED) AS students,
        CAST(SUM(CASE WHEN is_organizer = 1 AND role != 'Admin' THEN 1 ELSE 0 END) AS UNSIGNED) AS organizers
      FROM \`user\`
      WHERE deleted_at IS NULL
    `;
    const [rows] = await pool.query(query);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// 9. STATISTIKA AKTIVNOSTI (Grafikon)
export async function getAdminActivityStats(req, res, next) {
  try {
    const { period = 'daily' } = req.query;
    let query = "";

    switch (period) {
      case 'daily':
        query = `SELECT HOUR(login_time) AS hour, CAST(COUNT(*) AS UNSIGNED) AS count 
                 FROM user_activity WHERE DATE(login_time) = CURDATE() 
                 AND HOUR(login_time) <= HOUR(NOW()) GROUP BY hour ORDER BY hour ASC`;
        break;
      case 'weekly':
        query = `SELECT DAYNAME(login_time) AS day, CAST(COUNT(*) AS UNSIGNED) AS count 
                 FROM user_activity WHERE login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                 GROUP BY day, DAYOFWEEK(login_time) ORDER BY DAYOFWEEK(login_time) ASC`;
        break;
      case 'monthly':
        query = `SELECT DATE_FORMAT(login_time, '%d %b') AS date, CAST(COUNT(*) AS UNSIGNED) AS count 
                 FROM user_activity WHERE MONTH(login_time) = MONTH(CURRENT_DATE()) 
                 AND YEAR(login_time) = YEAR(CURRENT_DATE()) GROUP BY date ORDER BY MIN(login_time) ASC`;
        break;
      case 'yearly':
        query = `SELECT MONTH(login_time) AS month, CAST(COUNT(*) AS UNSIGNED) AS count 
                 FROM user_activity WHERE YEAR(login_time) = YEAR(CURRENT_DATE()) GROUP BY month ORDER BY month ASC`;
        break;
      default:
        return res.status(400).json({ message: "Invalid period" });
    }

    const [stats] = await pool.query(query);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

// 10. TOP AKTIVNI KORISNICI
export async function getTopActiveUsers(req, res, next) {
  try {
    const query = `
      SELECT u.username, u.name, u.surname, COUNT(ua.id) as login_count
      FROM \`user\` u JOIN user_activity ua ON u.id = ua.user_id
      GROUP BY u.id ORDER BY login_count DESC LIMIT 5
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    next(err);
  } 
}