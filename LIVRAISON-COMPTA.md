# Application de COMPTABILITÉ (Maxima) — guide

Comptabilité **en partie double**, low-code : journaux, plan comptable, tiers,
écritures, balance, compte de résultat. Données **persistées sur disque**.
Tous les totaux sont des **formules** (équilibre, solde, résultat) recalculées à
l'affichage — rien n'est figé.

## Lancer (Windows)
1. Installer **Node.js 20+** une fois (https://nodejs.org) — connexion Internet
   nécessaire au tout premier lancement, puis hors-ligne.
2. **Double-clic sur `lancer-compta.bat`** → navigateur sur http://localhost:3000.
3. Connexion : **`admin` / `admin`** (ou `comptable` / `comptable`).

macOS / Linux : `npm install` puis `npm run start:compta -w @maides/server`.

## Utilisation

Menu **Comptabilité** :
- **Factures** — clients/fournisseurs ; HT + taux de TVA → TVA et TTC calculés ; échéance.
  Sur la fiche, ses **règlements** s'affichent et le **solde restant dû** se met à jour
  (0 = facture lettrée/soldée). « + Nouveau règlement » pour encaisser.
- **Échéancier** — la liste des factures (échéance, TTC, réglé, solde).
- **Règlements** — tous les encaissements/décaissements.
- **Écritures** — la liste des pièces ; « + Nouvelle écriture » (date, journal, libellé).
- **Journal général** — toutes les lignes ; « + Nouvelle ligne » : n° d'écriture (pièce),
  compte, tiers, **débit**/**crédit**. Saisissez au moins deux lignes pour une pièce de
  sorte que **Σ débit = Σ crédit**.
- En rouvrant une **écriture**, ses totaux et son **équilibre** (doit être 0) se calculent.
- **Plan comptable / Balance** — la liste des comptes ; cliquer un compte affiche son
  **solde** (Σ débit − Σ crédit).
- **Tiers** — clients / fournisseurs.
- **Journaux** — AC / VE / BQ / CA / OD.
- **Résultat** — produits (classe 7) − charges (classe 6).

Exemple fourni au 1er lancement : une vente (1 200 TTC) et un achat (600 TTC) déjà saisis
et équilibrés.

## Paramétrage (sans code)
Barre du haut → **Designer** :
- **Tables de paramètres** (`tx`) : taux de TVA.
- **Formules** : équilibre d'écriture, solde de compte, charges/produits/résultat —
  toutes éditables.
- **Écrans** : mise en page (gabarit `$champ` = champ saisissable).

## Données & sauvegarde
Tout est dans **`apps/server/compta-data/`** (2 fichiers JSON). Sauvegarde = copier ce
dossier ; base vierge = le supprimer puis relancer. Emplacement modifiable via `COMPTA_DATA`,
port via `PORT`. Hébergement : voir `RENDER.md` (le même principe s'applique avec
`start:compta`).

## Identifiants
- `admin` / `admin` — accès complet.
- `comptable` / `comptable` — utilisateur standard.
