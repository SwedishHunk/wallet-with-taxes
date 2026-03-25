// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title GenesisWallet - User-owned smart wallet for TRI & NFTs (Upgradeable)
/// @author MashaVaverova
/// @notice Upgradeable self-custodial wallet supporting ERC-20, ERC-721, and ERC-1155 assets. All actions restricted to the owner.
/// @dev Uses OpenZeppelin's UUPS pattern for upgradeability. Ownership must be initialized upon deployment via `initialize`.

/// @custom:future development.
/// EIP-1271 Signature Verification (Smart Wallet Signing)
/// Support Meta-Transactions / Gasless Relayers
/// Session Keys or Limited Access Roles (Allow temporary roles for in-game scripts, bots, or automation)
/// Maintain a record of asset changes for analytics or tax reporting (Right now, only the owner knows what assets were moved. Indexing relies entirely on external watchers)
/// Add a backup system for owner change if private key is lost
/// Upgrade Governance Hooks or Factory-Controlled Access



contract GenesisWallet is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice Minimum delay between proposing and executing an upgrade (2 days)
    uint256 public constant UPGRADE_DELAY = 2 days;

    /// @notice Pending upgrade implementation address (zero if none proposed)
    address public pendingImplementation;

    /// @notice Timestamp after which the pending upgrade may be executed
    uint256 public upgradeReadyAt;

    /// @notice Emitted when an ERC-1155 token is withdrawn to the wallet owner
    /// @param token Address of the ERC-1155 contract
    /// @param id ID of the token being claimed
    /// @param amount Quantity of the token transferred
    event ClaimedNFT(address indexed token, uint256 indexed id, uint256 amount);

    /// @notice Emitted when TRI is withdrawn to the wallet owner
    /// @param to The address that received the TRI
    /// @param amount Amount of TRI withdrawn
    event WithdrewTRI(address indexed to, uint256 amount);

    /// @notice Emitted when ETH is received by the wallet
    /// @param from Sender address
    /// @param amount Amount of ETH received
    event ReceivedETH(address indexed from, uint256 amount);

    /// @notice Emitted when an upgrade is proposed
    /// @param newImplementation The proposed new implementation address
    /// @param readyAt Timestamp after which the upgrade may be executed
    event UpgradeProposed(address indexed newImplementation, uint256 readyAt);

    /// @notice Emitted when a pending upgrade is cancelled
    /// @param cancelledImplementation The implementation address that was cancelled
    event UpgradeCancelled(address indexed cancelledImplementation);

    /// @notice Constructor (disabled in proxy; use `initialize` instead)
    constructor() initializer {}

    /// @notice Initializes the wallet with an owner
    /// @param owner_ The address that will control the wallet
    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    /// @notice Allows the wallet to receive ETH
    receive() external payable {
        emit ReceivedETH(msg.sender, msg.value);
    }

    /// @notice Claims an ERC-1155 token from the wallet to the owner
    /// @param token The ERC-1155 token contract address
    /// @param id The token ID to claim
    /// @param amount The quantity to claim
    function claimERC1155(address token, uint256 id, uint256 amount) external onlyOwner {
        IERC1155(token).safeTransferFrom(address(this), msg.sender, id, amount, "");
        emit ClaimedNFT(token, id, amount);
    }

    /// @notice Claims an ERC-721 token from the wallet to the owner
    /// @param token The ERC-721 token contract address
    /// @param id The token ID to claim
    function claimERC721(address token, uint256 id) external onlyOwner {
        IERC721(token).safeTransferFrom(address(this), msg.sender, id);
    }

    /// @notice Withdraws TRI tokens from the wallet to the owner
    /// @param token The TRI token contract address (ERC-20)
    /// @param amount The amount of TRI to withdraw
    function withdrawTRI(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
        emit WithdrewTRI(msg.sender, amount);
    }

    /// @notice Step 1 of 2 for upgrades: propose a new implementation with a 2-day timelock.
    /// @param newImplementation The address of the new implementation to propose
    /// @dev Must be called at least UPGRADE_DELAY seconds before upgradeToAndCall.
    function proposeUpgrade(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "GenesisWallet: zero address");
        pendingImplementation = newImplementation;
        upgradeReadyAt = block.timestamp + UPGRADE_DELAY;
        emit UpgradeProposed(newImplementation, upgradeReadyAt);
    }

    /// @notice Cancel a pending upgrade proposal.
    function cancelUpgrade() external onlyOwner {
        emit UpgradeCancelled(pendingImplementation);
        pendingImplementation = address(0);
        upgradeReadyAt = 0;
    }

    /// @notice Authorizes contract upgrade (UUPS requirement).
    /// @dev Enforces a 2-day timelock. Call proposeUpgrade() first, wait UPGRADE_DELAY, then upgradeToAndCall().
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(
            newImplementation == pendingImplementation,
            "GenesisWallet: must propose upgrade first"
        );
        require(
            block.timestamp >= upgradeReadyAt,
            "GenesisWallet: upgrade timelock not elapsed"
        );
        // Clear pending state
        pendingImplementation = address(0);
        upgradeReadyAt = 0;
    }

    /// @notice ERC-1155 single-token receive hook
    /// @dev Enables wallet to hold ERC-1155 tokens
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) public pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /// @notice ERC-1155 batch-token receive hook
    /// @dev Enables wallet to hold multiple ERC-1155 tokens in one call
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) public pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
