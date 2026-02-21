import { Router } from "express";
import { requireAdmin } from "../middleware/auth-middleware.js";
import { pool } from "../db.js";
import { restoreUserById, getDeletedUsers, deleteUserById, getUserRoleStats } from "../controllers/users-controller.js";
import { sendOrganizerApprovalEmail, sendOrganizerRejectionEmail } from "../utils/emailService.js";

const router = Router();

// Dashboard statistika
router.get("/dashboard", requireAdmin, async (req, res, next) => {
  try {
    const [userCounts] = await pool.query(`
      SELECT 
        SUM(CASE WHEN role IN ('Student', 'Organizer') THEN 1 ELSE 0 END) as total_users,
        SUM(CASE WHEN role = 'Student' THEN 1 ELSE 0 END) as total_students,
        SUM(CASE WHEN role = 'Organizer' THEN 1 ELSE 0 END) as total_organizers,
        SUM(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) as total_admins
      FROM user
      WHERE deleted_at IS NULL
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

// Svi događaji (za admina) – sa ukupnom zaradom
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
        u.email AS organizer_email,
        COALESCE(SUM(tt.price * r.number_of_tickets), 0) AS total_revenue
      FROM event e
      JOIN \`user\` u ON u.id = e.user_id
      LEFT JOIN ticket_type tt ON tt.event_id = e.id
      LEFT JOIN reservation r ON r.ticket_type_id = tt.id
      GROUP BY e.id, e.title, e.date_and_time, e.image, e.description, e.user_id, u.name, u.surname, u.username, u.email
      ORDER BY e.date_and_time DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Svi AKTIVNI korisnici
router.get("/users", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, username, name, surname, email, role
      FROM user 
      WHERE deleted_at IS NULL
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

router.get("/user-count", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as user_count
      FROM user 
      WHERE role != 'Admin' AND deleted_at IS NULL
    `);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/deleted-users", requireAdmin, getDeletedUsers);
router.post("/users/:id/restore", requireAdmin, restoreUserById);
router.delete("/users/:id", requireAdmin, deleteUserById);

// Dohvati sve pending zahteve
router.get("/role-requests", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        rr.id,
        rr.user_id,
        rr.created_at,
        u.username,
        u.name,
        u.surname,
        u.email
      FROM role_requests rr
      JOIN user u ON u.id = rr.user_id
      WHERE rr.status = 'pending'
      ORDER BY rr.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
// Statistika uloga za PieChart
router.get("/stats/roles", requireAdmin, async (req, res, next) => {
  try {
    // Koristimo is_organizer jer tvoja baza tako razlikuje uloge
    const [rows] = await pool.query(`
      SELECT 
        CAST(SUM(CASE WHEN is_organizer = 0 AND role != 'Admin' THEN 1 ELSE 0 END) AS UNSIGNED) AS students,
        CAST(SUM(CASE WHEN is_organizer = 1 AND role != 'Admin' THEN 1 ELSE 0 END) AS UNSIGNED) AS organizers
      FROM user
      WHERE deleted_at IS NULL
    `);
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Odobri zahtev
router.put("/role-requests/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Proveri da li zahtev postoji i da je pending
    const [requests] = await pool.query(
      "SELECT user_id FROM role_requests WHERE id = ? AND status = 'pending'",
      [id]
    );
    if (!requests.length) {
      return res.status(404).json({ error: "Request not found or already processed" });
    }

    const userId = requests[0].user_id;

    // Postavi is_organizer = true
    await pool.query("UPDATE user SET is_organizer = 1 WHERE id = ?", [userId]);

    // Označi zahtev kao odobren
    await pool.query(
      "UPDATE role_requests SET status = 'approved', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?",
      [req.user.id, id]
    );

    const [user] = await pool.query("SELECT email, username FROM user WHERE id = ?", [userId]);
    if (user[0]) {
      await sendOrganizerApprovalEmail(user[0].email, user[0].username);
    }

    res.json({ message: "Request approved. User is now an organizer." });
  } catch (err) {
    next(err);
  }
});

// Odbij zahtev
router.put("/role-requests/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // ✅ Proveri da li zahtev postoji i da je pending
    const [requests] = await pool.query(
      "SELECT user_id FROM role_requests WHERE id = ? AND status = 'pending'",
      [id]
    );
    if (!requests.length) {
      return res.status(404).json({ error: "Request not found or already processed" });
    }

    const userId = requests[0].user_id; 

    // Označi zahtev kao odbijen
    await pool.query(
      "UPDATE role_requests SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?",
      [req.user.id, id]
    );

    // ✅ POŠALJI EMAIL
    const [user] = await pool.query("SELECT email, username FROM user WHERE id = ?", [userId]);
    if (user[0]) {
      await sendOrganizerRejectionEmail(user[0].email, user[0].username);
    }

    res.json({ message: "Request rejected successfully." });
  } catch (err) {
    next(err);
  }
});

export default router;