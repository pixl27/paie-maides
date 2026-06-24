# maides v2 — Reconstruction TypeScript du constructeur d'applications

> Réécriture moderne de **maides / L.o.g.g.s**, une plateforme *low-code* de
> construction d'applications de gestion. L'historique PHP (~2017) servait
> notamment à fabriquer un progiciel d'assurance ; **le produit reconstruit ici
> est le constructeur lui-même**, l'assurance n'étant qu'une application de
> référence pour valider le moteur.

## Ce qu'est maides (rappel de l'audit)

maides n'est **pas** un logiciel d'assurance : c'est un moteur qui permet de
**définir des applications par des données** (sans coder), puis de les exécuter.

| Pilier | Rôle | Source PHP d'origine |
|---|---|---|
| **Métamodèle** | Définir tables/`patrons` + champs | `pStructure.php`, tables `pat`/`patrons`/`patrons_champs` |
| **Designer d'écrans** | Composer des écrans (widgets ↔ champs) | `pEcranAssign.php`, `jyWidget.php` |
| **Moteur de widgets** | Générer l'UI depuis une définition | `jyWidget.php` (2×153 KB) |
| **Langage d'expressions** | Règles métier déclaratives (`ET/OU/NON`, `:=`, dates) | `mdExpression.php` (67 KB) |
| **Couches R4** | Héritage de paramétrage multi-tenant (`data`→`paramR1`) | `R4_gestion.php` |
| **Runtime générique** | Exécuter les écrans (CRUD « ordres » o1…o99) | `bax.php` |
| **Designers annexes** | Lettres/documents, menus, droits | `azxPlettre.php`, `mdMenu`, `pDroitTable` |
| **Services** | PDF, mailing de masse, GED/scan, batch | tcpdf, `gestionMassMailing`, `ged/` |
| **Install / scaffold** | Créer une nouvelle application | `MODE_INSTALL`, `blueprints/` |

## Décisions d'architecture (validées)

- **Stack** : TypeScript full-stack.
- **Base de données** : **PostgreSQL unique** — tables relationnelles pour le
  métamodèle, colonnes **JSONB** pour les documents/écrans (héritage CouchDB).
- **Runtime déclaratif conservé** : les applications restent définies par des
  données (patrons/écrans/expressions interprétés à l'exécution).
- **Les moteurs « méta » sont portés fidèlement** : ils *sont* le produit.

## État d'avancement

| Composant | Statut |
|---|---|
| **Langage d'expressions** (`@maides/core` › `expression`) | ✅ Porté · 45 tests |
| **Métamodèle** (patrons/champs) | ✅ Porté · 5 tests |
| **Couches R4** (paramétrage multi-tenant) | ✅ Porté (store mémoire) · 7 tests |
| **Runtime générique** (bax : ordres CRUD, relations, listes, navigation) | ✅ Porté · 12 tests |
| **Code spécifique** (logique métier sur-mesure : hooks + ordres custom) | ✅ Porté · 6 tests |
| **Rendu widgets / écrans** (~30 types de widgets, registre extensible) | ✅ Porté · 12 tests |
| **Designers** (structures & écrans) | ✅ Porté · 5 tests |
| **Auth sécurisée** (hash scrypt) + **droits** + **menus** | ✅ Porté · 11 tests |
| **Serveur HTTP** : shell complet (login → menu → écrans) + **API JSON** | ✅ Runnable · 12 tests |
| **Designer visuel web** : concevoir une appli (+ lettres) puis la lancer | ✅ Runnable · 3 tests |
| **Persistance PostgreSQL** (JSONB, load-at-boot/write-through) | ✅ Porté · 3 tests |
| **Services** : batch/cron, documents/PDF, mailing de masse | ✅ Porté · 5 tests |
| **GED** (documents) + interface scanner | ✅ Porté · tests inclus |
| **Multi-tenant** (registre `entreprise` → R4) | ✅ Porté · tests inclus |
| **Scaffold** d'appli + **import/migration** (MySQL/CouchDB legacy) | ✅ Porté · 7 tests |
| Front SPA React, scanner matériel | ⏳ optionnel |
| Application de référence « assurance » | ⏳ (outil d'import prêt ; manque le dump) |

**337 tests verts** (308 core + 23 serveur + 6 web), ESLint + typecheck propres, CI GitHub Actions.

> **Comblement des écarts du constructeur (audit ↔ v2).** Le moteur a été
> complété pour reproduire *sans écart* le constructeur PHP : constantes
> `MOIS`/`AN` + fonctions d'expression manquantes + API `registerFunction` ·
> **compilateur de gabarit `@`** (`@si/@pour/@()/@[]/@var/@sautPage`…) ·
> **couche données** (séquences `prochaineCle`, navigation `up/down/find`,
> conditions `et/ou`, agrégats `compteunique/fusion`, **exécution de vues**) ·
> **+26 widgets** liés aux données (selectTable/Fic, recordList, editableArray,
> querabilité, zoneDoc/PDF, sous-écrans…) · **ordres runtime** o10/o11/o13/o14,
> variables magiques, verrouillage optimiste, JSON AJAX, web services ·
> **designers** (menus, droits, formules, vues, paramètres, relations,
> séquences) · **services** d'impression paginée + mailers ·
> **moteur HTML→PDF binaire** (`SimplePdfRenderer` sans dépendance +
> `PuppeteerPdfRenderer`) · **front SPA React** (`apps/web`) sur l'API JSON.
> Voir [AUDIT-ECART.md](./AUDIT-ECART.md). *Hors périmètre : les applications
> métier (assurance/devis/compta), qui sont des données rejouables via l'import.*
>
> **Ré-audit adversarial (vérifié sur le code v2).** Un second audit a confronté
> le PHP au code v2 *réel* et confirmé 60 écarts résiduels, tous comblés depuis :
> contrôle d'accès **par champ** (C/N/L/P) appliqué au rendu/sérialisation +
> défaut de niveau sécurisé ; chemin de **sauvegarde** fidèle (checkbox 0/1,
> tableaux, auto-incrément, coercition à l'écriture, champs système) ;
> **expressions** (min/max chaînes, variableClient, devise, @date/@heure local) ;
> **navigation** (o2/o3 up/down, o6/o7 séquences, pile, options d'ordre,
> var_transfert) ; **widgets/web-services/R4** (ordreBoutonObe, alias, recherche,
> getEmplacement, vues) ; **services** (requetteur, format/PDF, menu par défaut)
> et **designer web** (paramétrage : menus/formules/paramètres/droits).
>
> **Audit de certification (final) : ✅ CERTIFIÉ.** Un ultime contrôle multi-agents
> (vérification de chaque correction + traque des régressions + balayage de
> nouveaux écarts, vérifiés sur le code v2 réel) a d'abord relevé 3 défauts —
> `REQ_valideSQL` incomplet, fuite d'état `messerr` sur widget partagé, menu
> super-admin — **tous corrigés**, puis re-certifié **0 défaut**.

📘 **[MANUEL.md](./MANUEL.md)** — manuel d'utilisation complet (concepteur + utilisateur).
Voir **[ROADMAP.md](./ROADMAP.md)** pour le détail des phases.

## Structure du dépôt

```
maides-v2/
├─ packages/
│  └─ core/                 # @maides/core — moteurs méta
│     ├─ src/expression/    # langage d'expressions
│     ├─ src/metamodel/     # patrons (tables) et champs
│     ├─ src/r4/            # couches de paramétrage multi-tenant
│     ├─ src/runtime/       # runtime générique « bax » (ordres CRUD)
│     ├─ src/rendering/     # rendu HTML des widgets et écrans
│     ├─ src/designer/      # éditeurs de structures et d'écrans
│     ├─ src/auth/          # hachage, comptes, droits
│     ├─ src/menu/          # menus hiérarchiques
│     ├─ src/services/      # batch/cron, documents/PDF, mailing
│     ├─ src/ged/           # gestion documentaire + scanner
│     ├─ src/tenant/        # multi-tenant (registre entreprise)
│     ├─ src/scaffold/      # création de nouvelle application
│     ├─ src/migration/     # import/migration (legacy MySQL + CouchDB)
│     └─ test/              # tests Vitest
├─ apps/
│  ├─ server/               # @maides/server — shell HTTP + API JSON + designer visuel
│  └─ web/                  # @maides/web — front SPA React (Vite) sur l'API JSON
├─ package.json             # workspaces npm
└─ tsconfig.base.json
```

## Démarrage

```bash
npm install            # à la racine (workspaces)
npm test               # lance tous les tests
```

Dans `packages/core` :

```bash
npm test               # tests du noyau (Vitest)
npm run typecheck      # vérification TypeScript
```

Lancer le serveur de démonstration (appli « facture » définie par données) :

```bash
npm start -w @maides/server     # puis http://localhost:3000/  (login : admin / admin)
```

### Front SPA React (`apps/web`)

```bash
# Développement (HMR ; le proxy /api pointe sur le serveur :3000) :
npm start -w @maides/server         # terminal 1 : l'API
npm run dev   -w @maides/web         # terminal 2 : http://localhost:5173

# Production (même origine, cookies/sessions sans CORS) :
npm run build -w @maides/web         # génère apps/web/dist
npm start     -w @maides/server      # sert la SPA sur http://localhost:3000/app
```

Le front consomme l'API JSON (`/api/...`) : login, menu, ouverture d'écran,
rendu des widgets, sauvegarde + erreurs de validation, navigation.

### Générer un PDF

```ts
import { SimplePdfRenderer, genererPdf } from '@maides/core';
const pdf = await genererPdf(new SimplePdfRenderer(), runtime, 'maLettre', ['1']);
// pour une fidélité CSS totale : new PuppeteerPdfRenderer() (puppeteer installé côté hôte)
```

## Exemple : le langage d'expressions

```ts
import { evaluerValeur, MdExpression } from '@maides/core';

evaluerValeur('2 + 3 * 4');                 // 14
evaluerValeur('SI(5 > 3 ? "oui" : "non")'); // "oui"
evaluerValeur('age("01-01-2000", "01-01-2020")'); // 20
evaluerValeur('devise(1234.5, 2, "€")');    // "1 234,50 €"

// Variables typées + dictionnaire
evaluerValeur('an($d)', {
  variables: { d: '2020-06-15' },
  dico: { d: { type_champ: 'date' } },
});                                          // 2020

// Sous-formules paramétrables (couches R4 injectées)
const e = new MdExpression('[majoration] + 5', {
  providers: { params: { loadFormula: () => '10 * 2', table: () => null, tableInf: () => null, tableSup: () => null } },
});
e.calcul().value;                            // 25
```

### Bugs latents corrigés lors du portage (documentés)

- `^` (puissance) : déclaré dans l'original mais absent de l'évaluateur → implémenté.
- `~~` (contient) : jamais tokenisé (bug de regex) → rendu fonctionnel.
- moins unaire `-$x` / `-(...)` : ne marchait que sur les littéraux → généralisé.
- `chaineVersDate()` produisait `AAAA-MM-JJ` au lieu du format littéral interne → corrigé.
- frontières de mots sur `et`/`ou`/`non` et constantes → `etat` n'est plus lu comme l'opérateur `et`.
