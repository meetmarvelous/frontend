"use client";

import { useActiveAccount, useActiveWallet, useActiveWalletChain } from "thirdweb/react";
import { useState, useEffect } from "react";

export type WalletType = "in-app" | "external" | "none";

export type AuthMethod =
  | "email"
  | "google"
  | "phone"
  | "passkey"
  | "facebook"
  | "apple"
  | "metamask"
  | "coinbase"
  | "walletconnect"
  | "rainbow"
  | "zerion"
  | "trust"
  | "okx"
  | "external"
  | "unknown";

export interface WalletSecurityInfo {
  isSmartAccount: boolean;
  isValidWallet: boolean;
  isSecureConnection: boolean;
  warnings: string[];
}

export interface WalletInfoState {
  address: string | null;
  shortAddress: string | null;
  type: WalletType;
  authMethod: AuthMethod;
  isConnected: boolean;
  isInAppWallet: boolean;
  isExternalWallet: boolean;
  walletId: string | null;
  chain: {
    id: number | null;
    name: string | null;
  };
  security: WalletSecurityInfo;
  displayName: string;
  icon: string;
  description: string;
}

function detectAuthMethod(walletId: string | null, accountAddress: string | null): AuthMethod {
  if (!walletId) return "unknown";

  if (walletId === "inApp" || walletId === "embedded") {
    if (typeof window !== "undefined") {
      try {
        const thirdwebKeys = Object.keys(localStorage).filter(key =>
          key.includes("thirdweb") || key.includes("wallet") || key.includes("auth")
        );
        for (const key of thirdwebKeys) {
          const value = localStorage.getItem(key);
          if (!value) continue;
          try {
            const parsed = JSON.parse(value);
            if (parsed.email || key.includes("email")) return "email";
            if (parsed.google || key.includes("google") || parsed.provider === "google") return "google";
            if (parsed.phone || key.includes("phone") || parsed.phoneNumber) return "phone";
            if (parsed.passkey || key.includes("passkey") || parsed.credentialId) return "passkey";
            if (parsed.facebook || key.includes("facebook")) return "facebook";
            if (parsed.apple || key.includes("apple")) return "apple";
          } catch {
            if (value.includes("email") || value.includes("@")) return "email";
            if (value.includes("google")) return "google";
            if (value.includes("phone")) return "phone";
            if (value.includes("passkey")) return "passkey";
          }
        }
      } catch {
        // ignore
      }
    }
    return "email";
  }

  const walletIdLower = walletId.toLowerCase();
  if (walletIdLower.includes("metamask") || walletId === "io.metamask") return "metamask";
  if (walletIdLower.includes("coinbase") || walletId === "com.coinbase.wallet") return "coinbase";
  if (walletIdLower.includes("walletconnect") || walletId === "walletConnect") return "walletconnect";
  if (walletIdLower.includes("rainbow") || walletId === "me.rainbow") return "rainbow";
  if (walletIdLower.includes("zerion") || walletId === "io.zerion.wallet") return "zerion";
  if (walletIdLower.includes("trust") || walletId === "com.trustwallet.app") return "trust";
  if (walletIdLower.includes("okx") || walletId === "com.okex.wallet") return "okx";
  return "external";
}

function getWalletDisplayInfo(authMethod: AuthMethod): {
  displayName: string;
  icon: string;
  description: string;
} {
  const displayInfo: Record<AuthMethod, { displayName: string; icon: string; description: string }> = {
    email:         { displayName: "Email Wallet",     icon: "📧", description: "Authenticated via email" },
    google:        { displayName: "Google Wallet",    icon: "🔐", description: "Authenticated via Google" },
    phone:         { displayName: "Phone Wallet",     icon: "📱", description: "Authenticated via phone number" },
    passkey:       { displayName: "Passkey Wallet",   icon: "🔑", description: "Authenticated via biometric passkey" },
    facebook:      { displayName: "Facebook Wallet",  icon: "👤", description: "Authenticated via Facebook" },
    apple:         { displayName: "Apple Wallet",     icon: "",   description: "Authenticated via Apple" },
    metamask:      { displayName: "MetaMask",         icon: "🦊", description: "MetaMask browser extension" },
    coinbase:      { displayName: "Coinbase Wallet",  icon: "💼", description: "Coinbase Wallet" },
    walletconnect: { displayName: "WalletConnect",    icon: "🔗", description: "Connected via WalletConnect" },
    rainbow:       { displayName: "Rainbow Wallet",   icon: "🌈", description: "Rainbow Wallet" },
    zerion:        { displayName: "Zerion Wallet",    icon: "⚡", description: "Zerion Wallet" },
    trust:         { displayName: "Trust Wallet",     icon: "🛡️", description: "Trust Wallet" },
    okx:           { displayName: "OKX Wallet",       icon: "⭕", description: "OKX Wallet" },
    external:      { displayName: "External Wallet",  icon: "🔌", description: "Connected external wallet" },
    unknown:       { displayName: "Unknown Wallet",   icon: "❓", description: "Unknown wallet type" },
  };
  return displayInfo[authMethod];
}

function validateWalletSecurity(
  walletId: string | null,
  accountAddress: string | null,
  type: WalletType
): WalletSecurityInfo {
  const warnings: string[] = [];
  let isSmartAccount = false;
  let isValidWallet = true;
  let isSecureConnection = true;

  if (!accountAddress) {
    warnings.push("No wallet address detected");
    isValidWallet = false;
  }

  if (walletId?.includes("smart") || walletId?.includes("account-abstraction")) {
    isSmartAccount = true;
  }

  if (type === "in-app") {
    if (walletId !== "inApp" && walletId !== "embedded") {
      warnings.push("Unexpected in-app wallet ID");
      isValidWallet = false;
    }
    if (typeof window !== "undefined") {
      try {
        const hasThirdwebData = Object.keys(localStorage).some(key => key.includes("thirdweb"));
        if (!hasThirdwebData) {
          warnings.push("Missing Thirdweb wallet data");
          isValidWallet = false;
        }
      } catch {
        warnings.push("Cannot access wallet storage");
        isSecureConnection = false;
      }
    }
  }

  if (type === "external") {
    if (typeof window !== "undefined") {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        warnings.push("No Web3 provider detected");
        isSecureConnection = false;
      }
    }
  }

  if (accountAddress && !accountAddress.startsWith("0x")) {
    warnings.push("Invalid address format");
    isValidWallet = false;
  }
  if (accountAddress && accountAddress.length !== 42) {
    warnings.push("Invalid address length");
    isValidWallet = false;
  }

  return { isSmartAccount, isValidWallet, isSecureConnection, warnings };
}

export function useWalletInfo(): WalletInfoState {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const chain = useActiveWalletChain();

  const [walletInfo, setWalletInfo] = useState<WalletInfoState>({
    address: null,
    shortAddress: null,
    type: "none",
    authMethod: "unknown",
    isConnected: false,
    isInAppWallet: false,
    isExternalWallet: false,
    walletId: null,
    chain: { id: null, name: null },
    security: { isSmartAccount: false, isValidWallet: false, isSecureConnection: false, warnings: [] },
    displayName: "Not Connected",
    icon: "🔌",
    description: "No wallet connected",
  });

  useEffect(() => {
    if (!wallet || !account) {
      setWalletInfo({
        address: null,
        shortAddress: null,
        type: "none",
        authMethod: "unknown",
        isConnected: false,
        isInAppWallet: false,
        isExternalWallet: false,
        walletId: null,
        chain: { id: null, name: null },
        security: { isSmartAccount: false, isValidWallet: false, isSecureConnection: false, warnings: [] },
        displayName: "Not Connected",
        icon: "🔌",
        description: "No wallet connected",
      });
      return;
    }

    const address = account.address;
    const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
    const walletId = wallet.id || null;

    const isInAppWallet = walletId === "inApp" || walletId === "embedded";
    const isExternalWallet = !isInAppWallet;
    const type: WalletType = isInAppWallet ? "in-app" : isExternalWallet ? "external" : "none";

    const authMethod = detectAuthMethod(walletId, address);
    const displayInfo = getWalletDisplayInfo(authMethod);
    const security = validateWalletSecurity(walletId, address, type);
    const chainInfo = { id: chain?.id || null, name: chain?.name || null };

    setWalletInfo({
      address,
      shortAddress,
      type,
      authMethod,
      isConnected: true,
      isInAppWallet,
      isExternalWallet,
      walletId,
      chain: chainInfo,
      security,
      ...displayInfo,
    });
  }, [wallet, account, chain]);

  return walletInfo;
}

export function useWalletAuthentication() {
  const walletInfo = useWalletInfo();
  return {
    isAuthenticated: walletInfo.isConnected && walletInfo.security.isValidWallet,
    isSecure: walletInfo.security.isSecureConnection,
    warnings: walletInfo.security.warnings,
    canMakePayments: walletInfo.isConnected && walletInfo.security.isValidWallet && walletInfo.security.isSecureConnection,
  };
}
