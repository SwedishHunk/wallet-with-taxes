import { ERROR_MESSAGES } from "./error-messages";

describe("ERROR_MESSAGES", () => {
  it("renders dynamic messages", () => {
    expect(ERROR_MESSAGES.MISSING_ENV_VAR("JWT_SECRET")).toContain(
      "JWT_SECRET",
    );
    expect(ERROR_MESSAGES.VALIDATION_ERROR("email")).toContain("email");
    expect(ERROR_MESSAGES.MISSING_REQUIRED_FIELD("password")).toContain(
      "password",
    );
  });
});
