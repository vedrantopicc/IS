import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNext, mockReq, mockRes } from "../helpers/http.js";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  query: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mocks.verify,
  },
}));

vi.mock("../../db.js", () => ({
  pool: {
    query: mocks.query,
  },
}));

const {
  requireAuth,
  requireAdmin,
  requireOrganizer,
  requireSelfOrAdmin,
} = await import("../../middleware/auth-middleware.js");

describe("auth middleware", () => {
  beforeEach(() => {
    mocks.verify.mockReset();
    mocks.query.mockReset();
  });

  it("requireAuth rejects requests without Bearer token", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Nedostaje ili je neispravno zaglavlje za autorizaciju",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAuth attaches decoded user and continues for valid token", async () => {
    mocks.verify.mockReturnValue({
      sub: "7",
      jti: "token-id",
      role: "Student",
      username: "student1",
      name: "Ana",
      surname: "Anic",
      email: "ana@example.com",
    });
    mocks.query.mockResolvedValue([[{ id: "token-id" }]]);
    const req = mockReq({ headers: { authorization: "Bearer valid.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(req.user).toMatchObject({
      id: 7,
      jti: "token-id",
      role: "Student",
      username: "student1",
      email: "ana@example.com",
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requireAuth rejects tokens missing from token table", async () => {
    mocks.verify.mockReturnValue({
      sub: "7",
      jti: "revoked-token",
      role: "Student",
    });
    mocks.query.mockResolvedValue([[]]);
    const req = mockReq({ headers: { authorization: "Bearer revoked.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token je neispravan ili je istekao" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAuth allows valid JWT without jti claim", async () => {
    mocks.verify.mockReturnValue({
      sub: "7",
      role: "Student",
      username: "student1",
    });
    const req = mockReq({ headers: { authorization: "Bearer legacy.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(mocks.query).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 7, role: "Student" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("requireAuth rejects invalid JWT tokens", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("bad token");
    });
    const req = mockReq({ headers: { authorization: "Bearer broken.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token je neispravan ili je istekao" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin allows users whose role in database is Admin", async () => {
    mocks.verify.mockReturnValue({ sub: "1", jti: "admin-token" });
    mocks.query.mockResolvedValue([[{ role: "Admin", is_organizer: 0 }]]);
    const req = mockReq({ headers: { authorization: "Bearer admin.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAdmin(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith(
      "SELECT role, is_organizer FROM `user` WHERE id = ? LIMIT 1",
      [1]
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("requireAdmin rejects authenticated non-admin users", async () => {
    mocks.verify.mockReturnValue({ sub: "2", jti: "student-token" });
    mocks.query.mockResolvedValue([[{ role: "Student", is_organizer: 0 }]]);
    const req = mockReq({ headers: { authorization: "Bearer student.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Potreban je administratorski pristup" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin rejects missing authorization header before database lookup", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin rejects malformed token", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("bad token");
    });
    const req = mockReq({ headers: { authorization: "Bearer bad.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token je neispravan ili je istekao" });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin rejects token for user missing from database", async () => {
    mocks.verify.mockReturnValue({ sub: "404", jti: "missing-token" });
    mocks.query.mockResolvedValue([[]]);
    const req = mockReq({ headers: { authorization: "Bearer valid.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Korisnik nije pronađen" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin returns 500 when role lookup fails", async () => {
    mocks.verify.mockReturnValue({ sub: "1", jti: "admin-token" });
    mocks.query.mockRejectedValue(new Error("database down"));
    const req = mockReq({ headers: { authorization: "Bearer valid.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Provjera autorizacije nije uspjela" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireOrganizer allows users marked as organizer in database", async () => {
    mocks.verify.mockReturnValue({ sub: "3", jti: "organizer-token" });
    mocks.query.mockResolvedValue([[{ role: "Student", is_organizer: 1 }]]);
    const req = mockReq({ headers: { authorization: "Bearer organizer.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireOrganizer(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requireOrganizer rejects ordinary students", async () => {
    mocks.verify.mockReturnValue({ sub: "4", jti: "student-token" });
    mocks.query.mockResolvedValue([[{ role: "Student", is_organizer: 0 }]]);
    const req = mockReq({ headers: { authorization: "Bearer student.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireOrganizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Potreban je pristup organizatora" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireOrganizer rejects malformed token", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("bad token");
    });
    const req = mockReq({ headers: { authorization: "Bearer bad.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireOrganizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("requireOrganizer rejects missing authorization header before database lookup", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await requireOrganizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("requireOrganizer rejects token for user missing from database", async () => {
    mocks.verify.mockReturnValue({ sub: "404", jti: "missing-token" });
    mocks.query.mockResolvedValue([[]]);
    const req = mockReq({ headers: { authorization: "Bearer valid.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireOrganizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Korisnik nije pronađen" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireOrganizer returns 500 when role lookup fails", async () => {
    mocks.verify.mockReturnValue({ sub: "3", jti: "organizer-token" });
    mocks.query.mockRejectedValue(new Error("database down"));
    const req = mockReq({ headers: { authorization: "Bearer valid.jwt" } });
    const res = mockRes();
    const next = mockNext();

    await requireOrganizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Provjera autorizacije nije uspjela" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireSelfOrAdmin allows users to update themselves", async () => {
    mocks.verify.mockReturnValue({ sub: "5", role: "Student", jti: "self-token" });
    const req = mockReq({
      headers: { authorization: "Bearer self.jwt" },
      params: { id: "5" },
    });
    const res = mockRes();
    const next = mockNext();

    await requireSelfOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("requireSelfOrAdmin rejects users updating another profile", async () => {
    mocks.verify.mockReturnValue({ sub: "5", role: "Student", jti: "self-token" });
    const req = mockReq({
      headers: { authorization: "Bearer self.jwt" },
      params: { id: "6" },
    });
    const res = mockRes();
    const next = mockNext();

    await requireSelfOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Možete ažurirati samo svoj vlastiti profil",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireSelfOrAdmin rejects malformed token", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("bad token");
    });
    const req = mockReq({
      headers: { authorization: "Bearer bad.jwt" },
      params: { id: "5" },
    });
    const res = mockRes();
    const next = mockNext();

    await requireSelfOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("requireSelfOrAdmin rejects requests without authorization header", async () => {
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    const next = mockNext();

    await requireSelfOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("requireSelfOrAdmin returns 500 for unexpected errors after token verification", async () => {
    mocks.verify.mockReturnValue({ sub: "5", role: "Student", jti: "self-token" });
    const req = mockReq({
      headers: { authorization: "Bearer self.jwt" },
    });
    Object.defineProperty(req, "params", {
      get() {
        throw new Error("params failed");
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireSelfOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Provjera autorizacije nije uspjela" });
    expect(next).not.toHaveBeenCalled();
  });
});
