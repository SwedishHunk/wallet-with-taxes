import { BadRequestException } from "@nestjs/common";
import { ERROR_MESSAGES } from "../constants/error-messages";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function assertValidEmail(email: string): void {
  if (!isValidEmail(email)) {
    throw new BadRequestException(ERROR_MESSAGES.INVALID_EMAIL_FORMAT);
  }
}
