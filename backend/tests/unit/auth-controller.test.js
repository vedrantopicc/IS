import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNext, mockReq, mockRes } from "../helpers/http.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createUser: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  sign: vi.fn(),
  uuidv4: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  pool: {
    query: mocks.query,
  },
}));

vi.mock("../../controllers/users-controller.js", () => ({
  createUser: mocks.createUser,
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: mocks.compare,
    hash: mocks.hash,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mocks.sign,
  },
}));

vi.mock("uuid", () => ({
  v4: mocks.uuidv4,
}));

vi.mock("../../utils/emailService.js", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

const {
  register,
  login,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
} = await import("../../controllers/auth-controller.js");

describe("auth controller", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("register creates a non-organizer user and returns 201", async () => {
    const created = { id: 11, username: "ana", role: "Student" };
    mocks.createUser.mockResolvedValue(created);
    const req = mockReq({
      body: {
        name: "Ana",
        surname: "Anic",
        email: "ana@example.com",
        username: "ana",
        password: "secret123",
      },
    });
    const res = mockRes();

    await register(req, res);

    expect(mocks.createUser).toHaveBeenCalledWith({
      name: "Ana",
      surname: "Anic",
      email: "ana@example.com",
      username: "ana",
      password: "secret123",
      isOrganizer: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("register returns 400 when user creation validation fails", async () => {
    mocks.createUser.mockRejectedValue(new Error("Nedostaju obavezna polja"));
    const req = mockReq({ body: {} });
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Nedostaju obavezna polja" });
  });

  it("login rejects requests without identifier or password", async () => {
    const req = mockReq({ body: { email: "ana@example.com" } });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("login rejects unknown users", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ body: { email: "missing@example.com", password: "secret123" } });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Neispravni podaci za prijavu" });
  });

  it("login rejects invalid password", async () => {
    mocks.query.mockResolvedValueOnce([[{ id: 1, password: "hash" }]]);
    mocks.compare.mockResolvedValue(false);
    const req = mockReq({ body: { username: "ana", password: "wrong" } });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("login returns token and safe user data for valid credentials", async () => {
    const dbUser = {
      id: 1,
      username: "ana",
      name: "Ana",
      surname: "Anic",
      email: "ana@example.com",
      password: "hash",
      role: "Student",
      is_organizer: 0,
    };
    mocks.query
      .mockResolvedValueOnce([[dbUser]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }]);
    mocks.compare.mockResolvedValue(true);
    mocks.uuidv4.mockReturnValue("jti-123");
    mocks.sign.mockReturnValue("signed.jwt");
    const req = mockReq({ body: { email: "ana@example.com", password: "secret123" } });
    const res = mockRes();

    await login(req, res);

    expect(mocks.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "1", jti: "jti-123", username: "ana" }),
      undefined,
      { expiresIn: undefined }
    );
    expect(res.json).toHaveBeenCalledWith({
      token: "signed.jwt",
      user: expect.not.objectContaining({ password: expect.anything() }),
    });
  });

  it("login returns 500 for unexpected database errors", async () => {
    mocks.query.mockRejectedValueOnce(new Error("database down"));
    const req = mockReq({ body: { email: "ana@example.com", password: "secret123" } });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "database down" });
  });

  it("login uses fallback error message when thrown value has no message", async () => {
    mocks.query.mockRejectedValueOnce({});
    const req = mockReq({ body: { email: "ana@example.com", password: "secret123" } });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining("prijava") });
  });

  it("login handles a null request body as missing credentials", async () => {
    const req = mockReq({ body: null });
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("login still succeeds when activity logging fails", async () => {
    const dbUser = {
      id: 1,
      username: "ana",
      name: "Ana",
      surname: "Anic",
      email: "ana@example.com",
      password: "hash",
      role: "Student",
      is_organizer: 0,
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query
      .mockResolvedValueOnce([[dbUser]])
      .mockRejectedValueOnce(new Error("activity failed"))
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }]);
    mocks.compare.mockResolvedValue(true);
    mocks.uuidv4.mockReturnValue("jti-123");
    mocks.sign.mockReturnValue("signed.jwt");
    const req = mockReq({ body: { email: "ana@example.com", password: "secret123" } });
    const res = mockRes();

    await login(req, res);

    expect(res.json).toHaveBeenCalledWith({
      token: "signed.jwt",
      user: expect.objectContaining({ id: 1, username: "ana" }),
    });
  });

  it("changePassword rejects unauthenticated requests", async () => {
    const req = mockReq({ body: { currentPassword: "old", newPassword: "newpass" } });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("changePassword validates minimum new password length", async () => {
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "oldpass", newPassword: "123" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("changePassword requires current and new password", async () => {
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "oldpass" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Trenutna i nova lozinka su obavezne" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("changePassword handles a null body as missing passwords", async () => {
    const req = mockReq({
      user: { id: 3 },
      body: null,
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("changePassword returns 404 when authenticated user no longer exists", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Korisnik nije pronađen" });
  });

  it("changePassword rejects wrong current password", async () => {
    mocks.query.mockResolvedValueOnce([[{ id: 3, password: "old-hash" }]]);
    mocks.compare.mockResolvedValue(false);
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "wrong", newPassword: "newpass" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Trenutna lozinka nije ispravna" });
  });

  it("changePassword updates password and invalidates existing tokens", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 3, password: "old-hash" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue("new-hash");
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(mocks.hash).toHaveBeenCalledWith("newpass", 10);
    expect(res.json).toHaveBeenCalledWith({ message: "Lozinka je uspješno promijenjena" });
  });

  it("changePassword still succeeds when token invalidation fails", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 3, password: "old-hash" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockRejectedValueOnce(new Error("token update failed"));
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue("new-hash");
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ message: "Lozinka je uspješno promijenjena" });
  });

  it("changePassword forwards unexpected errors to middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({
      user: { id: 3 },
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("logout deletes current token and returns 204", async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ user: { id: 3, jti: "jti-123" } });
    const res = mockRes();
    const next = mockNext();

    await logout(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith("DELETE FROM `token` WHERE id = ? AND user_id = ?", [
      "jti-123",
      3,
    ]);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it("logout returns 204 even without token metadata or when delete fails", async () => {
    const noTokenReq = mockReq({ user: {} });
    const noTokenRes = mockRes();
    const noTokenNext = mockNext();

    await logout(noTokenReq, noTokenRes, noTokenNext);

    expect(noTokenRes.status).toHaveBeenCalledWith(204);
    expect(mocks.query).not.toHaveBeenCalled();

    mocks.query.mockRejectedValueOnce(new Error("delete failed"));
    const deleteFailReq = mockReq({ user: { id: 3, jti: "jti-123" } });
    const deleteFailRes = mockRes();
    const deleteFailNext = mockNext();

    await logout(deleteFailReq, deleteFailRes, deleteFailNext);

    expect(deleteFailRes.status).toHaveBeenCalledWith(204);
    expect(deleteFailNext).not.toHaveBeenCalled();
  });

  it("logout forwards unexpected response errors to middleware", async () => {
    const err = new Error("response failed");
    const req = mockReq({ user: {} });
    const res = mockRes();
    res.status.mockImplementation(() => {
      throw err;
    });
    const next = mockNext();

    await logout(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("forgotPassword does not reveal whether email exists", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ body: { email: "missing@example.com" } });
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: "Poslat vam je e-mail za ponovno postavljanje lozinke.",
    });
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("forgotPassword requires email", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "E-mail je obavezan" });
  });

  it("forgotPassword creates token and sends email for existing account", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ insertId: 1 }]);
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
    const req = mockReq({ body: { email: "student@test.local" } });
    const res = mockRes();

    await forgotPassword(req, res);

    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      "student@test.local",
      expect.any(String)
    );
    expect(res.json).toHaveBeenCalledWith({
      message: "Poslat vam je e-mail za ponovno postavljanje lozinke.",
    });
  });

  it("forgotPassword returns 500 for unexpected database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(new Error("database down"));
    const req = mockReq({ body: { email: "student@test.local" } });
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Greška na serveru" });
  });

  it("resetPassword validates required fields and password length", async () => {
    const missingReq = mockReq({ body: {} });
    const missingRes = mockRes();

    await resetPassword(missingReq, missingRes);

    expect(missingRes.status).toHaveBeenCalledWith(400);

    const shortReq = mockReq({ body: { token: "token", newPassword: "123" } });
    const shortRes = mockRes();

    await resetPassword(shortReq, shortRes);

    expect(shortRes.status).toHaveBeenCalledWith(400);
    expect(shortRes.json).toHaveBeenCalledWith({ error: "Lozinka mora imati najmanje 6 znakova" });
  });

  it("resetPassword rejects expired or invalid reset tokens", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ body: { token: "expired", newPassword: "newpass" } });
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Token je neispravan ili je istekao" });
  });

  it("resetPassword hashes new password and deletes used reset token", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ user_id: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.hash.mockResolvedValue("new-hash");
    const req = mockReq({ body: { token: "valid-token", newPassword: "newpass" } });
    const res = mockRes();

    await resetPassword(req, res);

    expect(mocks.hash).toHaveBeenCalledWith("newpass", 10);
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE `user` SET password = ? WHERE id = ?",
      ["new-hash", 3]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      3,
      "DELETE FROM password_reset_tokens WHERE token = ?",
      ["valid-token"]
    );
  });

  it("resetPassword returns 500 for unexpected database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(new Error("database down"));
    const req = mockReq({ body: { token: "valid-token", newPassword: "newpass" } });
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Greška na serveru" });
  });
});
