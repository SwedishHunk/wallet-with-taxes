export declare class AppException extends Error {
    readonly message: string;
    readonly statusCode: number;
    readonly code?: string | undefined;
    constructor(message: string, statusCode?: number, code?: string | undefined);
}
