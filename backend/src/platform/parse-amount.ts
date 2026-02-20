import { BadRequestException } from "@nestjs/common";

export function parseAmount(input: unknown): number {
  if (input === null || input === undefined) {
    throw new BadRequestException("Amount must be a finite positive number");
  }

  if (typeof input === "string" && input.trim() === "") {
    throw new BadRequestException("Amount must be a finite positive number");
  }

  const amount = typeof input === "number" ? input : Number(input);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException("Amount must be a finite positive number");
  }

  return amount;
}
