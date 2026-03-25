import {
  Controller,
  Get,
  Post,
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
import { DataRetentionService } from "../data-retention/data-retention.service";
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

// Default: 60 requests/min for reads; write endpoints are individually
// restricted to 10 req/min via the "admin-write" throttle tier.
@Throttle({ default: { limit: 60, ttl: 60000 } })
@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly dataRetentionService: DataRetentionService,
  ) {}

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
      Math.min(limit ? parseInt(limit, 10) : 50, 200),
      offset ? Math.max(parseInt(offset, 10), 0) : 0,
    );
  }

  @Patch("studios/:id/status")
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
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
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
  @UseGuards(TriolithGuard)
  async deleteStudio(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.adminService.deleteStudio(id, req.user.id, req.user.email);
  }

  @Get("studios/:id/games")
  @UseGuards(TriolithGuard)
  async getStudioGames(@Param("id") id: string) {
    return this.adminService.getStudioGames(id);
  }

  @Get("studios/:id/members")
  @UseGuards(TriolithGuard)
  async getStudioMembers(@Param("id") id: string) {
    return this.adminService.getStudioMembers(id);
  }

  @Get("studios/:id/players")
  @UseGuards(TriolithGuard)
  async getStudioPlayers(@Param("id") id: string) {
    return this.adminService.getStudioPlayers(id);
  }

  @Get("studios/:id/transactions")
  @UseGuards(TriolithGuard)
  async getStudioTransactions(
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.getStudioTransactions(
      id,
      Math.min(limit ? parseInt(limit, 10) : 25, 100),
    );
  }

  @Patch("users/:id/admin")
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
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
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
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
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
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
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
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

  @Get("games/:id/players")
  @UseGuards(TriolithGuard)
  async getGamePlayers(@Param("id") id: string) {
    return this.adminService.getGamePlayers(id);
  }

  @Get("games/:id/transactions")
  @UseGuards(TriolithGuard)
  async getGameTransactions(
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.getGameTransactions(
      id,
      Math.min(limit ? parseInt(limit, 10) : 25, 100),
    );
  }

  @Patch("games/:id/status")
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
  @UseGuards(TriolithGuard)
  async setGameStatus(
    @Param("id") id: string,
    @Body() body: SetGameStatusDto,
    @Request() req: AuthRequest,
  ) {
    return this.adminService.setGameStatus(
      id,
      body.status,
      req.user.id,
      req.user.email,
    );
  }

  @Delete("games/:id")
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
  @UseGuards(TriolithGuard)
  async deleteGame(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.adminService.deleteGame(id, req.user.id, req.user.email);
  }

  /**
   * POST /admin/maintenance/data-retention
   * Manually trigger the GDPR data-retention anonymisation job.
   * Useful for compliance testing and on-demand anonymisation runs
   * without waiting for the nightly cron.
   */
  @Post("maintenance/data-retention")
  @Throttle({ "admin-write": { limit: 10, ttl: 60000 } })
  @UseGuards(TriolithGuard)
  async runDataRetention() {
    return this.dataRetentionService.runManually();
  }

  @Get("audit-log")
  @UseGuards(TriolithGuard)
  async getAuditLog(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.getAuditLog(
      Math.min(limit ? parseInt(limit, 10) : 50, 200),
      offset ? Math.max(parseInt(offset, 10), 0) : 0,
    );
  }

  @Get("economics/studios")
  @UseGuards(TriolithGuard)
  async getEconomicsSummaryPerStudio() {
    return this.adminService.getEconomicsSummaryPerStudio();
  }
}
