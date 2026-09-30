import Link from "next/link";
import { CircleDot, LogOut, TriangleAlert } from "lucide-react";
import { signOut } from "@/app/_lib/actions";
import { formatTime } from "@/app/_lib/format-helpers";

// Shift state is always visible: selling needs an open shift.
export default function Topbar({ profile, shift }) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 sm:px-6">
      {shift ? (
        <Link href="/shifts" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline">
          <CircleDot className="h-4 w-4" aria-hidden />
          Shift open since {formatTime(shift.opened_at)}
        </Link>
      ) : (
        <Link href="/shifts" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] hover:underline">
          <TriangleAlert className="h-4 w-4" aria-hidden />
          No shift open. Open one to start selling.
        </Link>
      )}
      <div className="flex items-center gap-3">
        <span className="text-sm">
          <span className="font-semibold">{profile.full_name || profile.email}</span>{" "}
          <span className="text-[var(--color-muted)]">({profile.role === "admin" ? "Owner" : "Staff"})</span>
        </span>
        <form action={signOut}>
          <button type="submit" className="btn btn-ghost btn-sm">
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
