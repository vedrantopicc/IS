import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createTestApp } from "./helpers/app.js";
import { authHeader, loginAs } from "./helpers/auth.js";
import { getTestConnection, ids, resetTestDatabase } from "./helpers/test-db.js";

describe("integration: events and reservations API", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns only published public events with pagination metadata", async () => {
    await request(app)
      .get("/events")
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]).toMatchObject({
          id: ids.event,
          title: "Node.js radionica",
          status: "PUBLISHED",
        });
        expect(res.body.meta).toMatchObject({ page: 1, limit: 9, total: 1, totalPages: 1 });
      });
  });

  it("filters public events by category, date range, search and sort options", async () => {
    await request(app)
      .get("/events")
      .query({
        category_id: ids.category,
        from: "2030-01-01",
        to: "2030-12-31",
        search: "Node",
        sort: "title_asc",
        page: "0",
        limit: "500",
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toEqual([
          expect.objectContaining({
            id: ids.event,
            title: "Node.js radionica",
            category_id: ids.category,
          }),
        ]);
        expect(res.body.meta).toMatchObject({ page: 1, limit: 50, total: 1 });
      });

    await request(app)
      .get("/events")
      .query({ category_id: ids.category, sort: "category_desc" })
      .expect(200)
      .expect((res) => {
        expect(res.body.items[0]).toMatchObject({ category_name: "edukativni" });
      });
  });

  it("returns event details with ticket types and additional images", async () => {
    await request(app)
      .get(`/events/${ids.event}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.title).toBe("Node.js radionica");
        expect(res.body.ticket_types).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.standardTicket })])
        );
        expect(res.body.additional_images).toEqual(
          expect.arrayContaining([expect.objectContaining({ image_path: "/uploads/node.jpg" })])
        );
      });
  });

  it("returns 404 for draft event in public details endpoint", async () => {
    await request(app)
      .get(`/events/${ids.draftEvent}`)
      .expect(404);
  });

  it("rejects ordinary students on organizer create route", async () => {
    const studentToken = await loginAs(app, "student@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(studentToken))
      .send({
        title: "Neovlasten dogadjaj",
        date_and_time: "2030-08-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 50 }],
      })
      .expect(403);
  });

  it("creates event through organizer route using real JWT and database writes", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Nova radionica",
        description: "Opis radionice",
        location: "Sala 5",
        date_and_time: "2030-08-01 18:00:00",
        category_id: ids.category,
        status: "PUBLISHED",
        ticketTypes: [{ name: "Standard", price: 15, total_seats: 30 }],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          title: "Nova radionica",
          status: "PUBLISHED",
          user_id: ids.organizer,
        });
        expect(res.body.ticket_types).toHaveLength(1);
      });
  });

  it("creates event using image URL from request body", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Dogadjaj sa URL slikom",
        description: "Opis",
        location: "Sala 8",
        date_and_time: "2030-08-02 18:00:00",
        image: "https://cdn.test.local/event.png",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 15, total_seats: 30 }],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.image).toBe("https://cdn.test.local/event.png");
      });
  });

  it("rejects malformed ticket type JSON from multipart event creation", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .field("title", "Los ticket JSON")
      .field("date_and_time", "2030-08-02 18:00:00")
      .field("category_id", String(ids.category))
      .field("ticketTypes", "{nije-json")
      .expect(400);
  });

  it("rejects event creation with negative ticket price", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Neispravna cijena",
        date_and_time: "2030-08-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: -10, total_seats: 30 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Cijena ulaznice ne može biti negativna");
      });
  });

  it("rejects event creation with empty ticket type name", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Prazan naziv ulaznice",
        date_and_time: "2030-08-01 18:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "", price: 10, total_seats: 30 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain("Svaki tip ulaznice");
      });
  });

  it("rejects event creation with invalid date, past date or missing category", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Los datum",
        date_and_time: "nije-datum",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 30 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Datum događaja nije važeći");
      });

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Prosli datum",
        date_and_time: "2000-01-01 12:00:00",
        category_id: ids.category,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 30 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Datum događaja mora biti u budućnosti");
      });

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Nepostojeca kategorija",
        date_and_time: "2030-08-01 18:00:00",
        category_id: 9999,
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 30 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Kategorija nije pronađena");
      });
  });

  it("rejects event creation without category", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Bez kategorije",
        date_and_time: "2030-08-01 18:00:00",
        ticketTypes: [{ name: "Standard", price: 10, total_seats: 30 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Kategorija je obavezna");
      });
  });

  it("creates event with uploaded image file", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    const response = await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .field("title", "Dogadjaj sa slikom")
      .field("description", "Upload test")
      .field("location", "Sala 6")
      .field("date_and_time", "2030-09-01 18:00:00")
      .field("category_id", String(ids.category))
      .field("status", "DRAFT")
      .field("ticketTypes", JSON.stringify([{ name: "Standard", price: 12, total_seats: 20 }]))
      .attach("images", Buffer.from("fake image bytes"), {
        filename: "test-image.png",
        contentType: "image/png",
      })
      .expect(201);

    expect(response.body.image).toMatch(/^\/uploads\/.+\.png$/);

    const uploadedPath = path.join(process.cwd(), response.body.image);
    if (fs.existsSync(uploadedPath)) {
      fs.unlinkSync(uploadedPath);
    }
  });

  it("creates event with multiple uploaded images and marks first image as primary", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    const response = await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .field("title", "Galerija dogadjaj")
      .field("description", "Upload vise slika")
      .field("location", "Sala 7")
      .field("date_and_time", "2030-09-02 18:00:00")
      .field("category_id", String(ids.category))
      .field("status", "DRAFT")
      .field("ticketTypes", JSON.stringify([{ name: "Standard", price: 12, total_seats: 20 }]))
      .attach("images", Buffer.from("fake image one"), {
        filename: "first.png",
        contentType: "image/png",
      })
      .attach("images", Buffer.from("fake image two"), {
        filename: "second.png",
        contentType: "image/png",
      })
      .expect(201);

    expect(response.body.additional_images).toHaveLength(2);
    expect(response.body.additional_images[0]).toMatchObject({ is_primary: 1, display_order: 0 });
    expect(response.body.additional_images[1]).toMatchObject({ is_primary: 0, display_order: 1 });

    for (const image of response.body.additional_images) {
      const uploadedPath = path.join(process.cwd(), image.image_path);
      if (fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
    }
  });

  it("rejects non-image upload through multer file filter", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .field("title", "Pogresan upload")
      .field("date_and_time", "2030-09-01 18:00:00")
      .field("category_id", String(ids.category))
      .field("ticketTypes", JSON.stringify([{ name: "Standard", price: 12, total_seats: 20 }]))
      .attach("images", Buffer.from("not an image"), {
        filename: "test.txt",
        contentType: "text/plain",
      })
      .expect(500)
      .expect((res) => {
        expect(res.body.error).toBe("Dozvoljene su samo slike");
      });
  });

  it("rejects image upload larger than configured file size limit", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");
    const tooLargeImage = Buffer.alloc(5 * 1024 * 1024 + 1, "a");

    await request(app)
      .post("/events/organizer/create")
      .set("Authorization", authHeader(organizerToken))
      .field("title", "Prevelika slika")
      .field("date_and_time", "2030-09-01 18:00:00")
      .field("category_id", String(ids.category))
      .field("ticketTypes", JSON.stringify([{ name: "Standard", price: 12, total_seats: 20 }]))
      .attach("images", tooLargeImage, {
        filename: "too-large.png",
        contentType: "image/png",
      })
      .expect(500)
      .expect((res) => {
        expect(res.body.error).toBe("File too large");
      });
  });

  it("returns organizer's events with ticket types and images", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/events/organizer/my-events")
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: ids.event,
              ticket_types: expect.any(Array),
              additional_images: expect.any(Array),
            }),
          ])
        );
      });
  });

  it("filters organizer events by search query and pagination", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/events/organizer/my-events?q=Draft&page=0&limit=100")
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toEqual([
          expect.objectContaining({ id: ids.draftEvent, title: "Draft dogadjaj" }),
        ]);
        expect(res.body.meta).toMatchObject({ page: 1, limit: 100, total: 1 });
      });
  });

  it("updates organizer event and returns updated ticket types", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        title: "Azuriran draft",
        location: "Nova sala",
        ticketTypes: [{ name: "Updated", price: 7, total_seats: 40 }],
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: ids.draftEvent,
          title: "Azuriran draft",
          location: "Nova sala",
        });
        expect(res.body.ticket_types).toEqual([
          expect.objectContaining({ name: "Updated", total_seats: 40 }),
        ]);
      });
  });

  it("updates event image URL and deletes selected additional images", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.event}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        image: "https://cdn.test.local/new-main.png",
        deletedImages: [1],
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.image).toBe("https://cdn.test.local/new-main.png");
        expect(res.body.additional_images).toEqual([]);
      });
  });

  it("ignores malformed optional update payloads without losing existing event data", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.event}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        deletedImages: "{nije-json",
        ticketTypes: "{nije-json",
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: ids.event,
          title: "Node.js radionica",
        });
        expect(res.body.ticket_types).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.standardTicket })])
        );
      });
  });

  it("adds uploaded images while updating an organizer event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    const response = await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .field("title", "Draft sa novom slikom")
      .attach("images", Buffer.from("new fake image"), {
        filename: "updated.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(response.body.additional_images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image_path: expect.stringMatching(/^\/uploads\/.+\.png$/),
        }),
      ])
    );

    for (const image of response.body.additional_images) {
      const uploadedPath = path.join(process.cwd(), image.image_path);
      if (fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
    }
  });

  it("rejects event update with negative ticket price", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        ticketTypes: [{ name: "Neispravna", price: -1, total_seats: 20 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Cijena ulaznice ne može biti negativna");
      });
  });

  it("rejects event update with incomplete ticket type data", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        ticketTypes: [{ name: "Nema kapacitet", price: 10, total_seats: 0 }],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain("Svaki tip ulaznice");
      });
  });

  it("rejects event update with invalid date, past date or missing category", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ date_and_time: "nije-datum" })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Datum događaja nije važeći");
      });

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ date_and_time: "2000-01-01 12:00:00" })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Datum događaja mora biti u budućnosti");
      });

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ category_id: 9999 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Kategorija nije pronađena");
      });
  });

  it("publishes draft event and creates notifications for students", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        status: "PUBLISHED",
        title: "Objavljen draft",
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ id: ids.draftEvent, status: "PUBLISHED" });
      });

    const connection = await getTestConnection();
    try {
      const [notifications] = await connection.query(
        "SELECT title, event_id FROM notification WHERE event_id = ?",
        [ids.draftEvent]
      );
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].title).toBe("Novi događaj");
    } finally {
      await connection.end();
    }
  });

  it("publishes and updates events without notifications when there are no students", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");
    const connection = await getTestConnection();
    try {
      await connection.query("DELETE FROM `user` WHERE id IN (?, ?)", [
        ids.student,
        ids.secondStudent,
      ]);
    } finally {
      await connection.end();
    }

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ status: "PUBLISHED", title: "Objavljen bez studenata" })
      .expect(200);

    await request(app)
      .put(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ location: "Nova lokacija bez studenata" })
      .expect(200);

    const checkConnection = await getTestConnection();
    try {
      const [notifications] = await checkConnection.query(
        "SELECT id FROM notification WHERE event_id = ?",
        [ids.draftEvent]
      );
      expect(notifications).toHaveLength(0);
    } finally {
      await checkConnection.end();
    }
  });

  it("notifies students when published event location and time change", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.event}`)
      .set("Authorization", authHeader(organizerToken))
      .send({
        location: "Nova lokacija",
        date_and_time: "2030-06-02 19:30:00",
      })
      .expect(200);

    const connection = await getTestConnection();
    try {
      const [notifications] = await connection.query(
        "SELECT title, message FROM notification WHERE event_id = ? AND title = 'Izmjena događaja'",
        [ids.event]
      );
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].message).toContain("promijenjeni su lokacija i vrijeme");
    } finally {
      await connection.end();
    }
  });

  it("notifies students when only published event location changes", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.event}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ location: "Samo nova lokacija" })
      .expect(200);

    const connection = await getTestConnection();
    try {
      const [notifications] = await connection.query(
        "SELECT message FROM notification WHERE event_id = ? AND message LIKE '%lokacija%'",
        [ids.event]
      );
      expect(notifications[0].message).toContain("promijenjena je lokacija");
    } finally {
      await connection.end();
    }
  });

  it("notifies students when only published event time changes", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put(`/events/organizer/${ids.event}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ date_and_time: "2030-06-03 20:00:00" })
      .expect(200);

    const connection = await getTestConnection();
    try {
      const [notifications] = await connection.query(
        "SELECT message FROM notification WHERE event_id = ? AND message LIKE '%vrijeme%'",
        [ids.event]
      );
      expect(notifications[0].message).toContain("promijenjeno je vrijeme");
    } finally {
      await connection.end();
    }
  });

  it("rejects organizer update of another user's event", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query(
        `INSERT INTO event
          (id, title, description, location, date_and_time, user_id, category_id, status)
         VALUES
          (88, 'Tudji event', 'Opis', 'Sala', '2030-10-01 18:00:00', ?, ?, 'DRAFT')`,
        [ids.secondStudent, ids.category]
      );
    } finally {
      await connection.end();
    }

    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .put("/events/organizer/88")
      .set("Authorization", authHeader(organizerToken))
      .send({ title: "Ne smije" })
      .expect(404);
  });

  it("returns reservations for organizer-owned event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get(`/events/organizer/${ids.event}/reservations`)
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: ids.studentReservation, student_username: "student" }),
          ])
        );
      });
  });

  it("returns 404 for organizer reservations of another user's event", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query(
        `INSERT INTO event
          (id, title, description, location, date_and_time, user_id, category_id, status)
         VALUES
          (98, 'Tudje rezervacije', 'Opis', 'Sala 9', '2030-10-01 18:00:00', ?, ?, 'PUBLISHED')`,
        [ids.secondStudent, ids.category]
      );
    } finally {
      await connection.end();
    }

    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/events/organizer/98/reservations")
      .set("Authorization", authHeader(organizerToken))
      .expect(404);
  });

  it("returns sales progress for organizer-owned event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get(`/events/organizer/${ids.event}/sales-progress`)
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          event_id: ids.event,
          total_seats: 3,
          total_sold: 1,
          percentage_sold: 33,
        });
      });
  });

  it("returns zero sales progress for event without ticket types", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query(
        `INSERT INTO event
          (id, title, description, location, date_and_time, user_id, category_id, status)
         VALUES
          (97, 'Bez ulaznica', 'Opis', 'Sala 10', '2030-10-01 18:00:00', ?, ?, 'PUBLISHED')`,
        [ids.organizer, ids.category]
      );
    } finally {
      await connection.end();
    }

    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/events/organizer/97/sales-progress")
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          event_id: 97,
          total_seats: 0,
          total_sold: 0,
          percentage_sold: 0,
          ticket_types: [],
        });
      });
  });

  it("returns zero ticket percentage for ticket type without capacity", async () => {
    const connection = await getTestConnection();
    try {
      await connection.query(
        `INSERT INTO event
          (id, title, description, location, date_and_time, user_id, category_id, status)
         VALUES
          (96, 'Nulti kapacitet', 'Opis', 'Sala 11', '2030-10-01 18:00:00', ?, ?, 'PUBLISHED')`,
        [ids.organizer, ids.category]
      );
      await connection.query(
        "INSERT INTO ticket_type (id, event_id, name, price, total_seats) VALUES (96, 96, 'Zero', 0, 0)"
      );
    } finally {
      await connection.end();
    }

    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get("/events/organizer/96/sales-progress")
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.ticket_types).toEqual([
          expect.objectContaining({
            name: "Zero",
            total_seats: 0,
            percentage: 0,
          }),
        ]);
      });
  });

  it("returns time stats and rejects invalid stat period", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .get(`/events/organizer/${ids.event}/time-stats?period=daily`)
      .set("Authorization", authHeader(organizerToken))
      .expect(200);

    await request(app)
      .get(`/events/organizer/${ids.event}/time-stats?period=invalid`)
      .set("Authorization", authHeader(organizerToken))
      .expect(400);
  });

  it("returns weekly, monthly and yearly time stats for organizer-owned event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    for (const period of ["weekly", "monthly", "yearly"]) {
      await request(app)
        .get(`/events/organizer/${ids.event}/time-stats?period=${period}`)
        .set("Authorization", authHeader(organizerToken))
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    }
  });

  it("soft deletes organizer-owned event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .delete(`/events/organizer/${ids.draftEvent}`)
      .set("Authorization", authHeader(organizerToken))
      .expect(200);

    await request(app)
      .get("/events/organizer/my-events")
      .set("Authorization", authHeader(organizerToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.items).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.draftEvent })])
        );
      });
  });

  it("returns 404 when organizer deletes missing event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .delete("/events/organizer/9999")
      .set("Authorization", authHeader(organizerToken))
      .expect(404);
  });

  it("soft deletes event through admin route and prevents duplicate delete", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete(`/events/${ids.event}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .delete(`/events/${ids.event}`)
      .set("Authorization", authHeader(adminToken))
      .expect(400);
  });

  it("soft delete event keeps existing reservations for historical data", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete(`/events/${ids.event}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    const connection = await getTestConnection();
    try {
      const [reservations] = await connection.query(
        "SELECT id FROM reservation WHERE event_id = ?",
        [ids.event]
      );
      expect(reservations).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: ids.studentReservation })])
      );
    } finally {
      await connection.end();
    }
  });

  it("returns 404 when admin deletes missing event", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .delete("/events/9999")
      .set("Authorization", authHeader(adminToken))
      .expect(404);
  });

  it("creates reservation for available ticket type", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.vipTicket, numberOfTickets: 1 })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          ticketType: "VIP",
          numberOfTickets: 1,
          totalPrice: "25.00",
        });
      });
  });

  it("creates reservation with default single ticket count", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.vipTicket })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          ticketType: "VIP",
          numberOfTickets: 1,
          totalPrice: "25.00",
        });
      });
  });

  it("rejects duplicate reservation for the same ticket type", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.standardTicket, numberOfTickets: 1 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Već imate rezervaciju za ovaj tip ulaznice");
      });
  });

  it("rejects reservation when requested tickets exceed available capacity", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.standardTicket, numberOfTickets: 2 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain("Nema dovoljno dostupnih mjesta");
      });
  });

  it("rejects zero or negative ticket count", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.vipTicket, numberOfTickets: 0 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Broj ulaznica mora biti pozitivan cijeli broj");
      });

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.vipTicket, numberOfTickets: -2 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Broj ulaznica mora biti pozitivan cijeli broj");
      });
  });

  it("rejects decimal ticket count and missing ticket type", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.vipTicket, numberOfTickets: 1.5 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Broj ulaznica mora biti pozitivan cijeli broj");
      });

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ numberOfTickets: 1 })
      .expect(404);
  });

  it("prevents organizer from reserving their own event", async () => {
    const organizerToken = await loginAs(app, "organizer@test.local");

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(organizerToken))
      .send({ ticketTypeId: ids.standardTicket, numberOfTickets: 1 })
      .expect(403);
  });

  it("rejects reservations for draft and soft-deleted events", async () => {
    const token = await loginAs(app, "student2@test.local");

    const connection = await getTestConnection();
    try {
      await connection.query(
        "INSERT INTO ticket_type (id, event_id, name, price, total_seats) VALUES (77, ?, 'Draft', 5, 10)",
        [ids.draftEvent]
      );
    } finally {
      await connection.end();
    }

    await request(app)
      .post(`/reservations/events/${ids.draftEvent}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: 77, numberOfTickets: 1 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Rezervacije su moguće samo za objavljene aktivne događaje");
      });

    const adminToken = await loginAs(app, "admin@test.local");
    await request(app)
      .delete(`/events/${ids.event}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: ids.vipTicket, numberOfTickets: 1 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe("Rezervacije su moguće samo za objavljene aktivne događaje");
      });
  });

  it("rejects ticket type that belongs to another event", async () => {
    const token = await loginAs(app, "student2@test.local");
    const connection = await getTestConnection();
    try {
      await connection.query(
        `INSERT INTO event
          (id, title, description, location, date_and_time, user_id, category_id, status)
         VALUES
          (66, 'Drugi event', 'Opis', 'Sala', '2030-11-01 18:00:00', ?, ?, 'PUBLISHED')`,
        [ids.organizer, ids.category]
      );
      await connection.query(
        "INSERT INTO ticket_type (id, event_id, name, price, total_seats) VALUES (66, 66, 'Other', 5, 10)"
      );
    } finally {
      await connection.end();
    }

    await request(app)
      .post(`/reservations/events/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ ticketTypeId: 66, numberOfTickets: 1 })
      .expect(404);
  });

  it("prevents overbooking when two users reserve the last seat at the same time", async () => {
    const tokenA = await loginAs(app, "student@test.local");
    const tokenB = await loginAs(app, "student2@test.local");

    const connection = await getTestConnection();
    try {
      await connection.query("DELETE FROM reservation WHERE ticket_type_id = ?", [ids.vipTicket]);
    } finally {
      await connection.end();
    }

    const [first, second] = await Promise.all([
      request(app)
        .post(`/reservations/events/${ids.event}`)
        .set("Authorization", authHeader(tokenA))
        .send({ ticketTypeId: ids.vipTicket, numberOfTickets: 1 }),
      request(app)
        .post(`/reservations/events/${ids.event}`)
        .set("Authorization", authHeader(tokenB))
        .send({ ticketTypeId: ids.vipTicket, numberOfTickets: 1 }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);

    const checkConnection = await getTestConnection();
    try {
      const [rows] = await checkConnection.query(
        "SELECT COALESCE(SUM(number_of_tickets), 0) AS reserved FROM reservation WHERE ticket_type_id = ?",
        [ids.vipTicket]
      );
      expect(Number(rows[0].reserved)).toBe(1);
    } finally {
      await checkConnection.end();
    }
  });

  it("lists, reads and deletes current user's reservation", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .get("/reservations")
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.studentReservation })])
        );
      });

    await request(app)
      .get(`/reservations/${ids.studentReservation}`)
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ reservation_id: ids.studentReservation });
      });

    await request(app)
      .delete(`/reservations/${ids.studentReservation}`)
      .set("Authorization", authHeader(token))
      .expect(200);

    await request(app)
      .get(`/reservations/${ids.studentReservation}`)
      .set("Authorization", authHeader(token))
      .expect(404);
  });

  it("does not allow users to delete missing or another user's reservation", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .delete(`/reservations/${ids.studentReservation}`)
      .set("Authorization", authHeader(token))
      .expect(404);

    await request(app)
      .delete("/reservations/9999")
      .set("Authorization", authHeader(token))
      .expect(404);
  });
});
