import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">That page or record does not exist.</p>
        <Link href="/" className="btn btn-primary mt-4">Go to the dashboard</Link>
      </div>
    </div>
  );
}
