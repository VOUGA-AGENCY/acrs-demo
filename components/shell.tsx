"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Package,
  ArrowLeftRight,
  Wrench,
  ReceiptText,
  Clock3,
  Users,
  Factory,
  Calculator,
  ChartNoAxesCombined,
  Settings2,
  ChevronRight,
} from "lucide-react";
import { LogOut } from "lucide-react";
import { useStore } from "./store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const links = [
  ["Dashboard", "/", LayoutDashboard],
  ["Obras", "/obras", Building2],
  ["Armazém", "/armazem", Package],
  ["Recursos", "/armazem/recursos", Package],
  ["Movimentos", "/armazem/movimentos", ArrowLeftRight],
  ["Tablet", "/armazem/tablet", Wrench],
  ["Faturas & Compras", "/faturas", ReceiptText],
  ["Pessoas", "group", Users],
  ["Ponto", "/pessoas/ponto", Clock3],
  ["Colaboradores", "/pessoas/colaboradores", Users],
  ["Empresas", "/pessoas/empresas", Factory],
  ["Orçamentos", "/orcamentos", Calculator],
  ["Controlo", "/controlo", ChartNoAxesCombined],
  ["Configuração", "/configuracao", Settings2],
] as const;

export function ProfileSelector() {
  const { profile, authUser } = useStore();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Redirecionar sempre mesmo em caso de erro
    } finally {
      window.location.href = "/login";
    }
  }

  const roleLabel =
    authUser?.perfil === "admin" || profile === "João Catalão"
      ? "Administrador"
      : authUser?.perfil === "secretariado" || profile === "Vítor"
        ? "Secretariado"
        : authUser?.perfil === "armazem" || profile === "Armazém"
          ? "Armazém"
          : "Operações Campo";

  const avatarText =
    profile === "João Catalão"
      ? "JC"
      : profile === "Vítor"
        ? "VI"
        : profile === "Armazém"
          ? "AR"
          : profile === "Campo"
            ? "CA"
            : "GE";

  return (
    <div className="profile-picker" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div className="avatar">{avatarText}</div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
          {authUser?.nome || profile}
        </span>
        <span style={{ fontSize: "10px", color: "var(--muted)" }}>{roleLabel}</span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="logout-btn"
        disabled={loggingOut}
        title="Terminar sessão"
        aria-label="Terminar sessão"
      >
        <LogOut size={13} />
        <span>{loggingOut ? "A sair…" : "Sair"}</span>
      </button>
    </div>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <img src="/acrslogo.png" alt="ACRS Metal Solutions" />
    </div>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { profile, state, authUser } = useStore();
  const router = useRouter();
  const simplified =
    path.startsWith("/armazem/tablet") ||
    profile === "Campo" ||
    profile === "Armazém" ||
    path === "/campo";
  useEffect(() => {
    if (profile === "Campo" && path !== "/campo") router.replace("/campo");
    if (profile === "Armazém" && !path.startsWith("/armazem/tablet"))
      router.replace("/armazem/tablet");
  }, [profile, path, router]);
  if (simplified)
    return (
      <div className="simple-shell">
        <header>
          <Link href="/" className="brand-link" aria-label="Ir para o dashboard">
            <Brand />
          </Link>
          <span className="simple-label">
            {profile === "Campo" ? "Campo" : "Armazém"}
          </span>
          <ProfileSelector />
        </header>
        {children}
      </div>
    );
  const parts = path.split("/").filter(Boolean);
  const title =
    links.find((l) => l[1] === path)?.[0] ??
    (parts[0] === "obras" ? "Detalhe da obra" : "Operação");
  const visible =
    profile === "Vítor"
      ? new Set([
          "Dashboard",
          "Obras",
          "Armazém",
          "Visão geral",
          "Recursos",
          "Movimentos",
          "Tablet",
        ])
      : profile === "Gerência"
        ? new Set(["Dashboard", "Obras", "Controlo"])
        : null;
  const categoryClass = (label: string) =>
    ["Armazém", "Recursos", "Movimentos", "Tablet"].includes(label)
      ? "nav-warehouse"
      : ["Pessoas", "Ponto", "Colaboradores", "Empresas"].includes(label)
        ? "nav-people"
        : ["Faturas & Compras", "Orçamentos", "Controlo", "Configuração"].includes(label)
          ? "nav-management"
          : "nav-operation";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand-link">
          <Brand />
        </Link>
        <div className="workspace-label">PLATAFORMA OPERACIONAL</div>
        <nav>
          {links.filter(([label]) => !visible || visible.has(label)).map(([label, url, Icon]) =>
            url === "group" ? (
              <div className={`nav-group ${categoryClass(label)}`} key={label}>
                <Icon size={17} />
                {label}
              </div>
            ) : (
              <Link
                key={url}
                href={url}
                className={`${(url === "/" ? path === "/" : path === url || (url === "/obras" && path.startsWith("/obras/"))) ? "active" : ""} ${["Recursos", "Movimentos", "Tablet", "Ponto", "Colaboradores", "Empresas"].includes(label) ? "sub" : ""} ${categoryClass(label)} ${["Armazém"].includes(label) ? "module-parent" : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
                {label === "Obras" && (
                  <span className="nav-count">{state.works.length}</span>
                )}
              </Link>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="agency">
            <span>Developed by</span>
            <img src="/vougalogo.png" alt="Vouga Agency" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>ACRS</span>
            <ChevronRight size={14} />
            {parts.length > 1 && (
              <>
                <span>
                  {parts[0] === "pessoas"
                    ? "Pessoas"
                    : parts[0] === "armazem"
                      ? "Armazém"
                      : "Obras"}
                </span>
                <ChevronRight size={14} />
              </>
            )}
            <b>{title}</b>
          </div>
          <div className="topbar-right">
            <span className="session-tag" style={{ color: "#287a55", borderColor: "#c8e6d6", background: "#f0f8f4" }}>
              {authUser?.perfil?.toUpperCase() || "AUTENTICADO"}
            </span>
            <ProfileSelector />
          </div>
        </header>
        <main>{children}</main>
        <footer className="app-footer">
          <span>ACRS Metal Solutions</span>
          <span>Base de dados conectada · Sessão ativa</span>
        </footer>
      </div>
    </div>
  );
}
