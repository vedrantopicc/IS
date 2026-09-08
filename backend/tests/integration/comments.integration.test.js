import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/app.js";
import { authHeader, loginAs } from "./helpers/auth.js";
import { ids, resetTestDatabase } from "./helpers/test-db.js";

describe("integration: comments API", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("requires authentication for event comments", async () => {
    await request(app).get(`/comments/event/${ids.event}`).expect(401);
  });

  it("returns comments for authenticated user", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .get(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: ids.studentComment,
              comment_text: "Odlicna radionica",
              rating: 5,
            }),
          ])
        );
      });
  });

  it("creates a review for a student who has not reviewed the event", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Korisno i jasno", rating: 4 })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          comment_text: "Korisno i jasno",
          rating: 4,
          user_id: ids.secondStudent,
          event_id: ids.event,
        });
      });
  });

  it("trims comment text when creating and updating reviews", async () => {
    const createToken = await loginAs(app, "student2@test.local");

    const created = await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(createToken))
      .send({ comment_text: "   Trim komentar   ", rating: 4 })
      .expect(201);

    expect(created.body.comment_text).toBe("Trim komentar");

    const ownerToken = await loginAs(app, "student2@test.local");

    await request(app)
      .put(`/comments/${created.body.id}`)
      .set("Authorization", authHeader(ownerToken))
      .send({ comment_text: "   Novi trim   ", rating: 5 })
      .expect(200)
      .expect((res) => {
        expect(res.body.comment_text).toBe("Novi trim");
        expect(res.body.rating).toBe(5);
      });
  });

  it("allows rating-only reviews and rating-only review updates", async () => {
    const createToken = await loginAs(app, "student2@test.local");

    const created = await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(createToken))
      .send({ rating: 3 })
      .expect(201);

    expect(created.body).toMatchObject({
      comment_text: "",
      rating: 3,
      user_id: ids.secondStudent,
    });

    await request(app)
      .put(`/comments/${created.body.id}`)
      .set("Authorization", authHeader(createToken))
      .send({ rating: 5 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          comment_text: "",
          rating: 5,
        });
      });
  });

  it("rejects reviews from non-students and reviews for missing events", async () => {
    const adminToken = await loginAs(app, "admin@test.local");
    const studentToken = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(adminToken))
      .send({ comment_text: "Nije dozvoljeno", rating: 5 })
      .expect(403);

    await request(app)
      .post("/comments/event/9999")
      .set("Authorization", authHeader(studentToken))
      .send({ comment_text: "Nema dogadjaja", rating: 5 })
      .expect(404);
  });

  it("rejects script tags in comment text", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "<script>alert(1)</script>", rating: 4 })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe("Komentar sadrži nedozvoljen sadržaj");
      });
  });

  it("prevents organizer from reviewing their own event", async () => {
    const token = await loginAs(app, "organizer@test.local");

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Moj dogadjaj", rating: 5 })
      .expect(403);
  });

  it("rejects duplicate review for the same event", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .post(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Drugi put", rating: 3 })
      .expect(409);
  });

  it("allows users to update their own review", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Azurirana recenzija", rating: 4 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: ids.studentComment,
          comment_text: "Azurirana recenzija",
          rating: 4,
        });
      });
  });

  it("rejects comment updates and deletes from non-students", async () => {
    const adminToken = await loginAs(app, "admin@test.local");

    await request(app)
      .put(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(adminToken))
      .send({ comment_text: "Organizator update", rating: 4 })
      .expect(403);

    await request(app)
      .delete(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(adminToken))
      .expect(403);
  });

  it("rejects update with invalid rating and missing review", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Lose", rating: 0 })
      .expect(400);

    await request(app)
      .put("/comments/9999")
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Ne postoji", rating: 4 })
      .expect(404);

    await request(app)
      .put(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "x".repeat(1001), rating: 4 })
      .expect(400);
  });

  it("rejects script tags when updating comment text", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .put(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "<script>alert(1)</script>", rating: 4 })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe("Komentar sadrži nedozvoljen sadržaj");
      });
  });

  it("rejects deleting another student's review", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .delete(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .expect(403);
  });

  it("rejects updating another student's review", async () => {
    const token = await loginAs(app, "student2@test.local");

    await request(app)
      .put(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .send({ comment_text: "Tudja recenzija", rating: 4 })
      .expect(403)
      .expect((res) => {
        expect(res.body.message).toContain("svoje vlastite recenzije");
      });
  });

  it("allows a student to delete their own review", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .delete(`/comments/${ids.studentComment}`)
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toContain("obrisana");
      });

    await request(app)
      .get(`/comments/event/${ids.event}`)
      .set("Authorization", authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: ids.studentComment })])
        );
      });
  });

  it("returns 404 when deleting missing review", async () => {
    const token = await loginAs(app, "student@test.local");

    await request(app)
      .delete("/comments/9999")
      .set("Authorization", authHeader(token))
      .expect(404);
  });
});
