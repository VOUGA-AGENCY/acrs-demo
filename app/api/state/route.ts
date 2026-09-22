import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchStateWithClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin não configurado" }, { status: 500 });
  }

  try {
    let userRole: string | null = null;
    try {
      const serverClient = await getSupabaseServerClient();
      if (serverClient) {
        const {
          data: { user },
        } = await serverClient.auth.getUser();

        if (user) {
          const { data: profileRow } = (await admin
            .from("profiles")
            .select("perfil")
            .eq("user_id", user.id)
            .maybeSingle()) as { data: { perfil?: string } | null };

          if (profileRow?.perfil) {
            userRole = profileRow.perfil;
          } else if (user.email) {
            const email = user.email.toLowerCase();
            if (email.includes("armazem")) userRole = "armazem";
            else if (email.includes("terreno")) userRole = "terreno";
            else if (email.includes("secretariado")) userRole = "secretariado";
            else userRole = "admin";
          }
        }
      }
    } catch (authErr) {
      console.warn("Aviso ao determinar perfil do utilizador em /api/state:", authErr);
    }

    const state = await fetchStateWithClient(admin);
    if (!state) {
      return NextResponse.json({ error: "Falha ao obter dados da base de dados" }, { status: 502 });
    }

    // Proteger orçamentos confidenciais se o utilizador for de armazém, terreno ou secretariado (RLS enforcement)
    if (userRole === "armazem" || userRole === "terreno" || userRole === "secretariado") {
      state.budgets = [];
    }

    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Erro na rota /api/state:", error);
    return NextResponse.json({ error: error?.message || "Erro interno" }, { status: 500 });
  }
}
