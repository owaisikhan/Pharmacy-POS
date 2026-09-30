import { NextResponse } from "next/server";
import { actionSession } from "@/app/_lib/helpers";
import { searchSellable } from "@/app/_lib/data-service";

// Search for the sale screen: a barcode scanner types the code and presses
// Enter, so an exact barcode match comes back on its own.
export async function GET(request) {
  const s = await actionSession();
  if (s.error) return NextResponse.json({ error: s.error }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q") || "";
  try {
    const results = await searchSellable(q, 12);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
