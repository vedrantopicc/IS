import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/app.js";
import { authHeader, loginAs } from "./helpers/auth.js";
import { getTestConnection, ids, resetTestDatabase } from "./helpers/test-db.js";

describe("integration: admin, role requests and notifications API", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns admin dashboard data for admin users", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get("/admin/dashboard")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(Number(res.body.users.total_users)).toBeGreaterThanOrEqual(3);
        expect(Number(res.body.events.total_events)).toBe(1);
      });
  });

  it("admin dashboard does not count soft-deleted users", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete(`/users/${ids.secondStudent}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .get("/admin/dashboard")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(Number(res.body.users.total_users)).toBe(2);
      });
  });

  it("returns admin event list with calculated revenue", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get("/admin/events")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: ids.event,
              title: "Node.js radionica",
              organizer_username: "organizer",
            }),
          ])
        );
        const event = res.body.find((item) => item.id === ids.event);
        expect(Number(event.total_revenue)).toBe(10);
      });
  });

  it("returns admin users, user count and role stats", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get("/admin/users")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(4);
      });

    await request(app)
      .get("/admin/user-count")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(Number(res.body.user_count)).toBe(3);
      });

    await request(app)
      .get("/admin/stats/roles")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ students: 2, organizers: 1 });
      });
  });

  it("soft-deletes, lists and restores a user through admin routes", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete(`/admin/users/${ids.secondStudent}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .get("/admin/deleted-users")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.secondStudent })])
        );
      });

    await request(app)
      .post(`/admin/users/${ids.secondStudent}/restore`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .get("/admin/users")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.secondStudent })])
        );
      });
  });

  it("returns user stats and 404 for missing user", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get(`/admin/users/${ids.organizer}/stats`)
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toMatchObject({ id: ids.organizer, username: "organizer" });
        expect(res.body.event_count).toBe(2);
      });

    await request(app)
      .get("/admin/users/9999/stats")
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });

  it("rejects admin dashboard access for non-admin users", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .get("/admin/dashboard")
      .set("Authorization", authHeader(studentToken))
      .expect(403);

    await request(app)
      .get("/admin/events")
      .set("Authorization", authHeader(studentToken))
      .expect(403);

    await request(app)
      .get("/admin/role-requests")
      .set("Authorization", authHeader(studentToken))
      .expect(403);
  });

  it("rejects duplicate pending role request", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post("/role-requests")
      .set("Authorization", authHeader(token))
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Već imate zahtjev na čekanju");
      });
  });

  it("rejects role request from user who is already organizer", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/role-requests")
      .set("Authorization", authHeader(organizerToken))
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Već ste organizator");
      });
  });

  it("creates role request for eligible student and lists it for admin", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query("DELETE FROM role_requests WHERE user_id = ?", [ids.secondStudent]);
    } finally {
      await connection.end();
    }

    const studentToken = await loginAs(app, "student2@test.local");
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .post("/role-requests")
      .set("Authorization", authHeader(studentToken))
      .expect(201);

    await request(app)
      .get("/admin/role-requests")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ user_id: ids.secondStudent })])
        );
      });
  });

  it("approves pending organizer request and updates database state", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/admin/role-requests/${ids.pendingRoleRequest}/approve`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    const connection = await getTestConnection();
    try {
      const [users] = await connection.query("SELECT is_organizer FROM `user` WHERE id = ?", [
        ids.secondStudent,
      ]);
      const [requests] = await connection.query("SELECT status FROM role_requests WHERE id = ?", [
        ids.pendingRoleRequest,
      ]);

      expect(users[0].is_organizer).toBe(1);
      expect(requests[0].status).toBe("approved");
    } finally {
      await connection.end();
    }
  });

  it("rejects pending organizer request and stores rejected status", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/admin/role-requests/${ids.pendingRoleRequest}/reject`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    const connection = await getTestConnection();
    try {
      const [requests] = await connection.query("SELECT status FROM role_requests WHERE id = ?", [
        ids.pendingRoleRequest,
      ]);
      expect(requests[0].status).toBe("rejected");
    } finally {
      await connection.end();
    }
  });

  it("allows student to create event after admin approves organizer request", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/admin/role-requests/${ids.pendingRoleRequest}/approve`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    const promotedStudentToken = await loginAs(app, "student2@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(promotedStudentToken))
      .send({
        title: "Event nakon odobrenja",
        date_and_time: "2030-12-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 20 }],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.user_id).toBe(ids.secondStudent);
      });
  });

  it("removes organizer access immediately after admin downgrades user role", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/users/${ids.organizer}`)
      .set("Authorization", authHeader(adminToken))
      .send({ role: "Student" })
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toMatchObject({
          id: ids.organizer,
          role: "Student",
          is_organizer: 0,
        });
      });

    const downgradedToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(downgradedToken))
      .send({
        title: "Nema pristup",
        date_and_time: "2030-12-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 20 }],
      })
      .expect(403);
  });

  it("keeps rejected student without organizer access", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/admin/role-requests/${ids.pendingRoleRequest}/reject`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    const rejectedStudentToken = await loginAs(app, "student2@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(rejectedStudentToken))
      .send({
        title: "Ne smije kreirati",
        date_and_time: "2030-12-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 20 }],
      })
      .expect(403);
  });

  it("returns 404 when approving already processed request", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/admin/role-requests/${ids.pendingRoleRequest}/approve`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .put(`/admin/role-requests/${ids.pendingRoleRequest}/approve`)
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });

  it("returns 404 when approving or rejecting missing role request", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put("/admin/role-requests/9999/approve")
      .set("Authorization", authHeader(adminToken))
      .expect(404);

    await request(app)
      .put("/admin/role-requests/9999/reject")
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });

  it("returns notifications and marks them as read for current user", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .get("/notifications")
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.notification, is_read: 0 })])
        );
        expect(res.body.meta.unread).toBe(1);
      });

    await request(app)
      .patch(`/notifications/${ids.notification}/read`)
      .set("Authorization", authHeader(token))
      .expect(200);

    await request(app)
      .get("/notifications")
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.unread).toBe(0);
      });
  });

  it("normalizes notification pagination query values", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .get("/notifications?page=-3&limit=999")
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body.meta).toMatchObject({ page: 1, limit: 50 });
      });
  });

  it("marks all notifications as read", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .patch("/notifications/read-all")
      .set("Authorization", authHeader(token))
      .expect(200);

    await request(app)
      .get("/notifications")
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.unread).toBe(0);
      });
  });

  it("does not allow user to mark another user's notification as read", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .patch(`/notifications/${ids.notification}/read`)
      .set("Authorization", authHeader(token))
      .expect(200);

    const ownerToken = await loginAs(app, "student@test.local");

    await request(app)
      .get("/notifications")
      .set("Authorization", authHeader(ownerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.unread).toBe(1);
      });
  });
});
