import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret";

export function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Nedostaje ili je neispravno zaglavlje za autorizaciju" });
    }
    const token = auth.slice(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: Number(decoded.sub),
            jti: decoded.jti,
            role: decoded.role,
            isOrganizer: decoded.isOrganizer,
            username: decoded.username,
            name: decoded.name,
            surname: decoded.surname,
            email: decoded.email,
            payload: decoded
        };
        return next();
    } catch {
        return res.status(401).json({ error: "Token je neispravan ili je istekao" });
    }
}

export async function requireAdmin(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        if (!auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Nedostaje ili je neispravno zaglavlje za autorizaciju" });
        }
        const token = auth.slice(7);

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            req.user = { id: Number(decoded.sub), jti: decoded.jti, payload: decoded };
        } catch {
            return res.status(401).json({ error: "Token je neispravan ili je istekao" });
        }
        const [rows] = await pool.query(
            "SELECT role, is_organizer FROM `user` WHERE id = ? LIMIT 1",
            [req.user.id]
        );

        if (!rows.length) {
            return res.status(401).json({ error: "Korisnik nije pronađen" });
        }

        if (rows[0].role !== "Admin") {
            return res.status(403).json({ error: "Potreban je administratorski pristup" });
        }

        next();
    } catch (error) {
        return res.status(500).json({ error: "Provjera autorizacije nije uspjela" });
    }
}

export async function requireOrganizer(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        if (!auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Nedostaje ili je neispravno zaglavlje za autorizaciju" });
        }
        const token = auth.slice(7);

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            req.user = { id: Number(decoded.sub), jti: decoded.jti, payload: decoded };
        } catch {
            return res.status(401).json({ error: "Token je neispravan ili je istekao" });
        }

        const [rows] = await pool.query(
            "SELECT role, is_organizer FROM `user` WHERE id = ? LIMIT 1", // ✅ DODATO is_organizer
            [req.user.id]
        );

        if (!rows.length) {
            return res.status(401).json({ error: "Korisnik nije pronađen" });
        }

        // ✅ ISPRAVNA LOGIKA
        if (rows[0].is_organizer !== 1 && rows[0].role !== "Student") {
            return res.status(403).json({ error: "Potreban je pristup organizatora" });
        }

        next();
    } catch (error) {
        return res.status(500).json({ error: "Provjera autorizacije nije uspjela" });
    }
}

export async function requireSelfOrAdmin(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        if (!auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Nedostaje ili je neispravno zaglavlje za autorizaciju" });
        }
        const token = auth.slice(7);

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            req.user = {
                id: Number(decoded.sub),
                jti: decoded.jti,
                role: decoded.role,
                isOrganizer: decoded.is_organizer,
                username: decoded.username,
                name: decoded.name,
                surname: decoded.surname,
                email: decoded.email,
                payload: decoded
            };
        } catch {
            return res.status(401).json({ error: "Token je neispravan ili je istekao" });
        }

        const targetUserId = Number(req.params.id);

        if (req.user.id === targetUserId || req.user.role === "Admin") {
            return next();
        }

        return res.status(403).json({ error: "Možete ažurirati samo svoj vlastiti profil" });

    } catch (error) {
        return res.status(500).json({ error: "Provjera autorizacije nije uspjela" });
    }
}