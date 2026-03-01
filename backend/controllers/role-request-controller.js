// controllers/roleRequestController.js
import { pool } from "../db.js";

export async function createRoleRequest(req, res) {
    try {
        const userId = req.user.id;

        // Provjeri da li je već organizator
        const [user] = await pool.query("SELECT is_organizer FROM user WHERE id = ?", [userId]);
        if (user[0]?.is_organizer) {
            return res.status(400).json({ error: "Već ste organizator" });
        }

        // Provjeri da li već ima zahtjev na čekanju
        const [existing] = await pool.query(
            "SELECT id FROM role_requests WHERE user_id = ? AND status = 'pending'",
            [userId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: "Već imate zahtjev na čekanju" });
        }

        // Kreiraj zahtjev
        await pool.query("INSERT INTO role_requests (user_id) VALUES (?)", [userId]);

        res.status(201).json({ message: "Zahtjev je poslan. Administrator će ga pregledati." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Neuspješno slanje zahtjeva" });
    }
}