/**
 * Lightweight global subject for Turnkey payment confirmation.
 *
 * Turnkey email wallets sign server-side via /api/turnkey/sign-transaction —
 * there is no extension popup, so the user has no native "approve / reject"
 * step. We add an in-app confirmation modal that the payment hook awaits
 * before actually triggering the signing API call.
 *
 * Pattern: one active request at a time. The hook calls `requestPaymentConfirm`
 * which returns a promise. The mounted modal subscribes and renders the
 * dialog. User action (confirm / cancel / dismiss) calls `resolvePaymentConfirm`
 * which fulfils the promise.
 */

export interface PaymentConfirmRequest {
  /** Human-readable amount, e.g. "0.10". */
  amount: string;
  /** Asset name shown next to the amount, e.g. "USDC". */
  asset: string;
  /** Recipient (full base58 address, modal will truncate). */
  to: string;
  /** Optional purpose label, e.g. "Generate 2K image". */
  description?: string;
  /** Network label shown for transparency, e.g. "Solana devnet". */
  network?: string;
}

interface ActiveRequest extends PaymentConfirmRequest {
  resolve: (ok: boolean) => void;
}

let activeRequest: ActiveRequest | null = null;
const listeners = new Set<() => void>();

export function getActivePaymentConfirm(): PaymentConfirmRequest | null {
  if (!activeRequest) return null;
  const { resolve: _resolve, ...rest } = activeRequest;
  void _resolve;
  return rest;
}

export function subscribePaymentConfirm(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function requestPaymentConfirm(req: PaymentConfirmRequest): Promise<boolean> {
  // If something is already pending, reject the previous one — newer payment wins.
  if (activeRequest) {
    activeRequest.resolve(false);
    activeRequest = null;
  }
  return new Promise<boolean>((resolve) => {
    activeRequest = { ...req, resolve };
    emit();
  });
}

export function resolvePaymentConfirm(ok: boolean): void {
  if (!activeRequest) return;
  const { resolve } = activeRequest;
  activeRequest = null;
  emit();
  resolve(ok);
}
