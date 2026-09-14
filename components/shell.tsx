"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Package,
  ArrowLeftRight,
  Wrench,
  TrendingUp,
  ReceiptText,
  Clock3,
  Users,
  Factory,
  Calculator,
  ChartNoAxesCombined,
  Settings2,
  ChevronRight,
  CircleHelp,
} from "lucide-react";
import { useStore } from "./store";
import type { Profile } from "@/types";
const links = [
  ["Dashboard", "/", LayoutDashboard],
  ["Obras", "/obras", Building2],
  ["Armazém", "/armazem", Package],
  ["Recursos", "/armazem/recursos", Package],
  ["Movimentos", "/armazem/movimentos", ArrowLeftRight],
  ["Consumo e reposição", "/armazem/consumo", TrendingUp],
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
  const { profile, setProfile } = useStore();
  const router = useRouter();
  return (
    <div className="profile-picker">
      <div className="avatar">
        {profile === "João Catalão"
          ? "JC"
          : profile === "Vítor"
            ? "VI"
            : profile === "Armazém"
              ? "AR"
              : profile === "Gerência"
                ? "GE"
                : "CA"}
      </div>
      <label>
        <span>Perfil da demo</span>
        <select
          value={profile}
          onChange={(e) => {
            const p = e.target.value as Profile;
            setProfile(p);
            router.push(
              p === "Armazém"
                ? "/armazem/tablet"
                : p === "Campo"
                  ? "/campo"
                  : "/",
            );
          }}
          aria-label="Perfil da demo"
        >
          {["João Catalão", "Vítor", "Armazém", "Gerência", "Campo"].map(
            (p) => (
              <option key={p}>{p}</option>
            ),
          )}
        </select>
      </label>
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
  const { profile, state } = useStore();
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
          "Consumo e reposição",
          "Tablet",
        ])
      : profile === "Gerência"
        ? new Set(["Dashboard", "Obras", "Controlo"])
        : null;
  const categoryClass = (label: string) =>
    ["Armazém", "Recursos", "Movimentos", "Consumo e reposição", "Tablet"].includes(label)
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
                className={`${(url === "/" ? path === "/" : path === url || (url === "/obras" && path.startsWith("/obras/"))) ? "active" : ""} ${["Recursos", "Movimentos", "Consumo e reposição", "Tablet", "Ponto", "Colaboradores", "Empresas"].includes(label) ? "sub" : ""} ${categoryClass(label)} ${["Armazém"].includes(label) ? "module-parent" : ""}`}
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
            <span className="session-tag">DEMO</span>
            <ProfileSelector />
          </div>
        </header>
        <main>{children}</main>
        <footer className="app-footer">
          <span>ACRS Metal Solutions</span>
          <span>Os registos desta sessão são repostos ao recarregar.</span>
        </footer>
      </div>
    </div>
  );
}
