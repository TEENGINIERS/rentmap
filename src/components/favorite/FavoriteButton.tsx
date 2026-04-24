"use client";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  listingId: string;
  initialFavorited: boolean;
  isSignedIn: boolean;
}

export function FavoriteButton({ listingId, initialFavorited, isSignedIn }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [, start] = useTransition();

  const handleClick = () => {
    if (!isSignedIn) {
      toast("Sign in to save", {
        action: {
          label: "Sign in",
          onClick: () => {
            window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          },
        },
      });
      return;
    }
    const next = !favorited;
    setFavorited(next);
    start(async () => {
      const res = await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (!res.ok) {
        setFavorited(!next);
        toast.error("Couldn't save — try again");
      }
    });
  };

  return (
    <Button
      variant={favorited ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
      {favorited ? "Saved" : "Save"}
    </Button>
  );
}
