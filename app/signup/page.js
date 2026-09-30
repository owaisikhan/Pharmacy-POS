import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/app/_components/auth/AuthCard";
import SignupForm from "@/app/_components/auth/SignupForm";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/app/_lib/supabase-env";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  return (
    <AuthCard
      title="Create an account"
      description="The first account becomes the owner. Staff accounts start switched off until the owner turns them on in Settings."
      footer={
        <>
          Already have an account? <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:underline">Sign in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
