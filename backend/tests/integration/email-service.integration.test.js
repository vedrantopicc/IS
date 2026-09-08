import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

process.env.EMAIL_HOST = "smtp.test.local";
process.env.EMAIL_PORT = "587";
process.env.EMAIL_USER = "noreply@test.local";
process.env.EMAIL_PASS = "secret";
process.env.FRONTEND_URL = "https://studlife.test";

const {
  sendOrganizerApprovalEmail,
  sendOrganizerRejectionEmail,
  sendPasswordResetEmail,
} = await import("../../utils/emailService.js");

describe("integration: email service templates", () => {
  beforeEach(() => {
    mocks.sendMail.mockClear();
    process.env.FRONTEND_URL = "https://studlife.test";
    mocks.sendMail.mockResolvedValue({ accepted: ["student@test.local"] });
  });

  it("sends password reset email with reset token link", async () => {
    await sendPasswordResetEmail("student@test.local", "reset-token");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@test.local",
        subject: expect.stringContaining("Ponovno postavljanje lozinke"),
        html: expect.stringContaining("reset-token"),
      })
    );
  });

  it("sends organizer approval and rejection emails", async () => {
    await sendOrganizerApprovalEmail("student@test.local", "student");
    await sendOrganizerRejectionEmail("student@test.local", "student");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@test.local",
        subject: expect.stringContaining("odobren"),
        html: expect.stringContaining("student"),
      })
    );
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@test.local",
        subject: expect.stringContaining("odbijen"),
        html: expect.stringContaining("student"),
      })
    );
  });

  it("uses localhost dashboard fallback when frontend URL is not configured", async () => {
    delete process.env.FRONTEND_URL;

    await sendOrganizerApprovalEmail("student@test.local", "student");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("http://localhost:5173"),
      })
    );
  });
});
