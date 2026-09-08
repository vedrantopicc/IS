import { afterAll, vi } from "vitest";
import "./test-db.js";

vi.mock("../../../utils/emailService.js", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendOrganizerApprovalEmail: vi.fn().mockResolvedValue(undefined),
  sendOrganizerRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

export async function createTestApp() {
  const { default: app } = await import("../../../app.js");
  return app;
}

export async function closeTestAppPool() {
  const { closePool } = await import("../../../db.js");
  await closePool();
}

afterAll(async () => {
  await closeTestAppPool();
});

