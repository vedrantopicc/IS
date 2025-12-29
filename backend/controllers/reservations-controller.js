// reservations.js
import { pool } from "../db.js";
import crypto from "crypto";

export async function createReservation(req, res, next) {
  try {
    const { eventId } = req.params;
    const { ticketTypeId, numberOfTickets = 1 } = req.body;
    const userId = req.user.id;

    // Proveri da li događaj i tip ulaznice postoje
    const [ticketTypeRows] = await pool.query(
      `SELECT 
         tt.id, tt.price, tt.total_seats, tt.event_id,
         e.title as event_title,
         e.user_id as event_owner_id
       FROM ticket_type tt
       JOIN event e ON e.id = tt.event_id
       WHERE tt.id = ? AND tt.event_id = ?`,
      [ticketTypeId, eventId]
    );

    if (!ticketTypeRows.length) {
      return res.status(404).json({ error: "Ticket type or event not found" });
    }

    const ticketType = ticketTypeRows[0];

    // ✅ ZABRANI REZERVACIJU AKO JE KORISNIK VLASNIK DOGAĐAJA
    if (ticketType.event_owner_id === userId) {
      return res.status(403).json({ error: "You cannot reserve tickets for your own event." });
    }

    // Proveri da li korisnik već ima rezervaciju za taj tip ulaznice
    const [existing] = await pool.query(
      "SELECT id FROM reservation WHERE user_id = ? AND ticket_type_id = ? LIMIT 1",
      [userId, ticketTypeId]
    );

    if (existing.length) {
      return res.status(400).json({ error: "You already have a reservation for this ticket type" });
    }

    // Proveri dostupna mesta
    const [reservedResult] = await pool.query(
      "SELECT COALESCE(SUM(number_of_tickets), 0) AS reserved FROM reservation WHERE ticket_type_id = ?",
      [ticketTypeId]
    );

    const reserved = reservedResult[0].reserved;
    const available = ticketType.total_seats - reserved;

    if (available < numberOfTickets) {
      return res.status(400).json({
        error: `Not enough seats available for '${ticketType.name}'. Only ${available} left.`
      });
    }

    // Kreiraj rezervaciju
    const reservationCode = crypto.randomUUID();
    const [result] = await pool.query(
      `INSERT INTO reservation 
        (user_id, event_id, ticket_type_id, number_of_tickets, reservation_date, code) 
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [userId, eventId, ticketTypeId, numberOfTickets, reservationCode]
    );

    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: result.insertId,
      reservationCode,
      numberOfTickets,
      ticketType: ticketType.name,
      totalPrice: (ticketType.price * numberOfTickets).toFixed(2)
    });

  } catch (err) {
    next(err);
  }
}

export async function getUserReservations(req, res, next) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
         r.id,
         r.number_of_tickets,
         r.reservation_date,
         r.ticket_type_id,
         tt.name AS ticket_type_name,
         tt.price AS ticket_price,
         e.id AS event_id,
         e.title AS event_title,
         e.date_and_time AS event_date_and_time,
         e.image AS event_image,
         (r.number_of_tickets * tt.price) AS total_price
       FROM reservation r
       JOIN ticket_type tt ON tt.id = r.ticket_type_id
       JOIN event e ON e.id = r.event_id
       WHERE r.user_id = ?
       ORDER BY r.reservation_date DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function deleteReservation(req, res, next) {
  try {
    const { reservationId } = req.params;
    const userId = req.user.id;

    const [reservation] = await pool.query(
      "SELECT id, user_id FROM reservation WHERE id = ? AND user_id = ? LIMIT 1",
      [reservationId, userId]
    );

    if (!reservation.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    await pool.query("DELETE FROM reservation WHERE id = ?", [reservationId]);
    res.json({ message: "Reservation deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function getReservationById(req, res, next) {
  try {
    const { reservationId } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
         r.id AS reservation_id,
         r.number_of_tickets,
         r.reservation_date,
         r.ticket_type_id,
         tt.name AS ticket_type_name,
         tt.price AS ticket_price,
         e.id AS event_id,
         e.title AS event_title,
         e.date_and_time AS event_date,
         e.image AS event_image,
         e.description AS event_description,
         (r.number_of_tickets * tt.price) AS total_price
       FROM reservation r
       JOIN ticket_type tt ON tt.id = r.ticket_type_id
       JOIN event e ON e.id = r.event_id
       WHERE r.id = ? AND r.user_id = ?
       LIMIT 1`,
      [reservationId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}