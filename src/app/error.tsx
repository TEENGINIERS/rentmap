"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container mx-auto flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={reset} variant="outline">Try again</Button>
        <Button asChild><Link href="/">Back to map</Link></Button>
      </div>
    </div>
  );
}
