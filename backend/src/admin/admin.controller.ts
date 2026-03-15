import {
  Controller,
  Get,
  Patch,
  UseGuards,
  Query,
  Param,
  Body,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { TriolithGuard } from "../auth/triolith.guard";
import { AdminService } from "../admin/admin.service";

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
    @Body() body: { status: "active" | "suspended" },
  ) {
    return this.adminService.setStudioStatus(id, body.status);
  }

  @Patch("users/:id/admin")
  @UseGuards(TriolithGuard)
  async setUserAdmin(
    @Param("id") id: string,
    @Body() body: { isAdmin: boolean },
  ) {
    return this.adminService.setUserAdmin(id, body.isAdmin);
  }

  @Patch("users/:id/suspended")
  @UseGuards(TriolithGuard)
  async setUserSuspended(
    @Param("id") id: string,
    @Body() body: { suspended: boolean },
  ) {
    return this.adminService.setUserSuspended(id, body.suspended);
  }

  @Get("platform/fee")
  @UseGuards(TriolithGuard)
  async getPlatformFee() {
    return this.adminService.getPlatformFee();
  }

  @Patch("platform/fee")
  @UseGuards(TriolithGuard)
  async setPlatformFee(@Body() body: { feePercent: number }) {
    return this.adminService.setPlatformFee(body.feePercent);
  }
}
