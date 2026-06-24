/** Client de l'API JSON maides (préfixe /api, partagé dev [proxy Vite] et prod [même origine]). */

import type { EtatEcran, UtilisateurInfo, EntreeMenu } from './types.js';

const BASE = (import.meta.env?.VITE_API_BASE ?? '/api').replace(/\/$/, '');

async function req(chemin: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${chemin}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    ...init,
  });
}

export interface SessionInfo { authentifie: boolean; user: UtilisateurInfo | null }

export const api = {
  async session(): Promise<SessionInfo> {
    const r = await req('/login');
    return r.json();
  },

  async login(login: string, motdepasse: string): Promise<{ ok: boolean; user?: UtilisateurInfo; erreur?: string }> {
    const r = await req('/login', { method: 'POST', body: JSON.stringify({ login, motdepasse }) });
    return r.json();
  },

  async logout(): Promise<void> {
    await req('/logout', { method: 'POST', body: JSON.stringify({}) });
  },

  async menu(): Promise<{ user: UtilisateurInfo; entrees: EntreeMenu[] }> {
    const r = await req('/menu');
    return r.json();
  },

  async ecran(ecran: string, b = '', o = 1): Promise<EtatEcran> {
    const q = new URLSearchParams({ o: String(o) });
    if (b) q.set('b', b);
    const r = await req(`/${encodeURIComponent(ecran)}?${q.toString()}`);
    return r.json();
  },

  async sauvegarde(ecran: string, b: string, valeurs: Record<string, any>): Promise<EtatEcran> {
    const r = await req(`/${encodeURIComponent(ecran)}`, {
      method: 'POST', body: JSON.stringify({ o: 9, b, ...valeurs }),
    });
    return r.json();
  },

  async supprime(ecran: string, b: string): Promise<EtatEcran> {
    const r = await req(`/${encodeURIComponent(ecran)}`, {
      method: 'POST', body: JSON.stringify({ o: 4, b }),
    });
    return r.json();
  },
};
