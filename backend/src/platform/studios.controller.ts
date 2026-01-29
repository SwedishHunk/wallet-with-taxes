import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { StudiosService } from "./studios.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Request } from "express";
import { JwtUser } from "../auth/jwt-user.interface";

@Controller("studios")
export class StudiosController {
  constructor(private studiosService: StudiosService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":studioId/members")
  getMembers(@Req() req: Request, @Param("studioId") studioId: string) {
    const jwtUser = req.user as JwtUser;
    return this.studiosService.getStudioMembers(studioId, jwtUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":studioId/members")
  createMember(
    @Req() req: Request,
    @Param("studioId") studioId: string,
    @Body()
    dto: {
      email: string;
      password?: string;
      role?: string;
      permissions?: string[];
    },
  ) {
    const jwtUser = req.user as JwtUser;
    return this.studiosService.createMember(studioId, jwtUser.id, {
      email: dto.email,
      password: dto.password,
      role: dto.role,
      permissions: dto.permissions ?? [],
    });
  }
}
