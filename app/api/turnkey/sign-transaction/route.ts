/**
 * POST /api/turnkey/sign-transaction
 *
 * Signs an arbitrary Solana payload (typically a `VersionedTransaction.message.serialize()`
 * byte string) using the authenticated user's Turnkey-managed Solana wallet.
 *
 * Auth: requires `X-Session-Token` header from the Turnkey email login flow.
 *       The session token is matched against `auth_sessions` and resolved to the
 *       Turnkey sub-organization that owns the wallet.
 *
 * Body: { payloadHex: string }   // hex-encoded bytes to sign (no 0x prefix)
 * Response: { signatureHex: string, walletAddress: string }
 *
 * Solana uses ed25519, so:
 *   - payloadEncoding = PAYLOAD_ENCODING_HEXADECIMAL
 *   - hashFunction    = HASH_FUNCTION_NOT_APPLICABLE (RFC 8032 forbids pre-hashing)
 *
 * The route signs with the parent Turnkey API key against the user's sub-org. The user
 * authorized creation of the sub-org via OTP email; subsequent signing is gated by their
 * server-side session token (24h TTL) — equivalent trust model to other server-side wallet
 * custody flows.
 */
import { NextRequest, NextResponse } from "next/server";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyServerClient } from "@turnkey/sdk-server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { checkRequestRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

const TURNKEY_BASE_URL = "https://api.turnkey.com";

function getTurnkeyClient(organizationId: string) {
  const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;
  const defaultOrgId = process.env.TURNKEY_ORGANIZATION_ID;
  if (!apiPublicKey || !apiPrivateKey || !defaultOrgId) {
    throw new Error("Turnkey env vars not configured");
  }
  const stamper = new ApiKeyStamper({ apiPublicKey, apiPrivateKey });
  return new TurnkeyServerClient({ stamper, apiBaseUrl: TURNKEY_BASE_URL, organizationId });
}

function isHexString(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0;
}

export async function POST(req: NextRequest) {
  const ipLimit = checkRequestRateLimit(rateLimitKey(req, "turnkey:sign:ip"), 60, 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);

  const sessionToken = req.headers.get("X-Session-Token");
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token" }, { status: 401 });
  }

  let body: { payloadHex?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isHexString(body.payloadHex)) {
    return NextResponse.json({ error: "payloadHex must be an even-length hex string" }, { status: 400 });
  }
  const payloadHex = body.payloadHex;

  const supabase = getSupabaseServerClient();

  // 1. Resolve the session → wallet address
  const { data: session, error: sessionError } = await supabase
    .from("auth_sessions")
    .select("wallet_address, wallet_type, expires_at")
    .eq("token", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }
  if (session.wallet_type !== "turnkey") {
    return NextResponse.json({ error: "Session is not a Turnkey email session" }, { status: 403 });
  }

  // 2. Look up the user's sub-organization
  const { data: tkUser, error: tkError } = await supabase
    .from("turnkey_users")
    .select("sub_organization_id, wallet_address")
    .eq("wallet_address", session.wallet_address)
    .maybeSingle();
  if (tkError || !tkUser?.sub_organization_id || !tkUser.wallet_address) {
    return NextResponse.json({ error: "Turnkey user record not found" }, { status: 404 });
  }

  // 3. Sign with Turnkey
  try {
    const client = getTurnkeyClient(tkUser.sub_organization_id);
    const result = await client.signRawPayload({
      organizationId: tkUser.sub_organization_id,
      signWith: tkUser.wallet_address,
      payload: payloadHex,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      // Solana / ed25519 cannot pre-hash per RFC 8032 — must be NOT_APPLICABLE.
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });

    // signRawPayloadResult returns r and s as hex (no 0x), each 32 bytes for ed25519.
    // Concatenate to form the 64-byte ed25519 signature.
    const r = result.r ?? "";
    const s = result.s ?? "";
    if (!isHexString(r) || !isHexString(s)) {
      console.error("[turnkey/sign-transaction] unexpected signature shape:", result);
      return NextResponse.json({ error: "Unexpected signature shape" }, { status: 500 });
    }
    const signatureHex = (r + s).toLowerCase();

    return NextResponse.json({
      signatureHex,
      walletAddress: tkUser.wallet_address,
    });
  } catch (error) {
    console.error("[turnkey/sign-transaction] signRawPayload error:", error);
    return NextResponse.json({ error: "Signing failed" }, { status: 500 });
  }
}
