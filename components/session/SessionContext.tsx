'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { EstadoApi } from '@/lib/tipos';

// Fonte única de verdade da sessão no cliente. Faz polling de /api/estado —
// alimentado pelo worker Baileys via SQLite. A barra de status, a tela de
// Conexão e a fita leem daqui e acompanham sozinhas.
const VAZIO: EstadoApi = {
  sessao: { estado: 'desconhecido', numero: null },
  workerOnline: false,
  conectados: 0,
  sessoes: [],
  campanha: { nome: null, total: 0, modulos: [] },
};

interface SessionValue extends EstadoApi {
  recarregar: () => void;
}

const SessionCtx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoApi>(VAZIO);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch('/api/estado', { cache: 'no-store' });
      if (r.ok) setEstado(await r.json());
    } catch {
      /* worker/painel indisponível — mantém o último estado */
    }
  }, []);

  useEffect(() => {
    recarregar();
    const t = setInterval(recarregar, 3000);
    return () => clearInterval(t);
  }, [recarregar]);

  return (
    <SessionCtx.Provider value={{ ...estado, recarregar }}>{children}</SessionCtx.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
