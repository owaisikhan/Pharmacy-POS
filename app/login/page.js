import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/app/_components/auth/AuthCard";
import LoginForm from "@/app/_components/auth/LoginForm";
import { getSession } from "@/app/_lib/helpers";
import { isSupabaseConfigured } from "@/app/_lib/supabase-env";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const { user } = await getSession();
  if (!isSupabaseConfigured()) redirect("/setup");
  if (user) redirect("/");
  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password the owner set up for you."
      footer={
        <>
          New here? <Link href="/signup" className="font-semibold text-[var(--color-primary)] hover:underline">Create an account</Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
