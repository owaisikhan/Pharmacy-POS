import { NextResponse } from "next/server";
import { actionSession } from "@/app/_lib/helpers";
import { searchCustomers } from "@/app/_lib/data-service";

export async function GET(request) {
  const s = await actionSession();
  if (s.error) return NextResponse.json({ error: s.error }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q") || "";
  try {
    const results = await searchCustomers(q, 8);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
