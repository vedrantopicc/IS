import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNext, mockReq, mockRes } from "../helpers/http.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connQuery: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  getConnection: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  pool: {
    query: mocks.query,
    getConnection: mocks.getConnection,
  },
}));

vi.mock("crypto", () => ({
  default: {
    randomUUID: mocks.randomUUID,
  },
  randomUUID: mocks.randomUUID,
}));

const {
  createReservation,
  getUserReservations,
  deleteReservation,
  getReservationById,
} = await import("../../controllers/reservations-controller.js");

describe("reservations controller", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getConnection.mockResolvedValue({
      query: mocks.connQuery,
      beginTransaction: mocks.beginTransaction,
      commit: mocks.commit,
      rollback: mocks.rollback,
      release: mocks.release,
    });
  });

  it("createReservation rejects non-positive ticket counts before opening transaction", async () => {
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 0 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("createReservation returns 404 when ticket type does not belong to event", async () => {
    mocks.connQuery.mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Tip ulaznice ili događaj nije pronađen" });
    expect(mocks.rollback).toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalled();
  });

  it("createReservation rejects draft or deleted events", async () => {
    mocks.connQuery.mockResolvedValueOnce([
      [{ id: 5, name: "Standard", price: 10, total_seats: 100, event_owner_id: 9, event_status: "DRAFT", event_deleted_at: null }],
    ]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Rezervacije su moguće samo za objavljene aktivne događaje" });
  });

  it("createReservation prevents organizer from reserving their own event", async () => {
    mocks.connQuery.mockResolvedValueOnce([
      [{ id: 5, price: 10, total_seats: 100, event_id: 10, event_owner_id: 3, event_status: "PUBLISHED", event_deleted_at: null }],
    ]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.connQuery).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).toHaveBeenCalled();
  });

  it("createReservation rejects duplicate reservation for same ticket type", async () => {
    mocks.connQuery
      .mockResolvedValueOnce([
        [{ id: 5, name: "Standard", price: 10, total_seats: 100, event_id: 10, event_owner_id: 9, event_status: "PUBLISHED", event_deleted_at: null }],
      ])
      .mockResolvedValueOnce([[{ id: 22 }]]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Već imate rezervaciju za ovaj tip ulaznice" });
  });

  it("createReservation rejects requests above available capacity", async () => {
    mocks.connQuery
      .mockResolvedValueOnce([
        [{ id: 5, name: "Standard", price: 10, total_seats: 3, event_id: 10, event_owner_id: 9, event_status: "PUBLISHED", event_deleted_at: null }],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ reserved: 2 }]]);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 2 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Nema dovoljno dostupnih mjesta za 'Standard'. Preostalo je samo 1.",
    });
  });

  it("createReservation creates reservation and calculates total price", async () => {
    mocks.connQuery
      .mockResolvedValueOnce([
        [{ id: 5, name: "VIP", price: 12.5, total_seats: 10, event_id: 10, event_owner_id: 9, event_status: "PUBLISHED", event_deleted_at: null }],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ reserved: 1 }]])
      .mockResolvedValueOnce([{ insertId: 44 }]);
    mocks.randomUUID.mockReturnValue("reservation-code-1");
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 2 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(mocks.commit).toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rezervacija je uspješno kreirana",
      reservationId: 44,
      reservationCode: "reservation-code-1",
      numberOfTickets: 2,
      ticketType: "VIP",
      totalPrice: "25.00",
    });
  });

  it("createReservation treats missing reserved aggregate as zero", async () => {
    mocks.connQuery
      .mockResolvedValueOnce([
        [{ id: 5, name: "VIP", price: 12.5, total_seats: 10, event_id: 10, event_owner_id: 9, event_status: "PUBLISHED", event_deleted_at: null }],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{}]])
      .mockResolvedValueOnce([{ insertId: 45 }]);
    mocks.randomUUID.mockReturnValue("reservation-code-2");
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(mocks.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 45,
        numberOfTickets: 1,
        totalPrice: "12.50",
      })
    );
  });

  it("createReservation rolls back and forwards unexpected errors", async () => {
    const err = new Error("database down");
    mocks.connQuery.mockRejectedValueOnce(err);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(mocks.rollback).toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  it("createReservation forwards connection errors before rollback is possible", async () => {
    const err = new Error("connection failed");
    mocks.getConnection.mockRejectedValueOnce(err);
    const req = mockReq({
      params: { eventId: "10" },
      body: { ticketTypeId: 5, numberOfTickets: 1 },
      user: { id: 3 },
    });
    const res = mockRes();
    const next = mockNext();

    await createReservation(req, res, next);

    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  it("getUserReservations returns reservations for authenticated user", async () => {
    const rows = [{ id: 1, event_title: "Koncert" }];
    mocks.query.mockResolvedValueOnce([rows]);
    const req = mockReq({ user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await getUserReservations(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("WHERE r.user_id = ?"), [3]);
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  it("getUserReservations forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await getUserReservations(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("deleteReservation only deletes reservation owned by current user", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { reservationId: "77" }, user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await deleteReservation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("deleteReservation deletes current user's reservation", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 77, user_id: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { reservationId: "77" }, user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await deleteReservation(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(2, "DELETE FROM reservation WHERE id = ?", ["77"]);
    expect(res.json).toHaveBeenCalledWith({ message: "Rezervacija je uspješno obrisana" });
  });

  it("deleteReservation forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { reservationId: "77" }, user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await deleteReservation(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getReservationById returns 404 for missing or foreign reservation", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { reservationId: "77" }, user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await getReservationById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Rezervacija nije pronađena" });
  });

  it("getReservationById returns reservation owned by current user", async () => {
    const reservation = { reservation_id: 77, event_title: "Koncert" };
    mocks.query.mockResolvedValueOnce([[reservation]]);
    const req = mockReq({ params: { reservationId: "77" }, user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await getReservationById(req, res, next);

    expect(res.json).toHaveBeenCalledWith(reservation);
  });

  it("getReservationById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { reservationId: "77" }, user: { id: 3 } });
    const res = mockRes();
    const next = mockNext();

    await getReservationById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
