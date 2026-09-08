import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/app.js";
import { authHeader, loginAs } from "./helpers/auth.js";
import { getTestConnection, ids, resetTestDatabase } from "./helpers/test-db.js";

describe("integration: security and negative API behavior", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects malformed Bearer tokens on protected routes", async () => {
    await request(app)
      .get("/reservations")
      .set("Authorization", "Bearer definitely-not-a-valid-jwt")
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe("Token je neispravan ili je istekao");
      });
  });

  it("rejects missing authorization headers on protected admin, organizer and self routes", async () => {
    await request(app)
      .get("/admin/dashboard")
      .expect(401);

    await request(app)
      .post("/events/organizer/create")
      .send({
        title: "Bez tokena",
        date_and_time: "2030-12-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 20 }],
      })
      .expect(401);

    await request(app)
      .put(`/users/${ids.student}`)
      .send({ name: "Bez tokena" })
      .expect(401);
  });

  it("rejects invalid JWTs on admin and self-or-admin routes", async () => {
    await request(app)
      .get("/admin/dashboard")
      .set("Authorization", "Bearer invalid-admin-token")
      .expect(401);

    await request(app)
      .put(`/users/${ids.student}`)
      .set("Authorization", "Bearer invalid-self-token")
      .send({ name: "Nece proci" })
      .expect(401);
  });

  it("rejects valid tokens when the referenced admin or organizer no longer exists", async () => {
    const adminToken = await loginAs(app, "admin@test.local");
    const organizerToken = await loginAs(app, "organizer@test.local");

    const connection = await getTestConnection();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      await connection.query("DELETE FROM `user` WHERE id IN (?, ?)", [
        ids.admin,
        ids.organizer,
      ]);
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      await connection.end();
    }

    await request(app)
      .get("/admin/dashboard")
      .set("Authorization", authHeader(adminToken))
      .expect(401);

    await request(app)
      .get("/events/organizer/my-events")
      .set("Authorization", authHeader(organizerToken))
      .expect(401);
  });

  it("does not allow a student to read another user's reservation", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .get(`/reservations/${ids.studentReservation}`)
      .set("Authorization", authHeader(token))
      .expect(404);
  });

  it("does not allow organizer to read statistics for event they do not own", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query(
        `INSERT INTO event
          (id, title, description, location, date_and_time, user_id, category_id, status)
         VALUES
          (99, 'Tudji dogadjaj', 'Opis', 'Sala 9', '2030-10-01 18:00:00', ?, ?, 'PUBLISHED')`,
        [ids.secondStudent, ids.category]
      );
      await connection.query(
        "INSERT INTO ticket_type (id, event_id, name, price, total_seats) VALUES (99, 99, 'Standard', 5, 10)"
      );
    } finally {
      await connection.end();
    }

    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/events/organizer/99/sales-progress")
      .set("Authorization", authHeader(organizerToken))
      .expect(403);

    await request(app)
      .get("/events/organizer/99/time-stats?period=daily")
      .set("Authorization", authHeader(organizerToken))
      .expect(403);
  });

  it("rejects comment payloads with invalid rating and overlong text", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Validan tekst", rating: 0 })
      .expect(400);

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "x".repeat(1001), rating: 5 })
      .expect(400);
  });

  it("treats SQL-injection-like search text as plain input", async () => {
    await request(app)
      .get("/events")
      .query({ search: "' OR 1=1 --" })
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toHaveLength(0);
      });

    await request(app)
      .get("/events")
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toHaveLength(1);
      });
  });

  it("does not expose demo seed endpoint unless explicitly enabled", async () => {
    await request(app)
      .post("/demo/seed")
      .expect(404)
      .expect((res) => {
        expect(res.body.error).toBe("Not Found");
      });
  });

  it("rejects old token after password change invalidates stored tokens", async () => {
    const oldToken = await loginAs(app, "student@test.local");

    await request(app)
      .post("/auth/change-password")
      .set("Authorization", authHeader(oldToken))
      .send({ currentPassword: "Password123!", newPassword: "NewPassword123!" })
      .expect(200);

    await request(app)
      .get("/reservations")
      .set("Authorization", authHeader(oldToken))
      .expect(401);

    await request(app)
      .post("/auth/login")
      .send({ email: "student@test.local", password: "NewPassword123!" })
      .expect(200);
  });

  it("rejects token after logout removes it from token table", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .post("/auth/logout")
      .set("Authorization", authHeader(token))
      .expect(204);

    await request(app)
      .get("/reservations")
      .set("Authorization", authHeader(token))
      .expect(401);
  });

  it("rejects login for soft-deleted user", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query("UPDATE `user` SET deleted_at = NOW() WHERE id = ?", [ids.student]);
    } finally {
      await connection.end();
    }

    await request(app)
      .post("/auth/login")
      .send({ email: "student@test.local", password: "Password123!" })
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe("Neispravni podaci za prijavu");
      });
  });
});
