import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeB3Recipient } from '../lib/b3-recipient.ts';

void test('encodes a known B3 mainnet P2PKH address as RECIPIENT_V1', () => {
  assert.equal(
    encodeB3Recipient('SNyANHiUkuqPSfbeKHDXzVD86LC2ZUUjLX'),
    '0x00000000000000000000000112602418ffc74640e37f1a73d0cdc255d2a07c35',
  );
});

void test('rejects an address with a changed checksum', () => {
  assert.throws(
    () => encodeB3Recipient('SNyANHiUkuqPSfbeKHDXzVD86LC2ZUUjLY'),
    /checksum/i,
  );
});

void test('rejects another network even when Base58Check is valid', () => {
  assert.throws(
    () => encodeB3Recipient('1BoatSLRHtKNngkdXEeobR76b53LETtpyT'),
    /B3 mainnet/i,
  );
});

void test('rejects non-Base58 input', () => {
  assert.throws(() => encodeB3Recipient('not-a-b3-address'), /Base58/i);
});
