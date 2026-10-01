import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchStateWithClient } from "@/lib/supabase/service";
import type { State } from "@/types/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // 1. NEGAR POR DEFEITO: Exigir sessão autenticada ativa
  const serverClient = await getSupabaseServerClient();
  if (!serverClient) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 });
  }

  // 2. Obter perfil real do utilizador a partir da base de dados
  const { data: profileRow } = (await admin
    .from("profiles")
    .select("perfil, email, nome")
    .eq("user_id", user.id)
    .maybeSingle()) as { data: { perfil?: string; email?: string; nome?: string } | null };

  const role = profileRow?.perfil;
  const validRoles = ["admin", "secretariado", "armazem", "terreno"];

  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Acesso não autorizado para o perfil atual" }, { status: 403 });
  }

  try {
    const rawState = await fetchStateWithClient(admin);
    if (!rawState) {
      return NextResponse.json({ error: "Falha ao carregar estado do sistema" }, { status: 502 });
    }

    // 3. FILTRAGEM ESTRITA DE DADOS POR PERFIL (ALLOWLIST DE CAMPOS)
    let filteredState: State = { ...rawState };

    if (role === "admin") {
      // Admin tem acesso integral a todos os dados financeiros e operacionais
      filteredState = rawState;
    } else if (role === "secretariado") {
      // Secretariado gere faturas, ponto e obras operacionais
      // Ocultar orçamentos e margens alvo confidenciais
      filteredState = {
        ...rawState,
        budgets: [],
        settings: {
          ...rawState.settings,
          valoresInternos: {},
        },
      };
    } else if (role === "armazem") {
      // Armazém foca em artigos, máquinas, alocações e compras para stock
      // Ocultar orçamentos, tarifas de colaboradores e despesas financeiras diretas
      filteredState = {
        ...rawState,
        budgets: [],
        people: rawState.people.map((p) => ({
          ...p,
          custoHora: null, // Censurar salários/taxas horárias
        })),
        invoices: rawState.invoices.filter((i) => i.tipo === "Compra para stock"),
        settings: {
          ...rawState.settings,
          valoresInternos: {},
          policy: {
            ...rawState.settings.policy,
            extra: 0,
            noturno: 0,
          },
        },
      };
    } else if (role === "terreno") {
      // Terreno submete faturas da sua própria obra e consulta disponibilidade básica
      // Ocultar orçamentos, dados financeiros globais e outros colaboradores
      const userEmail = (profileRow?.email || user.email || "").toLowerCase();
      filteredState = {
        ...rawState,
        budgets: [],
        people: rawState.people.map((p) => ({
          ...p,
          custoHora: null,
        })),
        invoices: rawState.invoices.filter(
          (i) => i.utilizador?.toLowerCase() === userEmail,
        ),
        manualCosts: [],
        settings: {
          minimos: {},
          valoresInternos: {},
          policy: rawState.settings.policy,
          personPolicies: {},
          companyPolicies: {},
          holidays: rawState.settings.holidays,
        },
      };
    }

    return NextResponse.json(filteredState, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Nunca devolver stack traces ou mensagens internas não sanitizadas
    console.error("Erro interno ao processar /api/state:", error);
    return NextResponse.json({ error: "Erro interno ao processar pedido" }, { status: 500 });
  }
}
