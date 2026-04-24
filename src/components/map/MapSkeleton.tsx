export function MapSkeleton() {
  return (
    <div className="h-full w-full animate-pulse bg-muted">
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        Loading map…
      </div>
    </div>
  );
}
