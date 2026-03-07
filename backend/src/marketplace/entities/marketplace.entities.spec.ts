import { Listing } from "./listing.entity";
import { Trade } from "./trade.entity";

describe("Marketplace entities", () => {
  it("supports Listing and Trade shape", () => {
    const listing = new Listing();
    listing.id = 1;
    listing.sellerId = 2;
    listing.tokenAddress = "0xabc";
    listing.tokenId = 3;
    listing.amount = 4;
    listing.pricePerUnit = 1.25;
    listing.status = "active";

    const trade = new Trade();
    trade.id = 1;
    trade.buyerId = 10;
    trade.sellerId = 2;
    trade.listingId = 1;
    trade.amount = 2;
    trade.totalPrice = 2.5;
    trade.feeUSD = 0.1;
    trade.status = "confirmed";

    expect(listing.status).toBe("active");
    expect(trade.status).toBe("confirmed");
  });
});
