import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchStateWithClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin não configurado" }, { status: 500 });
  }

  try {
    const state = await fetchStateWithClient(admin);
    if (!state) {
      return NextResponse.json({ error: "Falha ao obter dados da base de dados" }, { status: 502 });
    }
    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
      },
    });
  } catch (error: any) {
    console.error("Erro na rota /api/state:", error);
    return NextResponse.json({ error: error?.message || "Erro interno" }, { status: 500 });
  }
}
