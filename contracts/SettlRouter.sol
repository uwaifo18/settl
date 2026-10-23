// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SettlRouter {
    using SafeERC20 for IERC20;

    event Paid(
        bytes32 indexed invoiceId,
        address indexed merchant,
        address indexed payer,
        uint256 amount
    );

    error ZeroAmount();
    error InvalidMerchant();
    error Expired();
    error AlreadyPaid();

    IERC20 public immutable USDC;  // 0x3600000000000000000000000000000000000000

    // key = keccak256(abi.encode(merchant, invoiceId))
    mapping(bytes32 => bool) public paid;

    constructor(address usdc) {
        USDC = IERC20(usdc);
    }

    function pay(
        bytes32 invoiceId,
        address merchant,
        uint256 amount,
        uint256 deadline
    ) external {
        if (amount == 0) revert ZeroAmount();
        if (merchant == address(0) || merchant == address(this)) revert InvalidMerchant();
        if (block.timestamp > deadline) revert Expired();

        bytes32 key = keccak256(abi.encode(merchant, invoiceId));
        if (paid[key]) revert AlreadyPaid();

        // checks-effects-interactions: set paid BEFORE transfer
        paid[key] = true;
        USDC.safeTransferFrom(msg.sender, merchant, amount);
        emit Paid(invoiceId, merchant, msg.sender, amount);
    }

    function isPaid(address merchant, bytes32 invoiceId) external view returns (bool) {
        return paid[keccak256(abi.encode(merchant, invoiceId))];
    }
}
