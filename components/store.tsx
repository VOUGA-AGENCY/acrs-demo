"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Profile, State } from "@/types";
import { costLedger } from "@/lib/engine";
import { today } from "@/lib/format";
import {
  fetchStateFromSupabase,
  subscribeToSupabaseChanges,
} from "@/lib/supabase/service";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const emptyState: State = {
  works: [],
  articles: [],
  people: [],
  companies: [],
  times: [],
  invoices: [],
  movements: [],
  machines: [],
  allocations: [],
  budgets: [],
  settings: {
    minimos: {},
    valoresInternos: {},
    policy: {
      limiteExtra: 8,
      extra: 0.5,
      noturno: 0.25,
      sabado: 0.5,
      domingo: 0.5,
      feriado: 0.5,
      acumular: false,
      source: "demo",
    },
    personPolicies: {},
    companyPolicies: {},
    holidays: [],
  },
  manualCosts: [],
};

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  perfil: "admin" | "secretariado" | "armazem" | "terreno";
} | null;

type Store = {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  profile: Profile;
  setProfile: (p: Profile) => void;
  authUser: AuthUser;
  notify: (s: string) => void;
  ledger: ReturnType<typeof costLedger>;
  isSupabaseConnected: boolean;
  isLoaded: boolean;
};

const Context = createContext<Store | null>(null);

export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [profile, setProfile] = useState<Profile>("João Catalão");
  const [authUser, setAuthUser] = useState<AuthUser>(null);
  const [toast, setToast] = useState("");
  const [asOf, setAsOf] = useState("2026-09-11");
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => setAsOf(today()), []);

  useEffect(() => {
    let active = true;

    async function initSupabase() {
      try {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data: authData } = await supabase.auth.getUser();
          if (active && authData?.user) {
            const email = authData.user.email?.toLowerCase() || "";
            let mappedProfile: Profile = "João Catalão";
            let role: "admin" | "secretariado" | "armazem" | "terreno" = "admin";
            let nome = "João Catalão";

            // Consultar registo na tabela profiles
            const { data: profRow } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", authData.user.id)
              .maybeSingle();

            if (profRow) {
              nome = profRow.nome || nome;
              role = (profRow.perfil as any) || role;
              if (profRow.perfil === "secretariado") mappedProfile = "Vítor";
              else if (profRow.perfil === "armazem") mappedProfile = "Armazém";
              else if (profRow.perfil === "terreno") mappedProfile = "Campo";
              else mappedProfile = "João Catalão";
            } else {
              // Fallback por email
              if (email.includes("secretariado")) {
                mappedProfile = "Vítor";
                role = "secretariado";
                nome = "Vítor";
              } else if (email.includes("armazem")) {
                mappedProfile = "Armazém";
                role = "armazem";
                nome = "Armazém Central";
              } else if (email.includes("terreno")) {
                mappedProfile = "Campo";
                role = "terreno";
                nome = "Equipa de Campo";
              }
            }

            setProfile(mappedProfile);
            setAuthUser({
              id: authData.user.id,
              email: authData.user.email || "",
              nome,
              perfil: role,
            });
          }
        }

        const data = await fetchStateFromSupabase();
        if (active && data) {
          setState(data);
          setIsSupabaseConnected(true);
        }
      } catch (err) {
        console.warn("Supabase não disponível, a usar estado demonstrativo local:", err);
      } finally {
        if (active) {
          setIsLoaded(true);
        }
      }
    }

    initSupabase();

    const unsubscribe = subscribeToSupabaseChanges(() => {
      initSupabase();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const ledger = useMemo(() => costLedger(state, asOf), [state, asOf]);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  };

  return (
    <Context.Provider
      value={{
        state,
        setState,
        profile,
        setProfile,
        authUser,
        notify,
        ledger,
        isSupabaseConnected,
        isLoaded,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
          <button aria-label="Fechar notificação" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}

export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error("Provider ausente");
  return c;
}
