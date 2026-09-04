# Ethereum contract verification

The live runtime code and immutable configuration were independently checked against the B3 v1.1.1 deployment artifacts at Ethereum block `25,901,902`. All four code hashes matched. This proves that the addresses contain the expected bytecode; it is separate from publishing the source to an explorer.

## Public source publication

Run these from the B3 Coin V2 repository's `contracts` directory. This publishes the exact source and compiler metadata but does not change contract state.

```sh
forge verify-contract 0x8e612aE4D475d25940E2A2FC907F21b6813eedA7 src/BlsCertificateProver.sol:BlsCertificateProver --chain mainnet --verifier sourcify --compiler-version 0.8.35 --num-of-optimizations 200 --via-ir --evm-version osaka --creation-transaction-hash 0xa5d05c63cd76d9a6e74a0b417ec26dbe683aa8a5f31709e064dd5ab8e29e4d8e --watch

forge verify-contract 0xE72B3Fe73F0d42A6e964D33E7BB1cc2EA7a3F690 src/B3FinalityVerifier.sol:B3FinalityVerifier --chain mainnet --verifier sourcify --compiler-version 0.8.35 --num-of-optimizations 200 --via-ir --evm-version osaka --creation-transaction-hash 0xbbf139e4858b815062243154743c104379faea786dccd028e4dbc2f36f9d7329 --watch

forge verify-contract 0x077839b12cebfbF163acAEAC3A59A015D100c64b src/B3StakerBridge.sol:B3StakerBridge --chain mainnet --verifier sourcify --compiler-version 0.8.35 --num-of-optimizations 200 --via-ir --evm-version osaka --creation-transaction-hash 0x78f704a341a71aadfd027c8c7567e757bf337b92f41cb453214665ef39dc6a73 --watch
```

Etherscan publication uses the same compiler settings plus an Etherscan API key and the exact ABI-encoded constructor arguments from the deployment broadcast. Never put an explorer API key in this repository.

## Current launch state

At the recorded snapshot, the verifier was uninitialized and returned `bridgeReady() == false`, `depositViable() == false`, and `releaseReady() == false`. Source publication alone does not make the bridge safe to open.
