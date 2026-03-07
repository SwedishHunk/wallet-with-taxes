import { GetListingsQueryDto } from "./get-listings-query.dto";
import { ListItemDto } from "./list-item.dto";
import { TradeDto } from "./trade.dto";

describe("Marketplace DTOs", () => {
  it("can be instantiated", () => {
    const q = new GetListingsQueryDto();
    q.status = "active";
    q.tokenId = 1;

    const list = new ListItemDto();
    list.tokenAddress = "0xabc";
    list.tokenId = 2;
    list.amount = 3;
    list.pricePerUnit = 1.5;

    const trade = new TradeDto();
    trade.listingId = 10;
    trade.amount = 1;

    expect(q.status).toBe("active");
    expect(list.tokenAddress).toBe("0xabc");
    expect(trade.listingId).toBe(10);
  });
});
