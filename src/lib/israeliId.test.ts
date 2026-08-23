import { describe, it, expect } from "vitest";
import { isValidIsraeliId } from "./israeliId";

// Registration (StudentRegistration.tsx) gates on this check before allowing
// signup, and reveal_id_number()/find_student_by_id_number() downstream rely
// on the stored value being a real, checksum-valid ID - so a wrong validator
// here either blocks real students or lets garbage into an encrypted PII column.
describe("isValidIsraeliId", () => {
  it("accepts known-valid checksums", () => {
    // Standard textbook-valid Israeli ID checksum examples.
    expect(isValidIsraeliId("123456782")).toBe(true);
    expect(isValidIsraeliId("000000018")).toBe(true);
  });

  it("accepts shorter IDs by left-padding with zeros", () => {
    // "023456783" is a valid 9-digit checksum starting with a leading zero;
    // a real user with this ID would type "23456783" (8 digits, still clears
    // the 5-digit floor) and both forms must validate identically.
    expect(isValidIsraeliId("23456783")).toBe(true);
    expect(isValidIsraeliId("023456783")).toBe(true);
  });

  it("rejects invalid checksums", () => {
    expect(isValidIsraeliId("123456789")).toBe(false);
    expect(isValidIsraeliId("111111111")).toBe(false);
  });

  it("rejects non-numeric or malformed input", () => {
    expect(isValidIsraeliId("")).toBe(false);
    expect(isValidIsraeliId("abcdefghi")).toBe(false);
    expect(isValidIsraeliId("12345678901")).toBe(false); // too long
    expect(isValidIsraeliId("1234")).toBe(false); // below the 5-digit floor
  });

  it("rejects input with whitespace-only padding around otherwise valid digits", () => {
    expect(isValidIsraeliId("  123456782  ")).toBe(true); // trimmed first
    expect(isValidIsraeliId("123 456 782")).toBe(false); // internal space is not digits-only
  });
});
