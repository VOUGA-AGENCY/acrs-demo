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
import { initialState } from "@/lib/initial";
import { costLedger } from "@/lib/engine";
import { today } from "@/lib/format";
type Store = {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  profile: Profile;
  setProfile: (p: Profile) => void;
  notify: (s: string) => void;
  ledger: ReturnType<typeof costLedger>;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [profile, setProfile] = useState<Profile>("João Catalão");
  const [toast, setToast] = useState("");
  const [asOf, setAsOf] = useState("2026-09-11");
  useEffect(() => setAsOf(today()), []);
  const ledger = useMemo(() => costLedger(state, asOf), [state, asOf]);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  };
  return (
    <Context.Provider
      value={{ state, setState, profile, setProfile, notify, ledger }}
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
