import { pool } from "../db.js";

export const getEventComments = async (req, res) => {
    try {
        const { eventId } = req.params;

        const [comments] = await pool.execute(`
      SELECT 
        c.id,
        c.comment_text,
        c.rating,
        DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s.000Z') as created_at,
        DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:%s.000Z') as updated_at,
        c.user_id,
        c.event_id,
        u.name,
        u.surname,
        u.username
      FROM comments c
      JOIN user u ON c.user_id = u.id
      WHERE c.event_id = ?
      ORDER BY c.created_at DESC
    `, [eventId]);

        res.json(comments);
    } catch (error) {
        console.error("Greška pri preuzimanju recenzija događaja:", error);
        res.status(500).json({ message: "Neuspješno preuzimanje recenzija" });
    }
};

export const createComment = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { comment_text, rating } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole !== 'Student') {
            return res.status(403).json({ message: "Samo studenti mogu dodavati recenzije" });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Ocjena je obavezna (1-5 zvjezdica)" });
        }

        if (comment_text && comment_text.length > 1000) {
            return res.status(400).json({ message: "Komentar je predugačak (najviše 1000 znakova)" });
        }

        const [eventCheck] = await pool.execute(
            "SELECT id FROM event WHERE id = ?",
            [eventId]
        );

        if (eventCheck.length === 0) {
            return res.status(404).json({ message: "Događaj nije pronađen" });
        }

        const [event] = await pool.execute(
            "SELECT user_id FROM event WHERE id = ?",
            [eventId]
        );

        if (event.length > 0 && event[0].user_id === userId) {
            return res.status(403).json({
                message: "Organizatori ne mogu ocjenjivati svoje vlastite događaje"
            });
        }

        const [existingReview] = await pool.execute(
            "SELECT id FROM comments WHERE user_id = ? AND event_id = ?",
            [userId, eventId]
        );

        if (existingReview.length > 0) {
            return res.status(409).json({ message: "Već ste ocijenili ovaj događaj" });
        }

        const [result] = await pool.execute(`
      INSERT INTO comments (user_id, event_id, comment_text, rating, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [userId, eventId, comment_text ? comment_text.trim() : "", rating]);

        const [newComment] = await pool.execute(`
      SELECT 
        c.id,
        c.comment_text,
        c.rating,
        DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s.000Z') as created_at,
        DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:%s.000Z') as updated_at,
        c.user_id,
        c.event_id,
        u.name,
        u.surname,
        u.username
      FROM comments c
      JOIN user u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

        res.status(201).json(newComment[0]);
    } catch (error) {
        console.error("Greška pri kreiranju recenzije:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Već ste ocijenili ovaj događaj" });
        }
        res.status(500).json({ message: "Neuspješno kreiranje recenzije" });
    }
};

export const updateComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { comment_text, rating } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole !== 'Student') {
            return res.status(403).json({ message: "Samo studenti mogu uređivati recenzije" });
        }

        // Validacija: OCJENA JE OBAVEZNA
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Ocjena je obavezna (1-5 zvjezdica)" });
        }

        // Validacija dužine teksta (ako je proslijeđen)
        if (comment_text && comment_text.length > 1000) {
            return res.status(400).json({ message: "Komentar je predugačak (najviše 1000 znakova)" });
        }

        const [commentCheck] = await pool.execute(
            "SELECT user_id FROM comments WHERE id = ?",
            [commentId]
        );

        if (commentCheck.length === 0) {
            return res.status(404).json({ message: "Recenzija nije pronađena" });
        }

        if (commentCheck[0].user_id !== userId) {
            return res.status(403).json({ message: "Možete uređivati samo svoje vlastite recenzije" });
        }

        await pool.execute(`
      UPDATE comments 
      SET comment_text = ?, rating = ?, updated_at = NOW() 
      WHERE id = ?
    `, [comment_text ? comment_text.trim() : "", rating, commentId]);

        const [updatedComment] = await pool.execute(`
      SELECT 
        c.id,
        c.comment_text,
        c.rating,
        DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s.000Z') as created_at,
        DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:%s.000Z') as updated_at,
        c.user_id,
        c.event_id,
        u.name,
        u.surname,
        u.username
      FROM comments c
      JOIN user u ON c.user_id = u.id
      WHERE c.id = ?
    `, [commentId]);

        res.json(updatedComment[0]);
    } catch (error) {
        console.error("Greška pri ažuriranju recenzije:", error);
        res.status(500).json({ message: "Neuspješno ažuriranje recenzije" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole !== 'Student') {
            return res.status(403).json({ message: "Samo studenti mogu brisati recenzije" });
        }

        const [commentCheck] = await pool.execute(
            "SELECT user_id FROM comments WHERE id = ?",
            [commentId]
        );

        if (commentCheck.length === 0) {
            return res.status(404).json({ message: "Recenzija nije pronađena" });
        }

        if (commentCheck[0].user_id !== userId) {
            return res.status(403).json({ message: "Možete brisati samo svoje vlastite recenzije" });
        }

        await pool.execute("DELETE FROM comments WHERE id = ?", [commentId]);

        res.json({ message: "Recenzija je uspješno obrisana" });
    } catch (error) {
        console.error("Greška pri brisanju recenzije:", error);
        res.status(500).json({ message: "Neuspješno brisanje recenzije" });
    }
};