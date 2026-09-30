import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import AuthCard from "@/app/_components/auth/AuthCard";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/app/_lib/supabase-env";

export const metadata = { title: "Connect the database" };

export default async function SetupPage() {
  await connection();
  if (isSupabaseConfigured()) redirect("/");
  return (
    <AuthCard title="Connect the database" description="This copy of the app has no database yet.">
      <div className="flex gap-3 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
        <div className="space-y-2">
          <p>
            Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in the environment, then restart the app.
          </p>
          <p className="text-[var(--color-muted)]">The steps are in the README under &quot;Setting up&quot;.</p>
        </div>
      </div>
    </AuthCard>
  );
}
