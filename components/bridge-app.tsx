'use client';

/* oxlint-disable react/react-compiler -- Temporary workaround for an oxlint compiler-rule invariant on this stateful client boundary. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
  keccak256,
  parseEventLogs,
  parseUnits,
  type Address,
  type EIP1193Provider,
  type Hex,
} from 'viem';
import { mainnet } from 'viem/chains';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { encodeB3Recipient } from '@/lib/b3-recipient';
import {
  B3_ASSET_ID,
  B3_CHAIN_DOMAIN,
  BRIDGE_ACTIVATION_HEIGHT,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
  MAX_DEPOSIT_RAW,
  MAX_DEPOSIT_USDT,
  PROVER_ADDRESS,
  PROVER_CODE_HASH,
  READ_RPC_URLS,
  RELEASE_GATES,
  USDT_ADDRESS,
  USDT_CODE_HASH,
  USDT_DECIMALS,
  VAULT_ADDRESS,
  VAULT_CODE_HASH,
  VERIFIER_ADDRESS,
  VERIFIER_CODE_HASH,
  etherscanAddressUrl,
  etherscanTransactionUrl,
  usdtAbi,
  vaultAbi,
  verifierAbi,
} from '@/lib/bridge-config';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

type CheckState = 'checking' | 'pass' | 'wait' | 'fail';

type DeploymentState = {
  phase: 'checking' | 'loaded' | 'error';
  identityMatches: boolean;
  initialized: boolean;
  bridgeReady: boolean;
  depositViable: boolean;
  releaseReady: boolean;
  latestBridgeHeight: bigint;
  nextDepositId: bigint;
  checkedBlock?: bigint;
  checkedAt?: number;
  message?: string;
};

type ActionState = {
  phase:
    | 'idle'
    | 'resetting'
    | 'approving'
    | 'depositing'
    | 'confirming'
    | 'success'
    | 'error';
  message?: string;
  hash?: Hex;
  depositId?: bigint;
};

const initialDeployment: DeploymentState = {
  phase: 'checking',
  identityMatches: false,
  initialized: false,
  bridgeReady: false,
  depositViable: false,
  releaseReady: false,
  latestBridgeHeight: 0n,
  nextDepositId: 0n,
};

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    READ_RPC_URLS.map((url) => http(url, { retryCount: 1, timeout: 10_000 })),
  ),
});

function sameHex(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

async function inspectDeployment(): Promise<DeploymentState> {
  const [
    checkedBlock,
    vaultCode,
    verifierCode,
    proverCode,
    usdtCode,
    vaultVerifier,
    pinnedVerifierHash,
    vaultDomain,
    originChainId,
    assetId,
    originToken,
    maxDeposit,
    vaultActivation,
    verifierProver,
    pinnedProverHash,
    verifierDomain,
    verifierActivation,
    initialized,
    bridgeReady,
    depositViable,
    releaseReady,
    latestBridgeHeight,
    nextDepositId,
  ] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getCode({ address: VAULT_ADDRESS }),
    publicClient.getCode({ address: VERIFIER_ADDRESS }),
    publicClient.getCode({ address: PROVER_ADDRESS }),
    publicClient.getCode({ address: USDT_ADDRESS }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'verifier',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'VERIFIER_CODE_HASH',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'B3_CHAIN_DOMAIN',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'ORIGIN_CHAIN_ID',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'B3_ASSET_ID',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'ORIGIN_TOKEN',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'MAX_DEPOSIT_RAW',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'BRIDGE_ACTIVATION_HEIGHT',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'prover',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'PROVER_CODE_HASH',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'CHAIN_DOMAIN',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'BRIDGE_ACTIVATION_HEIGHT',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'initialized',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'bridgeReady',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'depositViable',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'releaseReady',
    }),
    publicClient.readContract({
      address: VERIFIER_ADDRESS,
      abi: verifierAbi,
      functionName: 'latestBridgeFinalizedHeight',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'nextDepositId',
    }),
  ]);

  const deployedCodeMatches =
    vaultCode !== undefined &&
    verifierCode !== undefined &&
    proverCode !== undefined &&
    usdtCode !== undefined &&
    sameHex(keccak256(vaultCode), VAULT_CODE_HASH) &&
    sameHex(keccak256(verifierCode), VERIFIER_CODE_HASH) &&
    sameHex(keccak256(proverCode), PROVER_CODE_HASH) &&
    sameHex(keccak256(usdtCode), USDT_CODE_HASH);

  const configurationMatches =
    isAddressEqual(getAddress(vaultVerifier), VERIFIER_ADDRESS) &&
    sameHex(pinnedVerifierHash, VERIFIER_CODE_HASH) &&
    sameHex(vaultDomain, B3_CHAIN_DOMAIN) &&
    originChainId === BigInt(ETHEREUM_CHAIN_ID) &&
    sameHex(assetId, B3_ASSET_ID) &&
    isAddressEqual(getAddress(originToken), USDT_ADDRESS) &&
    maxDeposit === MAX_DEPOSIT_RAW &&
    vaultActivation === BRIDGE_ACTIVATION_HEIGHT &&
    isAddressEqual(getAddress(verifierProver), PROVER_ADDRESS) &&
    sameHex(pinnedProverHash, PROVER_CODE_HASH) &&
    sameHex(verifierDomain, B3_CHAIN_DOMAIN) &&
    verifierActivation === BRIDGE_ACTIVATION_HEIGHT;

  return {
    phase: 'loaded',
    identityMatches: deployedCodeMatches && configurationMatches,
    initialized,
    bridgeReady,
    depositViable,
    releaseReady,
    latestBridgeHeight,
    nextDepositId,
    checkedBlock,
    checkedAt: Date.now(),
  };
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function friendlyError(error: unknown) {
  if (!(error instanceof Error)) return 'The request failed. Nothing was sent.';
  const text = error.message;
  if (/rejected|denied|cancelled/i.test(text))
    return 'You cancelled the wallet request. Nothing was sent.';
  if (/insufficient funds/i.test(text))
    return 'Your Ethereum wallet does not have enough ETH for gas.';
  if (/DepositClosed/i.test(text))
    return 'The vault is not accepting deposits. Nothing was moved.';
  if (/BadB3Recipient/i.test(text))
    return 'The vault rejected that B3 recipient. Nothing was moved.';
  return text.split('\n')[0] || 'The request failed. Nothing was sent.';
}

function isTopLevelWindow() {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

async function waitForSuccessfulReceipt(hash: Hex, label: string) {
  let replacementReason: 'cancelled' | 'replaced' | 'repriced' | undefined;
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    onReplaced: ({ reason }) => {
      replacementReason = reason;
    },
  });

  if (replacementReason && replacementReason !== 'repriced') {
    throw new Error(
      `${label} was ${replacementReason} in the wallet. Its intended action was not accepted.`,
    );
  }
  if (receipt.status !== 'success') {
    throw new Error(`${label} reverted on Ethereum. Its intended action failed.`);
  }
  return receipt;
}

function StatusIcon({ state }: { state: CheckState }) {
  if (state === 'checking')
    return (
      <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
    );
  if (state === 'pass') return <Check className="size-4 text-success" />;
  if (state === 'fail') return <X className="size-4 text-destructive" />;
  return <span className="text-[11px] font-medium text-warning">Waiting</span>;
}

function StatusRow({
  label,
  detail,
  state,
}: {
  label: string;
  detail?: string;
  state: CheckState;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-secondary-foreground">{label}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
      <StatusIcon state={state} />
    </div>
  );
}

export function BridgeApp() {
  const [deployment, setDeployment] =
    useState<DeploymentState>(initialDeployment);
  const [account, setAccount] = useState<Address>();
  const [walletChainId, setWalletChainId] = useState<number>();
  const [balance, setBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [amount, setAmount] = useState('');
  const [b3Address, setB3Address] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);
  const [action, setAction] = useState<ActionState>({ phase: 'idle' });
  const [topLevel, setTopLevel] = useState(false);
  const activeAccount = useRef<Address | undefined>(undefined);

  const refreshDeployment = useCallback(async () => {
    setDeployment((current) => ({
      ...current,
      phase: 'checking',
      message: undefined,
    }));
    try {
      setDeployment(await inspectDeployment());
    } catch (error) {
      setDeployment((current) => ({
        ...current,
        phase: 'error',
        message: `Could not independently read Ethereum: ${friendlyError(error)}`,
      }));
    }
  }, []);

  const refreshWallet = useCallback(async (owner: Address) => {
    const [tokenBalance, tokenAllowance] = await Promise.all([
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: usdtAbi,
        functionName: 'balanceOf',
        args: [owner],
      }),
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: usdtAbi,
        functionName: 'allowance',
        args: [owner, VAULT_ADDRESS],
      }),
    ]);
    if (activeAccount.current === owner) {
      setBalance(tokenBalance);
      setAllowance(tokenAllowance);
    }
  }, []);

  useEffect(() => {
    void refreshDeployment();
    const timer = window.setInterval(() => void refreshDeployment(), 45_000);
    return () => window.clearInterval(timer);
  }, [refreshDeployment]);

  useEffect(() => {
    setTopLevel(isTopLevelWindow());
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;

    const handleAccountsChanged = (accounts: Address[]) => {
      const selected = accounts[0] ? getAddress(accounts[0]) : undefined;
      activeAccount.current = selected;
      setAccount(selected);
      setBalance(0n);
      setAllowance(0n);
      setAction({ phase: 'idle' });
      if (selected) {
        void refreshWallet(selected).catch((error) => {
          if (activeAccount.current === selected) {
            setAction({ phase: 'error', message: friendlyError(error) });
          }
        });
      }
    };
    const handleChainChanged = (chainId: string) => {
      setWalletChainId(Number.parseInt(chainId, 16));
      setAction({ phase: 'idle' });
    };
    const handleDisconnect = () => {
      activeAccount.current = undefined;
      setAccount(undefined);
      setWalletChainId(undefined);
      setBalance(0n);
      setAllowance(0n);
      setAction({ phase: 'idle' });
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    provider.on('disconnect', handleDisconnect);
    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
      provider.removeListener('disconnect', handleDisconnect);
    };
  }, [refreshWallet]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setAction({
        phase: 'error',
        message:
          'No Ethereum wallet was found. Install MetaMask or another EIP-1193 wallet.',
      });
      return;
    }
    setWalletBusy(true);
    setAction({ phase: 'idle' });
    try {
      const wallet = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum),
      });
      const [selected] = await wallet.requestAddresses();
      if (!selected) throw new Error('No Ethereum account was selected.');
      const normalizedAccount = getAddress(selected);
      const chainId = await wallet.getChainId();
      activeAccount.current = normalizedAccount;
      setAccount(normalizedAccount);
      setWalletChainId(chainId);
      await refreshWallet(normalizedAccount);
    } catch (error) {
      setAction({ phase: 'error', message: friendlyError(error) });
    } finally {
      setWalletBusy(false);
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    setWalletBusy(true);
    try {
      const wallet = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum),
      });
      await wallet.switchChain({ id: ETHEREUM_CHAIN_ID });
      setWalletChainId(ETHEREUM_CHAIN_ID);
      if (account) await refreshWallet(account);
    } catch (error) {
      setAction({ phase: 'error', message: friendlyError(error) });
    } finally {
      setWalletBusy(false);
    }
  };

  const form = useMemo(() => {
    let amountRaw: bigint | undefined;
    let amountError: string | undefined;
    if (amount.trim()) {
      try {
        amountRaw = parseUnits(amount.trim(), USDT_DECIMALS);
        if (amountRaw <= 0n) amountError = 'Enter an amount greater than zero.';
        if (amountRaw > MAX_DEPOSIT_RAW)
          amountError = `One deposit cannot exceed ${MAX_DEPOSIT_USDT} USDT.`;
      } catch {
        amountError = 'Use no more than six decimal places.';
      }
    }

    let recipient: Hex | undefined;
    let addressError: string | undefined;
    if (b3Address.trim()) {
      try {
        recipient = encodeB3Recipient(b3Address);
      } catch (error) {
        addressError = friendlyError(error);
      }
    }

    return { amountRaw, amountError, recipient, addressError };
  }, [amount, b3Address]);

  const releaseApproved =
    RELEASE_GATES.productionApproved &&
    RELEASE_GATES.externalAuditComplete &&
    RELEASE_GATES.endToEndRehearsalComplete &&
    RELEASE_GATES.explorerSourcesPublished;
  const liveReady =
    deployment.phase === 'loaded' &&
    deployment.identityMatches &&
    deployment.depositViable;
  const correctNetwork = walletChainId === ETHEREUM_CHAIN_ID;
  const canDeposit = Boolean(
    topLevel &&
    account &&
    correctNetwork &&
    liveReady &&
    releaseApproved &&
    form.amountRaw &&
    form.recipient &&
    !form.amountError &&
    !form.addressError,
  );
  const actionBusy = [
    'resetting',
    'approving',
    'depositing',
    'confirming',
  ].includes(action.phase);
  const closedReason = !topLevel
    ? 'This page is embedded inside another page. Open it directly in its own tab before connecting a wallet.'
    : !deployment.initialized
      ? 'The deployed code matches, but the verifier has not been initialized.'
      : !deployment.depositViable
        ? 'The verifier is initialized, but a fresh qualified validator release path is not live.'
        : 'The live contracts are ready, but source publication, independent audit, rehearsal, and final approval are still required.';

  const submitDeposit = async () => {
    if (!window.ethereum || !account || !form.amountRaw || !form.recipient)
      return;
    let submittedDepositHash: Hex | undefined;
    setAction({
      phase: 'confirming',
      message: 'Rechecking every safety gate…',
    });

    try {
      const fresh = await inspectDeployment();
      setDeployment(fresh);
      if (!fresh.identityMatches || !fresh.depositViable || !releaseApproved) {
        throw new Error(
          'Deposits are not approved and live yet. Nothing was sent.',
        );
      }

      const wallet = createWalletClient({
        account,
        chain: mainnet,
        transport: custom(window.ethereum),
      });

      const assertTransactionReady = async () => {
        if (!isTopLevelWindow()) {
          throw new Error(
            'This bridge is embedded inside another page. Open it directly before signing.',
          );
        }
        const [freshState, walletAccounts, chainId] = await Promise.all([
          inspectDeployment(),
          wallet.getAddresses(),
          wallet.getChainId(),
        ]);
        setDeployment(freshState);
        const selected = walletAccounts[0];
        if (!selected || !isAddressEqual(selected, account)) {
          throw new Error(
            'The selected wallet account changed. Review the form and try again.',
          );
        }
        if (chainId !== ETHEREUM_CHAIN_ID) {
          throw new Error('Switch your wallet to Ethereum Mainnet and try again.');
        }
        if (
          !freshState.identityMatches ||
          !freshState.depositViable ||
          !releaseApproved
        ) {
          throw new Error(
            'Deposits are not approved and live yet. Nothing was sent.',
          );
        }
      };

      const currentAllowance = await publicClient.readContract({
        address: USDT_ADDRESS,
        abi: usdtAbi,
        functionName: 'allowance',
        args: [account, VAULT_ADDRESS],
      });

      if (currentAllowance !== form.amountRaw) {
        if (currentAllowance > 0n) {
          await assertTransactionReady();
          setAction({
            phase: 'resetting',
            message: 'Resetting the old USDT allowance to zero…',
          });
          const resetHash = await wallet.writeContract({
            address: USDT_ADDRESS,
            abi: usdtAbi,
            functionName: 'approve',
            args: [VAULT_ADDRESS, 0n],
          });
          await waitForSuccessfulReceipt(resetHash, 'Allowance reset');
        }

        await assertTransactionReady();
        setAction({
          phase: 'approving',
          message: `Approving exactly ${amount} USDT…`,
        });
        const approvalHash = await wallet.writeContract({
          address: USDT_ADDRESS,
          abi: usdtAbi,
          functionName: 'approve',
          args: [VAULT_ADDRESS, form.amountRaw],
        });
        await waitForSuccessfulReceipt(approvalHash, 'USDT approval');
      }

      await assertTransactionReady();
      const exactAllowance = await publicClient.readContract({
        address: USDT_ADDRESS,
        abi: usdtAbi,
        functionName: 'allowance',
        args: [account, VAULT_ADDRESS],
      });
      if (exactAllowance !== form.amountRaw) {
        throw new Error(
          'The final USDT allowance does not exactly match this deposit. Nothing was moved.',
        );
      }
      setAction({
        phase: 'depositing',
        message: 'Confirm the vault deposit in your wallet…',
      });
      const depositHash = await wallet.writeContract({
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: 'deposit',
        args: [form.amountRaw, form.recipient],
      });
      submittedDepositHash = depositHash;
      setAction({
        phase: 'confirming',
        message: 'Waiting for Ethereum confirmation…',
        hash: depositHash,
      });
      const receipt = await waitForSuccessfulReceipt(
        depositHash,
        'Vault deposit',
      );
      submittedDepositHash = receipt.transactionHash;
      const depositLogs = parseEventLogs({
        abi: vaultAbi,
        eventName: 'Deposit',
        logs: receipt.logs,
      }).filter((log) => isAddressEqual(log.address, VAULT_ADDRESS));
      if (depositLogs.length !== 1) {
        throw new Error(
          'The Ethereum transaction succeeded, but its vault Deposit event could not be verified. Do not retry until the transaction is reviewed.',
        );
      }
      const depositEvent = depositLogs[0];
      if (
        !isAddressEqual(depositEvent.args.token, USDT_ADDRESS) ||
        depositEvent.args.amount !== form.amountRaw ||
        !sameHex(depositEvent.args.b3Recipient, form.recipient)
      ) {
        throw new Error(
          'The Ethereum transaction succeeded, but its Deposit details did not match this form. Do not retry until the transaction is reviewed.',
        );
      }
      const depositId = depositEvent.args.depositId;

      setAction({
        phase: 'success',
        message:
          'Deposit confirmed on Ethereum. Keep this transaction hash until the B3 mint is visible.',
        hash: receipt.transactionHash,
        depositId,
      });
      await Promise.all([refreshDeployment(), refreshWallet(account)]);
    } catch (error) {
      setAction({
        phase: 'error',
        message: friendlyError(error),
        hash: submittedDepositHash,
      });
    }
  };

  const mainButton = () => {
    if (!topLevel) {
      return (
        <Button disabled size="lg" className="h-12 w-full">
          Open this bridge directly in its own tab
        </Button>
      );
    }
    if (!account) {
      return (
        <Button
          onClick={connectWallet}
          disabled={walletBusy}
          size="lg"
          className="h-12 w-full bg-accent text-[#17140d] hover:bg-accent/90"
        >
          {walletBusy ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Wallet data-icon="inline-start" />
          )}
          Connect Ethereum wallet
        </Button>
      );
    }
    if (!correctNetwork) {
      return (
        <Button
          onClick={switchNetwork}
          disabled={walletBusy}
          size="lg"
          className="h-12 w-full bg-accent text-[#17140d] hover:bg-accent/90"
        >
          Switch to Ethereum Mainnet
        </Button>
      );
    }
    return (
      <Button
        onClick={submitDeposit}
        disabled={!canDeposit || actionBusy}
        size="lg"
        className="h-12 w-full bg-accent text-[#17140d] hover:bg-accent/90"
      >
        {actionBusy ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <LockKeyhole data-icon="inline-start" />
        )}
        {releaseApproved && liveReady
          ? 'Approve and deposit'
          : 'Deposits not open yet'}
      </Button>
    );
  };

  const identityState: CheckState =
    deployment.phase === 'checking'
      ? 'checking'
      : deployment.phase === 'error'
        ? 'fail'
        : deployment.identityMatches
          ? 'pass'
          : 'fail';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/92 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            {/* oxlint-disable-next-line next/no-img-element -- This fixed local mark is intentionally served without a remote image optimizer. */}
            <img
              src="/b3hive-mark.png"
              alt="B3 Hive"
              width={38}
              height={38}
              className="rounded-[10px]"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight">B3 Bridge</p>
              <p className="text-[11px] text-muted-foreground">
                Ethereum ↔ B3 Hive
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden border-warning/30 bg-warning/10 text-warning sm:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-warning" />
              Preparing launch
            </Badge>
            {account ? (
              <Button
                variant="outline"
                size="sm"
                onClick={connectWallet}
                disabled={walletBusy}
              >
                {shortAddress(account)}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)] lg:py-12">
        <Card className="border border-border/80 bg-card shadow-[0_24px_90px_rgba(0,0,0,.28)] ring-0">
          <CardHeader className="border-b border-border/70 pb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Badge className="bg-accent-muted text-accent">Deposit</Badge>
              <span className="text-xs text-muted-foreground">
                {ETHEREUM_CHAIN_NAME}
              </span>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-[-0.03em]">
              Move USDT into B3
            </CardTitle>
            <CardDescription>
              USDT is locked on Ethereum and the same six-decimal amount is
              minted as bUSD to your B3 address.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-2">
            {deployment.phase === 'error' ||
            (!deployment.identityMatches && deployment.phase === 'loaded') ? (
              <Alert
                variant="destructive"
                className="border-destructive/30 bg-destructive/8"
              >
                <AlertTriangle />
                <AlertTitle>Safety check failed</AlertTitle>
                <AlertDescription>
                  {deployment.message ??
                    'The live contract identity does not match the pinned release. Do not deposit.'}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-warning/30 bg-warning/8 text-warning">
                <CircleAlert />
                <AlertTitle>Deposits are safely closed</AlertTitle>
                <AlertDescription className="text-secondary-foreground">
                  {closedReason}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <label
                  htmlFor="amount"
                  className="text-xs font-medium text-secondary-foreground"
                >
                  You deposit
                </label>
                {account ? (
                  <span className="text-[11px] text-muted-foreground">
                    Balance {formatUnits(balance, USDT_DECIMALS)} USDT
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-invalid={Boolean(form.amountError)}
                  className="h-14 pr-20 text-lg"
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-sm font-semibold">
                  USDT
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <p
                  className={
                    form.amountError
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }
                >
                  {form.amountError ??
                    `Maximum ${MAX_DEPOSIT_USDT} USDT per deposit`}
                </p>
                {account && allowance > 0n ? (
                  <p className="text-muted-foreground">
                    Allowance {formatUnits(allowance, USDT_DECIMALS)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-center">
              <span className="grid size-9 place-items-center rounded-full border border-border bg-muted text-accent">
                <ArrowDown className="size-4" />
              </span>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="recipient"
                className="text-xs font-medium text-secondary-foreground"
              >
                Your B3 receiving address
              </label>
              <Input
                id="recipient"
                value={b3Address}
                onChange={(event) => setB3Address(event.target.value)}
                placeholder="Paste a legacy B3 address"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(form.addressError)}
                className="h-12 font-mono text-xs"
              />
              <p
                className={
                  form.addressError
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {form.addressError ??
                  (form.recipient
                    ? 'Valid B3 mainnet P2PKH address.'
                    : 'Only a checksummed B3 mainnet P2PKH address is accepted.')}
              </p>
            </div>

            {mainButton()}

            {action.phase !== 'idle' && action.message ? (
              <Alert
                className={
                  action.phase === 'success'
                    ? 'border-success/30 bg-success/8'
                    : action.phase === 'error'
                      ? 'border-destructive/30 bg-destructive/8'
                      : 'border-accent/30 bg-accent/8'
                }
              >
                {action.phase === 'success' ? (
                  <CircleCheck className="text-success" />
                ) : action.phase === 'error' ? (
                  <AlertTriangle className="text-destructive" />
                ) : (
                  <LoaderCircle className="animate-spin text-accent" />
                )}
                <AlertTitle>
                  {action.phase === 'success'
                    ? 'Deposit confirmed'
                    : action.phase === 'error'
                      ? action.hash
                        ? 'Review transaction'
                        : 'Nothing was sent'
                      : 'Wallet action'}
                </AlertTitle>
                <AlertDescription>
                  {action.message}
                  {action.hash ? (
                    <a
                      className="ml-1 text-accent"
                      href={etherscanTransactionUrl(action.hash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction{' '}
                      <ExternalLink className="inline size-3" />
                    </a>
                  ) : null}
                  {action.depositId !== undefined ? (
                    <span className="ml-1">
                      Deposit #{action.depositId.toString()}.
                    </span>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" />
              Non-custodial · your wallet signs every transaction
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/80 bg-card/85 ring-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="size-4 text-accent" /> Live safety
                    gates
                  </CardTitle>
                  <CardDescription className="mt-1">
                    The page rechecks Ethereum before every deposit.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={refreshDeployment}
                  disabled={deployment.phase === 'checking'}
                  aria-label="Refresh live checks"
                >
                  <RefreshCw
                    className={
                      deployment.phase === 'checking' ? 'animate-spin' : ''
                    }
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusRow
                label="Pinned bytecode and configuration"
                detail={
                  deployment.checkedBlock
                    ? `Ethereum block ${deployment.checkedBlock.toLocaleString()}`
                    : undefined
                }
                state={identityState}
              />
              <StatusRow
                label="Verifier initialized"
                state={
                  deployment.phase === 'checking'
                    ? 'checking'
                    : deployment.initialized
                      ? 'pass'
                      : 'wait'
                }
              />
              <StatusRow
                label="Live validator release path"
                detail={
                  deployment.latestBridgeHeight
                    ? `B3 height ${deployment.latestBridgeHeight.toLocaleString()}`
                    : undefined
                }
                state={
                  deployment.phase === 'checking'
                    ? 'checking'
                    : deployment.bridgeReady && deployment.depositViable
                      ? 'pass'
                      : 'wait'
                }
              />
              <StatusRow
                label="Public source publication"
                detail="Etherscan / Sourcify"
                state={RELEASE_GATES.explorerSourcesPublished ? 'pass' : 'wait'}
              />
              <StatusRow
                label="Independent audit and rehearsal"
                state={
                  RELEASE_GATES.externalAuditComplete &&
                  RELEASE_GATES.endToEndRehearsalComplete
                    ? 'pass'
                    : 'wait'
                }
              />
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card/85 ring-0">
            <CardHeader>
              <CardTitle className="text-base">Pinned USDT vault</CardTitle>
              <CardDescription>
                Keyless B3 staker-controlled contract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={etherscanAddressUrl(VAULT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className="group break-all font-mono text-xs leading-5 text-muted-foreground hover:text-accent"
              >
                {VAULT_ADDRESS} <ExternalLink className="ml-1 inline size-3" />
              </a>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/70 bg-surface p-3">
                  <p className="text-muted-foreground">Next deposit</p>
                  <p className="mt-1 font-mono">
                    #{deployment.nextDepositId.toString()}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-surface p-3">
                  <p className="text-muted-foreground">Activation</p>
                  <p className="mt-1 font-mono">811,001</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-secondary-foreground">
                This page never receives funds, seed phrases, private keys, or
                wallet passwords. Ethereum gas is paid by the connected wallet.
              </p>
            </CardContent>
          </Card>

          <details className="rounded-xl border border-border/80 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-secondary-foreground">
              How a deposit works
            </summary>
            <ol className="mt-3 space-y-2 pl-4">
              <li>1. Validate your B3 address locally in this browser.</li>
              <li>
                2. Approve only the exact USDT amount in your Ethereum wallet.
              </li>
              <li>
                3. Lock USDT in the pinned vault and keep the Ethereum receipt.
              </li>
              <li>
                4. B3 verifies the Ethereum deposit and mints the matching bUSD.
              </li>
            </ol>
          </details>
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            Verify the contract address from more than one trusted source before
            signing.
          </p>
          <p>Open-source, static, and designed for immutable peer hosting.</p>
        </div>
      </footer>
    </main>
  );
}
