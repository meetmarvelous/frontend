import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { encryptPrompt } from "@/backend/encryption";

const SEED_PROMPT_TITLE = "Monumental Marble Statue";

const SEED_PROMPT_BODY = `Low-angle hero shot of a monumental marble statue depicting the full-body [subject], frozen in the exact pose that most powerfully and dynamically embodies their signature essence and defining characteristics, every sculpted gesture amplifying their inherent nature, weight distribution and body tension reflecting their core identity, drapery and anatomical emphasis directed toward their most iconic features, elevated upon a grand plinth whose material and form harmonize with the subject's aesthetic, the sculpture's surface exhibiting masterful chiaroscuro through micro-carved veining and translucent flesh tones where light penetrates the stone's crystalline structure, enshrined within a palatial hall whose architecture, color palette, and atmospheric mood emerge organically from the statue's emotional resonance and visual identity—columns and vaults echoing the subject's energy, ambient hues shifting to complement their presence, decorative motifs reflecting their symbolic nature—close-ups revealing the almost-living texture of carved details and the tension in sculpted forms that define the subject's silhouette, reflections dancing across the polished floor that mirrors the scene in materials befitting the space, the atmosphere charged with [mood], cinematic aesthetic blending classical mastery with the subject's inherent visual language, [lighting] volumetric lighting sculpted to dramatic effect through the architecture, subtle film grain, sumptuous interplay of stone and environment unified in singular artistic vision.`;

const REFERENCE_IMAGE_URL =
  "https://images.unsplash.com/photo-1544967082-d9d25d867d66?auto=format&fit=crop&q=80&w=1200";

const SEED_VARIABLES = [
  {
    name: "subject",
    label: "Subject",
    description: "Upload a reference image of the person or figure to sculpt",
    type: "image",
    defaultValue: REFERENCE_IMAGE_URL,
    required: true,
    position: 0,
  },
  {
    name: "mood",
    label: "Mood",
    description: "Emotional atmosphere of the scene",
    type: "text",
    defaultValue: "timeless reverence",
    required: false,
    position: 1,
  },
  {
    name: "lighting",
    label: "Lighting",
    description: "Lighting style description",
    type: "text",
    defaultValue: "2.39:1 anamorphic framing, shallow depth of field (f/1.4 on 85mm),",
    required: false,
    position: 2,
  },
];

export async function POST() {
  try {
    const supabase = getSupabaseServerClient();

    // Idempotent: skip if prompt with this title already exists
    const { data: existing } = await supabase
      .from("prompts")
      .select("id")
      .eq("title", SEED_PROMPT_TITLE)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Seed prompt already exists",
        id: existing.id,
        seeded: false,
      });
    }

    const encrypted = encryptPrompt(SEED_PROMPT_BODY);
    const nowIso = new Date().toISOString();

    const promptRow = {
      title: SEED_PROMPT_TITLE,
      encrypted_content: encrypted.encryptedContent,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      user_id: null,
      category: "Cinematic",
      tags: ["cinematic", "sculpture", "marble", "editorial", "statue"],
      ai_model: "gemini-2.5-flash-image",
      price: 0,
      aspect_ratio: "2.39:1",
      photo_count: 1,
      prompt_type: "free-prompt",
      uploaded_photos: [REFERENCE_IMAGE_URL],
      resolution: "2K",
      is_free_showcase: true,
      public_prompt_text: SEED_PROMPT_BODY,
      created_at: nowIso,
      updated_at: nowIso,
      downloads: 0,
      rating: 0,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("prompts")
      .insert(promptRow)
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error("Failed to insert seed prompt");
    }

    const promptId = String(inserted.id);

    if (SEED_VARIABLES.length > 0) {
      const variableRows = SEED_VARIABLES.map((v) => ({
        prompt_id: promptId,
        name: v.name,
        label: v.label,
        description: v.description,
        type: v.type,
        default_value: v.defaultValue,
        required: v.required,
        position: v.position,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: varsError } = await supabase
        .from("variables")
        .insert(variableRows);

      if (varsError) {
        console.error("Seed variable insert error:", varsError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Seed prompt created",
      id: promptId,
      seeded: true,
      title: SEED_PROMPT_TITLE,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Seed error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
