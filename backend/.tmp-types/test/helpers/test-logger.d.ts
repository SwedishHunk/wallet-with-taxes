import { LoggerService } from "@nestjs/common";
export declare class TestLogger implements LoggerService {
    log(): void;
    error(): void;
    warn(): void;
    debug(): void;
    verbose(): void;
}
