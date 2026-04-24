import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <MapPin className="h-5 w-5 text-primary" />
          <span>Rentmap</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            · Bangalore
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/favorites">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Favorites</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
