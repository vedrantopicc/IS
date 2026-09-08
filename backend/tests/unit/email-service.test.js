import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

describe("emailService", () => {
  let emailService;

  beforeEach(async () => {
    vi.resetModules();
    mocks.sendMail.mockReset();
    mocks.createTransport.mockReset();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });

    process.env.EMAIL_HOST = "smtp.test.local";
    process.env.EMAIL_PORT = "587";
    process.env.EMAIL_USER = "noreply@test.local";
    process.env.EMAIL_PASS = "secret";
    process.env.FRONTEND_URL = "http://localhost:5173";

    emailService = await import("../../utils/emailService.js");
  });

  it("creates nodemailer transporter from environment variables", () => {
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.test.local",
      port: 587,
      secure: false,
      auth: {
        user: "noreply@test.local",
        pass: "secret",
      },
    });
  });

  it("sendPasswordResetEmail sends reset link with token", async () => {
    await emailService.sendPasswordResetEmail("student@test.local", "reset-token-123");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@test.local",
        to: "student@test.local",
        subject: expect.stringContaining("Ponovno postavljanje lozinke"),
        html: expect.stringContaining(
          "http://localhost:5173/reset-password?token=reset-token-123"
        ),
      })
    );
  });

  it("sendOrganizerApprovalEmail sends approval email with dashboard link", async () => {
    await emailService.sendOrganizerApprovalEmail("organizer@test.local", "organizer");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@test.local",
        to: "organizer@test.local",
        subject: expect.stringContaining("odobren"),
        html: expect.stringContaining("organizer"),
      })
    );
    expect(mocks.sendMail.mock.calls[0][0].html).toContain("http://localhost:5173");
  });

  it("sendOrganizerApprovalEmail falls back to localhost when FRONTEND_URL is missing", async () => {
    vi.resetModules();
    mocks.sendMail.mockReset();
    mocks.createTransport.mockReset();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    delete process.env.FRONTEND_URL;

    const serviceWithoutFrontendUrl = await import("../../utils/emailService.js");
    await serviceWithoutFrontendUrl.sendOrganizerApprovalEmail("organizer@test.local", "organizer");

    expect(mocks.sendMail.mock.calls[0][0].html).toContain("http://localhost:5173");
  });

  it("sendOrganizerRejectionEmail sends rejection email", async () => {
    await emailService.sendOrganizerRejectionEmail("student@test.local", "student");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@test.local",
        to: "student@test.local",
        subject: expect.stringContaining("odbijen"),
        html: expect.stringContaining("student"),
      })
    );
  });
});
