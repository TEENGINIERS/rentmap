import { cn } from "@/lib/utils";

const ICON: Record<string, string> = {
  fuzzy_search: "↳",
  geocode: "↳",
  find_area: "↳",
  distance_matrix: "↳",
  nearby_places: "↳",
};

export function ToolBadge({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600",
      )}
      title={`tool: ${name}`}
    >
      <span aria-hidden className="text-zinc-400">
        {ICON[name] ?? "↳"}
      </span>
      {name}
    </span>
  );
}
