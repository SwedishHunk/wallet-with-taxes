import {
  Controller,
  Get,
  Patch,
  Delete,
  UseGuards,
  Query,
  Param,
  Body,
  Request,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { TriolithGuard } from "../auth/triolith.guard";
import { AdminService } from "../admin/admin.service";
import {
  SetStudioStatusDto,
  SetUserAdminDto,
  SetUserSuspendedDto,
  SetPlatformFeeDto,
  SetGameStatusDto,
} from "./dto/admin-request.dto";

interface AuthRequest {
  user: { id: string; email: string };
}

// 30 requests per minute per IP on all admin endpoints
@Throttle({ auth: { limit: 30, ttl: 60000 } })
@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Studio-owner level: fee stats visible to studio owners
  @Get("fees")
  @UseGuards(AdminGuard)
  async getFeeStats(@Query("from") from?: string, @Query("to") to?: string) {
    return this.adminService.getFeeStats(from, to);
  }

  @Get("revenue")
  @UseGuards(AdminGuard)
  async getRevenue(@Query("from") from?: string, @Query("to") to?: string) {
    return this.adminService.getRevenueSplit(from, to);
  }

  // Triolith platform-admin level: cross-studio data
  @Get("users")
  @UseGuards(TriolithGuard)
  async getAllUsers() {
    return this.adminService.getUserList();
  }

  @Get("studios")
  @UseGuards(TriolithGuard)
  async getAllStudios() {
    return this.adminService.getAllStudios();
  }

  @Get("transactions")
  @UseGuards(TriolithGuard)
  async getAllTransactions(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.getAllTransactions(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Patch("studios/:id/status")
  @UseGuards(TriolithGuard)
  async setStudioStatus(
    @Param("id") id: string,
    @Body() body: SetStudioStatusDto,
    @Request() req: AuthRequest,
  ) {
    return this.adminService.setStudioStatus(
      id,
      body.status,
      req.user.id,
      req.user.email,
    );
  }

  @Delete("studios/:id")
  @UseGuards(TriolithGuard)
  async deleteStudio(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.adminService.deleteStudio(id, req.user.id, req.user.email);
  }

  @Get("studios/:id/games")
  @UseGuards(TriolithGuard)
  async getStudioGames(@Param("id") id: string) {
    return this.adminService.getStudioGames(id);
  }

  @Patch("users/:id/admin")
  @UseGuards(TriolithGuard)
  async setUserAdmin(
    @Param("id") id: string,
    @Body() body: SetUserAdminDto,
    @Request() req: AuthRequest,
  ) {
    return this.adminService.setUserAdmin(
      id,
      body.isAdmin,
      req.user.id,
      req.user.email,
    );
  }

  @Patch("users/:id/suspended")
  @UseGuards(TriolithGuard)
  async setUserSuspended(
    @Param("id") id: string,
    @Body() body: SetUserSuspendedDto,
    @Request() req: AuthRequest,
  ) {
    return this.adminService.setUserSuspended(
      id,
      body.suspended,
      req.user.id,
      req.user.email,
    );
  }

  @Delete("users/:id")
  @UseGuards(TriolithGuard)
  async deleteUser(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.adminService.deleteUser(id, req.user.id, req.user.email);
  }

  @Get("platform/fee")
  @UseGuards(TriolithGuard)
  async getPlatformFee() {
    return this.adminService.getPlatformFee();
  }

  @Patch("platform/fee")
  @UseGuards(TriolithGuard)
  async setPlatformFee(
    @Body() body: SetPlatformFeeDto,
    @Request() req: AuthRequest,
  ) {
    return this.adminService.setPlatformFee(
      body.feePercent,
      req.user.id,
      req.user.email,
    );
  }

  @Get("games")
  @UseGuards(TriolithGuard)
  async getAllGames() {
    return this.adminService.getAllGames();
  }

  @Patch("games/:id/status")
  @UseGuards(TriolithGuard)
  async setGameStatus(
    @Param("id") id: string,
    @Body() body: SetGameStatusDto,
  ) {
    return this.adminService.setGameStatus(id, body.status);
  }

  @Get("audit-log")
  @UseGuards(TriolithGuard)
  async getAuditLog(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.getAuditLog(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
