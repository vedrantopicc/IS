// src/controllers/seed-demo-data.js
import { pool } from "../db.js";
import bcrypt from "bcrypt";

export async function seedDemoData(req, res) {
  try {
    const DEMO_PASSWORD_HASH = await bcrypt.hash("demo123", 10);

    // ✅ 1. Proveri da li postoje studenti – ako ne, napravi 100
    const [existingStudents] = await pool.query(
      "SELECT id FROM `user` WHERE role = 'Student'"
    );

    let studentIds;
    if (existingStudents.length > 0) {
      studentIds = existingStudents.map(s => s.id);
      console.log("📚 %d existing students found – using them for reservations", studentIds.length);
    } else {
      console.log("🆕 No students found – creating 100 demo students...");
      const studentValues = [];
      for (let i = 1; i <= 100; i++) {
        studentValues.push([
          `student${i}`,
          "Student",
          `#${i}`,
          `student${i}@example.com`,
          DEMO_PASSWORD_HASH,
          "Student"
        ]);
      }
      await pool.query(
        `INSERT INTO \`user\` (username, name, surname, email, password, role) VALUES ?`,
        [studentValues]
      );
      const [newStudents] = await pool.query(
        "SELECT id FROM `user` WHERE role = 'Student' AND username LIKE 'student%' ORDER BY id"
      );
      studentIds = newStudents.map(s => s.id);
      console.log("✅ Created 100 demo students");
    }

    // ✅ 2. Nabavi sve događaje
    const [allEvents] = await pool.query(
      "SELECT id FROM event"
    );

    if (allEvents.length === 0) {
      return res.status(400).json({
        error: "No events found in the database. Create at least one event first."
      });
    }

    console.log("📊 Found %d events – processing for demo reservations...", allEvents.length);

    let totalNewReservations = 0;

    // ✅ 3. Za SVAKI događaj
    for (const event of allEvents) {
      const eventId = event.id;

      // 🔥 OBRIŠI postojeće demo rezervacije ZA OVAJ DOGAĐAJ (samo one sa 'DEMO-' u kodu)
      await pool.query(
        "DELETE FROM reservation WHERE event_id = ? AND code LIKE 'DEMO-%'",
        [eventId]
      );
      console.log("🧹 Cleared existing demo reservations for event %s", eventId);

      // Nabavi tipove ulaznica i njihov kapacitet
      const [ticketTypes] = await pool.query(
        "SELECT id, name, total_seats FROM ticket_type WHERE event_id = ?",
        [eventId]
      );

      if (ticketTypes.length === 0) {
        console.warn("⚠️ Event %s has no ticket types – skipping", eventId);
        continue;
      }

      // Pripremi mapu za praćenje preostalih mesta
      const ticketTypeMap = {};
      for (const tt of ticketTypes) {
        ticketTypeMap[tt.id] = { ...tt, reserved: 0 };
      }

      // Učitaj postojeće rezervacije (samo prave, jer demo su obrisani)
      const [currentReservations] = await pool.query(
        `SELECT ticket_type_id, SUM(number_of_tickets) AS total_reserved
         FROM reservation
         WHERE event_id = ?
         GROUP BY ticket_type_id`,
        [eventId]
      );

      currentReservations.forEach(r => {
        if (ticketTypeMap[r.ticket_type_id]) {
          ticketTypeMap[r.ticket_type_id].reserved = parseInt(r.total_reserved || 0);
        }
      });

      // ✅ 4. Kreiraj NOVE demo rezervacije (5–50 po događaju)
      const now = new Date();
      const daysBack = 30;
      const reservations = [];
      const userUsedTypes = new Map(); // userId → Set(ticketTypeId)

      const reservationCount = 5 + Math.floor(Math.random() * 46); // 5 to 50

      for (let i = 0; i < reservationCount; i++) {
        const userId = studentIds[Math.floor(Math.random() * studentIds.length)];

        // Filtriraj tipove sa preostalim mestima
        let availableTicketTypes = Object.values(ticketTypeMap).filter(tt => {
          const remaining = tt.total_seats - tt.reserved;
          return remaining > 0;
        });

        if (availableTicketTypes.length === 0) break;

        const ticketType = availableTicketTypes[Math.floor(Math.random() * availableTicketTypes.length)];
        const ticketTypeId = ticketType.id;

        if (!userUsedTypes.has(userId)) {
          userUsedTypes.set(userId, new Set());
        }

        if (userUsedTypes.get(userId).has(ticketTypeId)) {
          continue; // 1 korisnik = 1 rezervacija po tipu
        }

        userUsedTypes.get(userId).add(ticketTypeId);

        const remainingSeats = ticketType.total_seats - ticketType.reserved;
        const maxTickets = Math.min(3, remainingSeats);
        const numTickets = Math.max(1, Math.min(maxTickets, Math.floor(Math.random() * 3) + 1));

        ticketType.reserved += numTickets;

        const daysAgo = Math.floor(Math.random() * daysBack);
        const reservationDate = new Date(now);
        reservationDate.setDate(now.getDate() - daysAgo);
        reservationDate.setHours(9 + Math.floor(Math.random() * 10), 0, 0, 0);

        reservations.push([
          userId,
          eventId,
          ticketTypeId,
          numTickets,
          reservationDate.toISOString().slice(0, 19).replace("T", " "),
          `DEMO-${eventId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        ]);
      }

      // ✅ 5. Sačuvaj nove demo rezervacije
      if (reservations.length > 0) {
        await pool.query(
          `INSERT INTO reservation (user_id, event_id, ticket_type_id, number_of_tickets, reservation_date, code)
           VALUES ?`,
          [reservations]
        );
        console.log("✅ Added %d new demo reservations for event %s", reservations.length, eventId);
        totalNewReservations += reservations.length;
      }
    }

    res.status(200).json({
      message: "✅ Demo reservations successfully refreshed for all events",
      stats: {
        eventsProcessed: allEvents.length,
        totalNewReservations,
        studentsUsed: studentIds.length,
        note: "All old 'DEMO-' reservations were removed. New ones respect seat limits."
      }
    });

  } catch (err) {
    console.error("❌ Failed to seed reservations:", err);
    res.status(500).json({ error: "Failed to seed demo reservations", message: err.message });
  }
}