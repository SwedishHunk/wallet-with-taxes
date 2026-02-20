import { BadRequestException } from "@nestjs/common";
import { parseAmount } from "./parse-amount";

describe("parseAmount", () => {
  it("accepts valid numeric inputs and rejects invalid values", () => {
    expect(parseAmount("10")).toBe(10);
    expect(parseAmount(10)).toBe(10);

    expect(() => parseAmount("0")).toThrow(BadRequestException);
    expect(() => parseAmount(-1)).toThrow(BadRequestException);
    expect(() => parseAmount("abc")).toThrow(BadRequestException);
    expect(() => parseAmount("")).toThrow(BadRequestException);
    expect(() => parseAmount(undefined)).toThrow(BadRequestException);
    expect(() => parseAmount(null)).toThrow(BadRequestException);
  });
});
