import { pool } from "../db.js";

export async function getAllCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM category ORDER BY name ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
