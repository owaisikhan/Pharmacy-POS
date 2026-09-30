"use client";

import { useActionState } from "react";
import { signIn } from "@/app/_lib/actions";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";

export default function LoginForm() {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" defaultValue={state?.email} placeholder="e.g. counter@pharmacy.pk" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Signing in..." className="btn-primary w-full">Sign in</SubmitButton>
    </form>
  );
}
