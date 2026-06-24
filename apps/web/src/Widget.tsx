/** Rendu React d'un widget à partir de sa méta (JSON) — pendant client de jyWidget. */

import type { ChampMeta } from './types.js';

interface Props {
  nom: string;
  meta: ChampMeta;
  valeur: any;
  lecture: boolean;
  onChange: (nom: string, valeur: any) => void;
}

export function Widget({ nom, meta, valeur, lecture, onChange }: Props) {
  const ro = lecture || meta.est_lecture_seule === true;
  const type = meta.type_widget ?? 'text';
  const erreurs = meta.messerr ?? [];
  const set = (v: any) => onChange(nom, v);

  const libelle = meta.libelle ?? nom;
  const champ = rendu();

  return (
    <label className={`md-champ${erreurs.length ? ' md-champ--err' : ''}`}>
      <span className="md-label">{libelle}</span>
      {champ}
      {erreurs.length > 0 && <span className="md-err">{erreurs.join(', ')}</span>}
    </label>
  );

  function rendu() {
    if (type === 'hidden') return <input type="hidden" value={valeur ?? ''} readOnly />;

    // widgets d'affichage (toujours rendus, quel que soit le mode)
    if (type === 'recordList' || type === 'selectList' || type === 'querabiliteList' || type === 'dataReport') {
      return <Liste lignes={meta.lignes ?? []} />;
    }
    if (type === 'arrayList') {
      return <Liste lignes={Array.isArray(valeur) ? valeur : []} />;
    }
    if (type === 'arbre') {
      return <Arbre noeuds={Array.isArray(valeur) ? valeur : []} />;
    }

    if (ro && type !== 'boolean') {
      return <span className="md-ro">{format(valeur, type)}</span>;
    }
    switch (type) {
      case 'integer':
        return <input type="number" step={1} value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'decimal':
      case 'currency':
      case 'montant':
        return <input type="number" step="any" value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'date':
        return <input type="date" value={isoDate(valeur)} onChange={(e) => set(e.target.value)} />;
      case 'time':
        return <input type="time" value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'datetime':
        return <input type="datetime-local" value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'boolean':
        return <input type="checkbox" disabled={ro} checked={valeur === 1 || valeur === '1' || valeur === true} onChange={(e) => set(e.target.checked ? 1 : 0)} />;
      case 'textarea':
      case 'CKEditor':
      case 'richtext':
        return <textarea value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'select':
      case 'selectTable':
      case 'selectFic': {
        const opts = meta.options ?? [];
        return (
          <select value={valeur ?? ''} onChange={(e) => set(e.target.value)}>
            <option value=""></option>
            {opts.map((o) => <option key={String(o.value)} value={o.value}>{String(o.libelle ?? o.value)}</option>)}
          </select>
        );
      }
      case 'email': return <input type="email" value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'password': return <input type="password" value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
      default:
        return <input type="text" value={valeur ?? ''} onChange={(e) => set(e.target.value)} />;
    }
  }
}

interface Noeud { id?: any; cle?: any; label?: any; libelle?: any; enfants?: Noeud[]; children?: Noeud[] }

function Arbre({ noeuds }: { noeuds: Noeud[] }) {
  if (!noeuds.length) return <div className="md-arbre" />;
  return <div className="md-arbre"><ul>{noeuds.map((n, i) => <NoeudArbre key={i} n={n} />)}</ul></div>;
}
function NoeudArbre({ n }: { n: Noeud }) {
  const enfants = n.enfants ?? n.children ?? [];
  return (
    <li>
      <span className="md-arbre-noeud">{String(n.label ?? n.libelle ?? n.id ?? n.cle ?? '')}</span>
      {enfants.length > 0 && <ul>{enfants.map((e, i) => <NoeudArbre key={i} n={e} />)}</ul>}
    </li>
  );
}

function Liste({ lignes }: { lignes: Record<string, any>[] }) {
  if (!lignes.length) return <div className="md-liste md-liste--vide">—</div>;
  const cols = Object.keys(lignes[0]!).filter((k) => !k.startsWith('_'));
  return (
    <table className="md-liste">
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>
        {lignes.map((l, i) => <tr key={i}>{cols.map((c) => <td key={c}>{String(l[c] ?? '')}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

function isoDate(v: any): string {
  const s = String(v ?? '');
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function format(v: any, type: string): string {
  if (v === undefined || v === null || v === '') return '';
  if (type === 'date') {
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  }
  return String(v);
}
