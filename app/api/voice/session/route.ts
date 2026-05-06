import { NextResponse } from "next/server";

import { getAllPages } from "@/lib/docs";
import { getPageMarkdown } from "@/lib/markdown";
import { siteConfig } from "@/site.config";

export const runtime = "nodejs";

type VoicePreset = "female" | "male";

export async function POST(request: Request) {
  if (!isVoiceEnabled()) {
    return NextResponse.json(
      { error: "Voice assistant is disabled." },
      { status: 404 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for voice chat." },
      { status: 503 },
    );
  }

  const voicePreset = await parseVoicePreset(request);
  const voice = voiceForPreset(voicePreset);

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model:
          process.env.OPENAI_REALTIME_MODEL ||
          siteConfig.voiceAssistant.defaultModel,
        instructions: buildVoiceInstructions(),
        audio: {
          input: {
            transcription: {
              model:
                process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ||
                "gpt-4o-transcribe",
              language: "en",
            },
          },
          output: {
            voice,
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    return NextResponse.json(
      { error: "Could not create a Realtime client secret." },
      { status: 502 },
    );
  }

  const value =
    typeof payload.value === "string"
      ? payload.value
      : payload.client_secret?.value;

  if (typeof value !== "string") {
    return NextResponse.json(
      { error: "Realtime client secret response was missing a value." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      expiresAt: payload.expires_at ?? payload.client_secret?.expires_at,
      value,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function parseVoicePreset(request: Request): Promise<VoicePreset> {
  const payload = await request.json().catch(() => null);

  if (
    payload &&
    typeof payload === "object" &&
    "voicePreset" in payload &&
    payload.voicePreset === "male"
  ) {
    return "male";
  }

  return "female";
}

function voiceForPreset(preset: VoicePreset): string {
  const configuredVoice =
    preset === "male"
      ? process.env.OPENAI_REALTIME_VOICE_MALE ||
        siteConfig.voiceAssistant.voices.male
      : process.env.OPENAI_REALTIME_VOICE_FEMALE ||
        siteConfig.voiceAssistant.voices.female;

  return (
    sanitizeVoice(configuredVoice) ||
    sanitizeVoice(process.env.OPENAI_REALTIME_VOICE) ||
    "marin"
  );
}

function sanitizeVoice(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{2,64}$/.test(value)) {
    return "";
  }

  return value;
}

function isVoiceEnabled() {
  return (
    process.env.DOCS_VOICE_ASSISTANT_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_DOCS_VOICE_ASSISTANT === "true"
  );
}

function buildVoiceInstructions() {
  const docsContext = getAllPages()
    .map((page) => getPageMarkdown(page))
    .join("\n\n---\n\n");

  return `You are the voice documentation assistant for ${siteConfig.name}.

Answer with concise, spoken explanations grounded in these docs. If you are not sure, say the docs do not include enough detail and suggest using the text chat or search for cited page links.

Full docs context:
${docsContext}`;
}
