import { Controller, Get, UseGuards, Query } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { AdminService } from "../admin/admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("fees")
  async getFeeStats(@Query("from") from?: string, @Query("to") to?: string) {
    return this.adminService.getFeeStats(from, to);
  }
  @Get("revenue")
  async getRevenue(@Query("from") from?: string, @Query("to") to?: string) {
    return this.adminService.getRevenueSplit(from, to);
  }
  @Get("users")
  async getAllUsers() {
    return this.adminService.getUserList();
  }

  @Get("studios")
  async getAllStudios() {
    return this.adminService.getAllStudios();
  }

  @Get("transactions")
  async getAllTransactions(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.getAllTransactions(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
