import { pool } from "../db.js";

// ✅ DOHVATI JEDAN DOGAĐAJ SA SVIM TIPOVIMA ULAZNICA
export async function getEventById(req, res, next) {
  try {
    const { id } = req.params;

    // Osnovni podaci o događaju
    const [eventRows] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.description,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       WHERE e.id = ?`,
      [id]
    );

    if (!eventRows?.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRows[0];

    // Tipovi ulaznica + rezervisana mesta po tipu
    const [ticketTypes] = await pool.query(
      `SELECT
         tt.id,
         tt.name,
         tt.price,
         tt.total_seats,
         COALESCE(SUM(r.number_of_tickets), 0) AS reserved_tickets,
         GREATEST(tt.total_seats - COALESCE(SUM(r.number_of_tickets), 0), 0) AS available_seats
       FROM ticket_type tt
       LEFT JOIN reservation r ON r.ticket_type_id = tt.id
       WHERE tt.event_id = ?
       GROUP BY tt.id`,
      [id]
    );

    res.json({
      ...event,
      ticket_types: ticketTypes
    });
  } catch (err) {
    next(err);
  }
}

// ✅ DOHVATI SVE DOGAĐAJE (osnovni podaci + opseg cena)
export async function getAllEvents(req, res, next) {
  try {
    let { from, to, sort = "desc" } = req.query;
    from = (from && from.trim()) || undefined;
    to = (to && to.trim()) || undefined;

    const where = [];
    const params = [];

    if (from) {
      where.push("e.date_and_time >= ?");
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      where.push("e.date_and_time < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = sort?.toLowerCase() === "asc" ? "ASC" : "DESC";

    // Dohvata događaje i agregira cene i dostupna mesta
    const [rows] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.description,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username,
         MIN(tt.price) AS min_price,
         MAX(tt.price) AS max_price,
         SUM(GREATEST(tt.total_seats - COALESCE(res_sum.reserved, 0), 0)) AS total_available_seats
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       JOIN ticket_type tt ON tt.event_id = e.id
       LEFT JOIN (
         SELECT 
           ticket_type_id, 
           SUM(number_of_tickets) AS reserved
         FROM reservation
         GROUP BY ticket_type_id
       ) res_sum ON res_sum.ticket_type_id = tt.id
       ${whereSql}
       GROUP BY e.id
       ORDER BY e.date_and_time ${orderSql}`,
      params
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ✅ KREIRAJ DOGAĐAJ SA VIŠE TIPOVA ULAZNICA
export async function createEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { title, description, date_and_time, image, ticketTypes } = req.body;

    // Validacija
    if (!title || !date_and_time || !Array.isArray(ticketTypes) || ticketTypes.length === 0) {
      return res.status(400).json({ error: "Title, date, and at least one ticket type are required" });
    }

    for (const tt of ticketTypes) {
      if (!tt.name || tt.price == null || tt.total_seats == null || tt.total_seats <= 0) {
        return res.status(400).json({ error: "Each ticket type must have 'name', 'price', and 'total_seats > 0'" });
      }
    }

    // Kreiraj događaj
    const [eventResult] = await pool.query(
      `INSERT INTO event (title, description, date_and_time, image, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description, date_and_time, image || null, userId]
    );

    const eventId = eventResult.insertId;

    // Kreiraj tipove ulaznica
    const ticketTypeValues = ticketTypes.map(tt => [
      eventId,
      tt.name,
      tt.price,
      tt.total_seats
    ]);

    await pool.query(
      `INSERT INTO ticket_type (event_id, name, price, total_seats)
       VALUES ?`,
      [ticketTypeValues]
    );

    // Vrati potpuni događaj
    const [fullEvent] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.description,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       WHERE e.id = ?`,
      [eventId]
    );

    const [ticketTypesResult] = await pool.query(
      `SELECT id, name, price, total_seats FROM ticket_type WHERE event_id = ?`,
      [eventId]
    );

    res.status(201).json({
      ...fullEvent[0],
      ticket_types: ticketTypesResult
    });
  } catch (err) {
    next(err);
  }
}

// ✅ AŽURIRAJ OSNOVNE PODATKE DOGAĐAJA (naslov, datum...)
export async function updateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, date_and_time, image } = req.body;

    const [existing] = await pool.query(
      "SELECT id FROM event WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: "Event not found or no permission" });
    }

    const [result] = await pool.query(
      `UPDATE event SET 
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         date_and_time = COALESCE(?, date_and_time),
         image = ?
       WHERE id = ?`,
      [title, description, date_and_time, image || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const [updated] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.description,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       WHERE e.id = ?`,
      [id]
    );

    // Dohvati i tipove ulaznica
    const [ticketTypes] = await pool.query(
      `SELECT id, name, price, total_seats FROM ticket_type WHERE event_id = ?`,
      [id]
    );

    res.json({
      ...updated[0],
      ticket_types: ticketTypes
    });
  } catch (err) {
    next(err);
  }
}

// ✅ BRISANJE DOGAĐAJA (automatski briše i ticket_type i reservation zbog CASCADE)
export async function deleteEventById(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM event WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// ✅ DOGAĐAJI ORGANIZATORA
export async function getOrganizerEvents(req, res, next) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date_and_time,
         e.description,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username,
         MIN(tt.price) AS min_price,
         MAX(tt.price) AS max_price
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       JOIN ticket_type tt ON tt.event_id = e.id
       WHERE e.user_id = ?
       GROUP BY e.id
       ORDER BY e.date_and_time DESC`,
      [userId]
    );
    res.json(rows);
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

// ✅ REZERVACIJE ZA DOGAĐAJ (vidljivo organizatoru)
export async function getEventReservations(req, res, next) {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const [eventCheck] = await pool.query(
      "SELECT id FROM event WHERE id = ? AND user_id = ?",
      [eventId, userId]
    );

    if (!eventCheck.length) {
      return res.status(404).json({ error: "Event not found or no permission" });
    }

    const [reservations] = await pool.query(
      `SELECT
         r.id,
         r.number_of_tickets,
         r.reservation_date,
         tt.name AS ticket_type_name,
         tt.price AS ticket_price,
         CONCAT_WS(' ', u.name, u.surname) AS student_name,
         u.username AS student_username,
         u.email AS student_email
       FROM reservation r
       JOIN \`user\` u ON u.id = r.user_id
       JOIN ticket_type tt ON tt.id = r.ticket_type_id
       WHERE r.event_id = ?
       ORDER BY r.reservation_date DESC`,
      [eventId]
    );

    res.json(reservations);
  } catch (err) {
    next(err);
  }
}

// ✅ DOGAĐAJI ZA ADMINISTRATORA – sa ukupnom zaradom
export async function getAdminEvents(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        e.id,
        e.title,
        e.date_and_time,
        e.description,
        e.image,
        e.user_id,
        CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
        u.username AS organizer_username,
        COALESCE(SUM(tt.price * r.number_of_tickets), 0) AS total_revenue
      FROM event e
      JOIN \`user\` u ON u.id = e.user_id
      LEFT JOIN ticket_type tt ON tt.event_id = e.id
      LEFT JOIN reservation r ON r.ticket_type_id = tt.id
      GROUP BY e.id, e.title, e.date_and_time, e.description, e.image, e.user_id, u.name, u.surname, u.username
      ORDER BY e.date_and_time DESC
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
}