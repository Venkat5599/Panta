import { readFile } from "node:fs/promises";
import type { Logger } from "@premium/core";
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Chain access: load the hot wallet, sign what Panta builds, broadcast it.
 *
 * Panta hands back unsigned transactions and we sign locally, so the signing
 * key never leaves this process and never touches a browser.
 */

/** Load a keypair from a standard Solana CLI JSON array file. */
export async function loadKeypair(path: string): Promise<Keypair> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    throw new Error(
      `Cannot read the factory keypair at ${path}. On the VPS this should be a ` +
        `600-permission file owned by the service user.`,
      { cause },
    );
  }

  let bytes: number[];
  try {
    bytes = JSON.parse(raw) as number[];
  } catch (cause) {
    throw new Error(`Keypair at ${path} is not valid JSON`, { cause });
  }

  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error(
      `Keypair at ${path} should be a 64-byte JSON array, got ${
        Array.isArray(bytes) ? `${bytes.length} bytes` : typeof bytes
      }`,
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

/**
 * Decode a base64 transaction from Panta.
 *
 * Tries versioned first: Panta markets touch address lookup tables, so a
 * legacy-only decoder would fail on exactly the transactions that matter.
 */
export function decodeTransaction(base64: string): Transaction | VersionedTransaction {
  const bytes = Buffer.from(base64, "base64");
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

export interface ChainOptions {
  rpcUrl: string;
  keypair: Keypair;
  logger: Logger;
  /** When true, sign and simulate but never broadcast. */
  dryRun?: boolean;
}

export class Chain {
  readonly connection: Connection;
  readonly keypair: Keypair;
  private readonly logger: Logger;
  private readonly dryRun: boolean;

  constructor(options: ChainOptions) {
    // `confirmed` for reads during operation. Settlement reads use `finalized`
    // explicitly — see resolver.ts, where a reorg would corrupt a payout.
    this.connection = new Connection(options.rpcUrl, "confirmed");
    this.keypair = options.keypair;
    this.logger = options.logger;
    this.dryRun = options.dryRun ?? false;
  }

  get publicKey(): string {
    return this.keypair.publicKey.toBase58();
  }

  /** Current slot. Observed at market open and then frozen as the epoch's startSlot. */
  getSlot(commitment: "confirmed" | "finalized" = "confirmed"): Promise<number> {
    return this.connection.getSlot(commitment);
  }

  /** Lamport balance. Checked at boot so we fail before, not during, an epoch. */
  getBalance(): Promise<number> {
    return this.connection.getBalance(this.keypair.publicKey);
  }

  /**
   * Sign and broadcast, then wait for confirmation.
   *
   * Simulates first. A market creation costs a real fee, and finding out it
   * would fail before paying for it is worth the extra round trip.
   */
  async signAndSend(base64: string, label: string): Promise<string> {
    const tx = decodeTransaction(base64);

    if (tx instanceof VersionedTransaction) {
      tx.sign([this.keypair]);
    } else {
      tx.feePayer ??= this.keypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash ??= blockhash;
      tx.sign(this.keypair);
    }

    const simulation =
      tx instanceof VersionedTransaction
        ? await this.connection.simulateTransaction(tx, { commitment: "confirmed" })
        : await this.connection.simulateTransaction(tx);

    if (simulation.value.err) {
      throw new Error(
        `Simulation failed for ${label}: ${JSON.stringify(simulation.value.err)}. ` +
          `Logs: ${(simulation.value.logs ?? []).slice(-5).join(" | ")}`,
      );
    }

    if (this.dryRun) {
      this.logger.warn("DRY_RUN: simulated but not broadcast", { label });
      return `dry-run-${label}`;
    }

    const raw = tx instanceof VersionedTransaction ? tx.serialize() : tx.serialize();
    const signature = await this.connection.sendRawTransaction(raw, {
      // We already simulated; skipping avoids paying for it twice.
      skipPreflight: true,
      maxRetries: 3,
    });

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash("confirmed");
    const confirmation = await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction ${signature} for ${label} failed on chain: ${JSON.stringify(
          confirmation.value.err,
        )}`,
      );
    }

    this.logger.info("transaction confirmed", { label, signature });
    return signature;
  }
}
