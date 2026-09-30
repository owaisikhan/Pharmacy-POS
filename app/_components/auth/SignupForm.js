"use client";

import { useActionState } from "react";
import { signUp } from "@/app/_lib/actions";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";

export default function SignupForm() {
  const [state, action] = useActionState(signUp, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="full_name" className="label">Your name</label>
        <input id="full_name" name="full_name" required className="field" autoComplete="name" defaultValue={state?.full_name} placeholder="e.g. Bilal Ahmed" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" defaultValue={state?.email} placeholder="e.g. bilal@pharmacy.pk" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="field" autoComplete="new-password" />
        <p className="hint">At least 8 characters.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Creating account..." className="btn-primary w-full">Create account</SubmitButton>
    </form>
  );
}
