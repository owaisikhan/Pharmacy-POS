"use client";

import { CircleAlert } from "lucide-react";

export default function Error({ error, reset }) {
  return (
    <div className="grid place-items-center px-4 py-16">
      <div className="card max-w-md p-6 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-[var(--color-danger)]" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">This page could not load</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{error?.message?.startsWith("Could not load") ? error.message : "Check the internet connection, then try again."}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
