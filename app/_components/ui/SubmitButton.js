"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";
import Spinner from "@/app/_components/ui/Spinner";

// A submit button that says it is working and cannot be pressed twice.
export default function SubmitButton({ children, pendingLabel = "Saving...", className = "btn-primary", pending: forced, ...props }) {
  const { pending: formPending } = useFormStatus();
  const pending = forced ?? formPending;
  return (
    <button type="submit" disabled={pending || props.disabled} className={clsx("btn", className)} {...props}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
