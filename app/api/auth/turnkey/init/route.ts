import { NextRequest, NextResponse } from "next/server";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyServerClient, DEFAULT_SOLANA_ACCOUNTS } from "@turnkey/sdk-server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { checkRequestRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

const TURNKEY_BASE_URL = "https://api.turnkey.com";
const OTP_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getTurnkeyClient() {
  const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;
  const organizationId = process.env.TURNKEY_ORGANIZATION_ID;

  if (!apiPublicKey || !apiPrivateKey || !organizationId) {
    throw new Error("Turnkey env vars not configured");
  }

  const stamper = new ApiKeyStamper({ apiPublicKey, apiPrivateKey });
  return new TurnkeyServerClient({
    stamper,
    apiBaseUrl: TURNKEY_BASE_URL,
    organizationId,
  });
}

async function ensureTurnkeyEmailUser(email: string): Promise<{ subOrganizationId: string; isReturning: boolean }> {
  const parentOrgId = process.env.TURNKEY_ORGANIZATION_ID;
  if (!parentOrgId) throw new Error("Turnkey not configured");

  const supabase = getSupabaseServerClient();
  const { data: existingUser } = await supabase
    .from("turnkey_users")
    .select("sub_organization_id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser?.sub_organization_id) {
    return { subOrganizationId: existingUser.sub_organization_id, isReturning: true };
  }

  const client = getTurnkeyClient();
  const subOrgResult = await client.createSubOrganization({
    organizationId: parentOrgId,
    subOrganizationName: `user:${email}`,
    rootUsers: [
      {
        userName: email,
        userEmail: email,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: "Solana Wallet",
      accounts: DEFAULT_SOLANA_ACCOUNTS,
    },
  });

  const subOrgId = subOrgResult.subOrganizationId;
  const walletId = subOrgResult.wallet?.walletId;
  const walletAddress = subOrgResult.wallet?.addresses?.[0];

  if (!subOrgId || !walletAddress) {
    throw new Error("Turnkey sub-org creation did not return wallet data");
  }

  const { error: dbError } = await supabase.from("turnkey_users").insert({
    email,
    sub_organization_id: subOrgId,
    wallet_address: walletAddress,
    wallet_id: walletId ?? null,
  });

  if (!dbError) {
    return { subOrganizationId: subOrgId, isReturning: false };
  }

  const { data: raceWinner } = await supabase
    .from("turnkey_users")
    .select("sub_organization_id")
    .eq("email", email)
    .maybeSingle();

  if (raceWinner?.sub_organization_id) {
    return { subOrganizationId: raceWinner.sub_organization_id, isReturning: true };
  }

  throw dbError;
}

export async function POST(req: NextRequest) {
  let email: string;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const orgId = process.env.TURNKEY_ORGANIZATION_ID;
  if (!orgId) {
    return NextResponse.json({ error: "Turnkey not configured" }, { status: 500 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const ipLimit = checkRequestRateLimit(rateLimitKey(req, "turnkey:otp:init:ip"), 20, 10 * 60 * 1000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
  const emailLimit = checkRequestRateLimit(rateLimitKey(req, "turnkey:otp:init:email", normalizedEmail), 5, 10 * 60 * 1000);
  if (!emailLimit.allowed) return rateLimitResponse(emailLimit.retryAfterSeconds);

  const supabase = getSupabaseServerClient();

  try {
    const { subOrganizationId: targetOrgId, isReturning } = await ensureTurnkeyEmailUser(normalizedEmail);
    const client = getTurnkeyClient();
    const result = await client.initOtpAuth({
      organizationId: targetOrgId,
      otpType: "OTP_TYPE_EMAIL",
      contact: normalizedEmail,
      appName: "Enki Art",
    });

    const otpId = result.otpId;

    // Store OTP session server-side — ties the otpId to the email it was issued for.
    // This prevents email substitution attacks in the verify route.
    await supabase.from("otp_sessions").upsert({
      otp_id: otpId,
      email: normalizedEmail,
      organization_id: targetOrgId,
      expires_at: new Date(Date.now() + OTP_SESSION_TTL_MS).toISOString(),
    });

    // isReturning lets the client show "Existing wallet found, recovering…" before OTP entry.
    // Not sensitive (the user submitted this email themselves), and prevents leaking other users.
    return NextResponse.json({ otpId, isReturning });
  } catch (error) {
    console.error("Turnkey initOtpAuth error:", error);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
