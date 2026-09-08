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

const {
  getEventById,
  getAllEvents,
  createEvent,
  updateEvent,
  deleteOrganizerEvent,
  getEventReservations,
  deleteEventById,
  getEventSalesProgress,
  getEventTimeStats,
} = await import("../../controllers/events-controller.js");

describe("events controller", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("getEventById returns 404 when published event does not exist", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: "404" } });
    const res = mockRes();
    const next = mockNext();

    await getEventById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Događaj nije pronađen" });
  });

  it("getEventById returns event with additional images and ticket types", async () => {
    const event = { id: 4, title: "Koncert" };
    const images = [{ id: 1, image_path: "/uploads/a.jpg" }];
    const ticketTypes = [{ id: 2, name: "Standard", available_seats: 10 }];
    mocks.query
      .mockResolvedValueOnce([[event]])
      .mockResolvedValueOnce([images])
      .mockResolvedValueOnce([ticketTypes]);
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    const next = mockNext();

    await getEventById(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      ...event,
      additional_images: images,
      ticket_types: ticketTypes,
    });
  });

  it("getEventById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    const next = mockNext();

    await getEventById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getAllEvents normalizes pagination and returns meta data", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ total: 12 }]])
      .mockResolvedValueOnce([[{ id: 1, title: "Sajam" }]]);
    const req = mockReq({ query: { page: "-3", limit: "200", search: " Sajam " } });
    const res = mockRes();
    const next = mockNext();

    await getAllEvents(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("LIMIT ? OFFSET ?"),
      expect.arrayContaining(["%Sajam%", 50, 0])
    );
    expect(res.json).toHaveBeenCalledWith({
      items: [{ id: 1, title: "Sajam" }],
      meta: { page: 1, limit: 50, total: 12, totalPages: 1 },
    });
  });

  it("getAllEvents applies category, date range and fallback sort filters", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      query: {
        category_id: "3",
        from: "2030-01-01",
        to: "2030-01-31",
        sort: "unknown-sort",
        page: "abc",
        limit: "abc",
      },
    });
    const res = mockRes();
    const next = mockNext();

    await getAllEvents(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("e.category_id = ?"),
      ["3", "2030-01-01 00:00:00", "2030-01-31"]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("e.date_and_time ASC"),
      ["3", "2030-01-01 00:00:00", "2030-01-31", 9, 0]
    );
    expect(res.json).toHaveBeenCalledWith({
      items: [],
      meta: { page: 1, limit: 9, total: 0, totalPages: 1 },
    });
  });

  it("getAllEvents forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = mockNext();

    await getAllEvents(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("createEvent rejects missing title, date or ticket types", async () => {
    const req = mockReq({
      user: { id: 8 },
      body: { title: "", date_and_time: "2030-06-01 20:00:00", ticketTypes: [] },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createEvent rejects missing category", async () => {
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        ticketTypes: [{ name: "Standard", price: 5, total_seats: 100 }],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Kategorija je obavezna" });
  });

  it("createEvent rejects invalid ticket type capacity", async () => {
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        ticketTypes: [{ name: "Standard", price: 5, total_seats: 0 }],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createEvent treats malformed ticket type JSON as missing ticket types", async () => {
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        ticketTypes: "{nije-json",
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createEvent rejects invalid dates and missing categories before insert", async () => {
    const invalidDateReq = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "nije-datum",
        category_id: 2,
        ticketTypes: [{ name: "Standard", price: 5, total_seats: 100 }],
      },
    });
    const invalidDateRes = mockRes();
    const next = mockNext();

    await createEvent(invalidDateReq, invalidDateRes, next);

    expect(invalidDateRes.status).toHaveBeenCalledWith(400);
    expect(invalidDateRes.json).toHaveBeenCalledWith({ error: "Datum događaja nije važeći" });
    expect(mocks.query).not.toHaveBeenCalled();

    mocks.query.mockResolvedValueOnce([[]]);
    const missingCategoryReq = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 999,
        ticketTypes: [{ name: "Standard", price: 5, total_seats: 100 }],
      },
    });
    const missingCategoryRes = mockRes();

    await createEvent(missingCategoryReq, missingCategoryRes, next);

    expect(missingCategoryRes.status).toHaveBeenCalledWith(400);
    expect(missingCategoryRes.json).toHaveBeenCalledWith({ error: "Kategorija nije pronađena" });
  });

  it("createEvent rejects negative ticket prices", async () => {
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        ticketTypes: [{ name: "Standard", price: -1, total_seats: 100 }],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Cijena ulaznice ne može biti negativna" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createEvent inserts event, ticket types and returns complete event", async () => {
    const event = { id: 15, title: "Koncert", status: "DRAFT" };
    const ticketTypes = [{ id: 21, name: "Standard", price: 5, total_seats: 100 }];
    mocks.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 15 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[event]])
      .mockResolvedValueOnce([ticketTypes])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        description: "Opis",
        location: "Banja Luka",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        ticketTypes,
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO event"),
      ["Koncert", "Opis", "Banja Luka", "2030-06-01 20:00:00", null, 8, 2, "DRAFT"]
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ...event,
      additional_images: [],
      ticket_types: ticketTypes,
    });
  });

  it("createEvent parses string ticket types and image URLs", async () => {
    const event = { id: 33, title: "Koncert", status: "DRAFT" };
    const ticketTypes = [{ id: 7, name: "Standard", price: 5, total_seats: 100 }];
    mocks.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 33 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[event]])
      .mockResolvedValueOnce([ticketTypes])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        image: "  /uploads/from-url.jpg  ",
        category_id: 2,
        ticketTypes: JSON.stringify([{ name: "Standard", price: 5, total_seats: 100 }]),
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO event"),
      ["Koncert", null, null, "2030-06-01 20:00:00", "/uploads/from-url.jpg", 8, 2, "DRAFT"]
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("createEvent forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Koncert",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        ticketTypes: [{ name: "Standard", price: 5, total_seats: 100 }],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("createEvent with uploaded images publishes event and notifies students", async () => {
    const event = { id: 22, title: "Objavljen koncert", status: "PUBLISHED" };
    const ticketTypes = [{ id: 44, name: "Standard", price: 5, total_seats: 100 }];
    const images = [{ id: 9, image_path: "/uploads/main.jpg", is_primary: 1, display_order: 0 }];
    mocks.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 22 }])
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 3 }, { id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([[event]])
      .mockResolvedValueOnce([ticketTypes])
      .mockResolvedValueOnce([images]);
    const req = mockReq({
      user: { id: 8 },
      files: [{ filename: "main.jpg" }, { filename: "gallery.jpg" }],
      body: {
        title: "Objavljen koncert",
        description: "Opis",
        location: "Banja Luka",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        status: "PUBLISHED",
        ticketTypes,
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO event_image"),
      [[
        [22, "/uploads/main.jpg", 1, 0],
        [22, "/uploads/gallery.jpg", 0, 1],
      ]]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("INSERT INTO notification"),
      [[
        [3, "Objavljen novi događaj", 'Objavljen je novi događaj "Objavljen koncert"! Pogledajte ga.', 22, 0],
        [4, "Objavljen novi događaj", 'Objavljen je novi događaj "Objavljen koncert"! Pogledajte ga.', 22, 0],
      ]]
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("createEvent publishes without notification insert when there are no students", async () => {
    const event = { id: 23, title: "Objavljen koncert", status: "PUBLISHED" };
    const ticketTypes = [{ id: 45, name: "Standard", price: 5, total_seats: 100 }];
    mocks.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 23 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[event]])
      .mockResolvedValueOnce([ticketTypes])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      user: { id: 8 },
      body: {
        title: "Objavljen koncert",
        date_and_time: "2030-06-01 20:00:00",
        category_id: 2,
        status: "PUBLISHED",
        ticketTypes,
      },
    });
    const res = mockRes();
    const next = mockNext();

    await createEvent(req, res, next);

    expect(mocks.query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      expect.anything()
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updateEvent returns 404 when event is missing or owned by another user", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: "15" }, user: { id: 8 }, body: {} });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Događaj nije pronađen ili nemate dozvolu" });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("updateEvent rejects unknown category before updating event", async () => {
    mocks.query
      .mockResolvedValueOnce([[
        {
          id: 15,
          status: "DRAFT",
          title: "Old",
          description: "Old desc",
          image: null,
          location: "Old place",
          date_and_time: "2030-01-01 12:00:00",
          category_id: 1,
        },
      ]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: { category_id: 99 },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Kategorija nije pronađena" });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("updateEvent updates images, ticket types, sends publish notifications and returns event", async () => {
    const updatedEvent = {
      id: 15,
      title: "Novi koncert",
      description: "Novi opis",
      location: "Nova sala",
      date_and_time: "2030-06-01 20:00:00",
      image: "/uploads/main.jpg",
      user_id: 8,
      category_id: 2,
      status: "PUBLISHED",
    };
    const additionalImages = [{ id: 31, image_path: "/uploads/a.jpg", is_primary: 0, display_order: 1 }];
    const ticketTypes = [{ id: 41, name: "VIP", price: 20, total_seats: 50 }];

    mocks.query
      .mockResolvedValueOnce([[
        {
          id: 15,
          status: "DRAFT",
          title: "Stari koncert",
          description: "Stari opis",
          image: "/uploads/old.jpg",
          location: "Stara sala",
          date_and_time: "2030-01-01 12:00:00",
          category_id: 1,
        },
      ]])
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([[{ max_order: 2 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 3 }, { id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([additionalImages])
      .mockResolvedValueOnce([ticketTypes]);

    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      files: [{ filename: "a.jpg" }],
      body: {
        title: "Novi koncert",
        description: "Novi opis",
        location: "Nova sala",
        date_and_time: "2030-06-01 20:00:00",
        image: "/uploads/main.jpg",
        category_id: 2,
        status: "PUBLISHED",
        deletedImages: "[5,6]",
        ticketTypes: JSON.stringify([{ name: "VIP", price: 20, total_seats: 50 }]),
      },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO event_image"),
      [[["15", "/uploads/a.jpg", 0, 3]]]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("DELETE FROM event_image"),
      [5, 6, "15"]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      9,
      expect.stringContaining("INSERT INTO ticket_type"),
      [[["15", "VIP", 20, 50]]]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("INSERT INTO notification"),
      [[
        [3, "Novi događaj", 'Događaj "Novi koncert" je upravo objavljen! Pogledajte ga.', "15", 0],
        [4, "Novi događaj", 'Događaj "Novi koncert" je upravo objavljen! Pogledajte ga.', "15", 0],
      ]]
    );
    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: additionalImages,
      ticket_types: ticketTypes,
    });
  });

  it("updateEvent accepts deleted image ids as an array", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Sala",
      date_and_time: "2030-01-01 12:00:00",
      image: null,
      user_id: 8,
      category_id: 1,
      status: "DRAFT",
    };
    mocks.query
      .mockResolvedValueOnce([[{
        id: 15,
        status: "DRAFT",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {
        deletedImages: [5, 6],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DELETE FROM event_image"),
      [5, 6, "15"]
    );
    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent rejects invalid ticket type updates", async () => {
    mocks.query.mockResolvedValueOnce([[
      {
        id: 15,
        status: "DRAFT",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      },
    ]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {
        ticketTypes: [{ name: "VIP", price: -1, total_seats: 10 }],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Cijena ulaznice ne može biti negativna" });
  });

  it("updateEvent rejects ticket types with missing required fields", async () => {
    mocks.query.mockResolvedValueOnce([[
      {
        id: 15,
        status: "DRAFT",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      },
    ]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {
        ticketTypes: [{ name: "", price: 10, total_seats: 10 }],
      },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Svaki tip ulaznice mora imati 'naziv', 'cijenu' i 'ukupan_broj_mjesta > 0'",
    });
  });

  it("updateEvent logs malformed deleted image and ticket JSON then continues", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Sala",
      date_and_time: "2030-01-01 12:00:00",
      image: null,
      user_id: 8,
      category_id: 1,
      status: "DRAFT",
    };
    mocks.query
      .mockResolvedValueOnce([[
        {
          id: 15,
          status: "DRAFT",
          title: "Koncert",
          description: "Opis",
          image: null,
          location: "Sala",
          date_and_time: "2030-01-01 12:00:00",
          category_id: 1,
        },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {
        deletedImages: "{nije-json",
        ticketTypes: "{nije-json",
      },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent handles events with a missing existing date", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Sala",
      date_and_time: null,
      image: null,
      user_id: 8,
      category_id: 1,
      status: "PUBLISHED",
    };
    mocks.query
      .mockResolvedValueOnce([[{
        id: 15,
        status: "PUBLISHED",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Sala",
        date_and_time: null,
        category_id: 1,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {},
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent normalizes null status, null location and invalid existing dates", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: null,
      date_and_time: "nije-datum",
      image: null,
      user_id: 8,
      category_id: 1,
      status: null,
    };
    mocks.query
      .mockResolvedValueOnce([[{
        id: 15,
        status: null,
        title: "Koncert",
        description: "Opis",
        image: null,
        location: null,
        date_and_time: "nije-datum",
        category_id: 1,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {},
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent rejects invalid updated date before database writes", async () => {
    mocks.query.mockResolvedValueOnce([[
      {
        id: 15,
        status: "DRAFT",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      },
    ]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: { date_and_time: "2000-01-01 12:00:00" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("updateEvent notifies students when published event location and time change", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Nova sala",
      date_and_time: "2030-06-01 20:00:00",
      image: null,
      user_id: 8,
      category_id: 1,
      status: "PUBLISHED",
    };
    mocks.query
      .mockResolvedValueOnce([[
        {
          id: 15,
          status: "PUBLISHED",
          title: "Koncert",
          description: "Opis",
          image: null,
          location: "Stara sala",
          date_and_time: "2030-01-01 12:00:00",
          category_id: 1,
        },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: {
        location: "Nova sala",
        date_and_time: "2030-06-01 20:00:00",
      },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO notification"),
      [[[3, "Izmjena događaja", 'Za događaj "Koncert" promijenjeni su lokacija i vrijeme. Pogledajte nove informacije.', "15", 0]]]
    );
    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent skips publish notification insert when no students exist", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Sala",
      date_and_time: "2030-06-01 20:00:00",
      image: null,
      user_id: 8,
      category_id: 1,
      status: "PUBLISHED",
    };
    mocks.query
      .mockResolvedValueOnce([[{
        id: 15,
        status: "DRAFT",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: { status: "PUBLISHED", date_and_time: "2030-06-01 20:00:00" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(mocks.query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      expect.anything()
    );
    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent skips change notification insert when no students exist", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Nova sala",
      date_and_time: "2030-01-01 12:00:00",
      image: null,
      user_id: 8,
      category_id: 1,
      status: "PUBLISHED",
    };
    mocks.query
      .mockResolvedValueOnce([[{
        id: 15,
        status: "PUBLISHED",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Stara sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: { location: "Nova sala" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(mocks.query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      expect.anything()
    );
    expect(res.json).toHaveBeenCalledWith({
      ...updatedEvent,
      additional_images: [],
      ticket_types: [],
    });
  });

  it("updateEvent describes location-only and time-only changes", async () => {
    const cases = [
      {
        body: { location: "Nova sala" },
        message: 'Za događaj "Koncert" promijenjena je lokacija. Pogledajte nove informacije.',
      },
      {
        body: { date_and_time: "2030-06-01 20:00:00" },
        message: 'Za događaj "Koncert" promijenjeno je vrijeme. Pogledajte nove informacije.',
      },
    ];

    for (const testCase of cases) {
      const updatedEvent = {
        id: 15,
        title: "Koncert",
        description: "Opis",
        location: testCase.body.location || "Stara sala",
        date_and_time: testCase.body.date_and_time || "2030-01-01 12:00:00",
        image: null,
        user_id: 8,
        category_id: 1,
        status: "PUBLISHED",
      };
      mocks.query
        .mockResolvedValueOnce([[
          {
            id: 15,
            status: "PUBLISHED",
            title: "Koncert",
            description: "Opis",
            image: null,
            location: "Stara sala",
            date_and_time: "2030-01-01 12:00:00",
            category_id: 1,
          },
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ id: 3 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[updatedEvent]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const req = mockReq({
        params: { id: "15" },
        user: { id: 8 },
        body: testCase.body,
      });
      const res = mockRes();
      const next = mockNext();

      await updateEvent(req, res, next);

      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO notification"),
        [[[3, "Izmjena događaja", testCase.message, "15", 0]]]
      );
    }
  });

  it("updateEvent sends time-only change notification", async () => {
    const updatedEvent = {
      id: 15,
      title: "Koncert",
      description: "Opis",
      location: "Stara sala",
      date_and_time: "2030-06-01 20:00:00",
      image: null,
      user_id: 8,
      category_id: 1,
      status: "PUBLISHED",
    };
    mocks.query
      .mockResolvedValueOnce([[{
        id: 15,
        status: "PUBLISHED",
        title: "Koncert",
        description: "Opis",
        image: null,
        location: "Stara sala",
        date_and_time: "2030-01-01 12:00:00",
        category_id: 1,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updatedEvent]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { id: "15" },
      user: { id: 8 },
      body: { date_and_time: "2030-06-01 20:00:00" },
    });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    const notificationCall = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO notification")
    );
    expect(notificationCall[1][0][0]).toEqual([
      3,
      expect.any(String),
      expect.stringContaining("vrijeme"),
      "15",
      0,
    ]);
  });

  it("updateEvent forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "15" }, user: { id: 8 }, body: {} });
    const res = mockRes();
    const next = mockNext();

    await updateEvent(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("deleteOrganizerEvent returns 404 when event is missing or owned by another user", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await deleteOrganizerEvent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("deleteOrganizerEvent soft-deletes organizer event", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await deleteOrganizerEvent(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(2, "UPDATE `event` SET deleted_at = NOW() WHERE id = ?", ["15"]);
    expect(res.json).toHaveBeenCalledWith({ message: "Događaj je uspješno obrisan" });
  });

  it("getEventReservations returns 404 when organizer cannot access event", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventReservations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Događaj nije pronađen ili nemate dozvolu" });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("getEventReservations returns reservations for organizer event", async () => {
    const reservations = [
      {
        id: 7,
        number_of_tickets: 2,
        ticket_type_name: "Standard",
        student_username: "student",
      },
    ];
    mocks.query
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([reservations]);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventReservations(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM reservation r"),
      ["15"]
    );
    expect(res.json).toHaveBeenCalledWith(reservations);
  });

  it("getEventReservations forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventReservations(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("deleteEventById rejects already deleted events", async () => {
    mocks.query.mockResolvedValueOnce([[{ id: 15, deleted_at: new Date() }]]);
    const req = mockReq({ params: { id: "15" } });
    const res = mockRes();
    const next = mockNext();

    await deleteEventById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Događaj je već obrisan" });
  });

  it("deleteEventById returns 404 when event does not exist", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: "404" } });
    const res = mockRes();
    const next = mockNext();

    await deleteEventById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Događaj nije pronađen" });
  });

  it("deleteEventById soft-deletes existing event", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 15, deleted_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: "15" } });
    const res = mockRes();
    const next = mockNext();

    await deleteEventById(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE event SET deleted_at = NOW(), status = 'DELETED' WHERE id = ?",
      ["15"]
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Događaj je uspješno obrisan" });
  });

  it("getEventSalesProgress calculates totals and percentages", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([
        [
          { id: 1, name: "Standard", total_seats: "100", sold: "25" },
          { id: 2, name: "VIP", total_seats: "20", sold: "10" },
        ],
      ]);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventSalesProgress(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      event_id: 15,
      total_seats: 120,
      total_sold: 35,
      percentage_sold: 29,
      ticket_types: [
        { id: 1, name: "Standard", total_seats: 100, sold: 25, available: 75, percentage: 25 },
        { id: 2, name: "VIP", total_seats: 20, sold: 10, available: 10, percentage: 50 },
      ],
    });
  });

  it("getEventTimeStats rejects invalid period before querying stats", async () => {
    mocks.query.mockResolvedValueOnce([[{ id: 15 }]]);
    const req = mockReq({
      params: { eventId: "15" },
      query: { period: "quarterly" },
      user: { id: 8 },
    });
    const res = mockRes();
    const next = mockNext();

    await getEventTimeStats(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("getEventTimeStats returns stats for supported periods", async () => {
    const periods = ["daily", "weekly", "monthly", "yearly"];

    for (const period of periods) {
      const stats = [{ count: 2 }];
      mocks.query
        .mockResolvedValueOnce([[{ id: 15 }]])
        .mockResolvedValueOnce([stats]);
      const req = mockReq({
        params: { eventId: "15" },
        query: { period },
        user: { id: 8 },
      });
      const res = mockRes();
      const next = mockNext();

      await getEventTimeStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(stats);
    }

    expect(mocks.query).toHaveBeenCalledTimes(8);
  });

  it("getOrganizerEvents rejects invalid user ids", async () => {
    const req = mockReq({ user: { id: 0 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    const { getOrganizerEvents } = await import("../../controllers/events-controller.js");
    await getOrganizerEvents(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Nevažeći ID korisnika" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("getOrganizerEvents returns events with nested ticket types and images using search", async () => {
    const event = { id: 15, title: "Koncert", location: "Sala" };
    const ticketTypes = [{ id: 1, name: "Standard" }];
    const images = [{ id: 2, image_path: "/uploads/a.jpg" }];
    mocks.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[event]])
      .mockResolvedValueOnce([ticketTypes])
      .mockResolvedValueOnce([images]);
    const req = mockReq({ user: { id: 8 }, query: { q: " koncert ", page: "2", limit: "3" } });
    const res = mockRes();
    const next = mockNext();

    const { getOrganizerEvents } = await import("../../controllers/events-controller.js");
    await getOrganizerEvents(req, res, next);

    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("AND (e.title LIKE ? OR e.location LIKE ?)"),
      [8, "%koncert%", "%koncert%"]
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("LIMIT ? OFFSET ?"),
      [8, "%koncert%", "%koncert%", 3, 3]
    );
    expect(res.json).toHaveBeenCalledWith({
      items: [{ ...event, ticket_types: ticketTypes, additional_images: images }],
      meta: { page: 2, limit: 3, total: 1, totalPages: 1 },
    });
  });

  it("getOrganizerEvents defaults total count to zero when count row is missing", async () => {
    mocks.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 8 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    const { getOrganizerEvents } = await import("../../controllers/events-controller.js");
    await getOrganizerEvents(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      items: [],
      meta: { page: 1, limit: 9, total: 0, totalPages: 1 },
    });
  });

  it("getEventSalesProgress returns zero percentages when there is no capacity", async () => {
    mocks.query
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([
        [
          { id: 1, name: "Zero", total_seats: "0", sold: "0" },
        ],
      ]);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventSalesProgress(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      event_id: 15,
      total_seats: 0,
      total_sold: 0,
      percentage_sold: 0,
      ticket_types: [
        { id: 1, name: "Zero", total_seats: 0, sold: 0, available: 0, percentage: 0 },
      ],
    });
  });

  it("getEventSalesProgress rejects access when event is not owned by user", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventSalesProgress(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Niste vlasnik ovog događaja" });
  });

  it("getOrganizerEvents falls back to empty nested data when per-event loading fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const event = { id: 15, title: "Koncert" };
    mocks.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[event]])
      .mockRejectedValueOnce(new Error("ticket types failed"));
    const req = mockReq({ user: { id: 8 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    const { getOrganizerEvents } = await import("../../controllers/events-controller.js");
    await getOrganizerEvents(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      items: [{ ...event, ticket_types: [], additional_images: [] }],
      meta: { page: 1, limit: 9, total: 1, totalPages: 1 },
    });
  });

  it("getOrganizerEvents skips rows without an event id", async () => {
    const eventWithoutId = { id: null, title: "Broken row" };
    mocks.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[eventWithoutId]]);
    const req = mockReq({ user: { id: 8 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    const { getOrganizerEvents } = await import("../../controllers/events-controller.js");
    await getOrganizerEvents(req, res, next);

    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      items: [eventWithoutId],
      meta: { page: 1, limit: 9, total: 1, totalPages: 1 },
    });
  });

  it("getOrganizerEvents returns 500 when main database query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(new Error("database down"));
    const req = mockReq({ user: { id: 8 }, query: {} });
    const res = mockRes();
    const next = mockNext();

    const { getOrganizerEvents } = await import("../../controllers/events-controller.js");
    await getOrganizerEvents(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Neuspješno učitavanje vaših događaja" });
  });

  it("deleteOrganizerEvent forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await deleteOrganizerEvent(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getEventSalesProgress forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { eventId: "15" }, user: { id: 8 } });
    const res = mockRes();
    const next = mockNext();

    await getEventSalesProgress(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("deleteEventById forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "15" } });
    const res = mockRes();
    const next = mockNext();

    await deleteEventById(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("getEventTimeStats rejects access to another organizer's event", async () => {
    mocks.query.mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { eventId: "15" },
      query: { period: "daily" },
      user: { id: 8 },
    });
    const res = mockRes();
    const next = mockNext();

    await getEventTimeStats(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Pristup odbijen" });
  });

  it("getEventTimeStats forwards database errors to error middleware", async () => {
    const err = new Error("database down");
    mocks.query.mockRejectedValueOnce(err);
    const req = mockReq({
      params: { eventId: "15" },
      query: { period: "daily" },
      user: { id: 8 },
    });
    const res = mockRes();
    const next = mockNext();

    await getEventTimeStats(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
