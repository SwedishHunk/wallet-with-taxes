import {
  BadRequestException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { AppExceptionFilter } from "./app-exception.filter";
import { AppException } from "../exceptions/app-exception";

describe("AppExceptionFilter", () => {
  function setup() {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const response = { status, json };
    const request = { url: "/x" };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };
    return { response, host, status, json };
  }

  it("formats AppException", () => {
    const { host, status, json } = setup();
    const filter = new AppExceptionFilter();
    filter.catch(new AppException("boom", 418, "TEAPOT"), host as never);
    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 418,
        code: "TEAPOT",
        message: "boom",
        path: "/x",
      }),
    );
  });

  it("formats BadRequestException object response", () => {
    const { host, status, json } = setup();
    const filter = new AppExceptionFilter();
    filter.catch(
      new BadRequestException({ message: ["a"], code: "VALIDATION_FAILED" }),
      host as never,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "VALIDATION_FAILED",
        message: ["a"],
      }),
    );
  });

  it("formats BadRequestException string response", () => {
    const { host, json } = setup();
    const filter = new AppExceptionFilter();
    filter.catch(new BadRequestException("bad payload"), host as never);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BAD_REQUEST",
      }),
    );
  });

  it("formats generic HttpException", () => {
    const { host, status, json } = setup();
    const filter = new AppExceptionFilter();
    filter.catch(
      new HttpException({ message: "denied", error: "Forbidden" }, 403),
      host as never,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "Forbidden",
        message: "denied",
      }),
    );
  });

  it("formats HttpException with string payload", () => {
    const { host, json } = setup();
    const filter = new AppExceptionFilter();
    filter.catch(new HttpException("oops", 418), host as never);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 418,
        message: "oops",
      }),
    );
  });

  it("formats generic Error as internal server error", () => {
    const { host, status, json } = setup();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const filter = new AppExceptionFilter();
    filter.catch(new Error("unexpected"), host as never);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "UNHANDLED_ERROR",
        message: "unexpected",
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it("formats unknown exception object", () => {
    const { host, status, json } = setup();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const filter = new AppExceptionFilter();
    filter.catch({ boom: true }, host as never);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INTERNAL_SERVER_ERROR",
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});
