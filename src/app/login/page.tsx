import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithEmail } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const sent = sp.sent === "1";
  const email = typeof sp.email === "string" ? sp.email : "";
  const error = typeof sp.error === "string" ? sp.error : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-md items-center px-4">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll email you a magic link. No passwords.
          </p>
        </div>

        {sent ? (
          <div className="rounded-md border bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            Check <span className="font-mono">{email}</span> for a link. It expires in 15 minutes.
          </div>
        ) : (
          <form action={signInWithEmail} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <Input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
            <Button type="submit" className="w-full">
              Email me a link
            </Button>
            {error ? (
              <p className="text-sm text-destructive">
                {error === "invalid_email"
                  ? "That doesn't look like a valid email."
                  : "Couldn't send the link. Try again in a moment."}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
