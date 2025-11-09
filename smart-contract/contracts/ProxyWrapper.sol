// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import ERC1967Proxy from the local lib (project includes OpenZeppelin sources under lib/)
import "../lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ProxyWrapper is ERC1967Proxy {
    constructor(address _logic, bytes memory _data) ERC1967Proxy(_logic, _data) {}
}
