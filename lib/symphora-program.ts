/**
 * Symphora on-chain program client (read-only helpers).
 *
 * Wraps the Anchor IDL at lib/idl/symphora.json so the frontend can read
 * Prompt and GuardianConfig accounts without owning a server-side keypair.
 *
 * Write instructions (purchase_prompt, register_guardian, recover_wallet, etc.)
 * are intentionally NOT exposed here — they are wired up in dedicated payment
 * / guardian flows once those product surfaces are ready.
 */

import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, type Commitment } from "@solana/web3.js";
import idl from "@/lib/idl/symphora.json";

export const SYMPHORA_PROGRAM_ID = new PublicKey(
  "GdKHLpEPWC6xLjDjgKDJ1FPkZmmKnxGcCH1NebC8S6XD"
);

export const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";

const PROMPT_SEED = new TextEncoder().encode("prompt");
const PURCHASE_SEED = new TextEncoder().encode("purchase");
const GUARDIAN_SEED = new TextEncoder().encode("guardian");

// Anchor's u64 args are serialized little-endian in PDA seeds.
function u64LE(value: bigint | number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(value), true);
  return new Uint8Array(buf);
}

export function getPromptPda(artist: PublicKey, promptId: bigint | number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PROMPT_SEED, artist.toBuffer(), u64LE(promptId)],
    SYMPHORA_PROGRAM_ID
  );
  return pda;
}

export function getPurchasePda(
  promptPda: PublicKey,
  buyer: PublicKey,
  generationId: bigint | number
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PURCHASE_SEED, promptPda.toBuffer(), buyer.toBuffer(), u64LE(generationId)],
    SYMPHORA_PROGRAM_ID
  );
  return pda;
}

export function getGuardianConfigPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [GUARDIAN_SEED, owner.toBuffer()],
    SYMPHORA_PROGRAM_ID
  );
  return pda;
}

// Read-only Anchor Provider — does not require a real signer for view calls.
function readOnlyProvider(connection: Connection, commitment: Commitment = "confirmed") {
  const fail = (): never => {
    throw new Error("Read-only provider cannot sign transactions");
  };
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: fail,
    signAllTransactions: fail,
  };
  return new AnchorProvider(connection, dummyWallet as never, { commitment, preflightCommitment: commitment });
}

export function getReadOnlyProgram(rpcUrl: string = SOLANA_DEVNET_RPC) {
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = readOnlyProvider(connection);
  return new Program(idl as Idl, provider);
}

export interface PromptAccount {
  artist: PublicKey;
  promptId: bigint;
  priceUsdc: bigint;
  title: string;
  metadataUri: string;
  isActive: boolean;
  totalSales: bigint;
  totalRevenue: bigint;
  bump: number;
}

export interface GuardianConfigAccount {
  owner: PublicKey;
  guardian: PublicKey;
  bump: number;
}

export interface PurchaseAccount {
  prompt: PublicKey;
  buyer: PublicKey;
  generationId: bigint;
  paidAmount: bigint;
  receiptMint: PublicKey | null;
  timestamp: bigint;
  bump: number;
}

/** Fetch and decode a Prompt PDA. Returns null if it does not exist. */
export async function fetchPrompt(
  artist: PublicKey,
  promptId: bigint | number,
  rpcUrl?: string
): Promise<PromptAccount | null> {
  const program = getReadOnlyProgram(rpcUrl);
  const pda = getPromptPda(artist, promptId);
  try {
    // Anchor lowercases account namespace to match the snake_case → camelCase IDL.
    const acc = await (program.account as Record<string, { fetchNullable: (pk: PublicKey) => Promise<unknown> }>).prompt.fetchNullable(pda);
    return (acc as PromptAccount | null) ?? null;
  } catch {
    return null;
  }
}

/** Fetch and decode a GuardianConfig PDA. Returns null if it does not exist. */
export async function fetchGuardianConfig(
  owner: PublicKey,
  rpcUrl?: string
): Promise<GuardianConfigAccount | null> {
  const program = getReadOnlyProgram(rpcUrl);
  const pda = getGuardianConfigPda(owner);
  try {
    const acc = await (program.account as Record<string, { fetchNullable: (pk: PublicKey) => Promise<unknown> }>).guardianConfig.fetchNullable(pda);
    return (acc as GuardianConfigAccount | null) ?? null;
  } catch {
    return null;
  }
}

/** Fetch and decode a Purchase PDA. Returns null if it does not exist. */
export async function fetchPurchase(
  promptPda: PublicKey,
  buyer: PublicKey,
  generationId: bigint | number,
  rpcUrl?: string
): Promise<PurchaseAccount | null> {
  const program = getReadOnlyProgram(rpcUrl);
  const pda = getPurchasePda(promptPda, buyer, generationId);
  try {
    const acc = await (program.account as Record<string, { fetchNullable: (pk: PublicKey) => Promise<unknown> }>).purchase.fetchNullable(pda);
    return (acc as PurchaseAccount | null) ?? null;
  } catch {
    return null;
  }
}
