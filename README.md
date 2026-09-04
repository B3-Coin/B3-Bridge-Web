# B3 Bridge Web

Non-custodial browser interface for moving canonical Ethereum USDT into B3 Hive as bUSD through the keyless B3 staker bridge.

## Current safety state

This release is intentionally fail-closed. It can connect an Ethereum wallet, validate a B3 recipient locally, and independently inspect the deployed contracts. It cannot submit a deposit until all four release flags in `lib/bridge-config.ts` are reviewed and enabled **and** the live verifier reports `depositViable() == true`.

At the verification snapshot recorded in `public/deployment.json`, the deployed runtime bytecode and immutable configuration matched the B3 v1.1.1 artifacts exactly. The verifier was not initialized, source publication was pending, and production approval was false.

## Local development

Requirements: Node.js 22.13 or newer and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Build and check:

```sh
pnpm lint
pnpm build
```

## Security properties

- No backend and no custody by this website.
- No seed phrase, B3 private key, BLS key, or wallet password is requested.
- Four deployed code hashes and the immutable vault route are checked against pinned values.
- B3 Base58Check and P2PKH network validation happens locally before signing.
- USDT approval is limited to the exact deposit amount; an old non-zero allowance is reset first when required.
- The complete readiness check runs again immediately before any transaction.
- The vault itself rejects deposits unless its on-chain verifier reports a viable release path.

## Hosting

The application is designed for static, content-addressed distribution. A reviewed release can be pinned by multiple IPFS operators and opened through a CID subdomain gateway or a local Kubo gateway. Never expose a B3 RPC port to serve this page.

## Contracts

The canonical public deployment record is in `public/deployment.json`. Always compare the vault address through more than one trusted channel before signing.

## License

MIT
