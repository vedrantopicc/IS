import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/app.js";
import { authHeader, loginAs } from "./helpers/auth.js";
import { getTestConnection, ids, resetTestDatabase } from "./helpers/test-db.js";

describe("integration: auth API", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("registers a new student and then logs in with created credentials", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Novi",
        surname: "Student",
        email: "new.student@test.local",
        username: "newstudent",
        password: "Password123!",
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          username: "newstudent",
          email: "new.student@test.local",
          role: "Student",
        });
        expect(res.body.password).toBeUndefined();
      });

    await request(app)
      .post("/auth/login")
      .send({ email: "new.student@test.local", password: "Password123!" })
      .expect(200)
      .expect((res) => {
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.user.password).toBeUndefined();
      });
  });

  it("rejects duplicate registration with real database unique checks", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Dupli",
        surname: "Email",
        email: "student@test.local",
        username: "different-username",
        password: "Password123!",
      })
      .expect(400);
  });

  it("rejects registration with missing required fields and duplicate username", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Nema",
        surname: "Lozinku",
        email: "missing.password@test.local",
        username: "missingpassword",
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain("Nedostaju");
      });

    await request(app)
      .post("/auth/register")
      .send({
        name: "Dupli",
        surname: "Username",
        email: "unique.email@test.local",
        username: "student",
        password: "Password123!",
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain("upotrebi");
      });
  });

  it("rejects registration with invalid email format or weak password", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Los",
        surname: "Email",
        email: "nije-email",
        username: "bademail",
        password: "Password123!",
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("E-mail adresa nije važeća");
      });

    await request(app)
      .post("/auth/register")
      .send({
        name: "Slaba",
        surname: "Lozinka",
        email: "weak.password@test.local",
        username: "weakpassword",
        password: "123",
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Lozinka mora imati najmanje 6 znakova");
      });
  });

  it("rejects login with incorrect password", async () => {
    await request(app)
      .post("/auth/login")
      .send({ email: "student@test.local", password: "wrong-password" })
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe("Neispravni podaci za prijavu");
      });
  });

  it("rejects login without credentials and accepts username login", async () => {
    await request(app)
      .post("/auth/login")
      .send({ email: "student@test.local" })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain("lozinka");
      });

    await request(app)
      .post("/auth/login")
      .send({ username: "student", password: "Password123!" })
      .expect(200)
      .expect((res) => {
        expect(res.body.user).toMatchObject({ username: "student" });
        expect(res.body.token).toEqual(expect.any(String));
      });
  });

  it("protects authenticated routes and allows logout with valid token", async () => {
    await request(app).post("/auth/logout").expect(401);

    const token = await loginAs(app, "student@test.local");

    await request(app)
      .post("/auth/logout")
      .set("Authorization", authHeader(token))
      .expect(204);
  });

  it("changes password only when current password is valid", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .post("/auth/change-password")
      .set("Authorization", authHeader(token))
      .send({ currentPassword: "bad-password", newPassword: "NewPassword123!" })
      .expect(401);

    await request(app)
      .post("/auth/change-password")
      .set("Authorization", authHeader(token))
      .send({ currentPassword: "Password123!", newPassword: "NewPassword123!" })
      .expect(200);

    await request(app)
      .post("/auth/login")
      .send({ email: "student@test.local", password: "NewPassword123!" })
      .expect(200);
  });

  it("validates change password and forgot/reset password payloads", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .post("/auth/change-password")
      .set("Authorization", authHeader(token))
      .send({ currentPassword: "Password123!" })
      .expect(400);

    await request(app)
      .post("/auth/change-password")
      .set("Authorization", authHeader(token))
      .send({ currentPassword: "Password123!", newPassword: "123" })
      .expect(400);

    await request(app)
      .post("/auth/forgot-password")
      .send({})
      .expect(400);

    await request(app)
      .post("/auth/reset-password")
      .send({ token: "missing-new-password" })
      .expect(400);

    await request(app)
      .post("/auth/reset-password")
      .send({ token: "any-token", newPassword: "123" })
      .expect(400);
  });

  it("creates password reset token without sending a real email", async () => {
    await request(app)
      .post("/auth/forgot-password")
      .send({ email: "student@test.local" })
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toContain("e-mail");
      });

    const connection = await getTestConnection();
    try {
      const [rows] = await connection.query(
        "SELECT user_id, token FROM password_reset_tokens WHERE user_id = ?",
        [ids.student]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].token).toEqual(expect.any(String));
    } finally {
      await connection.end();
    }
  });

  it("forgot password returns same response for missing email account", async () => {
    await request(app)
      .post("/auth/forgot-password")
      .send({ email: "nema.korisnika@test.local" })
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe("Poslat vam je e-mail za ponovno postavljanje lozinke.");
      });

    const connection = await getTestConnection();
    try {
      const [rows] = await connection.query("SELECT id FROM password_reset_tokens");
      expect(rows).toHaveLength(0);
    } finally {
      await connection.end();
    }
  });

  it("resets password using a valid reset token", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
        [ids.student, "valid-reset-token"]
      );
    } finally {
      await connection.end();
    }

    await request(app)
      .post("/auth/reset-password")
      .send({ token: "valid-reset-token", newPassword: "ResetPassword123!" })
      .expect(200);

    await request(app)
      .post("/auth/login")
      .send({ email: "student@test.local", password: "ResetPassword123!" })
      .expect(200);
  });

  it("rejects expired reset token and prevents reset token reuse", async () => {
    let connection = await getTestConnection();
    try {
      await connection.query(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 MINUTE))",
        [ids.student, "expired-reset-token"]
      );
      await connection.query(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
        [ids.secondStudent, "one-time-reset-token"]
      );
    } finally {
      await connection.end();
    }

    await request(app)
      .post("/auth/reset-password")
      .send({ token: "expired-reset-token", newPassword: "ResetPassword123!" })
      .expect(400);

    await request(app)
      .post("/auth/reset-password")
      .send({ token: "one-time-reset-token", newPassword: "ResetPassword123!" })
      .expect(200);

    await request(app)
      .post("/auth/reset-password")
      .send({ token: "one-time-reset-token", newPassword: "AnotherPassword123!" })
      .expect(400);

    connection = await getTestConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id FROM password_reset_tokens WHERE token = ?",
        ["one-time-reset-token"]
      );
      expect(rows).toHaveLength(0);
    } finally {
      await connection.end();
    }
  });
});
