import { getSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e palavra-passe são obrigatórios." },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Serviço de autenticação indisponível." },
      { status: 503 },
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: "Email ou palavra-passe incorretos." },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true });
}
