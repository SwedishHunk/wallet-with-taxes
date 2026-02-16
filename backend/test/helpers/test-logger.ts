import { LoggerService } from "@nestjs/common";

/**
 * Minimal logger that silences all Nest output during e2e tests.
 * This prevents cluttering test output with expected error stacktraces.
 */
export class TestLogger implements LoggerService {
  log() {}
  error() {}
  warn() {}
  debug() {}
  verbose() {}
}
