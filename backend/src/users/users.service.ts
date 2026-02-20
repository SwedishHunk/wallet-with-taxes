import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";
import * as bcrypt from "bcryptjs";
import { ethers } from "ethers";
import * as crypto from "crypto";
import GenesisWalletFactoryAbiJson from "../shared/constants/abis/GenesisWalletFactory.json";
import { JwtService } from "@nestjs/jwt";
import type { InterfaceAbi } from "ethers";
import { ContractTransactionResponse } from "ethers";
import console from "console";
import { Studio } from "../platform/entities/studio.entity";
import {
  StudioMember,
  StudioRole,
} from "../platform/entities/studio-member.entity";
import { StudioMemberService } from "../platform/studio-member.service";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    @InjectRepository(StudioMember)
    private readonly studioMemberRepository: Repository<StudioMember>,
    private readonly studioMemberService: StudioMemberService,
    private readonly jwtService: JwtService,
  ) {}

  private isValidEmail(email: string): boolean {
    // Email must contain @ and have a domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async signup(email: string, password: string, studioName?: string) {
    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new AppException(ERROR_MESSAGES.INVALID_EMAIL_FORMAT, 400);
    }

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new AppException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const wallet = ethers.Wallet.createRandom();

    const encryptionKey = process.env.ENCRYPTION_KEY;
    const encryptionIv = process.env.ENCRYPTION_IV;
    if (!encryptionKey || !encryptionIv) {
      throw new AppException(
        ERROR_MESSAGES.MISSING_ENV_VAR("ENCRYPTION_KEY or ENCRYPTION_IV"),
        500,
      );
    }

    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(encryptionKey, "utf8"),
      Buffer.from(encryptionIv, "utf8"),
    );
    const encryptedPrivateKey =
      cipher.update(wallet.privateKey, "utf8", "hex") + cipher.final("hex");

    // Optional on-chain wallet creation. Skip gracefully if RPC is unavailable.
    let onChainWallet: string | null = null;
    const rpcUrl = process.env.RPC_URL;
    const factoryAddress = process.env.FACTORY_ADDRESS;
    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (rpcUrl && factoryAddress && deployerKey) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const deployer = new ethers.Wallet(deployerKey, provider);
        const factory = new ethers.Contract(
          factoryAddress,
          GenesisWalletFactoryAbiJson as InterfaceAbi,
          deployer,
        );

        const tx = (await factory.createWallet(
          wallet.address,
        )) as ContractTransactionResponse;
        const receipt = await tx.wait();
        if (receipt && receipt.status === 1) {
          onChainWallet = wallet.address;
        } else {
          console.warn(
            "On-chain wallet creation returned non-success status; continuing without on-chain wallet",
          );
        }
      } catch (err) {
        console.warn(
          "Skipping on-chain wallet creation (RPC unavailable?):",
          err,
        );
      }
    } else {
      console.warn(
        "Blockchain env vars missing; skipping on-chain wallet creation",
      );
    }

    const user = this.userRepository.create({
      email,
      passwordHash,
      custodyMode: "custodial",
      encryptedPrivateKey,
      walletAddress: wallet.address,
      onChainWallet: onChainWallet ?? undefined,
      kycStatus: "pending",
    });

    await this.userRepository.save(user);

    // Auto-create a studio and set user as owner (bootstrap)
    const studio = this.studioRepository.create({
      name: studioName || email, // Use provided studioName or fallback to email
      email,
      walletAddress: wallet.address,
    });
    const savedStudio = await this.studioRepository.save(studio);

    // Create owner membership via StudioMemberService
    // This sets isOwner=true and all permissions
    const membership = await this.studioMemberService.createBootstrapOwner(
      savedStudio,
      user,
    );

    // Generate JWT token for auto-login
    const token = this.jwtService.sign(
      {
        id: user.id,
        email: user.email,
        studioId: savedStudio.id,
        role: membership.role,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: "7d",
      },
    );

    // Return full session data for auto-login
    return {
      token,
      studio: {
        studioId: savedStudio.id,
        studioName: savedStudio.name,
      },
      member: {
        memberId: membership.id,
        userId: user.id,
        studioId: savedStudio.id,
        email: user.email,
        isOwner: membership.isOwner,
        permissions: this.studioMemberService.maskToPermissionStrings(
          membership.permissionsMask,
        ),
        gameAccessIds: membership.gameAccessIds ?? [],
      },
    };
  }

  async login(email: string, password: string, studioId?: string) {
    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new AppException(ERROR_MESSAGES.INVALID_EMAIL_FORMAT, 400);
    }

    console.log("Login attempt with:", email, password, "studioId:", studioId);

    const user = await this.userRepository.findOne({ where: { email } });
    console.log("Found user:", user);

    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppException(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // If studioId provided, verify user is a member
    let selectedStudio: Studio | null = null;
    let selectedRole: StudioRole | null = null;

    if (studioId) {
      const membership = await this.studioMemberRepository.findOne({
        where: { studio: { id: studioId }, user: { id: user.id } },
        relations: ["studio"],
      });
      if (!membership) {
        throw new AppException(ERROR_MESSAGES.NOT_STUDIO_MEMBER, 403);
      }
      selectedStudio = membership.studio;
      selectedRole = membership.role;
    } else {
      // If no studio specified, get first membership (for backwards compat)
      let membership = await this.studioMemberRepository.findOne({
        where: { user: { id: user.id } },
        relations: ["studio"],
      });

      // Auto-migrate old users without studios
      if (!membership) {
        // Check if a studio with this name already exists
        let studio = await this.studioRepository.findOne({
          where: { name: user.email },
        });

        // If it doesn't exist, create it
        if (!studio) {
          studio = this.studioRepository.create({
            name: user.email,
            email: user.email,
            walletAddress: user.walletAddress,
          });
          studio = await this.studioRepository.save(studio);
          console.log(`Created new studio ${studio.id} for user ${user.email}`);
        } else {
          console.log(
            `Studio ${studio.id} already exists for user ${user.email}`,
          );
        }

        // Check if membership already exists before creating
        const existingMembership = await this.studioMemberRepository.findOne({
          where: { studio: { id: studio.id }, user: { id: user.id } },
          relations: ["studio"],
        });

        if (!existingMembership) {
          // Create membership via StudioMemberService (sets isOwner + permissions)
          membership = await this.studioMemberService.createBootstrapOwner(
            studio,
            user,
          );
          console.log(
            `Created bootstrap owner membership for user ${user.email} in studio ${studio.id}`,
          );
        } else {
          membership = existingMembership;
          console.log(
            `Membership already exists for user ${user.email} in studio ${studio.id}`,
          );
        }
      }

      if (membership) {
        selectedStudio = membership.studio;
        selectedRole = membership.role;
      }
    }

    if (!selectedStudio) {
      throw new AppException(ERROR_MESSAGES.STUDIO_NOT_FOUND, 404);
    }

    const token = this.jwtService.sign(
      {
        id: user.id,
        email: user.email,
        studioId: selectedStudio.id,
        role: selectedRole,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: "7d",
      },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        custodyMode: user.custodyMode,
        kycStatus: user.kycStatus,
        studioId: selectedStudio.id,
      },
    };
  }

  async linkWallet(email: string, walletAddress: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    user.walletAddress = walletAddress;
    user.custodyMode = "self";
    user.encryptedPrivateKey = null;

    await this.userRepository.save(user);
    return { message: "Wallet linked successfully" };
  }
  async findById(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) return null;

    const membership = await this.studioMemberRepository.findOne({
      where: { user: { id } },
      relations: ["studio"],
    });

    return { ...user, studioId: membership?.studio.id ?? null } as User & {
      studioId: string | null;
    };
  }

  async getStudiosForUser(userId: string) {
    const memberships = await this.studioMemberRepository.find({
      where: { user: { id: userId } },
      relations: ["studio"],
    });
    return memberships.map((m) => ({ ...m.studio, role: m.role }));
  }

  async getMemberSession(userId: string, studioId: string) {
    // Enforce: must be the same user and same studio; no fallbacks
    const membership = await this.studioMemberRepository.findOne({
      where: { user: { id: userId }, studio: { id: studioId } },
      relations: ["user", "studio"],
    });

    if (!membership) {
      throw new AppException(ERROR_MESSAGES.NOT_STUDIO_MEMBER, 404);
    }

    return {
      memberId: membership.id,
      userId: membership.user.id,
      studioId: membership.studio.id,
      email: membership.user.email,
      isOwner: membership.isOwner,
      role: membership.role,
      permissions: this.studioMemberService.maskToPermissionStrings(
        membership.permissionsMask,
      ),
      gameAccessIds: membership.gameAccessIds ?? [],
    };
  }
}
