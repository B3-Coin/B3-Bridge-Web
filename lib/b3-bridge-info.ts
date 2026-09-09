import { getAddress, isAddressEqual } from 'viem';

import {
  B3_ASSET_ID,
  B3_BOOTSTRAP_SET_HASH,
  B3_WITHDRAWAL_RULES_COMMITMENT,
  BRIDGE_ACTIVATION_HEIGHT,
  ETHEREUM_CHAIN_ID,
  ORIGIN_DEPLOYMENT_BLOCK,
  USDT_ADDRESS,
  VAULT_ADDRESS,
  VAULT_CODE_HASH,
  VERIFIER_ADDRESS,
  VERIFIER_CODE_HASH,
} from './bridge-config.ts';

export type B3BridgeInfo = {
  nextHeight: bigint;
  withdrawalActive: true;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Paste the JSON object returned by getbridgeinfo.');
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, label: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) {
    return BigInt(value);
  }
  throw new Error(`${label} must be an exact non-negative integer.`);
}

function normalizedHex(value: unknown, label: string, bytes: number) {
  if (typeof value !== 'string') throw new Error(`${label} must be hex.`);
  const normalized = value.startsWith('0x') ? value : `0x${value}`;
  if (!new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(normalized)) {
    throw new Error(`${label} must be exactly ${bytes} bytes.`);
  }
  return normalized.toLowerCase();
}

function sameHex(value: unknown, expected: string, label: string) {
  if (
    normalizedHex(value, label, (expected.length - 2) / 2) !==
    expected.toLowerCase()
  ) {
    throw new Error(`${label} does not match this bridge release.`);
  }
}

function sameAddress(value: unknown, expected: string, label: string) {
  if (typeof value !== 'string')
    throw new Error(`${label} must be an address.`);
  try {
    const normalized = value.startsWith('0x') ? value : `0x${value}`;
    if (!isAddressEqual(getAddress(normalized), getAddress(expected))) {
      throw new Error(`${label} does not match this bridge release.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not match')) {
      throw error;
    }
    throw new Error(`${label} is not a valid Ethereum address.`);
  }
}

function exactInteger(value: unknown, expected: bigint, label: string) {
  if (integer(value, label) !== expected) {
    throw new Error(`${label} does not match this bridge release.`);
  }
}

export function parseB3BridgeInfo(text: string): B3BridgeInfo {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error('The B3 bridge status is not valid JSON.');
  }
  const value = record(decoded);

  if (value.configured !== true || value.ready !== true) {
    throw new Error(
      'This B3 wallet does not have the complete bridge configuration.',
    );
  }
  if (value.active !== true || value.withdrawal_active !== true) {
    throw new Error(
      'Bridge withdrawals are not active for this B3 wallet tip.',
    );
  }
  if (value.state_available !== true) {
    throw new Error('This B3 wallet has not synchronized its bridge state.');
  }
  if (value.withdrawal_mode !== 'decentralized-verifier-v1') {
    throw new Error('This B3 wallet is not using decentralized withdrawals.');
  }

  exactInteger(
    value.ethereum_chain_id,
    BigInt(ETHEREUM_CHAIN_ID),
    'ethereum_chain_id',
  );
  exactInteger(
    value.origin_deployment_block,
    ORIGIN_DEPLOYMENT_BLOCK,
    'origin_deployment_block',
  );
  exactInteger(
    value.activation_height,
    BRIDGE_ACTIVATION_HEIGHT,
    'activation_height',
  );
  exactInteger(
    value.withdrawal_activation_height,
    BRIDGE_ACTIVATION_HEIGHT,
    'withdrawal_activation_height',
  );
  exactInteger(value.origin_decimals, 6n, 'origin_decimals');
  exactInteger(value.asset_decimals, 6n, 'asset_decimals');
  exactInteger(value.adapter_version, 1n, 'adapter_version');
  exactInteger(
    value.recipient_encoding_version,
    1n,
    'recipient_encoding_version',
  );
  exactInteger(value.withdrawal_rules_version, 1n, 'withdrawal_rules_version');
  exactInteger(value.min_bridge_validators, 4n, 'min_bridge_validators');
  exactInteger(value.max_bridge_validators, 64n, 'max_bridge_validators');
  exactInteger(value.min_bridge_total_weight, 900n, 'min_bridge_total_weight');
  exactInteger(value.max_epoch_lag, 2_592_000n, 'max_epoch_lag');

  sameAddress(value.vault, VAULT_ADDRESS, 'vault');
  sameAddress(value.token, USDT_ADDRESS, 'token');
  sameAddress(
    value.decentralized_verifier,
    VERIFIER_ADDRESS,
    'decentralized_verifier',
  );
  sameHex(value.asset_id_evm, B3_ASSET_ID, 'asset_id_evm');
  sameHex(
    value.vault_runtime_code_hash,
    VAULT_CODE_HASH,
    'vault_runtime_code_hash',
  );
  sameHex(
    value.decentralized_verifier_code_hash,
    VERIFIER_CODE_HASH,
    'decentralized_verifier_code_hash',
  );
  sameHex(
    value.bootstrap_validator_set_hash,
    B3_BOOTSTRAP_SET_HASH,
    'bootstrap_validator_set_hash',
  );
  sameHex(
    value.withdrawal_rules_commitment,
    B3_WITHDRAWAL_RULES_COMMITMENT,
    'withdrawal_rules_commitment',
  );

  const nextHeight = integer(value.next_height, 'next_height');
  if (nextHeight < BRIDGE_ACTIVATION_HEIGHT) {
    throw new Error('This B3 wallet is still before bridge activation.');
  }
  return { nextHeight, withdrawalActive: true };
}
