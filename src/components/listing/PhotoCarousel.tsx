"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PhotoCarousel({ photos, alt }: { photos: Array<{ url: string; alt: string }>; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
        No photos
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[idx]!.url}
          alt={photos[idx]?.alt || alt}
          className="h-full w-full object-cover"
        />
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                "relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 transition",
                i === idx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
              aria-label={`Photo ${i + 1} of ${photos.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
