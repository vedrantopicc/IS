import { pool } from "../db.js";

// ✅ DOHVATI JEDAN DOGAĐAJ SA SVIM TIPOVIMA ULAZNICA I DODATNIM SLIKAMA
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
         e.status,
         c.name AS category_name,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       LEFT JOIN category c ON c.id = e.category_id
       WHERE e.id = ? AND e.deleted_at IS NULL AND e.status = 'PUBLISHED'`,
            [id]
        );

        if (!eventRows?.length) {
            return res.status(404).json({ error: "Događaj nije pronađen" });
        }

        const event = eventRows[0];

        // ✅ NOVO: Dohvati dodatne slike iz event_image tabele
        const [additionalImages] = await pool.query(
            `SELECT id, image_path, is_primary, display_order 
       FROM event_image 
       WHERE event_id = ? 
       ORDER BY display_order ASC, id ASC`,
            [id]
        );

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
            additional_images: additionalImages,
            ticket_types: ticketTypes
        });
    } catch (err) {
        next(err);
    }
}

// ✅ DOHVATI SVE DOGAĐAJE (za javni pregled)
export async function getAllEvents(req, res, next) {
    try {
        let { from, to, sort = "date_desc", category_id, search, page = 1, limit = 9 } = req.query;

        search = (search && search.trim()) || undefined;
        from = (from && from.trim()) || undefined;
        to = (to && to.trim()) || undefined;

        page = Math.max(1, parseInt(page, 10) || 1);
        limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 9));
        const offset = (page - 1) * limit;

        const where = [];
        const params = [];

        where.push("e.deleted_at IS NULL");
        where.push("e.status = 'PUBLISHED'");

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

        if (search) {
            where.push("e.title LIKE ?");
            params.push(`%${search}%`);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const SORT_MAP = {
            date_asc: "e.date_and_time ASC",
            date_desc: "e.date_and_time DESC",
            title_asc: "e.title ASC",
            title_desc: "e.title DESC",
            category_asc: "c.name ASC, e.date_and_time DESC",
            category_desc: "c.name DESC, e.date_and_time DESC",
        };

        const baseSort = SORT_MAP[String(sort).toLowerCase()] || SORT_MAP.date_asc;
        const orderBy = `(e.date_and_time >= NOW()) DESC, ${baseSort}, e.id DESC`;

        const [countRows] = await pool.query(
            `SELECT COUNT(DISTINCT e.id) AS total
       FROM event e
       JOIN \`user\` u ON u.id = e.user_id
       LEFT JOIN category c ON c.id = e.category_id
       JOIN ticket_type tt ON tt.event_id = e.id
       ${whereSql}`,
            params
        );

        const total = Number(countRows?.[0]?.total || 0);
        const totalPages = Math.max(1, Math.ceil(total / limit));

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
         e.status,
         c.name AS category_name,
         CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
         u.username AS organizer_username,
         MIN(tt.price) AS min_price,
         MAX(tt.price) AS max_price,
         SUM(GREATEST(tt.total_seats - COALESCE(res_sum.reserved, 0), 0)) AS total_available_seats,
         (
           SELECT ROUND(AVG(cmt.rating), 1)
           FROM comments cmt
           WHERE cmt.event_id = e.id
         ) AS averageRating
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
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            items: rows,
            meta: { page, limit, total, totalPages },
        });
    } catch (err) {
        next(err);
    }
}

// ✅ KREIRAJ DOGAĐAJ SA VIŠE SLIKA
export async function createEvent(req, res, next) {
    try {
        const userId = req.user.id;

        let { title, description, location, date_and_time, ticketTypes, category_id, status, image } = req.body;

        if (typeof ticketTypes === "string") {
            try {
                ticketTypes = JSON.parse(ticketTypes);
            } catch {
                ticketTypes = [];
            }
        }

        let mainImagePath = null;

        if (req.files && req.files.length > 0) {
            mainImagePath = `/uploads/${req.files[0].filename}`;
        } else if (typeof image === "string" && image.trim()) {
            mainImagePath = image.trim();
        }

        if (!title || !date_and_time || !Array.isArray(ticketTypes) || ticketTypes.length === 0) {
            return res.status(400).json({ error: "Naslov, datum i barem jedan tip ulaznice su obavezni" });
        }
        if (!category_id) {
            return res.status(400).json({ error: "Kategorija je obavezna" });
        }

        for (const tt of ticketTypes) {
            if (!tt.name || tt.price == null || tt.total_seats == null || Number(tt.total_seats) <= 0) {
                return res.status(400).json({ error: "Svaki tip ulaznice mora imati 'naziv', 'cijenu' i 'ukupan_broj_mjesta > 0'" });
            }
        }

        const eventStatus = status || "DRAFT";

        const [eventResult] = await pool.query(
            `INSERT INTO event (title, description, location, date_and_time, image, user_id, category_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description || null, location || null, date_and_time, mainImagePath, userId, category_id, eventStatus]
        );

        const eventId = eventResult.insertId;

        if (req.files && req.files.length > 0) {
            const imageValues = req.files.map((file, index) => [
                eventId,
                `/uploads/${file.filename}`,
                index === 0 ? 1 : 0,
                index
            ]);

            await pool.query(
                `INSERT INTO event_image (event_id, image_path, is_primary, display_order)
         VALUES ?`,
                [imageValues]
            );
        }

        const ticketTypeValues = ticketTypes.map((tt) => [
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

        if (eventStatus === "PUBLISHED") {
            const [students] = await pool.query(
                `SELECT id FROM \`user\` WHERE role = 'Student' AND id != ?`,
                [userId]
            );

            if (students.length) {
                const values = students.map((s) => [
                    s.id,
                    "Objavljen novi događaj",
                    `Objavljen je novi događaj "${title}"! Pogledajte ga.`,
                    eventId,
                    0
                ]);

                await pool.query(
                    `INSERT INTO notification (user_id, title, message, event_id, is_read)
           VALUES ?`,
                    [values]
                );
            }
        }

        const [fullEvent] = await pool.query(
            `SELECT
         e.id,
         e.title,
         e.description,
         e.location,
         e.date_and_time,
         e.image,
         e.user_id,
         e.category_id,
         e.status,
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

        const [additionalImages] = await pool.query(
            `SELECT id, image_path, is_primary, display_order 
       FROM event_image 
       WHERE event_id = ? 
       ORDER BY display_order ASC, id ASC`,
            [eventId]
        );

        res.status(201).json({
            ...fullEvent[0],
            additional_images: additionalImages,
            ticket_types: ticketTypesResult
        });
    } catch (err) {
        next(err);
    }
}

// // ✅ AŽURIRAJ DOGAĐAJ SA PODRŠKOM ZA PROMJENU GLAVNE SLIKE I BRISANJE SLIKA
export async function updateEvent(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        let { title, description, location, date_and_time, image, category_id, status, deletedImages, ticketTypes } = req.body;

        const [existing] = await pool.query(
            "SELECT id, status, title, image FROM event WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        if (!existing.length) {
            return res.status(404).json({ error: "Događaj nije pronađen ili nemate dozvolu" });
        }

        const oldStatus = existing[0].status;
        const eventTitle = existing[0].title;
        const oldImage = existing[0].image;

        // ✅ PROMJENJENO: Obrada glavne slike
        let newMainImage = oldImage;

        // Ako je frontend poslao drugu putanju za glavnu sliku
        if (image && image !== oldImage && image.trim()) {
            newMainImage = image.trim();
        }

        // Ako su uploadovani novi fajlovi
        if (req.files && req.files.length > 0) {
            const [maxOrder] = await pool.query(
                `SELECT COALESCE(MAX(display_order), -1) AS max_order FROM event_image WHERE event_id = ?`,
                [id]
            );

            const startOrder = maxOrder[0].max_order + 1;

            const imageValues = req.files.map((file, index) => [
                id,
                `/uploads/${file.filename}`,
                0, // ✅ VAŽNO: Sve nove slike idu sa is_primary = 0
                startOrder + index
            ]);

            await pool.query(
                `INSERT INTO event_image (event_id, image_path, is_primary, display_order)
         VALUES ?`,
                [imageValues]
            );

            {/*// Prva uploadovana slika postaje glavna ako nije već postavljena
      if (!newMainImage || newMainImage === oldImage) {
        newMainImage = `/uploads/${req.files[0].filename}`;
      }*/}
        }

        // ✅ BRISANJE OZNAČENIH SLIKA IZ BAZE
        if (deletedImages) {
            try {
                const deletedIds = JSON.parse(deletedImages);
                if (Array.isArray(deletedIds) && deletedIds.length > 0) {
                    const placeholders = deletedIds.map(() => '?').join(',');
                    await pool.query(
                        `DELETE FROM event_image WHERE id IN (${placeholders}) AND event_id = ?`,
                        [...deletedIds, id]
                    );
                }
            } catch (err) {
                console.error("Greška pri parsiranju deletedImages:", err);
            }
        }

        // ✅ KLJUČNI KORAK: Postavi is_primary = 1 SAMO za odabranu glavnu sliku
        if (newMainImage && newMainImage.trim()) {
            // Prvo resetuj sve na 0
            await pool.query(
                `UPDATE event_image SET is_primary = 0 WHERE event_id = ?`,
                [id]
            );

            // Zatim postavi 1 samo za odabranu sliku
            await pool.query(
                `UPDATE event_image SET is_primary = 1 WHERE event_id = ? AND image_path = ?`,
                [id, newMainImage.trim()]
            );
        }

        // ✅ AŽURIRANJE TICKET TYPES
        if (ticketTypes) {
            try {
                const parsedTicketTypes = typeof ticketTypes === "string"
                    ? JSON.parse(ticketTypes)
                    : ticketTypes;

                if (Array.isArray(parsedTicketTypes) && parsedTicketTypes.length > 0) {
                    // Obriši stare ticket types
                    await pool.query(`DELETE FROM ticket_type WHERE event_id = ?`, [id]);

                    // Ubaci nove
                    const ticketTypeValues = parsedTicketTypes.map((tt) => [
                        id,
                        tt.name,
                        tt.price,
                        tt.total_seats
                    ]);

                    await pool.query(
                        `INSERT INTO ticket_type (event_id, name, price, total_seats)
             VALUES ?`,
                        [ticketTypeValues]
                    );
                }
            } catch (err) {
                console.error("Greška pri parsiranju ticketTypes:", err);
            }
        }

        // Ažuriraj event
        await pool.query(
            `UPDATE event SET 
         title = ?,
         description = ?,
         location = ?,
         date_and_time = ?,
         image = ?,
         category_id = ?,
         status = COALESCE(?, status)
       WHERE id = ? AND user_id = ?`,
            [
                title || null,
                description || null,
                location || null,
                date_and_time || null,
                newMainImage,
                Number(category_id),
                status,
                id,
                userId
            ]
        );

        const newStatus = status || oldStatus;

        if (newStatus === "PUBLISHED" && oldStatus === "DRAFT") {
            const [students] = await pool.query(
                `SELECT id FROM \`user\` WHERE role = 'Student' AND id != ?`,
                [userId]
            );

            if (students.length) {
                const values = students.map((s) => [
                    s.id,
                    "Novi događaj",
                    `Događaj "${eventTitle}" je upravo objavljen! Pogledajte ga.`,
                    id,
                    0
                ]);

                await pool.query(
                    `INSERT INTO notification (user_id, title, message, event_id, is_read)
           VALUES ?`,
                    [values]
                );
            }
        }

        const [updated] = await pool.query(
            `SELECT e.id, e.title, e.description, e.location, e.date_and_time, e.image,
              e.user_id, e.category_id, e.status
       FROM event e WHERE e.id = ?`,
            [id]
        );

        const [additionalImages] = await pool.query(
            `SELECT id, image_path, is_primary, display_order 
       FROM event_image 
       WHERE event_id = ? 
       ORDER BY display_order ASC, id ASC`,
            [id]
        );

        const [ticketTypesResult] = await pool.query(
            `SELECT id, name, price, total_seats FROM ticket_type WHERE event_id = ?`,
            [id]
        );

        res.json({
            ...updated[0],
            additional_images: additionalImages,
            ticket_types: ticketTypesResult
        });
    } catch (err) {
        next(err);
    }
}

// ✅ DOHVATI DOGAĐAJE ORGANIZATORA - UČITAVA I DODATNE SLIKE
export async function getOrganizerEvents(req, res, next) {
    try {
        const userId = req.user.id;

        if (!userId || userId <= 0 || isNaN(userId)) {
            return res.status(400).json({ error: "Nevažeći ID korisnika" });
        }

        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.max(1, parseInt(req.query.limit || "9", 10));
        const offset = (page - 1) * limit;

        const q = (req.query.q || "").trim();
        const hasQ = q.length > 0;
        const like = `%${q}%`;

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
       FROM event e
       WHERE e.user_id = ? AND e.deleted_at IS NULL
       ${hasQ ? "AND (e.title LIKE ? OR e.location LIKE ?)" : ""}`,
            hasQ ? [userId, like, like] : [userId]
        );

        const total = Number(countRows?.[0]?.total || 0);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const [events] = await pool.query(
            `SELECT
        e.id, e.title, e.description, e.location, e.date_and_time, e.image,
        e.user_id, e.category_id, e.status,
        CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
        u.username AS organizer_username,
        (
          SELECT ROUND(AVG(cmt.rating), 1)
          FROM comments cmt
          WHERE cmt.event_id = e.id
        ) AS averageRating
      FROM event e
      LEFT JOIN \`user\` u ON u.id = e.user_id
      WHERE e.user_id = ? AND e.deleted_at IS NULL
      ${hasQ ? "AND (e.title LIKE ? OR e.location LIKE ?)" : ""}
      ORDER BY e.date_and_time DESC
      LIMIT ? OFFSET ?`,
            hasQ ? [userId, like, like, limit, offset] : [userId, limit, offset]
        );

        // ✅ UČITAJ TICKET TYPES I DODATNE SLIKE ZA SVAKI EVENT
        for (const event of events) {
            if (!event.id) continue;
            try {
                const [ticketTypes] = await pool.query(
                    `SELECT id, name, price, total_seats FROM ticket_type WHERE event_id = ?`,
                    [event.id]
                );
                event.ticket_types = ticketTypes;

                // ✅ UČITAJ DODATNE SLIKE
                const [additionalImages] = await pool.query(
                    `SELECT id, image_path, is_primary, display_order
           FROM event_image
           WHERE event_id = ?
           ORDER BY display_order ASC, id ASC`,
                    [event.id]
                );
                event.additional_images = additionalImages;
            } catch (err) {
                console.warn(`Neuspješno učitavanje podataka za događaj ${event.id}:`, err.message);
                event.ticket_types = [];
                event.additional_images = [];
            }
        }

        return res.json({
            items: events,
            meta: { page, limit, total, totalPages },
        });
    } catch (err) {
        console.error("Greška u bazi podataka u getOrganizerEvents:", err);
        return res.status(500).json({ error: "Neuspješno učitavanje vaših događaja" });
    }
}

// ✅ SOFT DELETE - BRISANJE DOGAĐAJA OD STRANE ORGANIZATORA
export async function deleteOrganizerEvent(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [existingEvent] = await pool.query(
            "SELECT id FROM `event` WHERE id = ? AND user_id = ? LIMIT 1",
            [id, userId]
        );

        if (!existingEvent.length) {
            return res.status(404).json({ error: "Događaj nije pronađen ili nemate dozvolu" });
        }

        await pool.query("UPDATE `event` SET deleted_at = NOW() WHERE id = ?", [id]);

        res.json({ message: "Događaj je uspješno obrisan" });
    } catch (err) {
        next(err);
    }
}

// ✅ REZERVACIJE ZA DOGAĐAJ
export async function getEventReservations(req, res, next) {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        const [eventCheck] = await pool.query(
            "SELECT id FROM event WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            [eventId, userId]
        );

        if (!eventCheck.length) {
            return res.status(404).json({ error: "Događaj nije pronađen ili nemate dozvolu" });
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

// ✅ PROGRES PRODAJE ZA DOGAĐAJ
export async function getEventSalesProgress(req, res, next) {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        const [eventCheck] = await pool.query(
            "SELECT id FROM event WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            [eventId, userId]
        );
        if (!eventCheck.length) {
            return res.status(403).json({ error: "Niste vlasnik ovog događaja" });
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

// ✅ SOFT DELETE - BRISANJE DOGAĐAJA OD STRANE ADMINISTRATORA
export async function deleteEventById(req, res, next) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            "UPDATE event SET deleted_at = NOW() WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Događaj nije pronađen" });
        }

        console.log(`Administrator je obrisao događaj ${id}`);
        res.json({ message: "Događaj je uspješno obrisan" });
    } catch (err) {
        console.error("Greška u deleteEventById:", err);
        next(err);
    }
}

// ✅ STATISTIKE VREMENA
export async function getEventTimeStats(req, res, next) {
    try {
        const { eventId } = req.params;
        const { period = 'daily' } = req.query;
        const userId = req.user.id;

        const [eventCheck] = await pool.query(
            "SELECT id FROM event WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            [eventId, userId]
        );

        if (!eventCheck.length) {
            return res.status(403).json({ error: "Pristup odbijen" });
        }

        let query = "";
        switch (period) {
            case 'daily':
                query = `
          SELECT HOUR(reservation_date) AS hour, CAST(SUM(number_of_tickets) AS UNSIGNED) AS count 
          FROM reservation WHERE event_id = ? AND DATE(reservation_date) = CURDATE()
          AND HOUR(reservation_date) <= HOUR(NOW())
          GROUP BY hour ORDER BY hour ASC`;
                break;
            case 'weekly':
                query = `
          SELECT DAYNAME(reservation_date) AS day, CAST(SUM(number_of_tickets) AS UNSIGNED) AS count 
          FROM reservation WHERE event_id = ? AND reservation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY day, DAYOFWEEK(reservation_date) ORDER BY DAYOFWEEK(reservation_date) ASC`;
                break;
            case 'monthly':
                query = `
          SELECT DATE_FORMAT(reservation_date, '%d %b') AS date, CAST(SUM(number_of_tickets) AS UNSIGNED) AS count 
          FROM reservation WHERE event_id = ? AND MONTH(reservation_date) = MONTH(CURRENT_DATE()) 
          AND YEAR(reservation_date) = YEAR(CURRENT_DATE())
          GROUP BY date ORDER BY MIN(reservation_date) ASC`;
                break;
            case 'yearly':
                query = `
          SELECT MONTH(reservation_date) AS month, CAST(SUM(number_of_tickets) AS UNSIGNED) AS count 
          FROM reservation WHERE event_id = ? AND YEAR(reservation_date) = YEAR(CURRENT_DATE())
          GROUP BY month ORDER BY month ASC`;
                break;
            default:
                return res.status(400).json({ error: "Nevažeći period" });
        }

        const [stats] = await pool.query(query, [eventId]);
        res.json(stats);
    } catch (err) {
        next(err);
    }
}