// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/Token/TRI.sol";
import "../src/Tax/TaxProcessor.sol";
import "../src/Shop/TokenShop.sol";
import "../src/interfaces/ITRI.sol";
import "../src/Wallet/GenesisWallet.sol";
import "../src/Wallet/GenesisWalletFactory.sol";

contract DeployTokenShopIntegration is Script {
    function run() external {
        uint256 maxEthIn = 0.05 ether;
        uint256 maxGenIn = 50e18;
        uint256 buyRateEth = 1000e18;
        uint256 sellRateEth = 1000e18;

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        TRI tri = new TRI();
        TaxProcessor taxProcessor = new TaxProcessor();
        TokenShop shop = new TokenShop(ITRI(address(tri)), maxEthIn, maxGenIn, buyRateEth, sellRateEth);

        tri.grantRole(tri.MINTER_ROLE(), address(shop));
        tri.grantRole(tri.BURNER_ROLE(), address(shop));
        taxProcessor.grantRole(taxProcessor.OPERATOR_ROLE(), address(shop));
        shop.setTaxProcessor(address(taxProcessor));

        // Deploy GenesisWallet implementation + factory.
        // The factory address must be set as FACTORY_ADDRESS in backend/.env.
        GenesisWallet walletImpl = new GenesisWallet();
        GenesisWalletFactory factory = new GenesisWalletFactory(address(walletImpl));

        vm.stopBroadcast();

        console2.log("Deployer:          ", deployer);
        console2.log("TRI token:         ", address(tri));
        console2.log("TaxProcessor:      ", address(taxProcessor));
        console2.log("TokenShop:         ", address(shop));
        console2.log("GenesisWallet impl:", address(walletImpl));
        console2.log("WalletFactory:     ", address(factory));
        console2.log("");
        console2.log("-- backend/.env --");
        console2.log("TOKENSHOP_ADDRESS=", address(shop));
        console2.log("FACTORY_ADDRESS=  ", address(factory));
    }
}
