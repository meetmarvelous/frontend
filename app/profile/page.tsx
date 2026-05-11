"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTurnkeyEmailAuth } from "@/hooks/useTurnkeyAuth";
import EnkiCard from "@/components/enki/EnkiCard";
import EnkiDetailPanel from "@/components/enki/EnkiDetailPanel";
import {
  mapMarketplacePromptToEnkiPrompt
} from "@/lib/enkiPromptAdapter";
import type { EnkiPrompt } from "@/lib/enkiPromptAdapter";
import { useSearchParams } from "next/navigation";
import { ChevronDown, MessageSquare, UserPlus, Sparkles } from "lucide-react";
import "@/components/enki/enki.css";

const PROFILE_STAT_LABELS = ["Prompts", "Uses", "Followers", "This month"] as const;

function useSafeActiveAccount() {
  try { return useActiveAccount(); } catch { return null; }
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("Released");
  const [open, setOpen] = useState<EnkiPrompt | null>(null);
  const searchParams = useSearchParams();

  const account = useSafeActiveAccount();
  const { publicKey: solanaPublicKey } = useWallet();
  const { address: turnkeyAddress } = useTurnkeyEmailAuth();
  const walletAddress =
    account?.address ?? solanaPublicKey?.toBase58() ?? turnkeyAddress ?? null;
  const isAuthed = !!walletAddress;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;
  const avatarInitials = walletAddress
    ? (walletAddress.startsWith("0x") ? walletAddress.slice(2, 4) : walletAddress.slice(0, 2)).toUpperCase()
    : "—";
  
  // Favorites logic (reused from feed)
  const [favs, setFavs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("enki:favorites") || "{}");
    } catch {
      return {};
    }
  });

  const toggleFav = (id: string) => {
    setFavs((current) => {
      const next = { ...current, [id]: !current[id] };
      if (typeof window !== "undefined") {
        localStorage.setItem("enki:favorites", JSON.stringify(next));
      }
      return next;
    });
  };

  const { data, isError } = useQuery({
    queryKey: ["/api/marketplace/prompts", "profile"],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20", sortBy: "newest" });
      const res = await fetch(`/api/marketplace/prompts?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load prompts");
      return res.json();
    },
    staleTime: 60_000,
  });

  const prompts = useMemo<EnkiPrompt[]>(() => {
    if (isError) return [];
    return Array.isArray(data?.prompts)
      ? data.prompts.map((item: unknown, index: number) => mapMarketplacePromptToEnkiPrompt(item, index))
      : [];
  }, [data, isError]);

  return (
    <div className="enki" style={{ paddingTop: 64 }}>
      {/* ─── Profile Header Section ─── */}
      <div style={{ position: "relative" }}>
        {/* Banner */}
        <div style={{ 
          height: 320, 
          background: "var(--enki-paper-3)", 
          backgroundImage: "linear-gradient(135deg, var(--enki-paper-3) 0%, var(--enki-paper-2) 100%)",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Subtle geometric pattern or abstract art for the banner */}
          <div style={{ 
            position: "absolute", 
            inset: 0, 
            opacity: 0.1, 
            backgroundImage: "radial-gradient(circle at 2px 2px, var(--enki-ink) 1px, transparent 0)",
            backgroundSize: "40px 40px"
          }} />
        </div>

        {/* Hero Content Container */}
        <div style={{ 
          maxWidth: 1400, 
          margin: "0 auto", 
          padding: "0 40px",
          position: "relative",
          marginTop: -80
        }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginBottom: 40 }}>
            {/* Avatar */}
            <div style={{ 
              width: 160, 
              height: 160, 
              borderRadius: 32, 
              background: "#111", 
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontFamily: "var(--font-instrument-serif), serif",
              fontStyle: "italic",
              boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
              border: "8px solid var(--enki-paper)",
              zIndex: 2
            }}>
              {avatarInitials}
            </div>

            {/* Title & Actions */}
            <div style={{ flex: 1, paddingBottom: 10 }}>
              <div className="mono" style={{ fontSize: 13, color: "var(--enki-ember)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {shortAddress ?? "Not connected"}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h1 className="serif" style={{ fontSize: "clamp(48px, 5vw, 72px)", fontWeight: 400, margin: 0, lineHeight: 1 }}>
                  {isAuthed ? <em>My</em> : <em>Guest</em>} {isAuthed ? "Profile" : ""}
                </h1>
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="enki-catbar-all" style={{ height: 44, opacity: 0.5, cursor: "not-allowed" }} disabled>
                    <UserPlus size={16} /> Follow
                  </button>
                  <button className="enki-catbar-all active" style={{ height: 44, opacity: 0.5, cursor: "not-allowed" }} disabled>
                    <MessageSquare size={16} /> Message
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bio & Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 80, marginBottom: 60 }}>
            <div style={{ fontSize: 18, lineHeight: 1.6, color: "var(--enki-ink-3)", maxWidth: 640, fontStyle: "italic" }}>
              {isAuthed
                ? "Add a bio in Settings."
                : "Connect your wallet to see your profile."}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px 40px" }}>
              {PROFILE_STAT_LABELS.map(label => (
                <div key={label}>
                  <div className="serif" style={{ fontSize: 32, lineHeight: 1, marginBottom: 4 }}>—</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--enki-ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs & Filter Section ─── */}
      <div style={{ 
        borderTop: "1px solid var(--enki-rule)", 
        borderBottom: "1px solid var(--enki-rule)",
        background: "var(--enki-paper)",
        position: "sticky",
        top: 64, // below global navbar
        zIndex: 40
      }}>
        <div style={{ 
          maxWidth: 1400, 
          margin: "0 auto", 
          padding: "0 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {["Released", "Reviews", "About"].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ 
                  padding: "20px 0",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid var(--enki-ink)" : "2px solid transparent",
                  color: activeTab === tab ? "var(--enki-ink)" : "var(--enki-ink-3)",
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {tab}
                {tab === "Released" && prompts.length > 0 && (
                  <span className="mono" style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>{prompts.length}</span>
                )}
              </button>
            ))}
            
            <button className="enki-catbar-all" style={{ height: 36, fontSize: 11, gap: 6, marginLeft: 16 }}>
              <Sparkles size={14} /> Filter by NFT <ChevronDown size={12} />
            </button>
          </div>

        </div>
      </div>

      {/* ─── Gallery Section ─── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px" }}>
        {activeTab === "Released" && prompts.length > 0 ? (
          <div className="enki-masonry">
            {prompts.map((prompt) => (
              <EnkiCard
                key={prompt.id}
                prompt={prompt}
                onOpen={setOpen}
                faved={Boolean(favs[prompt.id])}
                toggleFav={toggleFav}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 24, color: "var(--enki-ink-3)" }}>
              Nothing to show in {activeTab} yet.
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {open && (
        <EnkiDetailPanel
          prompt={open}
          onClose={() => setOpen(null)}
          faved={Boolean(favs[open.id])}
          toggleFav={toggleFav}
        />
      )}
    </div>
  );
}
