import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold">Not found</h1>
      <p className="mt-2 text-muted-foreground">That page doesn&apos;t exist or was removed.</p>
      <Button asChild className="mt-4">
        <Link href="/">Back to map</Link>
      </Button>
    </div>
  );
}
