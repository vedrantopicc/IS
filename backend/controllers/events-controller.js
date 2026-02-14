import { pool } from "../db.js";

// ✅ DOHVATI JEDAN DOGAĐAJ SA SVIM TIPOVIMA ULAZNICA
export async function getEventById(req, res, next) {
  try {
    const { id } = req.params;

    const [eventRows] = await pool.query(
  `SELECT
     e.id,
     e.title,
     e.description,
     e.location,
     e.date_and_time,
     e.image,
     e.user_id,
     e.category_id,
     c.name AS category_name,
     CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
     u.username AS organizer_username
   FROM event e
   JOIN \`user\` u ON u.id = e.user_id
   LEFT JOIN category c ON c.id = e.category_id
   WHERE e.id = ?`,
  [id]
);


    if (!eventRows?.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRows[0];

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

// ✅ DOHVATI SVE DOGAĐAJE (za javni pregled)
export async function getAllEvents(req, res, next) {
  try {
   // --- filteri ---
let { from, to, sort = "date_asc", category_id } = req.query;
from = (from && from.trim()) || undefined;
to = (to && to.trim()) || undefined;

const where = [];
const params = [];

if (category_id) {
  where.push("e.category_id = ?");
  params.push(category_id);
}

if (from) {
  where.push("e.date_and_time >= ?");
  params.push(`${from} 00:00:00`);
}
if (to) {
  where.push("e.date_and_time < DATE_ADD(?, INTERVAL 1 DAY)");
  params.push(to);
}

const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

// --- sortiranje ---
const SORT_MAP = {
  date_asc: "e.date_and_time ASC",
  date_desc: "e.date_and_time DESC",
  title_asc: "e.title ASC",
  title_desc: "e.title DESC",
  category_asc: "c.name ASC, e.date_and_time DESC",
  category_desc: "c.name DESC, e.date_and_time DESC",
};

const baseSort = SORT_MAP[String(sort).toLowerCase()] || SORT_MAP.date_asc;

// upcoming prvo (1), past poslije (0)
const orderBy = `(e.date_and_time >= NOW()) DESC, ${baseSort}, e.id DESC`;
// --- query ---
const [rows] = await pool.query(
  `SELECT
     e.id,
     e.title,
     e.description,
     e.location,
     e.date_and_time,
     e.image,
     e.user_id,
     e.category_id,
     c.name AS category_name,
     CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
     u.username AS organizer_username,
     MIN(tt.price) AS min_price,
     MAX(tt.price) AS max_price,
     SUM(GREATEST(tt.total_seats - COALESCE(res_sum.reserved, 0), 0)) AS total_available_seats
   FROM event e
   JOIN \`user\` u ON u.id = e.user_id
   LEFT JOIN category c ON c.id = e.category_id
   JOIN ticket_type tt ON tt.event_id = e.id
   LEFT JOIN (
     SELECT ticket_type_id, SUM(number_of_tickets) AS reserved
     FROM reservation
     GROUP BY ticket_type_id
   ) res_sum ON res_sum.ticket_type_id = tt.id
   ${whereSql}
   GROUP BY e.id
   ORDER BY ${orderBy}`,
  params
);


res.json(rows);

  } catch (err) {
    next(err);
  }
}


// ✅ KREIRAJ DOGAĐAJ SA VIŠE TIPOVA ULAZNICA I LOKACIJOM
export async function createEvent(req, res, next) {
  try {
    const userId = req.user.id;
const { title, description, location, date_and_time, image, ticketTypes, category_id } = req.body;

    if (!title || !date_and_time || !Array.isArray(ticketTypes) || ticketTypes.length === 0) {
      return res.status(400).json({ error: "Title, date, and at least one ticket type are required" });
    }
    if (!category_id) {
  return res.status(400).json({ error: "Category is required" });
}


    for (const tt of ticketTypes) {
      if (!tt.name || tt.price == null || tt.total_seats == null || tt.total_seats <= 0) {
        return res.status(400).json({ error: "Each ticket type must have 'name', 'price', and 'total_seats > 0'" });
      }
    }

    const [eventResult] = await pool.query(
     `INSERT INTO event (title, description, location, date_and_time, image, user_id, category_id)
 VALUES (?, ?, ?, ?, ?, ?, ?)`,
[title, description || null, location || null, date_and_time, image || null, userId, category_id ]

    );

    const eventId = eventResult.insertId;

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

    const [fullEvent] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.description,
         e.location,
         e.date_and_time,
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

// ✅ AŽURIRAJ OSNOVNE PODATKE DOGAĐAJA (UKLJUČUJUĆI LOKACIJU)
export async function updateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, location, date_and_time, image } = req.body;

    const [existing] = await pool.query(
      "SELECT id FROM event WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: "Event not found or no permission" });
    }

    await pool.query(
      `UPDATE event SET 
         title = ?,
         description = ?,
         location = ?,
         date_and_time = ?,
         image = ?
       WHERE id = ?`,
      [title || null, description || null, location || null, date_and_time || null, image || null, id]
    );

    const [updated] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.description,
         e.location,
         e.date_and_time,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       WHERE e.id = ?`,
      [id]
    );

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

// ✅ BRISANJE DOGAĐAJA
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

// ✅ DOHVATI DOGAĐAJE ORGANIZATORA
export async function getOrganizerEvents(req, res, next) {
  try {
    const userId = req.user.id;

    if (!userId || userId <= 0 || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const [events] = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.description,
         e.location,
         e.date_and_time,
         e.image,
         e.user_id,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       LEFT JOIN \`user\` u ON u.id = e.user_id
       WHERE e.user_id = ?
       ORDER BY e.date_and_time DESC`,
      [userId]
    );

    for (const event of events) {
      if (!event.id) continue;
      try {
        const [ticketTypes] = await pool.query(
          `SELECT id, name, price, total_seats FROM ticket_type WHERE event_id = ?`,
          [event.id]
        );
        event.ticket_types = ticketTypes;
      } catch (err) {
        console.warn(`Failed to load ticket types for event ${event.id}:`, err.message);
        event.ticket_types = [];
      }
    }

    res.json(events);
  } catch (err) {
    console.error("Database error in getOrganizerEvents:", err);
    return res.status(500).json({ error: "Failed to load your events" });
  }
}

// ✅ BRISANJE DOGAĐAJA OD STRANE ORGANIZATORA
export async function deleteOrganizerEvent(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [existingEvent] = await pool.query(
      "SELECT id FROM `event` WHERE id = ? AND user_id = ? LIMIT 1",
      [id, userId]
    );

    if (!existingEvent.length) {
      return res.status(404).json({ error: "Event not found or you don't have permission" });
    }

    await pool.query("DELETE FROM `event` WHERE id = ?", [id]);

    res.json({ 
      message: "Event deleted successfully"
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

// ✅ PROGRES PRODAJE ZA DOGAĐAJ (ISRAVQLJENO - BROJEVI KAO BROJEVI)
export async function getEventSalesProgress(req, res, next) {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const [eventCheck] = await pool.query(
      "SELECT id FROM event WHERE id = ? AND user_id = ?",
      [eventId, userId]
    );
    if (!eventCheck.length) {
      return res.status(403).json({ error: "You don't own this event" });
    }

    const [ticketTypes] = await pool.query(`
      SELECT
        tt.id,
        tt.name,
        tt.total_seats,
        COALESCE(SUM(r.number_of_tickets), 0) AS sold
      FROM ticket_type tt
      LEFT JOIN reservation r ON r.ticket_type_id = tt.id
      WHERE tt.event_id = ?
      GROUP BY tt.id
    `, [eventId]);

    const processedTicketTypes = ticketTypes.map(t => ({
      id: t.id,
      name: t.name,
      total_seats: Number(t.total_seats),
      sold: Number(t.sold)
    }));

    const totalSeats = processedTicketTypes.reduce((sum, t) => sum + t.total_seats, 0);
    const totalSold = processedTicketTypes.reduce((sum, t) => sum + t.sold, 0);
    const percentage = totalSeats > 0 ? Math.min(100, Math.round((totalSold / totalSeats) * 100)) : 0;

    res.json({
      event_id: Number(eventId),
      total_seats: totalSeats,
      total_sold: totalSold,
      percentage_sold: percentage,
      ticket_types: processedTicketTypes.map(t => ({
        id: t.id,
        name: t.name,
        total_seats: t.total_seats,
        sold: t.sold,
        available: t.total_seats - t.sold,
        percentage: t.total_seats > 0 ? Math.round((t.sold / t.total_seats) * 100) : 0
      }))
    });

  } catch (err) {
    next(err);
  }
}