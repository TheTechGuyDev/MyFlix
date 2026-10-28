import { describe, expect, it } from "vitest";
import { isPhoneLike, normalPhone, prettyPhone } from "./messaging";

describe("Nigerian phone numbers", () => {
  it("normalises common formats", () => {
    expect(normalPhone("0803 123 4567")).toBe("2348031234567");
    expect(normalPhone("+234 (803) 123-4567")).toBe("2348031234567");
    expect(normalPhone("8031234567")).toBe("2348031234567");
  });
  it("rejects bad numbers", () => {
    expect(normalPhone("0603 123 4567")).toBe("");
    expect(normalPhone("123")).toBe("");
  });
  it("formats for display", () => expect(prettyPhone("2348031234567")).toBe("+234 803 123 4567"));
  it("tells phones from emails", () => {
    expect(isPhoneLike("08031234567")).toBe(true);
    expect(isPhoneLike("ada@example.com")).toBe(false);
  });
});
