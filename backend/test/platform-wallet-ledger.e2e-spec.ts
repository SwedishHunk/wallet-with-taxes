import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import request from "supertest";
import { DataSource, Repository } from "typeorm";
import type { Server } from "http";
import { PlatformService } from "src/platform/platform.service";
import { PlatformController } from "src/platform/platform.controller";
import { JwtStrategy } from "src/auth/jwt.strategy";
import { Studio } from "src/platform/entities/studio.entity";
import {
  StudioMember,
  StudioRole,
} from "src/platform/entities/studio-member.entity";
import { StudioUser } from "src/platform/entities/studio-user.entity";
import { Game } from "src/platform/entities/game.entity";
import { GamePlayer } from "src/platform/entities/game-player.entity";
import { GameWallet } from "src/platform/entities/game-wallet.entity";
import { LedgerEntry } from "src/platform/entities/ledger-entry.entity";
import { NFTTemplate } from "src/platform/entities/nft-template.entity";
import { NFTInstance } from "src/platform/entities/nft-instance.entity";
import { WalletDepositIntent } from "src/platform/entities/wallet-deposit-intent.entity";
import { User } from "src/users/user.entity";
import {
  authHeader,
  validateGameWalletShape,
  validateLedgerArrayShape,
} from "./helpers/test-helpers";
import { TestLogger } from "./helpers/test-logger";

describe("Game Wallet & Ledger E2E Smoke Tests", () => {
  let app: INestApplication | null = null;
  let server: Server;
  let jwtService: JwtService;
  let dataSource: DataSource | null = null;

  // Repositories
  let userRepo: Repository<User>;
  let studioRepo: Repository<Studio>;
  let studioMemberRepo: Repository<StudioMember>;
  let gameRepo: Repository<Game>;
  let depositIntentRepo: Repository<WalletDepositIntent>;

  // Test data
  let user1: User;
  let user2: User;
  let studio: Studio;
  let studio2: Studio;
  let game: Game;
  let game2: Game;
  let game3: Game;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    try {
      // Validate TEST_DATABASE environment variables
      const requiredVars = [
        "TEST_DATABASE_HOST",
        "TEST_DATABASE_USER",
        "TEST_DATABASE_PASSWORD",
      ];
      const missing = requiredVars.filter((v) => !process.env[v]);
      if (missing.length > 0) {
        throw new Error(
          `E2E test requires missing environment variables: ${missing.join(", ")}. ` +
            `Please ensure .env.test is sourced or variables are set.`,
        );
      }

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "postgres",
            host: process.env.TEST_DATABASE_HOST,
            port: Number(process.env.TEST_DATABASE_PORT || "5432"),
            username: process.env.TEST_DATABASE_USER,
            password: process.env.TEST_DATABASE_PASSWORD,
            database: process.env.TEST_DATABASE_NAME || "inner_wallet_test",
            entities: [
              User,
              Studio,
              StudioMember,
              StudioUser,
              Game,
              GamePlayer,
              GameWallet,
              LedgerEntry,
              NFTTemplate,
              NFTInstance,
              WalletDepositIntent,
            ],
            synchronize: true,
            dropSchema: true,
          }),
          TypeOrmModule.forFeature([
            User,
            Studio,
            StudioMember,
            Game,
            GamePlayer,
            GameWallet,
            LedgerEntry,
            NFTTemplate,
            NFTInstance,
            WalletDepositIntent,
          ]),
          PassportModule,
          JwtModule.register({
            secret: "test-secret",
            signOptions: { expiresIn: "1h" },
          }),
        ],
        controllers: [PlatformController],
        providers: [PlatformService, JwtStrategy],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useLogger(new TestLogger()); // Silence Nest logs for cleaner test output
      app.useGlobalPipes(new ValidationPipe());
      await app.init();
      server = app.getHttpServer() as Server;

      jwtService = moduleFixture.get(JwtService);
      dataSource = moduleFixture.get(DataSource);

      if (!dataSource) {
        throw new Error("E2E: DataSource was not initialized");
      }
      const ds = dataSource;

      // Get repositories
      userRepo = ds.getRepository(User);
      studioRepo = ds.getRepository(Studio);
      studioMemberRepo = ds.getRepository(StudioMember);
      gameRepo = ds.getRepository(Game);
      depositIntentRepo = ds.getRepository(WalletDepositIntent);

      // Seed test data
      user1 = await userRepo.save({
        email: "user1@test.com",
        walletAddress: "0x1234567890123456789012345678901234567890",
        passwordHash: "test_hash",
        custodyMode: "custodial",
        encryptedPrivateKey: null,
      });

      user2 = await userRepo.save({
        email: "user2@test.com",
        walletAddress: "0x0987654321098765432109876543210987654321",
        passwordHash: "test_hash",
        custodyMode: "custodial",
        encryptedPrivateKey: null,
      });

      studio = await studioRepo.save({
        name: "Test Studio",
        email: "studio@test.com",
        walletAddress: "0xstudio",
      });

      // Add members to studio
      await studioMemberRepo.save({
        studio,
        user: user1,
        role: StudioRole.OWNER,
      });

      await studioMemberRepo.save({
        studio,
        user: user2,
        role: StudioRole.MEMBER,
      });

      // Create game
      game = await gameRepo.save({
        name: "Test Game",
        slug: "test-game",
        studio,
      });

      // Create second game for isolation test
      game2 = await gameRepo.save({
        name: "Test Game 2",
        slug: "test-game-2",
        studio,
      });

      // Create second studio for studio isolation test
      studio2 = await studioRepo.save({
        name: "Test Studio 2",
        email: "studio2@test.com",
        walletAddress: "0xstudio2",
      });

      // Add user2 as owner of studio2
      await studioMemberRepo.save({
        studio: studio2,
        user: user2,
        role: StudioRole.OWNER,
      });

      // Create game3 belonging to studio2
      game3 = await gameRepo.save({
        name: "Test Game 3",
        slug: "test-game-3",
        studio: studio2,
      });

      // JWT token helper
      const jwtSecretRaw = process.env.JWT_SECRET;
      if (!jwtSecretRaw || typeof jwtSecretRaw !== "string") {
        throw new Error("JWT_SECRET not set for e2e");
      }
      const jwtSecret = jwtSecretRaw;
      const signTestToken = (payload: unknown) => {
        if (typeof payload !== "object" || payload === null) {
          throw new Error(
            `Expected payload to be object, got: ${JSON.stringify(payload)}`,
          );
        }
        return jwtService.sign(payload, { secret: jwtSecret });
      };

      // Generate JWT tokens
      user1Token = signTestToken({
        id: user1.id,
        studioId: studio.id,
        role: "owner",
      });

      user2Token = signTestToken({
        id: user2.id,
        studioId: studio.id,
        role: "member",
      });
    } catch (err) {
      console.error("E2E beforeAll failed:", err);
      throw err;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe("Smoke Tests", () => {
    it("A) GET /platform/games/:gameId/wallet should return wallet with balance, totalDeposited, totalWithdrawn", async () => {
      const response = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token))
        .expect(200);

      const wallet = validateGameWalletShape(response.body);
      expect(wallet.balance).toBeDefined();
      expect(wallet.totalDeposited).toBeDefined();
      expect(wallet.totalWithdrawn).toBeDefined();
      expect(typeof wallet.balance).toBe("string");
      expect(typeof wallet.totalDeposited).toBe("string");
      expect(typeof wallet.totalWithdrawn).toBe("string");
    });

    it("B) GET /platform/games/:gameId/wallet/ledger should return array of ledger entries", async () => {
      const response = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token))
        .expect(200);

      const ledger = validateLedgerArrayShape(response.body);
      expect(Array.isArray(ledger)).toBe(true);
    });

    it("C) POST /platform/games/:gameId/wallet/deposit should record entry in ledger", async () => {
      // Deposit
      await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "10" })
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      // Get ledger
      const ledgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token))
        .expect(200);

      const ledger = validateLedgerArrayShape(ledgerRes.body);
      const depositEntry = ledger.find(
        (e) =>
          e.type === "deposit" && Math.abs(parseFloat(e.amount) - 10) < 1e-9,
      );
      if (!depositEntry) {
        console.error(
          "Deposit entry not found. Ledger:",
          JSON.stringify(ledgerRes.body, null, 2),
        );
      }
      expect(depositEntry).toBeDefined();
    });

    it("D) Game isolation: wallet and ledger must be scoped per game", async () => {
      // Get initial state for game1
      const game1InitRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token))
        .expect(200);
      const game1Init = validateGameWalletShape(game1InitRes.body);
      const startBalance1 = parseFloat(game1Init.balance);

      // Get initial state for game2
      const game2InitRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token))
        .expect(200);
      const game2Init = validateGameWalletShape(game2InitRes.body);
      const startBalance2 = parseFloat(game2Init.balance);

      // Get initial ledger length for game2
      const game2InitLedgerRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet/ledger`)
        .set(authHeader(user1Token))
        .expect(200);
      const game2InitLedger = validateLedgerArrayShape(game2InitLedgerRes.body);
      const startLedgerLen2 = game2InitLedger.length;

      // Deposit 10 to game1
      await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "10" })
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      // Get game1 wallet after deposit - should increase by ~10
      const game1AfterRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token))
        .expect(200);
      const game1After = validateGameWalletShape(game1AfterRes.body);
      const newBalance1 = parseFloat(game1After.balance);

      if (Math.abs(newBalance1 - (startBalance1 + 10)) >= 1e-6) {
        console.error(
          `Game1 balance assertion failed: startBalance=${startBalance1}, expected=${startBalance1 + 10}, actual=${newBalance1}`,
        );
      }
      expect(Math.abs(newBalance1 - (startBalance1 + 10)) < 1e-6).toBe(true);

      // Get game1 ledger - should contain deposit entry for ~10
      const game1LedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token))
        .expect(200);

      const game1Ledger = validateLedgerArrayShape(game1LedgerRes.body);
      const game1DepositEntry = game1Ledger.find(
        (e) =>
          e.type === "deposit" && Math.abs(parseFloat(e.amount) - 10) < 1e-9,
      );
      expect(game1DepositEntry).toBeDefined();

      // Get game2 wallet after game1 deposit - should be unchanged
      const game2AfterRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token))
        .expect(200);
      const game2After = validateGameWalletShape(game2AfterRes.body);
      const newBalance2 = parseFloat(game2After.balance);

      if (Math.abs(newBalance2 - startBalance2) >= 1e-6) {
        console.error(
          `Game2 balance changed unexpectedly: startBalance=${startBalance2}, actual=${newBalance2}`,
        );
      }
      expect(Math.abs(newBalance2 - startBalance2) < 1e-6).toBe(true);

      // Get game2 ledger - should be unchanged
      const game2LedgerRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet/ledger`)
        .set(authHeader(user1Token))
        .expect(200);

      const game2Ledger = validateLedgerArrayShape(game2LedgerRes.body);
      if (game2Ledger.length !== startLedgerLen2) {
        console.error(
          `Game2 ledger length changed: startLength=${startLedgerLen2}, actual=${game2Ledger.length}`,
        );
      }
      expect(game2Ledger.length).toBe(startLedgerLen2);
    });

    it("E) Studio isolation: cannot access other studio's game", async () => {
      // Try to GET wallet for game3 (studio2) with user1Token (studio1)
      const walletRes = await request(server)
        .get(`/platform/games/${game3.id}/wallet`)
        .set(authHeader(user1Token));

      if (walletRes.status !== 403) {
        console.error(
          `Expected 403 for cross-studio wallet access, got ${walletRes.status}. Body:`,
          walletRes.body,
        );
      }
      expect(walletRes.status).toBe(403);

      // Try to GET ledger for game3 (studio2) with user1Token (studio1)
      const ledgerRes = await request(server)
        .get(`/platform/games/${game3.id}/wallet/ledger`)
        .set(authHeader(user1Token));

      if (ledgerRes.status !== 403) {
        console.error(
          `Expected 403 for cross-studio ledger access, got ${ledgerRes.status}. Body:`,
          ledgerRes.body,
        );
      }
      expect(ledgerRes.status).toBe(403);

      // Try to POST deposit to game3 (studio2) with user1Token (studio1)
      const depositRes = await request(server)
        .post(`/platform/games/${game3.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "10" });

      if (depositRes.status !== 403) {
        console.error(
          `Expected 403 for cross-studio deposit, got ${depositRes.status}. Body:`,
          depositRes.body,
        );
      }
      expect(depositRes.status).toBe(403);
    });

    it("F) Deposit and ledger entry are atomic (same transaction)", async () => {
      // Record initial state
      const initialWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const initialLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const initialLedger = validateLedgerArrayShape(initialLedgerRes.body);
      const initialLedgerLen = initialLedger.length;

      // Do deposit
      const depositAmount = "25";
      const depositRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: depositAmount });

      expect(depositRes.status).toBe(201);
      const updatedWallet = validateGameWalletShape(depositRes.body);

      // Verify wallet balance updated
      const expectedBalance = initialBalance + parseFloat(depositAmount);
      if (
        Math.abs(parseFloat(updatedWallet.balance) - expectedBalance) >= 1e-9
      ) {
        console.error(
          `Wallet balance mismatch: expected ~${expectedBalance}, got ${updatedWallet.balance}`,
        );
      }
      expect(
        Math.abs(parseFloat(updatedWallet.balance) - expectedBalance),
      ).toBeLessThan(1e-9);

      // Verify ledger entry was created in same transaction
      const finalLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const finalLedger = validateLedgerArrayShape(finalLedgerRes.body);

      expect(finalLedger.length).toBe(initialLedgerLen + 1);

      // Verify the new ledger entry has correct type and amount
      // Look for a deposit entry with matching amount (should be our new one)
      const matchingEntry = finalLedger.find(
        (entry) =>
          entry.type === "deposit" &&
          Math.abs(parseFloat(entry.amount) - parseFloat(depositAmount)) < 1e-9,
      );
      if (!matchingEntry) {
        console.error(
          `Could not find deposit entry with amount ${depositAmount} in ledger. Ledger:`,
          finalLedger,
        );
      }
      expect(matchingEntry).toBeDefined();
      expect(matchingEntry?.type).toBe("deposit");
      expect(
        Math.abs(
          parseFloat(matchingEntry?.amount || "0") - parseFloat(depositAmount),
        ),
      ).toBeLessThan(1e-9);
    });

    it("G) Deposit with zero/negative amount should return 400 and not modify DB", async () => {
      // Record initial state
      const initialWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const initialLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const initialLedger = validateLedgerArrayShape(initialLedgerRes.body);
      const initialLedgerLen = initialLedger.length;

      // Try deposit with amount "0"
      const depositZeroRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "0" });

      expect(depositZeroRes.status).toBe(400);

      // Try deposit with negative amount
      const depositNegRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "-5" });

      expect(depositNegRes.status).toBe(400);

      // Verify DB unchanged
      const finalWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const finalWallet = validateGameWalletShape(finalWalletRes.body);

      if (Math.abs(parseFloat(finalWallet.balance) - initialBalance) >= 1e-9) {
        console.error(
          `Wallet balance changed after failed deposit: initial=${initialBalance}, final=${finalWallet.balance}`,
        );
      }
      expect(
        Math.abs(parseFloat(finalWallet.balance) - initialBalance),
      ).toBeLessThan(1e-9);

      const finalLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const finalLedger = validateLedgerArrayShape(finalLedgerRes.body);

      expect(finalLedger.length).toBe(initialLedgerLen);
    });

    it("G2) Deposit with non-numeric amount should return 400", async () => {
      const response = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "abc" });

      expect(response.status).toBe(400);
    });

    it("G3) Deposit intent + confirm credits wallet and ledger atomically", async () => {
      const initialWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const initialLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const initialLedger = validateLedgerArrayShape(initialLedgerRes.body);
      const initialLedgerLen = initialLedger.length;

      const amount = "12.5";
      const intentRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-intent`)
        .set(authHeader(user1Token))
        .send({ amount });
      expect(intentRes.status).toBe(201);
      const intentBody = intentRes.body as {
        intentId: string;
        depositAddress: string;
        amount: string;
        expiresAt: string;
      };
      expect(typeof intentBody.intentId).toBe("string");
      expect(intentBody.depositAddress).toMatch(/^0x[a-f0-9]{40}$/);
      expect(intentBody.amount).toBe(amount);
      expect(typeof intentBody.expiresAt).toBe("string");

      const intentId = intentBody.intentId;
      const txHash = "0xabcdef1234567890";
      const confirmRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-confirm`)
        .set(authHeader(user1Token))
        .send({ intentId, txHash });
      expect(confirmRes.status).toBe(201);

      const finalWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const finalWallet = validateGameWalletShape(finalWalletRes.body);
      expect(
        Math.abs(parseFloat(finalWallet.balance) - (initialBalance + 12.5)),
      ).toBeLessThan(1e-9);

      const finalLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const finalLedger = validateLedgerArrayShape(finalLedgerRes.body);
      expect(finalLedger.length).toBe(initialLedgerLen + 1);

      const matchingIntentEntries = finalLedger.filter(
        (entry) => entry.intentId === intentId,
      );
      expect(matchingIntentEntries).toHaveLength(1);
      expect(matchingIntentEntries[0].type).toBe("deposit");
      expect(
        Math.abs(parseFloat(matchingIntentEntries[0].amount) - 12.5),
      ).toBeLessThan(1e-9);
      expect(matchingIntentEntries[0].txHash).toBe(txHash);
      expect(matchingIntentEntries[0].txGroupId).toBeTruthy();

      const intent = await depositIntentRepo.findOne({
        where: { id: intentId },
      });
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe("CONFIRMED");
      expect(intent?.txHash).toBe(txHash);
    });

    it("G4) Confirm with invalid txHash returns 400 and does not modify DB", async () => {
      const amount = "9";
      const intentRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-intent`)
        .set(authHeader(user1Token))
        .send({ amount });
      expect(intentRes.status).toBe(201);
      const intentBody = intentRes.body as { intentId: string };
      const intentId = intentBody.intentId;

      const initialWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const initialLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const initialLedger = validateLedgerArrayShape(initialLedgerRes.body);
      const initialLedgerLen = initialLedger.length;

      const confirmRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-confirm`)
        .set(authHeader(user1Token))
        .send({ intentId, txHash: "bad-hash" });
      expect(confirmRes.status).toBe(400);

      const finalWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const finalWallet = validateGameWalletShape(finalWalletRes.body);
      expect(
        Math.abs(parseFloat(finalWallet.balance) - initialBalance),
      ).toBeLessThan(1e-9);

      const finalLedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const finalLedger = validateLedgerArrayShape(finalLedgerRes.body);
      expect(finalLedger.length).toBe(initialLedgerLen);

      const intent = await depositIntentRepo.findOne({
        where: { id: intentId },
      });
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe("PENDING");
      expect(intent?.txHash).toBeNull();
    });

    it("G5) Confirm on expired intent returns 400", async () => {
      const intentRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-intent`)
        .set(authHeader(user1Token))
        .send({ amount: "3" });
      expect(intentRes.status).toBe(201);
      const intentBody = intentRes.body as { intentId: string };
      const intentId = intentBody.intentId;

      const intent = await depositIntentRepo.findOne({
        where: { id: intentId },
      });
      if (!intent) {
        throw new Error("Expected deposit intent to exist");
      }
      intent.expiresAt = new Date(Date.now() - 60_000);
      await depositIntentRepo.save(intent);

      const confirmRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-confirm`)
        .set(authHeader(user1Token))
        .send({ intentId, txHash: "0x1234567890abcdef" });
      expect(confirmRes.status).toBe(400);

      const expiredIntent = await depositIntentRepo.findOne({
        where: { id: intentId },
      });
      expect(expiredIntent?.status).toBe("EXPIRED");
    });

    it("G6) Duplicate txHash across different intents is rejected", async () => {
      const txHash = "0xfeedfacecafebeef";

      const initialWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const intentARes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-intent`)
        .set(authHeader(user1Token))
        .send({ amount: "4" });
      expect(intentARes.status).toBe(201);
      const intentA = intentARes.body as { intentId: string };

      const confirmARes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-confirm`)
        .set(authHeader(user1Token))
        .send({ intentId: intentA.intentId, txHash });
      expect(confirmARes.status).toBe(201);

      const afterFirstConfirmWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const afterFirstConfirmWallet = validateGameWalletShape(
        afterFirstConfirmWalletRes.body,
      );
      expect(
        Math.abs(
          parseFloat(afterFirstConfirmWallet.balance) - (initialBalance + 4),
        ),
      ).toBeLessThan(1e-9);

      const intentBRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-intent`)
        .set(authHeader(user1Token))
        .send({ amount: "6" });
      expect(intentBRes.status).toBe(201);
      const intentB = intentBRes.body as { intentId: string };

      const confirmBRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/deposit-confirm`)
        .set(authHeader(user1Token))
        .send({ intentId: intentB.intentId, txHash });
      expect(confirmBRes.status).toBe(400);

      const finalWalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const finalWallet = validateGameWalletShape(finalWalletRes.body);
      expect(
        Math.abs(
          parseFloat(finalWallet.balance) -
            parseFloat(afterFirstConfirmWallet.balance),
        ),
      ).toBeLessThan(1e-9);

      const intentBAfter = await depositIntentRepo.findOne({
        where: { id: intentB.intentId },
      });
      expect(intentBAfter?.status).toBe("PENDING");
      expect(intentBAfter?.txHash).toBeNull();
    });

    it("H) Withdraw with zero/negative amount should return 400 and not modify DB", async () => {
      // First do a deposit to have non-zero balance
      const depositSetupRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "50" });
      expect(depositSetupRes.status).toBe(201);

      // Record initial state
      const initialWalletRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const initialLedgerRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const initialLedger = validateLedgerArrayShape(initialLedgerRes.body);
      const initialLedgerLen = initialLedger.length;

      // Try withdraw with amount "0"
      const withdrawZeroRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/withdraw`)
        .set(authHeader(user1Token))
        .send({ amount: "0" });

      expect(withdrawZeroRes.status).toBe(400);

      // Try withdraw with negative amount
      const withdrawNegRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/withdraw`)
        .set(authHeader(user1Token))
        .send({ amount: "-10" });

      expect(withdrawNegRes.status).toBe(400);

      // Verify DB unchanged
      const finalWalletRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token));
      const finalWallet = validateGameWalletShape(finalWalletRes.body);

      if (Math.abs(parseFloat(finalWallet.balance) - initialBalance) >= 1e-9) {
        console.error(
          `Wallet balance changed after failed withdraw: initial=${initialBalance}, final=${finalWallet.balance}`,
        );
      }
      expect(
        Math.abs(parseFloat(finalWallet.balance) - initialBalance),
      ).toBeLessThan(1e-9);

      const finalLedgerRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const finalLedger = validateLedgerArrayShape(finalLedgerRes.body);

      expect(finalLedger.length).toBe(initialLedgerLen);
    });

    it("I) Transfer is atomic and scoped", async () => {
      // Record initial balances
      const initialUser1WalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialUser1Wallet = validateGameWalletShape(
        initialUser1WalletRes.body,
      );
      const initialUser1Balance = parseFloat(initialUser1Wallet.balance);

      const initialUser2WalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user2Token));
      const initialUser2Wallet = validateGameWalletShape(
        initialUser2WalletRes.body,
      );
      const initialUser2Balance = parseFloat(initialUser2Wallet.balance);

      // Transfer 20 from user1 -> user2 in game1
      const transferRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/transfer`)
        .set(authHeader(user1Token))
        .send({ toUserId: user2.id, amount: "20" });
      expect(transferRes.status).toBe(201);

      // Verify user1 wallet balance decreased by 20
      const user1WalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const user1Wallet = validateGameWalletShape(user1WalletRes.body);
      const expectedUser1Balance = initialUser1Balance - 20;
      if (
        Math.abs(parseFloat(user1Wallet.balance) - expectedUser1Balance) >= 1e-9
      ) {
        console.error(
          `User1 balance mismatch: expected ~${expectedUser1Balance}, got ${user1Wallet.balance}`,
        );
      }
      expect(
        Math.abs(parseFloat(user1Wallet.balance) - expectedUser1Balance),
      ).toBeLessThan(1e-9);

      // Verify user2 wallet balance increased by 20
      const user2WalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user2Token));
      const user2Wallet = validateGameWalletShape(user2WalletRes.body);
      const expectedUser2Balance = initialUser2Balance + 20;
      if (
        Math.abs(parseFloat(user2Wallet.balance) - expectedUser2Balance) >= 1e-9
      ) {
        console.error(
          `User2 balance mismatch: expected ~${expectedUser2Balance}, got ${user2Wallet.balance}`,
        );
      }
      expect(
        Math.abs(parseFloat(user2Wallet.balance) - expectedUser2Balance),
      ).toBeLessThan(1e-9);

      // Verify user1 ledger contains transfer entry
      const user1LedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const user1Ledger = validateLedgerArrayShape(user1LedgerRes.body);
      const user1TransferEntry = user1Ledger.find(
        (e) =>
          e.type === "transfer" && Math.abs(parseFloat(e.amount) - 20) < 1e-9,
      );
      expect(user1TransferEntry).toBeDefined();
      expect(user1TransferEntry?.counterpartyUserId).toBe(user2.id);

      // Verify user2 ledger contains transfer entry
      const user2LedgerRes = await request(server)
        .get(`/platform/games/${game.id}/wallet/ledger`)
        .set(authHeader(user2Token));
      const user2Ledger = validateLedgerArrayShape(user2LedgerRes.body);
      const user2TransferEntry = user2Ledger.find(
        (e) =>
          e.type === "transfer" && Math.abs(parseFloat(e.amount) - 20) < 1e-9,
      );
      expect(user2TransferEntry).toBeDefined();
      expect(user2TransferEntry?.counterpartyUserId).toBe(user1.id);

      // Verify both entries share the same txGroupId (linking them together)
      expect(user1TransferEntry?.txGroupId).toBe(user2TransferEntry?.txGroupId);
      expect(user1TransferEntry?.txGroupId).toBeTruthy();
    });

    it("J) Transfer validation", async () => {
      // Setup: Deposit 100 to user1 in game2
      const depositRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/deposit`)
        .set(authHeader(user1Token))
        .send({ amount: "100" });
      expect(depositRes.status).toBe(201);

      // Record initial state
      const initialWalletRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token));
      const initialWallet = validateGameWalletShape(initialWalletRes.body);
      const initialBalance = parseFloat(initialWallet.balance);

      const initialLedgerRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const initialLedger = validateLedgerArrayShape(initialLedgerRes.body);
      const initialLedgerLen = initialLedger.length;

      // Transfer amount "0" => 400
      const transferZeroRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/transfer`)
        .set(authHeader(user1Token))
        .send({ toUserId: user2.id, amount: "0" });
      expect(transferZeroRes.status).toBe(400);

      // Transfer negative => 400
      const transferNegRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/transfer`)
        .set(authHeader(user1Token))
        .send({ toUserId: user2.id, amount: "-10" });
      expect(transferNegRes.status).toBe(400);

      // Transfer to self => 400
      const transferSelfRes = await request(server)
        .post(`/platform/games/${game2.id}/wallet/transfer`)
        .set(authHeader(user1Token))
        .send({ toUserId: user1.id, amount: "10" });
      expect(transferSelfRes.status).toBe(400);

      // Verify DB unchanged
      const finalWalletRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token));
      const finalWallet = validateGameWalletShape(finalWalletRes.body);
      expect(
        Math.abs(parseFloat(finalWallet.balance) - initialBalance),
      ).toBeLessThan(1e-9);

      const finalLedgerRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet/ledger`)
        .set(authHeader(user1Token));
      const finalLedger = validateLedgerArrayShape(finalLedgerRes.body);
      expect(finalLedger.length).toBe(initialLedgerLen);
    });

    it("K) Game isolation for transfer", async () => {
      // Record initial game1 and game2 state
      const initialGame1WalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const initialGame1Wallet = validateGameWalletShape(
        initialGame1WalletRes.body,
      );
      const initialGame1Balance = parseFloat(initialGame1Wallet.balance);

      const initialGame2WalletRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token));
      const initialGame2Wallet = validateGameWalletShape(
        initialGame2WalletRes.body,
      );
      const initialGame2Balance = parseFloat(initialGame2Wallet.balance);

      // Ensure enough balance for transfer in game1
      if (initialGame1Balance < 5) {
        const depositRes = await request(server)
          .post(`/platform/games/${game.id}/wallet/deposit`)
          .set(authHeader(user1Token))
          .send({ amount: "50" });
        expect(depositRes.status).toBe(201);
      }

      // Transfer small amount in game1
      const transferAmount = "5";
      const transferRes = await request(server)
        .post(`/platform/games/${game.id}/wallet/transfer`)
        .set(authHeader(user1Token))
        .send({ toUserId: user2.id, amount: transferAmount });
      expect(transferRes.status).toBe(201);

      // Verify game1 transfer worked: balance decreased
      const afterTransferGame1WalletRes = await request(server)
        .get(`/platform/games/${game.id}/wallet`)
        .set(authHeader(user1Token));
      const afterTransferGame1Wallet = validateGameWalletShape(
        afterTransferGame1WalletRes.body,
      );
      const afterTransferGame1Balance = parseFloat(
        afterTransferGame1Wallet.balance,
      );

      // Game1 balance should have decreased
      if (afterTransferGame1Balance >= initialGame1Balance) {
        console.error(
          `Game1 balance did not decrease after transfer: initial=${initialGame1Balance}, after=${afterTransferGame1Balance}`,
        );
      }
      expect(afterTransferGame1Balance).toBeLessThan(
        initialGame1Balance + 1e-9,
      );

      // Verify game2 unaffected: balance unchanged
      const finalGame2WalletRes = await request(server)
        .get(`/platform/games/${game2.id}/wallet`)
        .set(authHeader(user1Token));
      const finalGame2Wallet = validateGameWalletShape(
        finalGame2WalletRes.body,
      );
      const finalGame2Balance = parseFloat(finalGame2Wallet.balance);

      expect(Math.abs(finalGame2Balance - initialGame2Balance)).toBeLessThan(
        1e-9,
      );
    });
  });
});
