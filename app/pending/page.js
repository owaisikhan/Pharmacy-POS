import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import AuthCard from "@/app/_components/auth/AuthCard";
import { getSession } from "@/app/_lib/helpers";
import { signOut } from "@/app/_lib/actions";

export const metadata = { title: "Waiting for approval" };

export default async function PendingPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (profile?.active) redirect("/");
  return (
    <AuthCard title="Waiting for the owner" description={`Signed in as ${user.email}.`}>
      <div className="flex gap-3 rounded-lg bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="font-medium">
          Your account is created but switched off. Ask the owner to open Settings, find your name under Staff and switch it on. Then
          refresh this page.
        </p>
      </div>
      <form action={signOut} className="mt-4">
        <button type="submit" className="btn btn-secondary w-full">Sign out</button>
      </form>
    </AuthCard>
  );
}
