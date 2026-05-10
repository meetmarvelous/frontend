"use client";

/**
 * Turnkey Solana signer.
 *
 * Mirrors the wallet-adapter `{ publicKey, signTransaction }` shape so it can be
 * dropped into existing Solana flows (x402 payments, Anchor providers, etc.) when
 * the user logged in via the Turnkey email path instead of an external wallet.
 *
 * Signing is delegated to `/api/turnkey/sign-transaction` which uses Turnkey's
 * `signRawPayload` against the user's sub-org wallet. The full transaction is
 * never exposed to Turnkey — only the message bytes (per VersionedTransaction.message).
 */

import { useCallback, useMemo } from "react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useTurnkeyEmailAuth } from "@/hooks/useTurnkeyAuth";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export interface TurnkeySolanaSigner {
  isAvailable: boolean;
  publicKey: PublicKey | null;
  walletAddress: string | null;
  signTransaction: <T extends VersionedTransaction>(tx: T) => Promise<T>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export function useTurnkeySolanaSigner(): TurnkeySolanaSigner {
  const { address, sessionToken, getAuthHeaders } = useTurnkeyEmailAuth();

  const publicKey = useMemo(() => {
    if (!address) return null;
    try { return new PublicKey(address); } catch { return null; }
  }, [address]);

  const callSign = useCallback(
    async (payloadBytes: Uint8Array): Promise<Uint8Array> => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const auth = getAuthHeaders();
      if (auth) Object.assign(headers, auth);
      else if (sessionToken) headers["X-Session-Token"] = sessionToken;
      else throw new Error("Turnkey session not available");

      const res = await fetch("/api/turnkey/sign-transaction", {
        method: "POST",
        headers,
        body: JSON.stringify({ payloadHex: bytesToHex(payloadBytes) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Turnkey signing failed: ${res.status}`);
      }
      const { signatureHex } = await res.json() as { signatureHex: string };
      const sig = hexToBytes(signatureHex);
      if (sig.length !== 64) throw new Error(`Unexpected signature length ${sig.length}`);
      return sig;
    },
    [getAuthHeaders, sessionToken]
  );

  const signTransaction = useCallback(
    async <T extends VersionedTransaction>(tx: T): Promise<T> => {
      if (!publicKey) throw new Error("Turnkey wallet not available");

      const messageBytes = tx.message.serialize();
      const signature = await callSign(messageBytes);

      // Place the signature in the slot matching the fee payer (always index 0 here
      // because we only build single-signer txs in our flows).
      const signerIndex = tx.message.staticAccountKeys.findIndex((k) => k.equals(publicKey));
      const targetIndex = signerIndex === -1 ? 0 : signerIndex;
      tx.signatures[targetIndex] = signature;
      return tx;
    },
    [publicKey, callSign]
  );

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      return callSign(message);
    },
    [callSign]
  );

  return {
    isAvailable: !!publicKey && !!sessionToken,
    publicKey,
    walletAddress: address,
    signTransaction,
    signMessage,
  };
}
