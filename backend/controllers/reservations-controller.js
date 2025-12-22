import { pool } from "../db.js";
import crypto from "crypto";

export async function createReservation(req, res, next) {
  try {
    const { eventId } = req.params;
    const { numberOfTickets = 1 } = req.body;
    const userId = req.user.id;

    const [eventRows] = await pool.query(
      "SELECT id, title, number_of_available_seats, price FROM `event` WHERE id = ? LIMIT 1",
      [eventId]
    );

    if (!eventRows.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRows[0];

    const [existingReservation] = await pool.query(
      "SELECT id FROM reservation WHERE user_id = ? AND event_id = ? LIMIT 1",
      [userId, eventId]
    );

    if (existingReservation.length) {
      return res.status(400).json({ error: "You already have a reservation for this event" });
    }

    const [currentReservations] = await pool.query(
      "SELECT COALESCE(SUM(number_of_tickets), 0) as reserved_tickets FROM reservation WHERE event_id = ?",
      [eventId]
    );

    const reservedTickets = currentReservations[0].reserved_tickets;
    const availableSeats = event.number_of_available_seats - reservedTickets;

    if (availableSeats < numberOfTickets) {
      return res.status(400).json({ 
        error: `Not enough available seats. Only ${availableSeats} seats remaining.` 
      });
    }

    const reservationCode = crypto.randomUUID();
    const [result] = await pool.query(
      "INSERT INTO reservation (user_id, event_id, number_of_tickets, reservation_date, code) VALUES (?, ?, ?, NOW(), ?)",
      [userId, eventId, numberOfTickets, reservationCode]
    );

    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: result.insertId,
      reservationCode: reservationCode,
      numberOfTickets,
      totalPrice: (event.price * numberOfTickets).toFixed(2)
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
         e.id as event_id,
         e.title as event_title,
         e.date_and_time as event_date_and_time,
         e.price as event_price,
         e.image as event_image,
         (r.number_of_tickets * e.price) as total_price
       FROM reservation r
       JOIN \`event\` e ON e.id = r.event_id
       WHERE r.user_id = ?
       ORDER BY r.reservation_date DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error getting reservations:', err);
    next(err);
  }
}

export async function deleteReservation(req, res, next) {
  try {
    const { reservationId } = req.params;
    const userId = req.user.id;

    const numericReservationId = parseInt(reservationId);
    if (isNaN(numericReservationId)) {
      return res.status(400).json({ error: "Invalid reservation ID" });
    }

    const [reservationRows] = await pool.query(
      "SELECT id, event_id, user_id FROM reservation WHERE id = ? AND user_id = ? LIMIT 1",
      [numericReservationId, userId]
    );

    if (!reservationRows.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const [result] = await pool.query(
      "DELETE FROM reservation WHERE id = ? AND user_id = ?",
      [numericReservationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json({ message: "Reservation deleted successfully" });
  } catch (err) {
    console.error('Error in deleteReservation:', err);
    next(err);
  }
}

export async function getReservationById(req, res, next) {
  try {
    const { reservationId } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
         r.id as reservation_id,
         r.number_of_tickets,
         r.reservation_date,
         e.id as event_id,
         e.title as event_title,
         e.date_and_time as event_date,
         e.price as event_price,
         e.image as event_image,
         e.description as event_description,
         (r.number_of_tickets * e.price) as total_price
       FROM reservation r
       JOIN \`event\` e ON e.id = r.event_id
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
