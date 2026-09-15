"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Ligação à base de dados não configurada.");
      }

      // Autenticação direta com o Supabase Auth (base de dados real)
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Email ou palavra-passe incorretos.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // Sincronizar cookies no servidor
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      // Redirecionar para a plataforma
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "Erro de ligação ao servidor. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card-wrapper">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-logo">
            <img src="/acrslogo.png" alt="ACRS Metal Solutions" />
          </div>
          <h1>Plataforma Operacional</h1>
          <p>Autentique-se com a sua conta para aceder.</p>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="utilizador@acrs.pt"
              autoComplete="email"
              required
              autoFocus
            />
          </label>

          <label>
            <span>Palavra-passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="button login-btn" disabled={loading}>
            {loading ? "A autenticar na base de dados…" : "Entrar"}
          </button>

          <div className="login-footer">
            <small>ACRS Metal Solutions · Acesso Restrito por Perfil</small>
          </div>
        </form>
      </div>
    </div>
  );
}
