import assert from 'node:assert/strict';
import test from 'node:test';

import { getAddress, type Hex } from 'viem';

import {
  B3_ASSET_ID,
  ETHEREUM_CHAIN_ID,
  USDT_ADDRESS,
  VAULT_ADDRESS,
} from '../lib/bridge-config.ts';
import {
  computeWithdrawalLeaf,
  computeWithdrawalRoot,
  encodeReleaseCalldata,
  parseWithdrawalProof,
  type WithdrawalCall,
  type WithdrawalPath,
} from '../lib/bridge-withdrawal.ts';

const withdrawal: WithdrawalCall = {
  withdrawalId: 0n,
  recipient: getAddress('0x00112233445566778899aabbccddeeff00112233'),
  amount: 1_250_000n,
  b3Height: 811_010n,
};
const path = Array.from(
  { length: 32 },
  () => `0x${'00'.repeat(32)}` as Hex,
) as unknown as WithdrawalPath;

function proofObject() {
  const leaf = computeWithdrawalLeaf(withdrawal);
  const root = computeWithdrawalRoot(withdrawal.withdrawalId, leaf, path);
  return {
    withdrawal_id: Number(withdrawal.withdrawalId),
    source_txid: '11'.repeat(32),
    burn_output_index: 0,
    b3_height: Number(withdrawal.b3Height),
    asset_id_evm: B3_ASSET_ID,
    origin_token: USDT_ADDRESS,
    recipient: withdrawal.recipient,
    amount_raw: Number(withdrawal.amount),
    finalized_height: Number(withdrawal.b3Height),
    withdrawal_leaf: leaf,
    withdrawal_root: root,
    path,
    vault: VAULT_ADDRESS,
    ethereum_chain_id: ETHEREUM_CHAIN_ID,
    calldata: encodeReleaseCalldata(withdrawal, path),
    private_key_required_by_rpc: false,
  };
}

void test('accepts an exact B3 withdrawal proof and release calldata', () => {
  const parsed = parseWithdrawalProof(JSON.stringify(proofObject()));
  assert.deepEqual(parsed.withdrawal, withdrawal);
  assert.equal(parsed.path.length, 32);
  assert.equal(parsed.root, proofObject().withdrawal_root);
});

void test('matches the independent B3 and Solidity withdrawal leaf vector', () => {
  const leaf = computeWithdrawalLeaf(
    {
      withdrawalId: 0n,
      recipient: getAddress('0x404142434445464748494a4b4c4d4e4f50515253'),
      amount: 1_000_000n,
      b3Height: 815_000n,
    },
    {
      chainId: 1n,
      assetId:
        '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      originToken: getAddress('0x202122232425262728292a2b2c2d2e2f30313233'),
    },
  );
  assert.equal(
    leaf,
    '0xf96ee37321b191d9ba3e573fd7739ab8a163033824a1c534045bd168c3c88b44',
  );
});

void test('rejects a proof for another vault', () => {
  const candidate = proofObject();
  candidate.vault = '0x1111111111111111111111111111111111111111';
  assert.throws(
    () => parseWithdrawalProof(JSON.stringify(candidate)),
    /different Ethereum vault/,
  );
});

void test('rejects a path that does not reproduce the supplied root', () => {
  const candidate = proofObject();
  candidate.withdrawal_root = `0x${'22'.repeat(32)}`;
  assert.throws(
    () => parseWithdrawalProof(JSON.stringify(candidate)),
    /does not reproduce/,
  );
});

void test('rejects release calldata that differs from the proof', () => {
  const candidate = proofObject();
  candidate.calldata = `${candidate.calldata.slice(0, -2)}ff` as Hex;
  assert.throws(
    () => parseWithdrawalProof(JSON.stringify(candidate)),
    /calldata does not match/,
  );
});
