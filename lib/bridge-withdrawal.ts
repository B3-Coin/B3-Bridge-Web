import {
  concatHex,
  encodeFunctionData,
  encodePacked,
  getAddress,
  isAddressEqual,
  keccak256,
  type Address,
  type Hex,
} from 'viem';

import {
  B3_ASSET_ID,
  BRIDGE_ACTIVATION_HEIGHT,
  ETHEREUM_CHAIN_ID,
  USDT_ADDRESS,
  VAULT_ADDRESS,
  vaultAbi,
} from './bridge-config.ts';

type FixedArray<
  Value,
  Length extends number,
  Result extends Value[] = [],
> = Result['length'] extends Length
  ? Result
  : FixedArray<Value, Length, [Value, ...Result]>;

export type WithdrawalPath = Readonly<FixedArray<Hex, 32>>;

export type WithdrawalCall = {
  withdrawalId: bigint;
  recipient: Address;
  amount: bigint;
  b3Height: bigint;
};

export type WithdrawalProof = {
  withdrawal: WithdrawalCall;
  path: WithdrawalPath;
  leaf: Hex;
  root: Hex;
  calldata: Hex;
  sourceTxid: Hex;
  burnOutputIndex: bigint;
  finalizedHeight: bigint;
};

export type WithdrawalRoute = {
  chainId: bigint;
  assetId: Hex;
  originToken: Address;
};

const UINT32_MAX = (1n << 32n) - 1n;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
const ZERO_ADDRESS = getAddress('0x0000000000000000000000000000000000000000');

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      'Paste the JSON object returned by getbridgewithdrawalproof.',
    );
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, label: string, maximum: bigint): bigint {
  let parsed: bigint;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} is not an exact safe integer.`);
    }
    parsed = BigInt(value);
  } else if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) {
    parsed = BigInt(value);
  } else {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  if (parsed < 0n || parsed > maximum) {
    throw new Error(`${label} is outside its allowed range.`);
  }
  return parsed;
}

function hex(value: unknown, label: string, bytes?: number): Hex {
  if (typeof value !== 'string') throw new Error(`${label} must be hex.`);
  const normalized = value.startsWith('0x') ? value : `0x${value}`;
  const expected = bytes === undefined ? '+' : `{${bytes * 2}}`;
  if (!new RegExp(`^0x[0-9a-fA-F]${expected}$`).test(normalized)) {
    throw new Error(
      bytes === undefined
        ? `${label} must be non-empty hexadecimal data.`
        : `${label} must be exactly ${bytes} bytes.`,
    );
  }
  return normalized.toLowerCase() as Hex;
}

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string')
    throw new Error(`${label} must be an address.`);
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${label} is not a valid Ethereum address.`);
  }
}

function sameHex(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

export function computeWithdrawalLeaf(
  withdrawal: WithdrawalCall,
  route: WithdrawalRoute = {
    chainId: BigInt(ETHEREUM_CHAIN_ID),
    assetId: B3_ASSET_ID,
    originToken: USDT_ADDRESS,
  },
): Hex {
  return keccak256(
    encodePacked(
      [
        'uint64',
        'uint64',
        'bytes32',
        'address',
        'address',
        'uint256',
        'uint64',
      ],
      [
        withdrawal.withdrawalId,
        route.chainId,
        route.assetId,
        route.originToken,
        withdrawal.recipient,
        withdrawal.amount,
        withdrawal.b3Height,
      ],
    ),
  );
}

export function computeWithdrawalRoot(
  withdrawalId: bigint,
  leaf: Hex,
  path: readonly Hex[],
): Hex {
  if (path.length !== 32) {
    throw new Error('Withdrawal path must contain exactly 32 sibling hashes.');
  }
  let node = leaf;
  for (let level = 0; level < 32; level += 1) {
    const sibling = path[level];
    if (!sibling) throw new Error('Withdrawal path is incomplete.');
    node =
      ((withdrawalId >> BigInt(level)) & 1n) === 0n
        ? keccak256(concatHex([node, sibling]))
        : keccak256(concatHex([sibling, node]));
  }
  return node;
}

export function encodeReleaseCalldata(
  withdrawal: WithdrawalCall,
  path: WithdrawalPath,
): Hex {
  return encodeFunctionData({
    abi: vaultAbi,
    functionName: 'release',
    args: [withdrawal, path],
  });
}

export function parseWithdrawalProof(text: string): WithdrawalProof {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error('The withdrawal proof is not valid JSON.');
  }
  const value = record(decoded);

  const withdrawalId = integer(
    value.withdrawal_id,
    'withdrawal_id',
    UINT32_MAX,
  );
  const burnOutputIndex = integer(
    value.burn_output_index,
    'burn_output_index',
    UINT32_MAX,
  );
  const b3Height = integer(value.b3_height, 'b3_height', UINT64_MAX);
  const amount = integer(value.amount_raw, 'amount_raw', UINT256_MAX);
  const finalizedHeight = integer(
    value.finalized_height,
    'finalized_height',
    UINT64_MAX,
  );
  if (b3Height < BRIDGE_ACTIVATION_HEIGHT) {
    throw new Error('The withdrawal predates bridge activation.');
  }
  if (finalizedHeight < b3Height) {
    throw new Error(
      'The selected certificate does not finalize this withdrawal.',
    );
  }
  if (amount === 0n) throw new Error('The withdrawal amount is zero.');

  const recipient = address(value.recipient, 'recipient');
  if (isAddressEqual(recipient, ZERO_ADDRESS)) {
    throw new Error('The withdrawal recipient is the zero address.');
  }
  const vault = address(value.vault, 'vault');
  if (!isAddressEqual(vault, VAULT_ADDRESS)) {
    throw new Error('The proof names a different Ethereum vault.');
  }
  const token = address(value.origin_token, 'origin_token');
  if (!isAddressEqual(token, USDT_ADDRESS)) {
    throw new Error('The proof names a different Ethereum token.');
  }

  const chainId = integer(
    value.ethereum_chain_id,
    'ethereum_chain_id',
    UINT64_MAX,
  );
  if (chainId !== BigInt(ETHEREUM_CHAIN_ID)) {
    throw new Error('The proof is not for Ethereum Mainnet.');
  }
  if (!sameHex(hex(value.asset_id_evm, 'asset_id_evm', 32), B3_ASSET_ID)) {
    throw new Error('The proof names a different B3 bridge asset.');
  }

  if (!Array.isArray(value.path) || value.path.length !== 32) {
    throw new Error(
      'The withdrawal proof must contain exactly 32 path entries.',
    );
  }
  const path = value.path.map((item, index) =>
    hex(item, `path[${index}]`, 32),
  ) as unknown as WithdrawalPath;
  const sourceTxid = hex(value.source_txid, 'source_txid', 32);
  const suppliedLeaf = hex(value.withdrawal_leaf, 'withdrawal_leaf', 32);
  const suppliedRoot = hex(value.withdrawal_root, 'withdrawal_root', 32);
  const suppliedCalldata = hex(value.calldata, 'calldata');

  if (
    value.private_key_required_by_rpc !== undefined &&
    value.private_key_required_by_rpc !== false
  ) {
    throw new Error(
      'The proof incorrectly claims that B3 needs an Ethereum key.',
    );
  }

  const withdrawal: WithdrawalCall = {
    withdrawalId,
    recipient,
    amount,
    b3Height,
  };
  const leaf = computeWithdrawalLeaf(withdrawal);
  if (!sameHex(leaf, suppliedLeaf)) {
    throw new Error('The withdrawal leaf does not match its fields.');
  }
  const root = computeWithdrawalRoot(withdrawalId, leaf, path);
  if (!sameHex(root, suppliedRoot)) {
    throw new Error('The 32-step path does not reproduce the withdrawal root.');
  }
  const calldata = encodeReleaseCalldata(withdrawal, path);
  if (!sameHex(calldata, suppliedCalldata)) {
    throw new Error('The supplied Ethereum calldata does not match the proof.');
  }

  return {
    withdrawal,
    path,
    leaf,
    root,
    calldata,
    sourceTxid,
    burnOutputIndex,
    finalizedHeight,
  };
}
