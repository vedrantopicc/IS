import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNext, mockReq, mockRes } from "../helpers/http.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  hash: vi.fn(),
  sign: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  pool: {
    query: mocks.query,
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mocks.hash,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mocks.sign,
  },
}));

const {
  getAllUsers,
  createUser,
  getUserById,
  updateUserById,
  deleteUserById,
  restoreUserById,
  getDeletedUsers,
  getUserRoleStats,
  getAdminActivityStats,
  getTopActiveUsers,
} = await import("../../controllers/users-controller.js");

describe("users controller", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.hash.mockReset();
    mocks.sign.mockReset();
  });

  it("getAllUsers returns active users", async () => {
    const rows = [{ id: 1, username: "ana" }];
    mocks.query.mockResolvedValueOnce([rows]);
    const res = mockRes();
    const next = mockNext();

    await getAllUsers(mockReq(), res, next);

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("WHERE deleted_at IS NULL"));
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  it("getAllUsers forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const res = mockRes();
    const next = mockNext();

    await getAllUsers(mockReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("createUser rejects missing required fields before touching database", async () => {
    await expect(createUser({ email: "ana@example.com" })).rejects.toThrow("Nedostaju obavezna polja");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createUser rejects duplicate email or username", async () => {
    mocks.query.mockResolvedValueOnce([[{ id: 12 }]]);

    await expect(
      createUser({
        name: "Ana",
        surname: "Anic",
        email: "ana@example.com",
        username: "ana",
        password: "secret123",
      })
    ).rejects.toThrow("u upotrebi");
    expect(mocks.hash).not.toHaveBeenCalled();
  });

  it("createUser rejects invalid email and short password", async () => {
    await expect(
      createUser({
        name: "Ana",
        surname: "Anic",
        email: "nije-email",
        username: "ana",
        password: "secret123",
      })
    ).rejects.toThrow("E-mail");

    await expect(
      createUser({
        name: "Ana",
        surname: "Anic",
        email: "ana@example.com",
        username: "ana",
        password: "123",
      })
    ).rejects.toThrow("Lozinka");

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createUser hashes password, inserts student and returns safe user data", async () => {
    const user = {
      id: 10,
      username: "ana",
      name: "Ana",
      surname: "Anic",
      email: "ana@example.com",
      role: "Student",
      is_organizer: 0,
    };
    mocks.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([[user]]);
    mocks.hash.mockResolvedValue("hashed-password");

    const result = await createUser({
      name: "Ana",
      surname: "Anic",
      email: "ana@example.com",
      username: "ana",
      password: "secret123",
    });

    expect(mocks.hash).toHaveBeenCalledWith("secret123", 10);
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "INSERT INTO `user` (username, name, surname, email, password, role, is_organizer) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["ana", "Ana", "Anic", "ana@example.com", "hashed-password", "Student", false]
    );
    expect(result).toEqual(user);
    expect(result.password).toBeUndefined();
  });

  it("createUser can create organizer accounts", async () => {
    const user = {
      id: 11,
      username: "org",
      name: "Olga",
      surname: "Org",
      email: "org@example.com",
      role: "Organizer",
      is_organizer: 1,
    };
    mocks.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 11 }])
      .mockResolvedValueOnce([[user]]);
    mocks.hash.mockResolvedValue("hashed-password");

    const result = await createUser({
      name: "Olga",
      surname: "Org",
      email: "org@example.com",
      username: "org",
      password: "secret123",
      isOrganizer: true,
    });

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO `user`"),
      ["org", "Olga", "Org", "org@example.com", "hashed-password", "Organizer", true]
    );
    expect(result).toEqual(user);
  });

  it("getUserById returns 404 when user does not exist", async () => {
    mocks.query.mockResolvedValue([[]]);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    const next = mockNext();

    await getUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("getUserById returns a user when found", async () => {
    const user = { id: 4, username: "ana", role: "Student" };
    mocks.query.mockResolvedValueOnce([[user]]);
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    const next = mockNext();

    await getUserById(req, res, next);

    expect(res.json).toHaveBeenCalledWith(user);
  });

  it("getUserById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    const next = mockNext();

    await getUserById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("updateUserById rejects empty update body", async () => {
    const req = mockReq({
      params: { id: "4" },
      body: {},
      user: { id: 4, role: "Student" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("updateUserById rejects role changes by non-admin user", async () => {
    const req = mockReq({
      params: { id: "4" },
      body: { role: "Admin" },
      user: { id: 4, role: "Student" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("updateUserById rejects updates to another user by non-admin", async () => {
    const req = mockReq({
      params: { id: "5" },
      body: { name: "Novo" },
      user: { id: 4, role: "Student" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("updateUserById lets admins update roles without issuing a token", async () => {
    const updated = {
      id: 5,
      username: "org",
      name: "Olga",
      surname: "Org",
      email: "org@example.com",
      role: "Organizer",
      is_organizer: 1,
    };
    mocks.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);
    const req = mockReq({
      params: { id: "5" },
      body: { name: "Olga", role: "Organizer" },
      user: { id: 1, role: "Admin" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("UPDATE `user` SET name = ?, role = ?, is_organizer = ? WHERE id = ?"),
      ["Olga", "Organizer", 1, "5"]
    );
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ user: updated });
  });

  it("updateUserById lets admins downgrade users to student role", async () => {
    const updated = {
      id: 5,
      username: "org",
      name: "Olga",
      surname: "Org",
      email: "org@example.com",
      role: "Student",
      is_organizer: 0,
    };
    mocks.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);
    const req = mockReq({
      params: { id: "5" },
      body: { role: "Student" },
      user: { id: 1, role: "Admin" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("UPDATE `user` SET role = ?, is_organizer = ? WHERE id = ?"),
      ["Student", 0, "5"]
    );
    expect(res.json).toHaveBeenCalledWith({ user: updated });
  });

  it("updateUserById returns 404 when update affects no users", async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const req = mockReq({
      params: { id: "5" },
      body: { name: "Nema" },
      user: { id: 1, role: "Admin" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updateUserById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({
      params: { id: "4" },
      body: { name: "Ana" },
      user: { id: 4, role: "Student" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("updateUserById returns updated user and refreshed token for own profile", async () => {
    const updated = {
      id: 4,
      username: "ana",
      name: "Ana",
      surname: "Novo",
      email: "ana@example.com",
      role: "Student",
      is_organizer: 0,
    };
    mocks.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);
    mocks.sign.mockReturnValue("fresh.jwt");
    const req = mockReq({
      params: { id: "4" },
      body: { surname: "Novo" },
      user: { id: 4, role: "Student", jti: "token-id" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserById(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ user: updated, token: "fresh.jwt" });
  });

  it("deleteUserById refuses to soft-delete administrators", async () => {
    mocks.query.mockResolvedValueOnce([[{ id: 1, username: "admin", role: "Admin" }]]);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    const next = mockNext();

    await deleteUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("deleteUserById returns 404 when user is missing", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();
    const next = mockNext();

    await deleteUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deleteUserById soft-deletes non-admin users", async () => {
    const existing = { id: 4, username: "ana", role: "Student" };
    mocks.query
      .mockResolvedValueOnce([[existing]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    const next = mockNext();

    await deleteUserById(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(2, "UPDATE `user` SET deleted_at = NOW() WHERE id = ?", ["4"]);
    expect(res.json).toHaveBeenCalledWith({ message: "Korisnik je uspješno obrisan", deletedUser: existing });
  });

  it("deleteUserById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    const next = mockNext();

    await deleteUserById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("restoreUserById returns 404 when no deleted user was restored", async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const req = mockReq({ params: { id: "88" } });
    const res = mockRes();
    const next = mockNext();

    await restoreUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("restoreUserById restores deleted users", async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: "88" } });
    const res = mockRes();
    const next = mockNext();

    await restoreUserById(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ message: "Korisnik je uspješno vraćen" });
  });

  it("restoreUserById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "88" } });
    const res = mockRes();
    const next = mockNext();

    await restoreUserById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getDeletedUsers returns deleted users", async () => {
    const rows = [{ id: 9, username: "deleted" }];
    mocks.query.mockResolvedValueOnce([rows]);
    const res = mockRes();
    const next = mockNext();

    await getDeletedUsers(mockReq(), res, next);

    expect(res.json).toHaveBeenCalledWith(rows);
  });

  it("getDeletedUsers forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const res = mockRes();
    const next = mockNext();

    await getDeletedUsers(mockReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getUserRoleStats returns role distribution", async () => {
    const stats = { students: 12, organizers: 3 };
    mocks.query.mockResolvedValueOnce([[stats]]);
    const res = mockRes();
    const next = mockNext();

    await getUserRoleStats(mockReq(), res, next);

    expect(res.json).toHaveBeenCalledWith(stats);
  });

  it("getUserRoleStats forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const res = mockRes();
    const next = mockNext();

    await getUserRoleStats(mockReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getAdminActivityStats rejects unsupported period", async () => {
    const req = mockReq({ query: { period: "decade" } });
    const res = mockRes();
    const next = mockNext();

    await getAdminActivityStats(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("getAdminActivityStats supports weekly, monthly and yearly periods", async () => {
    const periods = ["weekly", "monthly", "yearly"];

    for (const period of periods) {
      mocks.query.mockResolvedValueOnce([[{ count: 1 }]]);
      const req = mockReq({ query: { period } });
      const res = mockRes();
      const next = mockNext();

      await getAdminActivityStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith([{ count: 1 }]);
    }

    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("getAdminActivityStats forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ query: { period: "daily" } });
    const res = mockRes();
    const next = mockNext();

    await getAdminActivityStats(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getTopActiveUsers returns most active users", async () => {
    const rows = [{ username: "student", name: "Sara", surname: "Student", login_count: 4 }];
    mocks.query.mockResolvedValueOnce([rows]);
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await getTopActiveUsers(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY login_count DESC LIMIT 5"));
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  it("getTopActiveUsers forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await getTopActiveUsers(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
