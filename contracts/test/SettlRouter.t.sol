// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../SettlRouter.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SettlRouterTest is Test {
    event Paid(bytes32 indexed invoiceId, address indexed merchant, address indexed payer, uint256 amount);

    MockUSDC internal usdc;
    SettlRouter internal router;

    address internal customer;
    address internal merchant;
    address internal merchant2;

    uint256 internal constant STARTING_BALANCE = 1_000_000e6;

    function setUp() external {
        usdc = new MockUSDC();
        router = new SettlRouter(address(usdc));

        customer = makeAddr("customer");
        merchant = makeAddr("merchant");
        merchant2 = makeAddr("merchant2");

        usdc.mint(customer, STARTING_BALANCE);
    }

    function testPayHappyPathEmitsEventAndTransfersToMerchant() external {
        bytes32 invoiceId = keccak256("invoice-happy");
        uint256 amount = 25e6;
        uint256 deadline = block.timestamp + 1 hours;

        uint256 merchantBefore = usdc.balanceOf(merchant);

        vm.startPrank(customer);
        usdc.approve(address(router), amount);

        vm.expectEmit(true, true, true, true);
        emit Paid(invoiceId, merchant, customer, amount);

        router.pay(invoiceId, merchant, amount, deadline);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant) - merchantBefore, amount);
        assertTrue(router.isPaid(merchant, invoiceId));
    }

    function testPayRevertsWhenExpired() external {
        bytes32 invoiceId = keccak256("invoice-expired");
        uint256 amount = 1e6;
        uint256 deadline = block.timestamp;

        vm.startPrank(customer);
        usdc.approve(address(router), amount);
        vm.warp(deadline + 1);

        vm.expectRevert(SettlRouter.Expired.selector);
        router.pay(invoiceId, merchant, amount, deadline);
        vm.stopPrank();
    }

    function testPayRevertsOnDoublePay() external {
        bytes32 invoiceId = keccak256("invoice-double");
        uint256 amount = 5e6;
        uint256 deadline = block.timestamp + 1 days;

        vm.startPrank(customer);
        usdc.approve(address(router), amount * 2);

        router.pay(invoiceId, merchant, amount, deadline);

        vm.expectRevert(SettlRouter.AlreadyPaid.selector);
        router.pay(invoiceId, merchant, amount, deadline);
        vm.stopPrank();
    }

    function testPayRevertsOnZeroAmount() external {
        bytes32 invoiceId = keccak256("invoice-zero-amount");

        vm.prank(customer);
        vm.expectRevert(SettlRouter.ZeroAmount.selector);
        router.pay(invoiceId, merchant, 0, block.timestamp + 1 days);
    }

    function testPayRevertsOnZeroMerchant() external {
        bytes32 invoiceId = keccak256("invoice-zero-merchant");
        uint256 amount = 1e6;

        vm.startPrank(customer);
        usdc.approve(address(router), amount);

        vm.expectRevert(SettlRouter.InvalidMerchant.selector);
        router.pay(invoiceId, address(0), amount, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function testPayRevertsWhenMerchantIsRouter() external {
        bytes32 invoiceId = keccak256("invoice-router-merchant");
        uint256 amount = 1e6;

        vm.startPrank(customer);
        usdc.approve(address(router), amount);

        vm.expectRevert(SettlRouter.InvalidMerchant.selector);
        router.pay(invoiceId, address(router), amount, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function testPayRevertsOnInsufficientAllowance() external {
        bytes32 invoiceId = keccak256("invoice-low-allowance");
        uint256 amount = 10e6;

        vm.startPrank(customer);
        usdc.approve(address(router), amount - 1);

        vm.expectRevert();
        router.pay(invoiceId, merchant, amount, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function testPayRevertsOnInsufficientBalance() external {
        bytes32 invoiceId = keccak256("invoice-low-balance");
        uint256 amount = STARTING_BALANCE + 1;

        vm.startPrank(customer);
        usdc.approve(address(router), amount);

        vm.expectRevert();
        router.pay(invoiceId, merchant, amount, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function testSameInvoiceDifferentMerchantsAreIndependent() external {
        bytes32 invoiceId = keccak256("shared-invoice-id");
        uint256 amountA = 3e6;
        uint256 amountB = 7e6;
        uint256 deadline = block.timestamp + 1 days;

        vm.startPrank(customer);
        usdc.approve(address(router), amountA + amountB);

        router.pay(invoiceId, merchant, amountA, deadline);
        router.pay(invoiceId, merchant2, amountB, deadline);
        vm.stopPrank();

        assertTrue(router.isPaid(merchant, invoiceId));
        assertTrue(router.isPaid(merchant2, invoiceId));
        assertEq(usdc.balanceOf(merchant), amountA);
        assertEq(usdc.balanceOf(merchant2), amountB);
    }

    function testRouterUSDCBalanceAlwaysZeroAfterSuccessfulPays() external {
        bytes32 invoiceIdA = keccak256("invoice-a");
        bytes32 invoiceIdB = keccak256("invoice-b");
        uint256 deadline = block.timestamp + 1 days;

        vm.startPrank(customer);
        usdc.approve(address(router), 100e6);

        router.pay(invoiceIdA, merchant, 40e6, deadline);
        assertEq(usdc.balanceOf(address(router)), 0);

        router.pay(invoiceIdB, merchant2, 60e6, deadline);
        assertEq(usdc.balanceOf(address(router)), 0);
        vm.stopPrank();
    }

    function testFuzzPayAmount(uint96 rawAmount) external {
        uint256 amount = bound(uint256(rawAmount), 1, STARTING_BALANCE);
        bytes32 invoiceId = keccak256(abi.encode("fuzz", amount));
        uint256 deadline = block.timestamp + 1 days;

        uint256 merchantBefore = usdc.balanceOf(merchant);

        vm.startPrank(customer);
        usdc.approve(address(router), amount);
        router.pay(invoiceId, merchant, amount, deadline);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant) - merchantBefore, amount);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertTrue(router.isPaid(merchant, invoiceId));
    }

    function testOverpaymentWorksFine() external {
        bytes32 invoiceId = keccak256("invoice-overpayment");
        uint256 expectedInvoiceAmount = 5e6;
        uint256 amountPaid = 12e6;

        assertGt(amountPaid, expectedInvoiceAmount);

        vm.startPrank(customer);
        usdc.approve(address(router), amountPaid);
        router.pay(invoiceId, merchant, amountPaid, block.timestamp + 1 days);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), amountPaid);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertTrue(router.isPaid(merchant, invoiceId));
    }
}
