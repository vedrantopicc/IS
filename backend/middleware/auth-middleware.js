
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET); 
    req.user = { 
      id: Number(decoded.sub), 
      jti: decoded.jti, 
      role: decoded.role,
      username: decoded.username,
      name: decoded.name,
      surname: decoded.surname,
      email: decoded.email,
      payload: decoded 
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = auth.slice(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET); 
      req.user = { id: Number(decoded.sub), jti: decoded.jti, payload: decoded };
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const [rows] = await pool.query(
      "SELECT role FROM `user` WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "User not found" });
    }

    if (rows[0].role !== "Admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

export async function requireOrganizer(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = auth.slice(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET); 
      req.user = { id: Number(decoded.sub), jti: decoded.jti, payload: decoded };
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    const [rows] = await pool.query(
      "SELECT role FROM `user` WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "User not found" });
    }

    if (rows[0].role !== "Organizer") {
      return res.status(403).json({ error: "Organizer access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

export async function requireSelfOrAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = auth.slice(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET); 
      req.user = { 
        id: Number(decoded.sub), 
        jti: decoded.jti, 
        role: decoded.role,
        username: decoded.username,
        name: decoded.name,
        surname: decoded.surname,
        email: decoded.email,
        payload: decoded 
      };
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    const targetUserId = Number(req.params.id);
    
    if (req.user.id === targetUserId || req.user.role === "Admin") {
      return next();
    }
    
    return res.status(403).json({ error: "You can only update your own profile" });
    
  } catch (error) {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}
