import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type VariableSummary = {
  id: string;
  name: string;
  label: string;
  type: string;
  position: number;
};

type PromptListItem = {
  id: string;
  _id: string;
  title: string;
  type: string;
  isFree: boolean;
  isFreeShowcase: boolean;
  price: number;
  category?: string;
  tags?: string[];
  aiModel?: string;
  createdAt?: string;
  downloads: number;
  rating: number;
  creatorId?: string;
  thumbnail: string;
  imageUrl: string;
  publicPromptText?: string;
  variables: VariableSummary[];
};

const FREE_TYPES = new Set(["showcase", "free", "free-prompt"]);

function deriveThumbnail(uploadedPhotos: unknown): string {
  if (Array.isArray(uploadedPhotos) && typeof uploadedPhotos[0] === "string") {
    return uploadedPhotos[0] as string;
  }
  return "";
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️  Supabase not configured - returning empty prompts list");
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "12", 10) || 12, 1),
      50
    );
    const offset = parseInt(searchParams.get("cursor") || "0", 10) || 0;

    const supabase = getSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("prompts")
      .select(
        "id,title,prompt_type,is_free_showcase,public_prompt_text,price,category,tags,ai_model,created_at,downloads,rating,user_id,uploaded_photos"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Supabase prompts list error:", error);
      throw error;
    }

    const promptRows = Array.isArray(rows) ? rows : [];
    const promptIds = promptRows.map((p) => String(p.id));

    let variablesByPrompt = new Map<string, VariableSummary[]>();
    if (promptIds.length > 0) {
      const { data: vars, error: varsError } = await supabase
        .from("variables")
        .select("id,prompt_id,name,label,type,position")
        .in("prompt_id", promptIds)
        .order("position", { ascending: true });

      if (varsError) {
        console.warn("Supabase variables fetch error (non-fatal):", varsError);
      } else if (Array.isArray(vars)) {
        for (const v of vars) {
          const key = String(v.prompt_id);
          const list = variablesByPrompt.get(key) ?? [];
          list.push({
            id: String(v.id ?? ""),
            name: String(v.name ?? ""),
            label: String(v.label ?? v.name ?? ""),
            type: String(v.type ?? "text"),
            position: typeof v.position === "number" ? v.position : 0,
          });
          variablesByPrompt.set(key, list);
        }
      }
    }

    const items: PromptListItem[] = promptRows.map((p) => {
      const promptType = String(p.prompt_type ?? "");
      const isFreeShowcase = Boolean(p.is_free_showcase ?? false);
      const isFree = FREE_TYPES.has(promptType) || isFreeShowcase;
      const thumb = deriveThumbnail(p.uploaded_photos);
      const id = String(p.id ?? "");

      return {
        id,
        _id: id,
        title: String(p.title ?? ""),
        type: promptType,
        isFree,
        isFreeShowcase,
        price: typeof p.price === "number" ? p.price : 0,
        category: typeof p.category === "string" ? p.category : undefined,
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : undefined,
        aiModel: typeof p.ai_model === "string" ? p.ai_model : undefined,
        createdAt: typeof p.created_at === "string" ? p.created_at : undefined,
        downloads: typeof p.downloads === "number" ? p.downloads : 0,
        rating: typeof p.rating === "number" ? p.rating : 0,
        creatorId: p.user_id ? String(p.user_id) : undefined,
        thumbnail: thumb,
        imageUrl: thumb,
        publicPromptText:
          isFree && typeof p.public_prompt_text === "string"
            ? p.public_prompt_text
            : undefined,
        variables: variablesByPrompt.get(id) ?? [],
      };
    });

    const nextCursor =
      items.length === limit ? String(offset + limit) : null;

    return NextResponse.json({ items, nextCursor });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Error in /api/prompts:", message);
    return NextResponse.json({ items: [], nextCursor: null }, { status: 200 });
  }
}
