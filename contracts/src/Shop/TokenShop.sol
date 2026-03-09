// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ITRI.sol";
import "../interfaces/ITaxProcessor.sol";

contract TokenShop is Ownable {
    using SafeERC20 for IERC20;

    ITRI public immutable token;
    uint256 public maxEthIn;
    uint256 public maxGenIn;
    bool public paused;
    ITaxProcessor public taxProcessor;

    mapping(address => bool) public supportedTokens;
    mapping(address => uint8) public assetDecimals;
    mapping(address => uint256) public buyRate;
    mapping(address => uint256) public sellRate;

    uint256 public feeBps;
    uint256 public constant BPS = 10_000;

    event Bought(address indexed user, address indexed payAsset, uint256 amountIn, uint256 genOut);
    event Sold(address indexed user, address indexed payAsset, uint256 genIn, uint256 amountOut);
    event RatesUpdated(address indexed asset, uint256 buyRate, uint256 sellRate);
    event FeeUpdated(uint256 feeBps);
    event EthWithdrawn(address indexed to, uint256 amount);
    event PausedSet(bool paused);
    event SupportedTokenSet(address indexed asset, bool isSupported);
    event AssetDecimalsSet(address indexed asset, uint8 decimals);
    event LimitsUpdated(uint256 maxEthIn, uint256 maxGenIn);
    event TaxProcessorSet(address indexed taxProcessor);

    constructor(
        ITRI token_,
        uint256 maxEthIn_,
        uint256 maxGenIn_,
        uint256 initialBuyRateEth,
        uint256 initialSellRateEth
    ) Ownable(msg.sender) {
        require(address(token_) != address(0), "token=0");
        require(initialBuyRateEth > 0, "buyRate=0");
        require(initialSellRateEth > 0, "sellRate=0");

        token = token_;
        maxEthIn = maxEthIn_;
        maxGenIn = maxGenIn_;

        supportedTokens[address(0)] = true;
        assetDecimals[address(0)] = 18;
        buyRate[address(0)] = initialBuyRateEth;
        sellRate[address(0)] = initialSellRateEth;

        emit RatesUpdated(address(0), initialBuyRateEth, initialSellRateEth);
        emit FeeUpdated(0);
        emit LimitsUpdated(maxEthIn_, maxGenIn_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function setSupportedToken(address asset, bool isSupported) external onlyOwner {
        supportedTokens[asset] = isSupported;
        emit SupportedTokenSet(asset, isSupported);
    }

    function setAssetDecimals(address asset, uint8 decimals_) external onlyOwner {
        require(asset != address(0), "eth fixed");
        require(decimals_ <= 18, "dec>18");
        assetDecimals[asset] = decimals_;
        emit AssetDecimalsSet(asset, decimals_);
    }

    function setRates(address asset, uint256 newBuyRate, uint256 newSellRate) external onlyOwner {
        require(newBuyRate > 0, "buyRate=0");
        require(newSellRate > 0, "sellRate=0");

        buyRate[asset] = newBuyRate;
        sellRate[asset] = newSellRate;

        emit RatesUpdated(asset, newBuyRate, newSellRate);
    }

    function setMaxEthIn(uint256 newMaxEthIn) external onlyOwner {
        maxEthIn = newMaxEthIn;
        emit LimitsUpdated(maxEthIn, maxGenIn);
    }

    function setMaxGenIn(uint256 newMaxGenIn) external onlyOwner {
        maxGenIn = newMaxGenIn;
        emit LimitsUpdated(maxEthIn, maxGenIn);
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1_000, "fee too high");
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function withdrawETH(address to, uint256 amountWei) external onlyOwner {
        require(to != address(0), "to=0");
        require(address(this).balance >= amountWei, "insufficient");

        (bool ok, ) = payable(to).call{value: amountWei}("");
        require(ok, "withdraw failed");

        emit EthWithdrawn(to, amountWei);
    }

    function setTaxProcessor(address taxProcessor_) external onlyOwner {
        taxProcessor = ITaxProcessor(taxProcessor_);
        emit TaxProcessorSet(taxProcessor_);
    }

    function _logTax(address user, string memory metadata) internal {
        if (address(taxProcessor) == address(0)) return;
        taxProcessor.logTaxEvent(user, 0, metadata);
    }

    function _applyFee(uint256 amount) internal view returns (uint256) {
        return (amount * (BPS - feeBps)) / BPS;
    }

    function _to18(address asset, uint256 amount) internal view returns (uint256) {
        if (asset == address(0)) return amount;
        uint8 d = assetDecimals[asset];
        require(d != 0, "decimals not set");
        if (d == 18) return amount;
        return amount * (10 ** (18 - d));
    }

    function _from18(address asset, uint256 amount18) internal view returns (uint256) {
        if (asset == address(0)) return amount18;
        uint8 d = assetDecimals[asset];
        require(d != 0, "decimals not set");
        if (d == 18) return amount18;
        return amount18 / (10 ** (18 - d));
    }

    function getQuoteBuyETH(uint256 ethInWei) public view returns (uint256 genOut) {
        uint256 r = buyRate[address(0)];
        genOut = (ethInWei * r) / 1e18;
    }

    function getQuoteSellToETH(uint256 genIn) public view returns (uint256 ethOutWei) {
        uint256 r = sellRate[address(0)];
        ethOutWei = (genIn * 1e18) / r;
    }

    function getQuoteBuyToken(address asset, uint256 amountIn) public view returns (uint256 genOut) {
        uint256 r = buyRate[asset];
        uint256 amount18 = _to18(asset, amountIn);
        genOut = (amount18 * r) / 1e18;
    }

    function getQuoteSellToToken(address asset, uint256 genIn) public view returns (uint256 amountOut) {
        uint256 r = sellRate[asset];
        uint256 grossOut18 = (genIn * 1e18) / r;
        amountOut = _from18(asset, grossOut18);
    }

    function buyETH(uint256 minGenOut) external payable {
        require(!paused, "paused");
        require(supportedTokens[address(0)], "eth not supported");
        require(msg.value > 0, "no payment");
        require(msg.value <= maxEthIn, "over maxEthIn");

        uint256 grossGenOut = getQuoteBuyETH(msg.value);
        require(grossGenOut > 0, "too little");

        uint256 netGenOut = _applyFee(grossGenOut);
        require(netGenOut >= minGenOut, "slippage");

        token.mint(msg.sender, netGenOut);

        emit Bought(msg.sender, address(0), msg.value, netGenOut);
        _logTax(msg.sender, string.concat("BUY: ", _uint2str(msg.value), " wei ETH -> ", _uint2str(netGenOut), " TRI"));
    }

    function buyToken(address asset, uint256 amountIn, uint256 minGenOut) external {
        require(asset != address(0), "use buyETH");
        require(!paused, "paused");
        require(supportedTokens[asset], "asset not supported");
        require(amountIn > 0, "amountIn=0");

        uint256 grossGenOut = getQuoteBuyToken(asset, amountIn);
        require(grossGenOut > 0, "too little");

        uint256 netGenOut = _applyFee(grossGenOut);
        require(netGenOut >= minGenOut, "slippage");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amountIn);
        token.mint(msg.sender, netGenOut);

        emit Bought(msg.sender, asset, amountIn, netGenOut);
        _logTax(msg.sender, string.concat("BUY: ", _uint2str(amountIn), " token -> ", _uint2str(netGenOut), " TRI"));
    }

    function sellToETH(uint256 genIn, uint256 minEthOut) external {
        require(!paused, "paused");
        require(supportedTokens[address(0)], "eth not supported");
        require(genIn > 0, "zero genIn");
        require(genIn <= maxGenIn, "over maxGenIn");

        uint256 grossEthOut = getQuoteSellToETH(genIn);
        require(grossEthOut > 0, "too little");

        uint256 netEthOut = _applyFee(grossEthOut);
        require(netEthOut >= minEthOut, "slippage");
        require(address(this).balance >= netEthOut, "no liquidity");

        bool ok = token.transferFrom(msg.sender, address(this), genIn);
        require(ok, "transferFrom failed");

        token.burn(address(this), genIn);

        (bool success, ) = payable(msg.sender).call{value: netEthOut}("");
        require(success, "eth transfer failed");

        emit Sold(msg.sender, address(0), genIn, netEthOut);
        _logTax(msg.sender, string.concat("SELL: ", _uint2str(genIn), " TRI -> ", _uint2str(netEthOut), " wei ETH"));
    }

    function sellToToken(address asset, uint256 genIn, uint256 minTokenOut) external {
        require(asset != address(0), "use sellToETH");
        require(!paused, "paused");
        require(supportedTokens[asset], "asset not supported");
        require(genIn > 0, "zero genIn");
        require(genIn <= maxGenIn, "over maxGenIn");

        uint256 grossTokenOut = getQuoteSellToToken(asset, genIn);
        require(grossTokenOut > 0, "too little");

        uint256 grossOut18 = _to18(asset, grossTokenOut);
        uint256 netOut18 = _applyFee(grossOut18);
        uint256 netTokenOut = _from18(asset, netOut18);

        require(netTokenOut >= minTokenOut, "slippage");
        require(IERC20(asset).balanceOf(address(this)) >= netTokenOut, "no liquidity");

        bool ok = token.transferFrom(msg.sender, address(this), genIn);
        require(ok, "transferFrom failed");

        token.burn(address(this), genIn);
        IERC20(asset).safeTransfer(msg.sender, netTokenOut);

        emit Sold(msg.sender, asset, genIn, netTokenOut);
        _logTax(msg.sender, string.concat("SELL: ", _uint2str(genIn), " TRI -> ", _uint2str(netTokenOut), " token"));
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    receive() external payable {}
}
