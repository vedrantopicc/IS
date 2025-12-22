import { pool } from "../db.js";
export async function getEventById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.number_of_available_seats,
         e.price,
         e.image,
         e.user_id,
         e.description,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username,
         COALESCE(SUM(r.number_of_tickets), 0) as reserved_tickets,
         (e.number_of_available_seats - COALESCE(SUM(r.number_of_tickets), 0)) as available_seats
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       LEFT JOIN reservation r ON r.event_id = e.id
       WHERE e.id = ?
       GROUP BY e.id
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    
    const event = rows[0];
    event.available_seats = Math.max(0, event.available_seats);
    
    res.json(event);
  } catch (err) {
    next(err);
  }
}

export async function getAllEvents(req, res, next) {
  try {
    let { from, to, sort = "desc" } = req.query;

    console.log("=== getAllEvents called ===");
    console.log("Query params:", { from, to, sort });

    from = (from && from.trim()) || undefined; 
    to   = (to   && to.trim())   || undefined;

    const where = [];
    const params = [];

    if (from) {
      where.push("e.date_and_time >= ?");
      params.push(`${from} 00:00:00`);
      console.log("Adding FROM filter:", `${from} 00:00:00`);
    }

    if (to) {
      where.push("e.date_and_time < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(to);
      console.log("Adding TO filter:", to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = String(sort).toLowerCase() === "asc" ? "ASC" : "DESC";

    const sql = `
      SELECT e.id, e.title, e.date_and_time, e.number_of_available_seats,
             e.price, e.image, e.user_id, e.description,
             COALESCE(SUM(r.number_of_tickets), 0) as reserved_tickets,
             (e.number_of_available_seats - COALESCE(SUM(r.number_of_tickets), 0)) as available_seats
      FROM \`event\` e
      LEFT JOIN reservation r ON r.event_id = e.id
      ${whereSql}
      GROUP BY e.id, e.title, e.date_and_time, e.number_of_available_seats, e.price, e.image, e.user_id, e.description
      ORDER BY e.date_and_time ${orderSql}
    `;
    console.log("SQL query:", sql);
    console.log("SQL params:", params);
    
    const [rows] = await pool.query(sql, params);
    
    const eventsWithAvailableSeats = rows.map(event => ({
      ...event,
      available_seats: Math.max(0, event.available_seats)
    }));
    
    console.log("Query results count:", eventsWithAvailableSeats.length);
    console.log("First 2 rows:", eventsWithAvailableSeats.slice(0, 2));
    
    res.json(eventsWithAvailableSeats);
  } catch (err) {
    console.error("Error in getAllEvents:", err);
    next(err);
  }
}

export async function deleteEventById(req, res, next) {
  try {
    const { id } = req.params;

    const [existingEvent] = await pool.query(
      "SELECT id, title, user_id FROM `event` WHERE id = ? LIMIT 1",
      [id]
    );

    if (!existingEvent.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const [result] = await pool.query(
      "DELETE FROM `event` WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ 
      message: "Event deleted successfully", 
      deletedEvent: existingEvent[0] 
    });

  } catch (err) {
    next(err);
  }
}

export async function getOrganizerEvents(req, res, next) {
  try {
    const userId = req.user.id;
    
    const [rows] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.number_of_available_seats,
         e.price,
         e.image,
         e.description,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username,
         COALESCE(SUM(r.number_of_tickets), 0) as reserved_tickets,
         (e.number_of_available_seats - COALESCE(SUM(r.number_of_tickets), 0)) as available_seats
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       LEFT JOIN reservation r ON r.event_id = e.id
       WHERE e.user_id = ?
       GROUP BY e.id
       ORDER BY e.date_and_time DESC`,
      [userId]
    );
    
    const eventsWithAvailableSeats = rows.map(event => ({
      ...event,
      available_seats: Math.max(0, event.available_seats)
    }));
    
    res.json(eventsWithAvailableSeats);
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { title, description, date_and_time, number_of_available_seats, price, image } = req.body;
    
    if (!title || !date_and_time || !number_of_available_seats || !price) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const [result] = await pool.query(
      `INSERT INTO event (title, description, date_and_time, number_of_available_seats, price, image, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, date_and_time, number_of_available_seats, price, image || null, userId]
    );
    
    const [newEvent] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.number_of_available_seats,
         e.price,
         e.image,
         e.description,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       WHERE e.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json(newEvent[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, date_and_time, number_of_available_seats, price, image } = req.body;
    
    const [existingEvent] = await pool.query(
      "SELECT id, user_id FROM `event` WHERE id = ? AND user_id = ? LIMIT 1",
      [id, userId]
    );
    
    if (!existingEvent.length) {
      return res.status(404).json({ error: "Event not found or you don't have permission to edit it" });
    }
    
    const [result] = await pool.query(
      `UPDATE event SET 
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         date_and_time = COALESCE(?, date_and_time),
         number_of_available_seats = COALESCE(?, number_of_available_seats),
         price = COALESCE(?, price),
         image = COALESCE(?, image)
       WHERE id = ?`,
      [title, description, date_and_time, number_of_available_seats, price, image, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    const [updatedEvent] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.number_of_available_seats,
         e.price,
         e.image,
         e.description,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       WHERE e.id = ?`,
      [id]
    );
    
    res.json(updatedEvent[0]);
  } catch (err) {
    next(err);
  }
}

export async function deleteOrganizerEvent(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [existingEvent] = await pool.query(
      "SELECT id, title, user_id FROM `event` WHERE id = ? AND user_id = ? LIMIT 1",
      [id, userId]
    );

    if (!existingEvent.length) {
      return res.status(404).json({ error: "Event not found or you don't have permission to delete it" });
    }

    const [result] = await pool.query(
      "DELETE FROM `event` WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ 
      message: "Event deleted successfully", 
      deletedEvent: existingEvent[0] 
    });

  } catch (err) {
    next(err);
  }
}

export async function getEventReservations(req, res, next) {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    
    const [eventCheck] = await pool.query(
      "SELECT id FROM `event` WHERE id = ? AND user_id = ? LIMIT 1",
      [eventId, userId]
    );
    
    if (!eventCheck.length) {
      return res.status(404).json({ error: "Event not found or you don't have permission to view its reservations" });
    }
    
    const [reservations] = await pool.query(
      `SELECT
         r.id,
         r.number_of_tickets,
         r.reservation_date,
         CONCAT_WS(' ', u.name, u.surname) AS student_name,
         u.username AS student_username,
         u.email AS student_email,
         e.title AS event_title
       FROM reservation r
       JOIN \`user\` u ON u.id = r.user_id
       JOIN event e ON e.id = r.event_id
       WHERE r.event_id = ?
       ORDER BY r.reservation_date DESC`,
      [eventId]
    );
    
    res.json(reservations);
  } catch (err) {
    next(err);
  }
}