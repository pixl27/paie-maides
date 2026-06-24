/** Application SPA maides : login -> menu -> écrans (consultation/édition/sauvegarde). */

import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Widget } from './Widget.js';
import { valeursFormulaire, parseScript, estNavigable } from './serialise.js';
import type { EtatEcran, EntreeMenu, Message, UtilisateurInfo } from './types.js';

type Vue =
  | { nom: 'chargement' }
  | { nom: 'login' }
  | { nom: 'menu' }
  | { nom: 'ecran'; etat: EtatEcran };

export function App() {
  const [user, setUser] = useState<UtilisateurInfo | null>(null);
  const [vue, setVue] = useState<Vue>({ nom: 'chargement' });
  const [entrees, setEntrees] = useState<EntreeMenu[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const allerMenu = useCallback(async () => {
    const m = await api.menu();
    setUser(m.user); setEntrees(m.entrees); setMessages([]); setVue({ nom: 'menu' });
  }, []);

  useEffect(() => {
    api.session().then((s) => {
      if (s.authentifie) { setUser(s.user); allerMenu(); }
      else setVue({ nom: 'login' });
    }).catch(() => setVue({ nom: 'login' }));
  }, [allerMenu]);

  const ouvrir = useCallback(async (ecran: string, b = '', o = 1) => {
    const etat = await api.ecran(ecran, b, o);
    setMessages(etat.messages ?? []); setVue({ nom: 'ecran', etat });
  }, []);

  if (vue.nom === 'chargement') return <div className="md-app"><p>Chargement…</p></div>;

  return (
    <div className="md-app">
      <header className="md-top">
        <strong onClick={() => user && allerMenu()} style={{ cursor: 'pointer' }}>maides · atelier</strong>
        {user && <span className="md-user">{user.login}{user.superAdmin ? ' (admin)' : ''} · <a onClick={async () => { await api.logout(); setUser(null); setVue({ nom: 'login' }); }}>déconnexion</a></span>}
      </header>

      <Flashs messages={messages} />

      {vue.nom === 'login' && <Login onOk={allerMenu} />}
      {vue.nom === 'menu' && <Menu entrees={entrees} onOuvrir={ouvrir} />}
      {vue.nom === 'ecran' && (
        <Ecran etat={vue.etat} onRecharger={ouvrir}
          onSauver={async (valeurs) => {
            const etat = await api.sauvegarde(vue.etat.ecran, vue.etat.cle.join('.'), valeurs);
            setMessages(etat.messages ?? []); setVue({ nom: 'ecran', etat });
          }}
          onSupprimer={async () => {
            const etat = await api.supprime(vue.etat.ecran, vue.etat.cle.join('.'));
            setMessages(etat.messages ?? [{ type: 'succes', text: 'Document supprimé.' }]);
            setVue({ nom: 'ecran', etat });
          }} />
      )}
    </div>
  );
}

function Flashs({ messages }: { messages: Message[] }) {
  if (!messages.length) return null;
  return <div className="md-flashs">{messages.map((m, i) => <div key={i} className={`md-flash md-flash--${m.type}`}>{m.text}</div>)}</div>;
}

function Login({ onOk }: { onOk: () => void }) {
  const [login, setLogin] = useState('admin');
  const [mdp, setMdp] = useState('admin');
  const [err, setErr] = useState('');
  return (
    <form className="md-login" onSubmit={async (e) => {
      e.preventDefault();
      const r = await api.login(login, mdp);
      if (r.ok) onOk(); else setErr(r.erreur ?? 'Échec');
    }}>
      <h1>Connexion</h1>
      {err && <div className="md-flash md-flash--erreur">{err}</div>}
      <label className="md-champ"><span className="md-label">Identifiant</span><input value={login} onChange={(e) => setLogin(e.target.value)} /></label>
      <label className="md-champ"><span className="md-label">Mot de passe</span><input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></label>
      <button type="submit">Se connecter</button>
      <p className="md-hint">Démo : admin / admin</p>
    </form>
  );
}

function Menu({ entrees, onOuvrir }: { entrees: EntreeMenu[]; onOuvrir: (e: string, b?: string, o?: number) => void }) {
  return (
    <div className="md-menu">
      <h1>Applications</h1>
      {entrees.length === 0 && <p>Aucune entrée de menu.</p>}
      <ul>
        {entrees.map((e, i) => {
          const cible = parseScript(e.script);
          const navigable = estNavigable(e.script);
          return (
            <li key={i}>
              {navigable
                ? <a onClick={() => onOuvrir(cible.ecran!, cible.b ?? '', cible.o ?? 1)}>{e.label}</a>
                : <span className="md-disabled" title="Programme non géré par la SPA">{e.label}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Ecran({ etat, onSauver, onSupprimer, onRecharger }: {
  etat: EtatEcran;
  onSauver: (valeurs: Record<string, any>) => void;
  onSupprimer: () => void;
  onRecharger: (ecran: string, b: string, o: number) => void;
}) {
  const [valeurs, setValeurs] = useState<Record<string, any>>(etat.valeurs);
  useEffect(() => setValeurs(etat.valeurs), [etat]);
  const edition = Number(etat.o) !== 1;
  const lecture = !edition;
  const b = etat.cle.join('.');

  const set = (nom: string, v: any) => setValeurs((prev) => ({ ...prev, [nom]: v }));

  return (
    <div className="md-ecran">
      <div className="md-crumbs">{etat.ecran} · {lecture ? 'Consultation' : etat.nouveauDoc ? 'Création' : 'Modification'}</div>
      <div className="md-form">
        {Object.entries(etat.champs).map(([nom, meta]) => (
          <Widget key={nom} nom={nom} meta={meta} valeur={valeurs[nom]} lecture={lecture} onChange={set} />
        ))}
      </div>
      <div className="md-toolbar">
        {lecture ? (
          <>
            <button onClick={() => onRecharger(etat.ecran, b, 8)}>Modifier</button>
            <button className="secondaire" onClick={onSupprimer}>Supprimer</button>
          </>
        ) : (
          <>
            <button onClick={() => onSauver(valeursFormulaire(etat.champs, valeurs))}>Enregistrer</button>
            <button className="secondaire" onClick={() => onRecharger(etat.ecran, b, 1)}>Annuler</button>
          </>
        )}
      </div>
    </div>
  );
}
