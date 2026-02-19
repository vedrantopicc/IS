import { pool } from "../db.js";

export async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT id, user_id, title, message, event_id, is_read, created_at
       FROM notification
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [unreadRows] = await pool.query(
      `SELECT COUNT(*) AS unread
       FROM notification
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({
      items: rows,
      meta: {
        unread: Number(unreadRows?.[0]?.unread || 0),
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
}


export async function markAllRead(req, res, next) {
  try {
    const userId = req.user.id;

    await pool.query(
      `UPDATE notification
       SET is_read = 1
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function markOneRead(req, res, next) {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);

    await pool.query(
      `UPDATE notification
       SET is_read = 1
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
