export class AppException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly code?: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppException.prototype);
  }
}
