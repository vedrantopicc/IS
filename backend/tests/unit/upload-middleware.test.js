import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  multer: vi.fn(),
  diskStorage: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mocks.existsSync,
    mkdirSync: mocks.mkdirSync,
  },
}));

vi.mock("multer", () => {
  const multer = mocks.multer;
  multer.diskStorage = mocks.diskStorage;
  return { default: multer };
});

describe("upload middleware", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.existsSync.mockReset();
    mocks.mkdirSync.mockReset();
    mocks.multer.mockReset();
    mocks.diskStorage.mockReset();
    mocks.diskStorage.mockImplementation((options) => ({ type: "storage", options }));
    mocks.multer.mockImplementation((options) => ({ type: "upload", options }));
  });

  it("creates uploads directory when missing and configures multer", async () => {
    mocks.existsSync.mockReturnValue(false);

    const { upload } = await import("../../middleware/upload.js");

    expect(mocks.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("uploads"), { recursive: true });
    expect(mocks.diskStorage).toHaveBeenCalledWith({
      destination: expect.any(Function),
      filename: expect.any(Function),
    });
    expect(mocks.multer).toHaveBeenCalledWith({
      storage: { type: "storage", options: expect.any(Object) },
      fileFilter: expect.any(Function),
      limits: { fileSize: 5 * 1024 * 1024 },
    });
    expect(upload).toEqual({ type: "upload", options: expect.any(Object) });
  });

  it("does not recreate uploads directory when it already exists", async () => {
    mocks.existsSync.mockReturnValue(true);

    await import("../../middleware/upload.js");

    expect(mocks.mkdirSync).not.toHaveBeenCalled();
  });

  it("builds upload destination and safe lowercase filenames", async () => {
    mocks.existsSync.mockReturnValue(true);
    vi.spyOn(Date, "now").mockReturnValue(123456789);
    vi.spyOn(Math, "random").mockReturnValue(0.42);

    await import("../../middleware/upload.js");
    const storageOptions = mocks.diskStorage.mock.calls[0][0];
    const destinationCb = vi.fn();
    const filenameCb = vi.fn();

    storageOptions.destination({}, {}, destinationCb);
    storageOptions.filename({}, { originalname: "Poster.PNG" }, filenameCb);

    expect(destinationCb).toHaveBeenCalledWith(null, expect.stringContaining("uploads"));
    expect(filenameCb).toHaveBeenCalledWith(null, "123456789-420000000.png");
  });

  it("accepts image mimetypes and rejects non-images", async () => {
    mocks.existsSync.mockReturnValue(true);

    await import("../../middleware/upload.js");
    const { fileFilter } = mocks.multer.mock.calls[0][0];
    const imageCb = vi.fn();
    const textCb = vi.fn();

    fileFilter({}, { mimetype: "image/webp" }, imageCb);
    fileFilter({}, { mimetype: "text/plain" }, textCb);

    expect(imageCb).toHaveBeenCalledWith(null, true);
    expect(textCb).toHaveBeenCalledWith(expect.any(Error), false);
    expect(textCb.mock.calls[0][0].message).toBe("Dozvoljene su samo slike");
  });
});
