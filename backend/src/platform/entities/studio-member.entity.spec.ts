import { getMetadataArgsStorage } from "typeorm";
import { StudioMember } from "./studio-member.entity";

describe("StudioMember entity bigint transformer", () => {
  it("converts bigint permissions to/from database values", () => {
    const column = getMetadataArgsStorage().columns.find(
      (c) => c.target === StudioMember && c.propertyName === "permissionsMask",
    );
    expect(column).toBeDefined();
    const transformer = column?.options.transformer as {
      to: (value: bigint | null | undefined) => string;
      from: (value: string | null | undefined) => bigint;
    };

    expect(transformer.to(31n)).toBe("31");
    expect(transformer.to(undefined)).toBe("0");
    expect(transformer.to(null)).toBe("0");

    expect(transformer.from("31")).toBe(31n);
    expect(transformer.from(undefined)).toBe(0n);
    expect(transformer.from(null)).toBe(0n);
  });

  it("returns 0n and logs when db value is invalid bigint", () => {
    const column = getMetadataArgsStorage().columns.find(
      (c) => c.target === StudioMember && c.propertyName === "permissionsMask",
    );
    const transformer = column?.options.transformer as {
      from: (value: string | null | undefined) => bigint;
    };
    const errSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(transformer.from("not-a-number")).toBe(0n);
    expect(errSpy).toHaveBeenCalled();
  });
});
