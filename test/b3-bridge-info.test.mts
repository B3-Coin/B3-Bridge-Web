import assert from 'node:assert/strict';
import test from 'node:test';

import {
  B3_ASSET_ID,
  B3_BOOTSTRAP_SET_HASH,
  B3_WITHDRAWAL_RULES_COMMITMENT,
  USDT_ADDRESS,
  VAULT_ADDRESS,
  VAULT_CODE_HASH,
  VERIFIER_ADDRESS,
  VERIFIER_CODE_HASH,
} from '../lib/bridge-config.ts';
import { parseB3BridgeInfo } from '../lib/b3-bridge-info.ts';

function bridgeInfo() {
  return {
    status: 'active',
    configured: true,
    ready: true,
    active: true,
    withdrawal_active: true,
    state_available: true,
    next_height: 811_010,
    activation_height: 811_001,
    withdrawal_activation_height: 811_001,
    asset_id_evm: B3_ASSET_ID,
    ethereum_chain_id: 1,
    origin_deployment_block: 25_898_729,
    vault: VAULT_ADDRESS.slice(2),
    vault_runtime_code_hash: VAULT_CODE_HASH,
    token: USDT_ADDRESS.slice(2),
    adapter_version: 1,
    recipient_encoding_version: 1,
    origin_decimals: 6,
    asset_decimals: 6,
    withdrawal_mode: 'decentralized-verifier-v1',
    decentralized_verifier: VERIFIER_ADDRESS.slice(2),
    decentralized_verifier_code_hash: VERIFIER_CODE_HASH,
    bootstrap_validator_set_hash: B3_BOOTSTRAP_SET_HASH,
    withdrawal_rules_version: 1,
    withdrawal_rules_commitment: B3_WITHDRAWAL_RULES_COMMITMENT,
    min_bridge_validators: 4,
    max_bridge_validators: 64,
    min_bridge_total_weight: 900,
    max_epoch_lag: 2_592_000,
  };
}

void test('accepts the exact active B3 bridge tuple', () => {
  const parsed = parseB3BridgeInfo(JSON.stringify(bridgeInfo()));
  assert.equal(parsed.nextHeight, 811_010n);
});

void test('rejects an old managed withdrawal wallet', () => {
  const candidate = bridgeInfo();
  candidate.withdrawal_mode = 'managed-v1';
  assert.throws(
    () => parseB3BridgeInfo(JSON.stringify(candidate)),
    /not using decentralized withdrawals/,
  );
});

void test('rejects a wallet pinned to another vault', () => {
  const candidate = bridgeInfo();
  candidate.vault = '0x1111111111111111111111111111111111111111';
  assert.throws(
    () => parseB3BridgeInfo(JSON.stringify(candidate)),
    /vault does not match/,
  );
});

void test('rejects unsynchronized bridge state', () => {
  const candidate = bridgeInfo();
  candidate.state_available = false;
  assert.throws(
    () => parseB3BridgeInfo(JSON.stringify(candidate)),
    /has not synchronized/,
  );
});
