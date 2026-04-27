import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, type Content } from "@google/genai";
import {
  TOOL_DECLARATIONS,
  executeTool,
  emptySideEffects,
  mergeSideEffects,
} from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import type { ListingCardDTO } from "@/lib/db/queries/listings";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash";
const MAX_TOOL_LOOPS = 8;

interface ChatRequestBody {
  message?: string;
  history?: Content[];
}

export interface ChatResponseBody {
  message: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  listings: ListingCardDTO[];
  focus: { lat: number; lng: number; zoom?: number } | null;
  pois: Array<{ name: string; lat: number; lng: number; category: string }>;
  history: Content[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY missing on server" },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents: Content[] = [
    ...(body.history ?? []),
    { role: "user", parts: [{ text: message }] },
  ];

  const effects = emptySideEffects();
  const toolCallsLog: ChatResponseBody["toolCalls"] = [];

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    let response;
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          temperature: 0.4,
        },
      });
    } catch (e) {
      const err = e as Error;
      return NextResponse.json(
        { error: `gemini call failed: ${err.message}` },
        { status: 502 },
      );
    }

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    if (parts.length > 0) {
      contents.push({ role: "model", parts });
    }

    const functionCalls = response.functionCalls ?? [];

    if (functionCalls.length === 0) {
      const text = response.text ?? "";
      const payload: ChatResponseBody = {
        message: text,
        toolCalls: toolCallsLog,
        listings: effects.listings,
        focus: effects.focus,
        pois: effects.pois,
        history: contents,
      };
      return NextResponse.json(payload);
    }

    // Execute each function call in parallel.
    const executions = await Promise.all(
      functionCalls.map(async (call) => {
        const name = call.name ?? "";
        const args = (call.args ?? {}) as Record<string, unknown>;
        toolCallsLog.push({ name, args });
        const { result, effects: e } = await executeTool(name, args);
        return { name, result, effects: e };
      }),
    );

    for (const ex of executions) mergeSideEffects(effects, ex.effects);

    contents.push({
      role: "user",
      parts: executions.map((ex) => ({
        functionResponse: {
          name: ex.name,
          response: ex.result as Record<string, unknown>,
        },
      })),
    });
  }

  return NextResponse.json({
    message:
      "I ran out of steps trying to answer that. Try a simpler or more specific question?",
    toolCalls: toolCallsLog,
    listings: effects.listings,
    focus: effects.focus,
    pois: effects.pois,
    history: contents,
  } satisfies ChatResponseBody);
}
