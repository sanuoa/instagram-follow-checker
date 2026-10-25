import { describe, expect, it } from "vitest";
import { createCsv, csvCell } from "../../src/lib/csv.js";

describe("safe CSV exports", () => {
  it.each([
    "=SUM(A1)",
    "+cmd",
    "-cmd",
    "@cmd",
    "  =cmd",
    "\t=cmd",
    "\rcommand",
  ])("neutralizes spreadsheet formula input %s", (value) => {
    expect(csvCell(value).startsWith("\"'")).toBe(true);
  });

  it("escapes quotes and commas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });

  it("exports just the supplied results with safe profile links", () => {
    expect(createCsv([{ username: "bob", key: "bob" }])).toBe(
      'username,profile_url\r\n"bob","https://www.instagram.com/bob/"',
    );
    expect(createCsv([])).toBe("username,profile_url");
    expect(() => createCsv([{ username: "=evil" }])).toThrow();
  });
});
