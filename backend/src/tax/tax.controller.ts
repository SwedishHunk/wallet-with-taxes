import { Controller, Get, Query, Res } from "@nestjs/common";
import { TaxService } from "./tax.service";
import { Response } from "express";

@Controller("tax")
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get("summary")
  async getSummary(@Query("user") user: string) {
    if (!user) return { error: "Missing user address in query." };
    return this.taxService.getSummary(user);
  }

  @Get("export")
  async exportCSV(@Query("user") user: string, @Res() res: Response) {
    if (!user) {
      res.status(400).send("Missing user address");
      return;
    }

    await this.taxService.exportEventsAsCSV(user, res);
  }
}
