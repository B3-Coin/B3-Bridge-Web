import { bytesToHex, hexToBytes, sha256, type Hex } from 'viem';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAINNET_P2PKH_VERSION = 63;

function decodeBase58(value: string): Uint8Array {
  if (!value) throw new Error('Enter a B3 address.');

  let integer = 0n;
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error('This is not a valid Base58 B3 address.');
    integer = integer * 58n + BigInt(digit);
  }

  let body: Uint8Array<ArrayBufferLike> = new Uint8Array();
  if (integer !== 0n) {
    let hex = integer.toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    body = hexToBytes(`0x${hex}`);
  }

  let leadingZeroes = 0;
  while (value[leadingZeroes] === '1') leadingZeroes += 1;

  const decoded = new Uint8Array(leadingZeroes + body.length);
  decoded.set(body, leadingZeroes);
  return decoded;
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

export function encodeB3Recipient(input: string): Hex {
  const address = input.trim();
  const decoded = decodeBase58(address);
  if (decoded.length !== 25)
    throw new Error('This B3 address has the wrong length.');

  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21);
  const expectedChecksum = hexToBytes(
    sha256(sha256(bytesToHex(payload))),
  ).slice(0, 4);

  if (!equalBytes(checksum, expectedChecksum))
    throw new Error('The B3 address checksum is invalid.');
  if (payload[0] !== MAINNET_P2PKH_VERSION)
    throw new Error('Use a B3 mainnet P2PKH address.');

  const keyHash = payload.slice(1);
  if (keyHash.every((byte) => byte === 0))
    throw new Error('The all-zero B3 recipient is not allowed.');

  // RECIPIENT_V1: 11 zero bytes || 0x01 || 20-byte P2PKH hash160.
  const recipient = new Uint8Array(32);
  recipient[11] = 1;
  recipient.set(keyHash, 12);
  return bytesToHex(recipient);
}
