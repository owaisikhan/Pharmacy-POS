"use client";

import { Printer } from "lucide-react";
import { printReceipt } from "@/app/_components/pos/print-receipt";

export default function ReprintButton({ saleId }) {
  return (
    <button type="button" className="btn btn-primary" onClick={() => printReceipt(saleId)}>
      <Printer className="h-4 w-4" aria-hidden /> Print receipt
    </button>
  );
}
