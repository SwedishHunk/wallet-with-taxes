import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Wallet } from "./wallet.entity";
import { ethers } from "ethers";

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async registerWallet(owner: string, address: string) {
    const wallet = this.walletRepo.create({ owner, address });
    return this.walletRepo.save(wallet);
  }

  async getWalletByOwner(owner: string) {
    return this.walletRepo.findOne({ where: { owner } });
  }
  async getBalance(address: string) {
    try {
      if (!process.env.RPC_URL) {
        return {
          address,
          balance: "0 ETH",
        };
      }

      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const balanceBigInt = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceBigInt);

      return {
        address,
        balance: `${balanceEth} ETH`,
      };
    } catch (err) {
      console.warn("Error fetching balance:", err);
      return {
        address,
        balance: "0 ETH (unavailable)",
      };
    }
  }
  getAssets(address: string) {
    // Mocked token holdings response
    return {
      address,
      assets: [
        { name: "TIX_HARDKODED!!!", symbol: "TIX", balance: 500 },
        { name: "USDC_HARDKODED!!!", symbol: "USDC", balance: 1250 },
      ],
    };
  }

  getAssetDetail(address: string, tokenId: string) {
    // For PoC: return mock data
    return {
      tokenId,
      owner: address,
      type: "ERC721",
      name: "Genesis NFT #" + tokenId,
      image: `https://example.com/images/${tokenId}.png`,
      description: "A unique Genesis NFT",
    };
  }
}
