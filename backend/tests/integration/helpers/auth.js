import request from "supertest";

export async function loginAs(app, email, password = "Password123!") {
  const response = await request(app)
    .post("/auth/login")
    .send({ email, password })
    .expect(200);

  return response.body.token;
}

export function authHeader(token) {
  return `Bearer ${token}`;
}
