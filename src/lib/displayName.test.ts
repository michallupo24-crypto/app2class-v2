import { describe, expect, it } from "vitest";
import { displayName, legalNameHint, validateDisplayName } from "./displayName";

describe("displayName", () => {
  it("prefers the display name and falls back to the legal name", () => {
    expect(displayName({ full_name: "נועה כהן", display_name: "נועה לוי" })).toBe("נועה לוי");
    expect(displayName({ full_name: "נועה כהן", display_name: null })).toBe("נועה כהן");
    expect(displayName({ full_name: "נועה כהן", display_name: "  " })).toBe("נועה כהן");
    expect(displayName(null, "תלמיד/ה")).toBe("תלמיד/ה");
  });

  it("hints the legal name only when it is hidden", () => {
    expect(legalNameHint({ full_name: "נועה כהן", display_name: "נועה לוי" })).toBe("שם רשמי: נועה כהן");
    expect(legalNameHint({ full_name: "נועה כהן", display_name: null })).toBeUndefined();
  });
});

describe("validateDisplayName", () => {
  it.each(["נועה לוי", "Noa Levi", "ג'וני", "בן-חיים", "שי אל-עזר", "O'Brien", ""])("accepts %s", (n) => {
    expect(validateDisplayName(n)).toBeNull();
  });
  it.each(["noa123", "x", "שם!", "@noa", "a--b", "-נועה", "א".repeat(41), "noa_levi"])("rejects %s", (n) => {
    expect(validateDisplayName(n)).not.toBeNull();
  });
});
