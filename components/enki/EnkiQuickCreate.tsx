import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { ChevronUp, PenSquare, Sparkles, Plus, X, GripVertical, Settings2, Info, Image as ImageIcon, Wallet, Minus, ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const QC_MODELS = [
  { id: "nano-banana-pro", name: "Nano Banana Pro", cost: 0.04 },
  { id: "gpt-image-2", name: "GPT-Image-2", cost: 0.06 },
];

const QC_RATIOS = ["1:1", "4:5", "3:4", "16:9", "9:16"];
const QC_RESOLUTIONS = ["1K", "2K", "4K"];

export default function EnkiQuickCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("A photograph of [subject] at (location), {mood}, lit by [lighting].");
  const [vars, setVars] = useState<Record<string, string>>({});
  
  // Settings
  const [model, setModel] = useState("nano-banana-pro");
  const [ratio, setRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2K");
  const [qty, setQty] = useState(1);
  
  // Image Selection Mode: 'upload' | 'nft'
  const [imgMode, setImgMode] = useState<"upload" | "nft">("upload");
  const [images, setImages] = useState<(string | null)[]>(Array(10).fill(null));

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Variable parsing: support [], (), {} with stable IDs
  const [detectedVariables, setDetectedVariables] = useState<any[]>([]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const regex = /(?:\[([^\]]+)\]|\{([^\}]+)\}|\(([^\)]+)\))/gi;
      const detections: { content: string; full: string }[] = [];
      let match;
      while ((match = regex.exec(prompt)) !== null) {
        const content = match[1] || match[2] || match[3];
        if (content) detections.push({ content, full: match[0] });
      }

      setDetectedVariables((prev) => {
        const next: any[] = [];
        const seenTokens = new Set<string>();

        detections.forEach((det) => {
          if (seenTokens.has(det.full)) return;
          seenTokens.add(det.full);

          const existing = prev.find(v => v.fullToken === det.full);
          if (existing) {
            next.push(existing);
          } else {
            next.push({
              id: `var-${Math.random().toString(36).substring(2, 9)}`,
              label: det.content,
              fullToken: det.full,
              value: ""
            });
          }
        });
        return next;
      });
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [prompt]);

  // Sync vars state with detected variables
  useEffect(() => {
    setVars(prev => {
      const next: Record<string, string> = {};
      detectedVariables.forEach(v => {
        next[v.fullToken] = prev[v.fullToken] || "";
      });
      return next;
    });
  }, [detectedVariables]);

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = prompt.substring(0, start) + text + prompt.substring(end);
    setPrompt(newVal);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
        textareaRef.current.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const charBefore = prompt[pos - 1];
    const isClosing = charBefore === ']' || charBefore === '}' || charBefore === ')';
    
    if (isClosing) {
      const openChar = charBefore === ']' ? '[' : charBefore === '}' ? '{' : '(';
      let startPos = pos - 2;
      while (startPos >= 0 && prompt[startPos] !== openChar) startPos--;
      
      if (startPos >= 0) {
        const fullToken = prompt.substring(startPos, pos);
        const variable = detectedVariables.find(v => v.fullToken === fullToken);
        if (variable) {
          e.preventDefault();
          const restoredText = variable.label;
          const newBody = prompt.substring(0, startPos) + restoredText + prompt.substring(pos);
          setPrompt(newBody);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              const newCursor = startPos + restoredText.length;
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursor;
              textareaRef.current.focus();
            }
          });
        }
      }
    }
  };

  const renderPromptWithTags = () => {
    const parts = prompt.split(/((?:\[[^\]]+\]|\{[^\}]+\}|\([^\)]+\)))/i);
    return parts.map((part, index) => {
      const isVar = detectedVariables.some(v => v.fullToken === part);
      if (isVar) {
        return <span key={index} className="enki-qc-var-tag-inline">{part}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const totalCost = (QC_MODELS.find(m => m.id === model)?.cost || 0) * qty;

  return (
    <div className={`enki-qc ${open ? "is-open" : ""}`}>
      {/* 70% Center Aligned Panel */}
      {open && (
        <>
          <div className="enki-qc-overlay" onClick={() => setOpen(false)} />
          <div className="enki-qc-panel-v2">
            
            {/* Header bar */}
            <div className="enki-qc-header-v2">
              <div className="enki-qc-header-left">
                <div className="enki-qc-bolt-icon">
                  <Sparkles size={16} fill="white" />
                </div>
                <span className="enki-qc-header-title">Quick Create</span>
              </div>
              <button className="enki-qc-collapse-v2" onClick={() => setOpen(false)}>
                Collapse <ChevronDown size={14} />
              </button>
            </div>

            <div className="enki-qc-content-v2">
              <div className="enki-qc-grid-v2">
                
                {/* Left Side: Inputs & Settings */}
                <div className="enki-qc-left-col">
                  {/* Prompt Section */}
                  <div className="enki-qc-section-v2">
                    <div className="enki-qc-label-mono">PROMPT</div>
                    <div className="enki-qc-input-group">
                      <div className="enki-qc-overlay-v2" ref={overlayRef}>
                        {renderPromptWithTags()}
                      </div>
                      <textarea
                        ref={textareaRef}
                        className="enki-qc-textarea-v2"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onScroll={handleScroll}
                        placeholder="[variable]"
                      />
                    </div>
                  </div>

                  {/* Smart Source Selection Section */}
                  <div className="enki-qc-section-v2">
                    <div className="enki-qc-label-mono">SOURCES</div>
                    <div className="enki-qc-source-card">
                      <div className="enki-qc-source-selector">
                        <button 
                          className={`enki-qc-source-btn ${imgMode === "upload" ? "active" : ""}`}
                          onClick={() => setImgMode("upload")}
                        >
                          <ImageIcon size={14} /> Upload Images
                        </button>
                        <button 
                          className={`enki-qc-source-btn ${imgMode === "nft" ? "active" : ""}`}
                          onClick={() => setImgMode("nft")}
                        >
                          <Wallet size={14} /> Select NFTs
                        </button>
                      </div>
                      
                      <div className="enki-qc-image-strip">
                        <button className="enki-qc-add-slot">
                          <Plus size={18} />
                        </button>
                        {[0,1,2,3].map(i => (
                          <div key={i} className="enki-qc-image-slot" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Settings Row */}
                  <div className="enki-qc-footer-row">
                    <div className="enki-qc-settings-v2">
                      <span className="enki-qc-label-mono">SETTINGS</span>
                      <div className="enki-qc-setting-pill-v2">
                        <ImageIcon size={12} opacity={0.4} />
                        <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
                          {QC_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={12} opacity={0.4} />
                      </div>
                      <div className="enki-qc-setting-pill-v2">
                        <span className="mono opacity-40 text-[10px]">RES</span>
                        <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                          {QC_RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={12} opacity={0.4} />
                      </div>
                    </div>

                    <div className="enki-qc-qty-v2">
                      <span className="enki-qc-label-mono">QTY</span>
                      <div className="enki-qc-qty-controls">
                        <button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={14} /></button>
                        <span className="mono">{qty}</span>
                        <button onClick={() => setQty(qty + 1)}><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Variables */}
                <div className="enki-qc-right-col">
                  <div className="enki-qc-vars-header-v2">
                    <div className="enki-qc-label-mono">VARIABLES ({detectedVariables.length})</div>
                    <button className="enki-qc-add-link" onClick={() => insertAtCursor("[variable]")}>+ Add</button>
                  </div>
                  
                  <div className="enki-qc-vars-scroll">
                    {detectedVariables.length === 0 ? (
                      <div className="enki-qc-empty-vars">
                        <p className="mono opacity-30 text-[11px]">Wrap text in [] () or {"{}"}</p>
                      </div>
                    ) : (
                      detectedVariables.map((v) => (
                        <div key={v.id} className="enki-qc-var-item">
                          <label className="enki-qc-var-title mono">{v.label.toUpperCase()}</label>
                          <input
                            type="text"
                            className="enki-qc-var-field"
                            value={vars[v.fullToken] || ""}
                            onChange={(e) => setVars({ ...vars, [v.fullToken]: e.target.value })}
                            placeholder={`example ${v.label}`}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <button className="enki-qc-primary-btn" onClick={() => {}}>
                Connect Wallet to Generate
              </button>
            </div>
          </div>
        </>
      )}

      {/* Pill bar — always visible */}
      {!open && (
        <div className="enki-qc-bar" onClick={() => setOpen(true)}>
          <span className="enki-qc-bar-bolt"><Sparkles size={14} /></span>
          <span className="enki-qc-label">Quick Create</span>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); router.push("/editor"); }}
              className="enki-qc-editor-btn"
              type="button"
            >
              <PenSquare size={12} />
              Prompt Editor
            </button>

            <button
              className="enki-qc-toggle-btn"
              type="button"
              aria-label="Expand"
            >
              <ChevronUp
                size={13}
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

