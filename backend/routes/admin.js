import { Router } from "express";
import { requireAdmin } from "../middleware/auth-middleware.js";
import { pool } from "../db.js";

const router = Router();

// Dashboard statistika
router.get("/dashboard", requireAdmin, async (req, res, next) => {
  try {
    const [userCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'Student' THEN 1 ELSE 0 END) as total_students,
        SUM(CASE WHEN role = 'Organizer' THEN 1 ELSE 0 END) as total_organizers,
        SUM(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) as total_admins
      FROM user
    `);

    const [eventCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN date_and_time > NOW() THEN 1 ELSE 0 END) as upcoming_events,
        SUM(CASE WHEN date_and_time <= NOW() THEN 1 ELSE 0 END) as past_events
      FROM event
    `);

    res.json({
      users: userCounts[0],
      events: eventCounts[0]
    });
  } catch (err) {
    next(err);
  }
});

// Svi događaji (za admina)
router.get("/events", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.date_and_time,
        e.image,
        e.description,
        e.user_id,
        CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
        u.username AS organizer_username,
        u.email AS organizer_email
      FROM event e
      JOIN \`user\` u ON u.id = e.user_id
      ORDER BY e.date_and_time DESC
    `);
    // ✅ Nema `price` i `number_of_available_seats` – više ne postoje
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Svi korisnici
router.get("/users", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, username, name, surname, email, role
      FROM user 
      ORDER BY id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Statistika po korisniku
router.get("/users/:id/stats", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [userInfo] = await pool.query(`
      SELECT id, username, name, surname, email, role
      FROM user 
      WHERE id = ?
    `, [id]);

    if (!userInfo.length) {
      return res.status(404).json({ error: "User not found" });
    }

    // Dohvati događaje + broj tipova ulaznica
    const [userEvents] = await pool.query(`
      SELECT 
        e.id, 
        e.title, 
        e.date_and_time,
        COUNT(tt.id) AS ticket_types_count,
        SUM(tt.total_seats) AS total_capacity
      FROM event e
      LEFT JOIN ticket_type tt ON tt.event_id = e.id
      WHERE e.user_id = ?
      GROUP BY e.id
      ORDER BY e.date_and_time DESC
    `, [id]);

    res.json({
      user: userInfo[0],
      events: userEvents,
      event_count: userEvents.length
    });
  } catch (err) {
    next(err);
  }
});

export default router;