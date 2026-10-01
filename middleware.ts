import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. FAIL-CLOSED: Se variáveis de ambiente essenciais faltarem, bloquear imediatamente
  if (!url || !anonKey) {
    console.error("ERRO CRÍTICO DE SEGURANÇA: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY em falta.");
    return new NextResponse(
      JSON.stringify({ error: "Erro de configuração de segurança no servidor." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  // 2. INJETAR CABEÇALHOS DE SEGURANÇA DE PRODUÇÃO
  const securityHeaders = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
    ].join("; "),
  };

  for (const [key, value] of Object.entries(securityHeaders)) {
    supabaseResponse.headers.set(key, value);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        for (const [key, value] of Object.entries(securityHeaders)) {
          supabaseResponse.headers.set(key, value);
        }
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // 3. Rotas públicas permitidas sem sessão (Login e Auth)
  if (path.startsWith("/login") || path.startsWith("/api/auth")) {
    // Se o utilizador já tem sessão e tenta aceder ao /login, redirecionar para a página principal
    if (user && path.startsWith("/login")) {
      const redirectUrl = new URL("/", request.url);
      const res = NextResponse.redirect(redirectUrl);
      for (const [key, value] of Object.entries(securityHeaders)) {
        res.headers.set(key, value);
      }
      return res;
    }
    return supabaseResponse;
  }

  // 4. Sem utilizador autenticado: Bloquear acesso (401 para APIs, redirect para páginas)
  if (!user) {
    if (path.startsWith("/api")) {
      const res = NextResponse.json(
        { error: "Acesso não autorizado. Inicie sessão." },
        { status: 401 },
      );
      for (const [key, value] of Object.entries(securityHeaders)) {
        res.headers.set(key, value);
      }
      return res;
    }
    const loginUrl = new URL("/login", request.url);
    const res = NextResponse.redirect(loginUrl);
    for (const [key, value] of Object.entries(securityHeaders)) {
      res.headers.set(key, value);
    }
    return res;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico)$).*)",
  ],
};

export default middleware;
