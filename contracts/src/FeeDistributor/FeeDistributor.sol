// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ISAFU.sol";

/// @title FeeDistributor - Splits TRI fees to dev, Triolith, and stakers/validators
/// @author MashaVaverova
/// @notice This contract distributes incoming TRI tokens to predefined receivers based on basis point shares.
/// @dev SAFU receives a small cut (5%) from Triolith's portion. Only ADMIN_ROLE can update shares or recipients.

/// @custom:future development.
/// Emit SAFU Transfer Separately
/// Add Pause Mechanism for SAFU here?
/// Configure SAFU BPS as a Variable. currently hardcoded to 5%
/// Support Native ETH Distributions.
/// Snapshot Support / Historical View of Distributions (Admin Only), here or in SAFU? or both? doublecheck where it would be better to use
/// Role Separation?
/// Fee Split Preview Function

contract FeeDistributor is AccessControl {
    /// @notice Role identifier for admin privileges
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /// @notice Role that is allowed to trigger fee distribution (e.g. Marketplace)
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice TRI token used for fee distribution
    IERC20 public immutable tri;

    /// @notice SAFU contract that receives a cut from Triolith's share and handles deposit
    ISAFU public safu;

    /// @notice Address receiving the developer share
    address public devReceiver;

    /// @notice Address receiving the Triolith protocol share
    address public triolithReceiver;

    /// @notice Address receiving the staking rewards share
    address public stakingReceiver;

    /// @notice Denominator used for basis point calculations (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Basis points (BPS) allocated to developers (e.g., 6000 = 60%)
    uint256 public devBps = 6000;

    /// @notice Basis points (BPS) allocated to Triolith (e.g., 3000 = 30%)
    uint256 public triolithBps = 3000;

    /// @notice Basis points (BPS) allocated to staking/validators (e.g., 1000 = 10%)
    uint256 public stakingBps = 1000;

    /// @notice Emitted when fees are distributed
    /// @param amount Total TRI distributed
    /// @param toDev Amount sent to devReceiver
    /// @param toTriolith Amount sent to triolithReceiver (after SAFU cut)
    /// @param toStakers Amount sent to stakingReceiver
    event FeeDistributed(uint256 amount, uint256 toDev, uint256 toTriolith, uint256 toStakers);

    /// @notice Emitted when recipient addresses are updated
    /// @param dev New developer address
    /// @param triolith New Triolith address
    /// @param stakers New staking address
    event RecipientsUpdated(address dev, address triolith, address stakers);

    /// @notice Emitted when share splits are updated
    /// @param devBps New developer BPS
    /// @param triolithBps New Triolith BPS
    /// @param stakingBps New staking BPS
    event SharesUpdated(uint256 devBps, uint256 triolithBps, uint256 stakingBps);

    /// @notice Deploys the FeeDistributor contract
    /// @param _tri The TRI token address
    /// @param _dev Initial developer receiver address
    /// @param _triolith Initial Triolith receiver address
    /// @param _staking Initial staking rewards address
    /// @param _safu The SAFU contract address
    constructor(address _tri, address _dev, address _triolith, address _staking, address _safu) {
        tri = IERC20(_tri);
        devReceiver = _dev;
        triolithReceiver = _triolith;
        stakingReceiver = _staking;
        safu = ISAFU(_safu);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice Distributes TRI tokens held by the contract to receivers based on BPS
    /// @param amount The amount of TRI tokens to distribute
    function distribute(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) {
        require(tri.balanceOf(address(this)) >= amount, "Insufficient TRI sent");

        uint256 toDev = (amount * devBps) / BPS_DENOMINATOR;
        uint256 toTriolithFull = (amount * triolithBps) / BPS_DENOMINATOR;
        uint256 safuCut = (toTriolithFull * 500) / BPS_DENOMINATOR; // 5% of Triolith's portion
        uint256 toTriolith = toTriolithFull - safuCut;
        uint256 toStakers = amount - toDev - toTriolith - safuCut;

        tri.transfer(devReceiver, toDev);
        tri.transfer(triolithReceiver, toTriolith);
        tri.transfer(address(safu), safuCut);
        safu.deposit(safuCut);
        tri.transfer(stakingReceiver, toStakers);

        emit FeeDistributed(amount, toDev, toTriolith, toStakers);
    }

    /// @notice Updates the recipient addresses for fee distribution
    /// @dev Only callable by ADMIN_ROLE
    /// @param _dev New developer address
    /// @param _triolith New Triolith address
    /// @param _staking New staking rewards address
    function updateRecipients(address _dev, address _triolith, address _staking) external onlyRole(ADMIN_ROLE) {
        devReceiver = _dev;
        triolithReceiver = _triolith;
        stakingReceiver = _staking;
        emit RecipientsUpdated(_dev, _triolith, _staking);
    }

    /// @notice Updates the share percentages (in basis points)
    /// @dev Only callable by ADMIN_ROLE
    /// @param _devBps New BPS for developer share
    /// @param _triolithBps New BPS for Triolith share
    /// @param _stakingBps New BPS for staking share
    function updateShares(uint256 _devBps, uint256 _triolithBps, uint256 _stakingBps) external onlyRole(ADMIN_ROLE) {
        require(_devBps + _triolithBps + _stakingBps == BPS_DENOMINATOR, "Invalid BPS split");
        devBps = _devBps;
        triolithBps = _triolithBps;
        stakingBps = _stakingBps;
        emit SharesUpdated(_devBps, _triolithBps, _stakingBps);
    }
}
