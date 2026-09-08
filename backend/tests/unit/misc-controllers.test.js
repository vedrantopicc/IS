import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNext, mockReq, mockRes } from "../helpers/http.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  pool: {
    query: mocks.query,
  },
}));

const { getAllCategories } = await import("../../controllers/categories-controller.js");
const {
  getMyNotifications,
  markAllRead,
  markOneRead,
} = await import("../../controllers/notifications-controller.js");
const { createRoleRequest } = await import("../../controllers/role-request-controller.js");

describe("categories, notifications and role request controllers", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("getAllCategories returns categories sorted by name", async () => {
    const rows = [
      { id: 1, name: "Koncert" },
      { id: 2, name: "Sport" },
    ];
    mocks.query.mockResolvedValueOnce([rows]);
    const res = mockRes();
    const next = mockNext();

    await getAllCategories(mockReq(), res, next);

    expect(mocks.query).toHaveBeenCalledWith("SELECT id, name FROM category ORDER BY name ASC");
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  it("getAllCategories forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const res = mockRes();
    const next = mockNext();

    await getAllCategories(mockReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getMyNotifications clamps pagination and returns unread count", async () => {
    const notifications = [{ id: 1, title: "Novi dogadjaj" }];
    mocks.query
      .mockResolvedValueOnce([notifications])
      .mockResolvedValueOnce([[{ unread: "3" }]]);
    const req = mockReq({ user: { id: 7 }, query: { page: "0", limit: "500" } });
    const res = mockRes();
    const next = mockNext();

    await getMyNotifications(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LIMIT ? OFFSET ?"),
      [7, 50, 0]
    );
    expect(res.json).toHaveBeenCalledWith({
      items: notifications,
      meta: { unread: 3, page: 1, limit: 50 },
    });
  });

  it("getMyNotifications defaults unread count to zero when aggregate row is missing", async () => {
    mocks.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 7 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    await getMyNotifications(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      items: [],
      meta: { unread: 0, page: 1, limit: 20 },
    });
  });

  it("markAllRead marks unread notifications for current user only", async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
    const req = mockReq({ user: { id: 7 } });
    const res = mockRes();
    const next = mockNext();

    await markAllRead(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id = ?"), [7]);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("getMyNotifications forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ user: { id: 7 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    await getMyNotifications(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("markAllRead forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ user: { id: 7 } });
    const res = mockRes();
    const next = mockNext();

    await markAllRead(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("markOneRead marks a single notification for current user", async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ user: { id: 7 }, params: { id: "12" } });
    const res = mockRes();
    const next = mockNext();

    await markOneRead(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("WHERE id = ? AND user_id = ?"), [
      12,
      7,
    ]);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("markOneRead forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ user: { id: 7 }, params: { id: "12" } });
    const res = mockRes();
    const next = mockNext();

    await markOneRead(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("createRoleRequest rejects users who are already organizers", async () => {
    mocks.query.mockResolvedValueOnce([[{ is_organizer: 1 }]]);
    const req = mockReq({ user: { id: 7 } });
    const res = mockRes();

    await createRoleRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Već ste organizator" });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("createRoleRequest rejects duplicate pending requests", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ is_organizer: 0 }]])
      .mockResolvedValueOnce([[{ id: 2 }]]);
    const req = mockReq({ user: { id: 7 } });
    const res = mockRes();

    await createRoleRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Već imate zahtjev na čekanju" });
  });

  it("createRoleRequest inserts request for eligible user", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ is_organizer: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }]);
    const req = mockReq({ user: { id: 7 } });
    const res = mockRes();

    await createRoleRequest(req, res);

    expect(mocks.query).toHaveBeenNthCalledWith(3, "INSERT INTO role_requests (user_id) VALUES (?)", [
      7,
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("createRoleRequest returns 500 when database insert fails", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ is_organizer: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error("insert failed"));
    const req = mockReq({ user: { id: 7 } });
    const res = mockRes();

    await createRoleRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Neuspješno slanje zahtjeva" });
  });
});
