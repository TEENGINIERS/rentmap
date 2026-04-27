"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Sparkles } from "lucide-react";
import type { Content } from "@google/genai";
import { ToolBadge } from "./ToolBadge";
import { useListingsStore } from "@/lib/store/listings-store";
import type { ChatResponseBody } from "@/app/api/chat/route";
import { cn } from "@/lib/utils";

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      toolCalls: ChatResponseBody["toolCalls"];
      pending?: boolean;
    };

const SUGGESTIONS = [
  "2BHK in Whitefield under ₹40k",
  "1BHK near Koramangala fully furnished",
  "Owner-only listings in HSR Layout",
  "Cheapest 2BHK within 5km of Indiranagar",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<Content[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setChatListings = useListingsStore((s) => s.setChatListings);
  const setFocus = useListingsStore((s) => s.setFocus);
  const setPois = useListingsStore((s) => s.setPois);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed },
      { role: "assistant", text: "", toolCalls: [], pending: true },
    ]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `http ${res.status}`);
      }
      const data = (await res.json()) as ChatResponseBody;

      setHistory(data.history);
      if (data.listings.length > 0) setChatListings(data.listings);
      if (data.focus) setFocus(data.focus);
      if (data.pois.length > 0) setPois(data.pois);

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: data.message || "(no response)",
          toolCalls: data.toolCalls,
        };
        return next;
      });
    } catch (e) {
      const err = e as Error;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: `Sorry, something went wrong: ${err.message}`,
          toolCalls: [],
        };
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur">
      {/* Scrollable message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState onPick={(s) => send(s)} />
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        className="flex items-end gap-2 border-t border-zinc-200 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="2BHK in Indiranagar within 5km of my office…"
          rows={1}
          className="min-h-[40px] max-h-32 flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-0"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition disabled:bg-zinc-300",
            !pending && "hover:bg-emerald-700",
          )}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
        <Sparkles className="h-6 w-6 text-emerald-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-800">
          Find your next Bangalore flat
        </h2>
        <p className="text-sm text-zinc-500">
          Ask in plain English. Filters, distances, and amenities — all just
          work.
        </p>
      </div>
      <div className="mt-2 grid w-full gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-3.5 py-2 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="space-y-2">
      {message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.toolCalls.map((tc, i) => (
            <ToolBadge key={i} name={tc.name} />
          ))}
        </div>
      )}
      {message.pending ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Thinking…
        </div>
      ) : (
        <div className="prose prose-sm prose-zinc max-w-none break-words text-sm text-zinc-800 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_a]:text-emerald-700 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_hr]:my-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
