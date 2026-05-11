"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";

const PromptGeneratorView = dynamic(() => import("./PromptGeneratorView"), { ssr: false });

interface PromptData {
  id: string;
  title: string;
  artist: string;
  artistHandle?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  showcaseImages?: any[];
  variables?: any[];
  price?: number;
  tags?: string[];
  createdAt?: string;
  uses?: number;
  isFree?: boolean;
}

interface PromptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: PromptData | null;
}

export default function PromptDetailModal({ isOpen, onClose, prompt }: PromptDetailModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen || !prompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#0F0E0D",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
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
        artistName={prompt.artist}
        imageUrl={prompt.imageUrl}
        showcaseImages={prompt.showcaseImages || []}
        isFreeShowcase={prompt.isFree}
      />
    </div>
  );
}
