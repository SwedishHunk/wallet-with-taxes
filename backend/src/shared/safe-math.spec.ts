import { safeAdd, safeSub } from "./safe-math";

describe("safe-math", () => {
  it("safeAdd avoids 0.1 + 0.2 floating-point error", () => {
    // JavaScript: 0.1 + 0.2 = 0.30000000000000004
    // safeAdd should return exactly "0.3"
    expect(safeAdd("0.1", 0.2)).toBe("0.3");
  });

  it("safeAdd handles normal addition", () => {
    expect(safeAdd("100.50", 25.25)).toBe("125.75");
  });

  it("safeAdd handles zero", () => {
    expect(safeAdd("50", 0)).toBe("50");
  });

  it("safeSub avoids floating-point error", () => {
    expect(safeSub("0.3", 0.1)).toBe("0.2");
  });

  it("safeSub handles normal subtraction", () => {
    expect(safeSub("100.50", 25.25)).toBe("75.25");
  });

  it("safeSub to zero", () => {
    expect(safeSub("50", 50)).toBe("0");
  });

  it("safeAdd with large numbers", () => {
    expect(safeAdd("999999.999999", 0.000001)).toBe("1000000");
  });

  it("safeSub negative result", () => {
    // Should work — overdraft protection is in the service layer
    expect(safeSub("10", 15)).toBe("-5");
  });
});
