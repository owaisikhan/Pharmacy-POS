import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/app/_lib/supabase-server";
import { isSupabaseConfigured } from "@/app/_lib/supabase-env";

// Who is signed in, read once per request.
export const getSession = cache(async () => {
  // Always per request: whether someone is signed in is never static, even
  // on a build made before the database env was set.
  await connection();
  if (!isSupabaseConfigured()) return { user: null, profile: null, supabase: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, profile, supabase };
});

export async function requireUser() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!session.profile?.active) redirect("/pending");
  return { ...session, isAdmin: session.profile.role === "admin" };
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!session.isAdmin) redirect("/?denied=1");
  return session;
}

// For Server Actions: never redirect mid-action, return a message instead.
export async function actionSession({ admin = false } = {}) {
  if (!isSupabaseConfigured()) return { error: "The database is not connected yet." };
  const session = await getSession();
  if (!session.user) return { error: "Your session has ended. Sign in again." };
  if (!session.profile?.active) return { error: "Your account is not active yet. Ask the owner to activate it." };
  const isAdmin = session.profile.role === "admin";
  if (admin && !isAdmin) return { error: "Only the owner (admin) can do this." };
  return { ...session, isAdmin };
}
