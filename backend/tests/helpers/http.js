import { vi } from "vitest";

export function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: undefined,
    files: undefined,
    ...overrides,
  };
}

export function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

export function mockNext() {
  return vi.fn();
}
