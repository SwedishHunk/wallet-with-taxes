import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { User } from "./user.entity";
import * as bcrypt from "bcryptjs";
import { ethers } from "ethers";
import GenesisWalletFactoryAbiJson from "../shared/constants/abis/GenesisWalletFactory.json";
import { JwtService } from "@nestjs/jwt";
import type { InterfaceAbi } from "ethers";
import { ContractTransactionResponse } from "ethers";
import { Studio } from "../platform/entities/studio.entity";
import {
  StudioMember,
  StudioRole,
} from "../platform/entities/studio-member.entity";
import { StudioMemberService } from "../platform/studio-member.service";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { encryptPrivateKey } from "../shared/crypto.util";
import { assertValidEmail } from "../shared/validators/email.validator";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  // Read deployer key once at startup and remove from process.env to
  // prevent other code paths from accessing it via the global env object.
  private readonly deployerPrivateKey: string | undefined;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    @InjectRepository(StudioMember)
    private readonly studioMemberRepository: Repository<StudioMember>,
    private readonly studioMemberService: StudioMemberService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {
    this.deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.DEPLOYER_PRIVATE_KEY;
  }

  // Email validation is provided by shared/validators/email.validator.ts

  private async buildCustodialCredentials(password: string): Promise<{
    passwordHash: string;
    wallet: { address: string; privateKey: string };
    encryptedPrivateKey: string;
    onChainWallet?: string;
  }> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const wallet = ethers.Wallet.createRandom();

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new AppException(
        ERROR_MESSAGES.MISSING_ENV_VAR("ENCRYPTION_KEY"),
        500,
      );
    }

    // AES-256-GCM: random IV per wallet — eliminates static-IV ciphertext reuse
    const encryptedPrivateKey = encryptPrivateKey(
      wallet.privateKey,
      encryptionKey,
    );

    const onChainWallet = await this.tryCreateOnChainWallet(wallet.address);

    return {
      passwordHash,
      wallet,
      encryptedPrivateKey,
      onChainWallet: onChainWallet ?? undefined,
    };
  }

  private async tryCreateOnChainWallet(
    walletAddress: string,
  ): Promise<string | null> {
    const rpcUrl = process.env.RPC_URL;
    const factoryAddress = process.env.FACTORY_ADDRESS;
    const deployerKey = this.deployerPrivateKey;

    if (!rpcUrl || !factoryAddress || !deployerKey) {
      console.warn(
        "Blockchain env vars missing; skipping on-chain wallet creation",
      );
      return null;
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const deployer = new ethers.Wallet(deployerKey, provider);
      const factory = new ethers.Contract(
        factoryAddress,
        GenesisWalletFactoryAbiJson as InterfaceAbi,
        deployer,
      );

      const tx = (await factory.createWallet(
        walletAddress,
      )) as ContractTransactionResponse;
      const receipt = await tx.wait();
      if (receipt && receipt.status === 1) {
        return walletAddress;
      }
      console.warn(
        "On-chain wallet creation returned non-success status; continuing without on-chain wallet",
      );
      return null;
    } catch (err) {
      console.warn(
        "Skipping on-chain wallet creation (RPC unavailable?):",
        err,
      );
      return null;
    }
  }

  async signup(email: string, password: string, studioName?: string) {
    assertValidEmail(email);

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new AppException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 409);
    }

    const { passwordHash, wallet, encryptedPrivateKey, onChainWallet } =
      await this.buildCustodialCredentials(password);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = queryRunner.manager.create(User, {
        email,
        passwordHash,
        custodyMode: "custodial",
        encryptedPrivateKey,
        walletAddress: wallet.address,
        onChainWallet,
        kycStatus: "pending",
      });
      await queryRunner.manager.save(user);

      const studio = queryRunner.manager.create(Studio, {
        name: studioName || email,
        email,
        walletAddress: wallet.address,
      });
      const savedStudio = await queryRunner.manager.save(studio);

      const membership = await this.studioMemberService.createBootstrapOwner(
        savedStudio,
        user,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      const token = this.jwtService.sign({
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        studioId: savedStudio.id,
        role: membership.role,
        isAdmin: user.isAdmin,
      });

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
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async login(email: string, password: string, studioId?: string) {
    assertValidEmail(email);

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppException(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    if (user.isSuspended === true) {
      throw new AppException(
        "Your account has been suspended. Contact support.",
        403,
      );
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
          this.logger.debug(
            `Created new studio ${studio.id} for user ${user.id}`,
          );
        } else {
          this.logger.debug(
            `Studio ${studio.id} already exists for user ${user.id}`,
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
          this.logger.debug(
            `Created bootstrap owner membership for user ${user.id} in studio ${studio.id}`,
          );
        } else {
          membership = existingMembership;
          this.logger.debug(
            `Membership already exists for user ${user.id} in studio ${studio.id}`,
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

    if (selectedStudio.status === "suspended") {
      throw new AppException(
        "This studio has been suspended. Contact support.",
        403,
      );
    }

    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      studioId: selectedStudio.id,
      role: selectedRole,
      isAdmin: user.isAdmin,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        custodyMode: user.custodyMode,
        kycStatus: user.kycStatus,
        studioId: selectedStudio.id,
        isAdmin: user.isAdmin,
      },
    };
  }

  async linkWallet(email: string, walletAddress: string, signature: string) {
    // Verify the caller owns the destination wallet by checking that the
    // supplied signature was produced by its private key.
    const message = `Link wallet to Triolith: ${email}`;
    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      throw new AppException("Invalid wallet ownership signature", 400);
    }
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AppException("Wallet ownership verification failed", 403);
    }

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
