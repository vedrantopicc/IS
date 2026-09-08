import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockReq, mockRes } from "../helpers/http.js";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  pool: {
    execute: mocks.execute,
  },
}));

const {
  getEventComments,
  createComment,
  updateComment,
  deleteComment,
} = await import("../../controllers/comments-controller.js");

describe("comments controller", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("getEventComments returns comments for event", async () => {
    const comments = [{ id: 1, rating: 5, comment_text: "Odlicno" }];
    mocks.execute.mockResolvedValueOnce([comments]);
    const req = mockReq({ params: { eventId: "10" } });
    const res = mockRes();

    await getEventComments(req, res);

    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining("WHERE c.event_id = ?"), ["10"]);
    expect(res.json).toHaveBeenCalledWith(comments);
  });

  it("getEventComments returns 500 when database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execute.mockRejectedValueOnce(new Error("database down"));
    const req = mockReq({ params: { eventId: "10" } });
    const res = mockRes();

    await getEventComments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Neuspješno preuzimanje recenzija" });
  });

  it("createComment rejects non-student users", async () => {
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 5, comment_text: "Super" },
      user: { id: 2, role: "Admin" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("createComment validates rating range", async () => {
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 6 },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("createComment rejects overlong text and missing event", async () => {
    const overlongReq = mockReq({
      params: { eventId: "10" },
      body: { rating: 5, comment_text: "x".repeat(1001) },
      user: { id: 2, role: "Student" },
    });
    const overlongRes = mockRes();

    await createComment(overlongReq, overlongRes);

    expect(overlongRes.status).toHaveBeenCalledWith(400);

    mocks.execute.mockResolvedValueOnce([[]]);
    const missingEventReq = mockReq({
      params: { eventId: "999" },
      body: { rating: 5, comment_text: "ok" },
      user: { id: 2, role: "Student" },
    });
    const missingEventRes = mockRes();

    await createComment(missingEventReq, missingEventRes);

    expect(missingEventRes.status).toHaveBeenCalledWith(404);
  });

  it("createComment rejects script tags and organizer self-reviews", async () => {
    const scriptReq = mockReq({
      params: { eventId: "10" },
      body: { rating: 5, comment_text: "<script>alert(1)</script>" },
      user: { id: 2, role: "Student" },
    });
    const scriptRes = mockRes();

    await createComment(scriptReq, scriptRes);

    expect(scriptRes.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();

    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ user_id: 2 }]]);
    const selfReviewReq = mockReq({
      params: { eventId: "10" },
      body: { rating: 5, comment_text: "Moje" },
      user: { id: 2, role: "Student" },
    });
    const selfReviewRes = mockRes();

    await createComment(selfReviewReq, selfReviewRes);

    expect(selfReviewRes.status).toHaveBeenCalledWith(403);
  });

  it("createComment returns duplicate response for database unique error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("duplicate");
    err.code = "ER_DUP_ENTRY";
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ user_id: 9 }]])
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(err);
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 5, comment_text: "ok" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Već ste ocijenili ovaj događaj" });
  });

  it("createComment returns 500 for unexpected database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ user_id: 9 }]])
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error("insert failed"));
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 5, comment_text: "ok" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Neuspješno kreiranje recenzije" });
  });

  it("createComment rejects duplicate review", async () => {
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ user_id: 9 }]])
      .mockResolvedValueOnce([[{ id: 1 }]]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 4, comment_text: "Dobro" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Već ste ocijenili ovaj događaj" });
  });

  it("createComment trims text and returns inserted review", async () => {
    const inserted = { id: 12, comment_text: "Dobro", rating: 4 };
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ user_id: 9 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 12 }])
      .mockResolvedValueOnce([[inserted]]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 4, comment_text: "  Dobro  " },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(mocks.execute).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO comments"),
      [2, "10", "Dobro", 4]
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(inserted);
  });

  it("createComment stores empty text when comment text is omitted", async () => {
    const inserted = { id: 13, comment_text: "", rating: 5 };
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ user_id: 9 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 13 }])
      .mockResolvedValueOnce([[inserted]]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { rating: 5 },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await createComment(req, res);

    expect(mocks.execute).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO comments"),
      [2, "10", "", 5]
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(inserted);
  });

  it("updateComment rejects edits to another user's review", async () => {
    mocks.execute.mockResolvedValueOnce([[{ user_id: 9 }]]);
    const req = mockReq({
      params: { commentId: "12" },
      body: { rating: 4, comment_text: "Novo" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await updateComment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("updateComment rejects non-student, invalid rating, overlong text and missing review", async () => {
    const nonStudentReq = mockReq({
      params: { commentId: "12" },
      body: { rating: 4 },
      user: { id: 1, role: "Admin" },
    });
    const nonStudentRes = mockRes();

    await updateComment(nonStudentReq, nonStudentRes);

    expect(nonStudentRes.status).toHaveBeenCalledWith(403);

    const invalidRatingReq = mockReq({
      params: { commentId: "12" },
      body: { rating: 9 },
      user: { id: 2, role: "Student" },
    });
    const invalidRatingRes = mockRes();

    await updateComment(invalidRatingReq, invalidRatingRes);

    expect(invalidRatingRes.status).toHaveBeenCalledWith(400);

    const overlongReq = mockReq({
      params: { commentId: "12" },
      body: { rating: 4, comment_text: "x".repeat(1001) },
      user: { id: 2, role: "Student" },
    });
    const overlongRes = mockRes();

    await updateComment(overlongReq, overlongRes);

    expect(overlongRes.status).toHaveBeenCalledWith(400);

    mocks.execute.mockResolvedValueOnce([[]]);
    const missingReq = mockReq({
      params: { commentId: "999" },
      body: { rating: 4 },
      user: { id: 2, role: "Student" },
    });
    const missingRes = mockRes();

    await updateComment(missingReq, missingRes);

    expect(missingRes.status).toHaveBeenCalledWith(404);
  });

  it("updateComment returns 500 when database update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execute
      .mockResolvedValueOnce([[{ user_id: 2 }]])
      .mockRejectedValueOnce(new Error("update failed"));
    const req = mockReq({
      params: { commentId: "12" },
      body: { rating: 4, comment_text: "Novo" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await updateComment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Neuspješno ažuriranje recenzije" });
  });

  it("updateComment rejects script tags and returns updated review", async () => {
    const scriptReq = mockReq({
      params: { commentId: "12" },
      body: { rating: 4, comment_text: "<script>alert(1)</script>" },
      user: { id: 2, role: "Student" },
    });
    const scriptRes = mockRes();

    await updateComment(scriptReq, scriptRes);

    expect(scriptRes.status).toHaveBeenCalledWith(400);

    const updated = { id: 12, comment_text: "Novo", rating: 4, user_id: 2 };
    mocks.execute
      .mockResolvedValueOnce([[{ user_id: 2 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);
    const updateReq = mockReq({
      params: { commentId: "12" },
      body: { rating: 4, comment_text: "  Novo  " },
      user: { id: 2, role: "Student" },
    });
    const updateRes = mockRes();

    await updateComment(updateReq, updateRes);

    expect(mocks.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE comments"),
      ["Novo", 4, "12"]
    );
    expect(updateRes.json).toHaveBeenCalledWith(updated);
  });

  it("updateComment stores empty text when comment text is omitted", async () => {
    const updated = { id: 12, comment_text: "", rating: 5, user_id: 2 };
    mocks.execute
      .mockResolvedValueOnce([[{ user_id: 2 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);
    const req = mockReq({
      params: { commentId: "12" },
      body: { rating: 5 },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await updateComment(req, res);

    expect(mocks.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE comments"),
      ["", 5, "12"]
    );
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it("deleteComment deletes only current user's review", async () => {
    mocks.execute
      .mockResolvedValueOnce([[{ user_id: 2 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({
      params: { commentId: "12" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await deleteComment(req, res);

    expect(mocks.execute).toHaveBeenCalledWith("DELETE FROM comments WHERE id = ?", ["12"]);
    expect(res.json).toHaveBeenCalledWith({ message: "Recenzija je uspješno obrisana" });
  });

  it("deleteComment rejects non-student and missing review", async () => {
    const nonStudentReq = mockReq({
      params: { commentId: "12" },
      user: { id: 1, role: "Admin" },
    });
    const nonStudentRes = mockRes();

    await deleteComment(nonStudentReq, nonStudentRes);

    expect(nonStudentRes.status).toHaveBeenCalledWith(403);

    mocks.execute.mockResolvedValueOnce([[]]);
    const missingReq = mockReq({
      params: { commentId: "999" },
      user: { id: 2, role: "Student" },
    });
    const missingRes = mockRes();

    await deleteComment(missingReq, missingRes);

    expect(missingRes.status).toHaveBeenCalledWith(404);
  });

  it("deleteComment rejects deletion of another user's review", async () => {
    mocks.execute.mockResolvedValueOnce([[{ user_id: 9 }]]);
    const req = mockReq({
      params: { commentId: "12" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await deleteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("deleteComment returns 500 when database delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execute
      .mockResolvedValueOnce([[{ user_id: 2 }]])
      .mockRejectedValueOnce(new Error("delete failed"));
    const req = mockReq({
      params: { commentId: "12" },
      user: { id: 2, role: "Student" },
    });
    const res = mockRes();

    await deleteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Neuspješno brisanje recenzije" });
  });
});
