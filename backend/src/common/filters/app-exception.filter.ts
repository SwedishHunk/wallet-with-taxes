import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AppException } from "../exceptions/app-exception";

type HttpExceptionResponse =
  | string
  | {
      message?: string | string[];
      error?: string;
      statusCode?: number;
      code?: string;
      [key: string]: unknown;
    };

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "An unexpected error occurred.";
    let code = "INTERNAL_SERVER_ERROR";

    // 1) AppException (din egen)
    if (exception instanceof AppException) {
      status = exception.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message ?? "An error occurred.";
      code = exception.code ?? "APP_ERROR";

      // 2) BadRequestException (mer specifik än HttpException)
    } else if (exception instanceof BadRequestException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse() as HttpExceptionResponse;

      // Nest brukar lägga validation errors i "message"
      if (typeof exResponse === "string") {
        message = exResponse;
      } else if (exResponse && typeof exResponse === "object") {
        message = exResponse.message ?? "Invalid request.";
        code = (exResponse.code as string) ?? "BAD_REQUEST";
      } else {
        message = "Invalid request.";
      }
      code = code ?? "BAD_REQUEST";

      // 3) Övriga HttpException
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse() as HttpExceptionResponse;

      if (typeof exResponse === "string") {
        message = exResponse;
      } else if (exResponse && typeof exResponse === "object") {
        message = exResponse.message ?? exception.message;
        code =
          (exResponse.code as string) ?? exResponse.error ?? "HTTP_EXCEPTION";
      } else {
        message = exception.message;
      }

      // 4) Vanliga Errors
    } else if (exception instanceof Error) {
      message = exception.message || "An error occurred.";
      code = "UNHANDLED_ERROR";
      // Logga stack för debugging (men exponera inte stack i response)

      console.error("[Unhandled Error]", exception);
    } else {
      console.error("[Unknown Exception]", exception);
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
