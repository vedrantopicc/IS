import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/app.js";
import { authHeader, loginAs } from "./helpers/auth.js";
import { ids, resetTestDatabase } from "./helpers/test-db.js";

describe("integration: users and categories API", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns public categories", async () => {
    await request(app)
      .get("/categories")
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: ids.category, name: "edukativni" }),
          ])
        );
      });
  });

  it("allows admin to list active users", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get("/users")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(4);
        expect(res.body[0].password).toBeUndefined();
      });
  });

  it("allows admin to get user by id and returns 404 for missing user", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get(`/users/${ids.student}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ id: ids.student, username: "student" });
      });

    await request(app)
      .get("/users/9999")
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });

  it("returns user role and activity statistics", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .get("/users/stats/roles")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ students: 2, organizers: 1 });
      });

    await request(app)
      .get("/users/stats/activity?period=daily")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .get("/users/stats/activity?period=bad")
      .set("Authorization", authHeader(adminToken))
      .expect(400);
  });

  it("returns weekly, monthly and yearly user activity statistics", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    for (const period of ["weekly", "monthly", "yearly"]) {
      await request(app)
        .get(`/users/stats/activity?period=${period}`)
        .set("Authorization", authHeader(adminToken))
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
      });
    }
  });

  it("returns top active users based on recorded login activity", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await loginAs(app, "student@test.local");
    await loginAs(app, "student@test.local");
    await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/users/stats/top-active")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        const student = res.body.find((item) => item.username === "student");
        expect(Number(student.login_count)).toBe(2);
        expect(res.body.length).toBeLessThanOrEqual(5);
      });
  });

  it("rejects non-admin user listing", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .get("/users")
      .set("Authorization", authHeader(studentToken))
      .expect(403);
  });

  it("allows user to update own profile and returns refreshed token", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/users/${ids.student}`)
      .set("Authorization", authHeader(studentToken))
      .send({ name: "Sara Updated" })
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toMatchObject({ id: ids.student, name: "Sara Updated" });
        expect(res.body.token).toEqual(expect.any(String));
      });
  });

  it("allows user to update own surname and returns refreshed token", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/users/${ids.student}`)
      .set("Authorization", authHeader(studentToken))
      .send({ surname: "Novo Prezime" })
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toMatchObject({
          id: ids.student,
          surname: "Novo Prezime",
        });
        expect(res.body.token).toEqual(expect.any(String));
      });
  });

  it("rejects profile updates without valid fields and self role changes", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/users/${ids.student}`)
      .set("Authorization", authHeader(studentToken))
      .send({})
      .expect(400);

    await request(app)
      .put(`/users/${ids.student}`)
      .set("Authorization", authHeader(studentToken))
      .send({ role: "Admin" })
      .expect(403);
  });

  it("allows admin to change user role and organizer flag", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/users/${ids.secondStudent}`)
      .set("Authorization", authHeader(adminToken))
      .send({ role: "Organizer" })
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toMatchObject({
          id: ids.secondStudent,
          role: "Organizer",
          is_organizer: 1,
        });
        expect(res.body.token).toBeUndefined();
      });
  });

  it("returns 404 when admin updates missing user", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put("/users/9999")
      .set("Authorization", authHeader(adminToken))
      .send({ name: "Missing" })
      .expect(404);
  });

  it("prevents ordinary user from updating another profile", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/users/${ids.secondStudent}`)
      .set("Authorization", authHeader(studentToken))
      .send({ name: "Nedozvoljeno" })
      .expect(403);
  });

  it("soft-deletes and restores user through admin routes", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete(`/users/${ids.secondStudent}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .get("/users/deleted")
      .set("Authorization", authHeader(adminToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.secondStudent })])
        );
      });

    await request(app)
      .patch(`/users/${ids.secondStudent}/restore`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);
  });

  it("returns 404 when restoring missing user", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .patch("/users/9999/restore")
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });

  it("prevents deleting administrator account", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete(`/users/${ids.admin}`)
      .set("Authorization", authHeader(adminToken))
      .expect(403);
  });

  it("returns 404 when admin deletes missing user", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete("/users/9999")
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });
});
