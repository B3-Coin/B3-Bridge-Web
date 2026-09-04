import { getAddress, parseAbi, type Hex } from 'viem';

export const ETHEREUM_CHAIN_ID = 1;
export const ETHEREUM_CHAIN_NAME = 'Ethereum Mainnet';

export const VAULT_ADDRESS = getAddress(
  '0x077839b12cebfbF163acAEAC3A59A015D100c64b',
);
export const VERIFIER_ADDRESS = getAddress(
  '0xE72B3Fe73F0d42A6e964D33E7BB1cc2EA7a3F690',
);
export const PROVER_ADDRESS = getAddress(
  '0x8e612aE4D475d25940E2A2FC907F21b6813eedA7',
);
export const USDT_ADDRESS = getAddress(
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
);

export const VAULT_CODE_HASH =
  '0xdb267712887568bffd394e46538bddba01da11cefc38e32b2428c00911237f8d' as Hex;
export const VERIFIER_CODE_HASH =
  '0xafdba8befb1aacc832bff4e08dcd92e6645a012ea8a8088b0f2811d916022902' as Hex;
export const PROVER_CODE_HASH =
  '0x77d2aea2d2a6842fae8b29e64a146622e2f45e772a6c351640ffe8362211a959' as Hex;
export const USDT_CODE_HASH =
  '0xb44fb4e949d0f78f87f79ee46428f23a2a5713ce6fc6e0beb3dda78c2ac1ea55' as Hex;

export const B3_CHAIN_DOMAIN =
  '0xa651262ae9031646047f290513d77ccae0fa9bd4e5afe7e07155a08d5dd1486a' as Hex;
export const B3_ASSET_ID =
  '0xc69c6bd581c3188fe80d97cf9946f34c79ec502ccf204cd597dc9366315d61ad' as Hex;
export const BRIDGE_ACTIVATION_HEIGHT = 811_001n;
export const MAX_DEPOSIT_RAW = 10_000_000_000n;
export const MAX_DEPOSIT_USDT = '10,000';
export const USDT_DECIMALS = 6;

// These release controls are deliberately separate from the contract's live
// predicate. Flip them only in a reviewed release after their evidence exists.
export const RELEASE_GATES = {
  productionApproved: false,
  externalAuditComplete: false,
  endToEndRehearsalComplete: false,
  explorerSourcesPublished: false,
} as const;

export const READ_RPC_URLS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
] as const;

export const vaultAbi = parseAbi([
  'function verifier() view returns (address)',
  'function VERIFIER_CODE_HASH() view returns (bytes32)',
  'function B3_CHAIN_DOMAIN() view returns (bytes32)',
  'function ORIGIN_CHAIN_ID() view returns (uint64)',
  'function B3_ASSET_ID() view returns (bytes32)',
  'function ORIGIN_TOKEN() view returns (address)',
  'function MAX_DEPOSIT_RAW() view returns (uint256)',
  'function BRIDGE_ACTIVATION_HEIGHT() view returns (uint64)',
  'function nextDepositId() view returns (uint64)',
  'function locked() view returns (uint256)',
  'function deposit(uint256 amount, bytes32 b3Recipient)',
  'event Deposit(uint64 indexed depositId, address indexed token, uint256 amount, bytes32 b3Recipient)',
]);

export const verifierAbi = parseAbi([
  'function initialized() view returns (bool)',
  'function prover() view returns (address)',
  'function PROVER_CODE_HASH() view returns (bytes32)',
  'function CHAIN_DOMAIN() view returns (bytes32)',
  'function BRIDGE_ACTIVATION_HEIGHT() view returns (uint64)',
  'function BOOTSTRAP_DEADLINE() view returns (uint256)',
  'function bridgeReady() view returns (bool)',
  'function depositViable() view returns (bool)',
  'function releaseReady() view returns (bool)',
  'function latestBridgeFinalizedHeight() view returns (uint64)',
]);

export const usdtAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export function etherscanAddressUrl(address: string) {
  return `https://etherscan.io/address/${address}`;
}

export function etherscanTransactionUrl(hash: string) {
  return `https://etherscan.io/tx/${hash}`;
}
