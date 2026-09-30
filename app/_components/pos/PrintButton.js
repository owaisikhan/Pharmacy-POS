"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden /> Print
    </button>
  );
}
