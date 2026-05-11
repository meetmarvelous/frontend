"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import type { EnkiPrompt } from "@/lib/enkiPromptAdapter";

const PromptGeneratorView = dynamic(() => import("@/components/PromptGeneratorView"), { ssr: false });

type EnkiDetailPanelProps = {
  prompt: EnkiPrompt;
  onClose: () => void;
  faved: boolean;
  toggleFav: (id: string) => void;
};

export default function EnkiDetailPanel({ prompt, onClose }: EnkiDetailPanelProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0F0E0D" }}>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 12,
          right: 16,
          zIndex: 1001,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%",
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
        }}
      >
        <X size={16} />
      </button>
      <PromptGeneratorView
        promptId={prompt.id}
        title={prompt.title}
        artistName={prompt.artist?.name}
        imageUrl={prompt.art.url}
        showcaseImages={[prompt.art, ...(prompt.versions || [])].map(v => ({ url: v.url }))}
        isFreeShowcase={prompt.visibility === "full"}
      />
    </div>
  );
}
