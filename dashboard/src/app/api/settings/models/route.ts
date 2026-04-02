export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkAuth, readSettings, writeSettings, readEnvKeys } from "@/app/lib/settings";

const DEFAULT_TESTS_MODEL = "openai/gpt-5.3-codex";
const DEFAULT_TESTS_CLAUDE_MODEL = "sonnet";
const DEFAULT_TESTS_OPENCODE_MODEL = "opencode/qwen3.6-plus-free";
const DEFAULT_DISCOVERER_API_MODEL = "openrouter/free";
const DEFAULT_DISCOVERER_CLAUDE_MODEL = "sonnet";
const DEFAULT_DISCOVERER_OPENCODE_MODEL = "opencode/qwen3.6-plus-free";

export interface ORModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  free: boolean;
  prompt_price_per_m: number; // USD per 1M tokens
  vision: boolean; // accepts image input (required for browser-use)
}

export async function GET(_req: NextRequest) {
  const keys = readEnvKeys();
  const openrouterKey = keys.OPENROUTER_API_KEY;

  let models: ORModel[] = [];
  let error = "";

  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "HTTP-Referer": "https://uwu-code.local",
          "X-Title": "uwu-code",
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        // Exclude non-chat models (media/audio/image generation)
        const NON_CHAT = /lyria|imagen|dall-e|stable-?diffusion|midjourney|flux|sora|whisper|tts|embedding|rerank/i;

        models = (data.data ?? [])
          .filter((m: { id: string; modality?: string; architecture?: { modality?: string } }) => {
            if (NON_CHAT.test(m.id)) return false;
            const modality = m.modality ?? m.architecture?.modality ?? "";
            if (modality && !modality.includes("text")) return false;
            return true;
          })
          .map((m: { id: string; name: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; modality?: string; architecture?: { modality?: string } }) => {
          const promptPrice = parseFloat(m.pricing?.prompt ?? "0");
          const completionPrice = parseFloat(m.pricing?.completion ?? "0");
          const free = promptPrice === 0 && completionPrice === 0;
          const modality = m.modality ?? m.architecture?.modality ?? "";
          const vision = modality.includes("image") || modality.includes("vision");
          return {
            id: m.id,
            name: m.name ?? m.id,
            context_length: m.context_length ?? 0,
            pricing: { prompt: m.pricing?.prompt ?? "0", completion: m.pricing?.completion ?? "0" },
            free,
            prompt_price_per_m: Math.round(promptPrice * 1_000_000 * 100) / 100,
            vision,
          };
        }).sort((a: ORModel, b: ORModel) => {
          // Free first, then by name
          if (a.free && !b.free) return -1;
          if (!a.free && b.free) return 1;
          return a.name.localeCompare(b.name);
        });
      } else {
        error = `OpenRouter API error: ${res.status}`;
      }
    } catch (e) {
      error = `Failed to fetch models: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    error = "No OpenRouter API key configured";
  }

  const settings = readSettings();
  return NextResponse.json({
    models,
    selected: {
      tests: settings.models?.tests ?? DEFAULT_TESTS_MODEL,
      tests_claude: settings.models?.tests_claude ?? DEFAULT_TESTS_CLAUDE_MODEL,
      tests_opencode: settings.models?.tests_opencode ?? settings.models?.tests ?? DEFAULT_TESTS_OPENCODE_MODEL,
      openclaw: settings.models?.openclaw ?? "openrouter/free",
      discoverer: settings.models?.discoverer ?? DEFAULT_DISCOVERER_API_MODEL,
      discoverer_api: settings.models?.discoverer_api ?? settings.models?.discoverer ?? DEFAULT_DISCOVERER_API_MODEL,
      discoverer_claude: settings.models?.discoverer_claude ?? DEFAULT_DISCOVERER_CLAUDE_MODEL,
      discoverer_opencode: settings.models?.discoverer_opencode ?? DEFAULT_DISCOVERER_OPENCODE_MODEL,
    },
    error: error || undefined,
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    tests,
    tests_claude,
    tests_opencode,
    openclaw,
    discoverer,
    discoverer_api,
    discoverer_claude,
    discoverer_opencode,
  } = await req.json() as {
    tests?: string;
    tests_claude?: string;
    tests_opencode?: string;
    openclaw?: string;
    discoverer?: string;
    discoverer_api?: string;
    discoverer_claude?: string;
    discoverer_opencode?: string;
  };
  const settings = readSettings();
  const nextDiscovererApi = discoverer_api ?? discoverer ?? settings.models?.discoverer_api ?? settings.models?.discoverer ?? DEFAULT_DISCOVERER_API_MODEL;
  writeSettings({
    ...settings,
    models: {
      tests: tests ?? settings.models?.tests ?? DEFAULT_TESTS_MODEL,
      tests_claude: tests_claude ?? settings.models?.tests_claude ?? DEFAULT_TESTS_CLAUDE_MODEL,
      tests_opencode: tests_opencode ?? settings.models?.tests_opencode ?? settings.models?.tests ?? DEFAULT_TESTS_OPENCODE_MODEL,
      openclaw: openclaw ?? settings.models?.openclaw ?? "openrouter/free",
      discoverer: nextDiscovererApi,
      discoverer_api: nextDiscovererApi,
      discoverer_claude: discoverer_claude ?? settings.models?.discoverer_claude ?? DEFAULT_DISCOVERER_CLAUDE_MODEL,
      discoverer_opencode: discoverer_opencode ?? settings.models?.discoverer_opencode ?? DEFAULT_DISCOVERER_OPENCODE_MODEL,
    },
  });
  return NextResponse.json({ ok: true });
}
