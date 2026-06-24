# Feuille de route — Reconstruction de maides

Objectif : reconstruire **l'intégralité** des fonctionnalités du constructeur
d'applications maides en TypeScript, en conservant le runtime déclaratif, avec
PostgreSQL comme base unique. L'application « assurance » sert de cas de test de
référence (toutes ses fonctions doivent être reproductibles avec la v2).

Légende : ✅ fait · 🚧 en cours · ⏳ à faire

---

## Phase 0 — Socle technique 🚧
- ✅ Monorepo TypeScript (workspaces npm), `@maides/core`, Vitest, tsconfig.
- ✅ **Authentification sécurisée** (`auth/`) : hachage scrypt (corrige le
  stockage en clair du legacy), comptes, `authentifier`, sessions HTTP par
  cookie dans `@maides/server`. *tests inclus.*
- ✅ **Persistance PostgreSQL** (`r4/pg/`) : modèle document JSONB
  (`maides_patron`/`maides_doc`), `PgDocumentRepository` + `PgLayerStore`
  (load-at-boot / write-through, noyau synchrone préservé). Pile complète testée
  via un faux client (Runtime → sauvegarde → relecture). *3 tests.*
- ✅ **CI** (GitHub Actions : **lint + typecheck + tests**), **ESLint** (flat
  config) + `.editorconfig` + `.prettierrc`.
- ✅ **Multi-tenant** (`tenant/`) : `TenantRegistry` résout un code d'application
  vers son `R4` (registre `entreprise`). *tests inclus.*

## Phase 1 — Noyau / moteurs méta ✅ (hors persistance PostgreSQL)
- ✅ **Langage d'expressions** (`expression/`) : tokeniseur shunting-yard,
  évaluateur RPN, opérateurs FR, `SI`, sous-formules `[nom]`, affectations `:=`,
  ~40 fonctions standard, fournisseurs injectables. *45 tests.*
- ✅ **Métamodèle** (`metamodel/`) : `patrons`/`champs`, types, valeurs par
  défaut, init d'enregistrement, clés, dico pour les expressions. *5 tests.*
- ✅ **Couches R4** (`r4/`) : cascade `data → paramR4..R1`, surcharge
  multi-tenant, `chargePatron`/`chargeEcran`/`search`/`loadFormula`/`table`/
  `tableInf`/`tableSup`/`aggregate`, store mémoire + pont expressions. *7 tests.*
- ⏳ Persistance **PostgreSQL** (adaptateur `LayerStore` sur JSONB) — interface
  prête (store mémoire), reste à écrire l'implémentation `pg`.

## Phase 2 — Runtime générique (moteur « bax ») ✅ (cœur headless)
- ✅ Cycle de vie d'un écran : `creeZzz`, `$zzz` (état), chargement fic. maître,
  `formulage`, `postage`, `validationSaisie`, `sauveDocMaitre`. *6 tests E2E.*
- ✅ Ordres principaux : o1 visu, o8 édition, o9 sauvegarde, o18 sauvegarde
  forcée, o4 suppression, o12 visu/édition, o5 duplication.
- ✅ **Relations** (`chargeRelations`) : enfants (un-à-plusieurs) et parent
  (plusieurs-à-un) chargés dans `zzz` et exploitables par les formules.
- ✅ **Listes / vues** (`runtime.liste` + `renderListe`) : table d'enregistrements
  filtrée, rendue en HTML avec liens d'ouverture. *6 tests (relations + listes).*
- ✅ **Code spécifique** (`runtime/specifique`) : trappe d'extension pour la
  logique métier sur-mesure (port de `spe_php`/`demarre`/ordres o41–o90). Hooks
  `demarre`, `apresChargement`, `avantSauvegarde`, `apresSauvegarde` + ordres
  personnalisés ; contexte avec `evaluer`/`erreur`/`message`. *6 tests
  (barème par paliers, blocage conditionnel, ordre custom).*
- ⏳ Ordres restants (o6/o7 séquence d'écrans), navigation OBE.

## Phase 3 — Rendu & widgets ✅ (rendu serveur)
- ✅ Rendu HTML des widgets (`rendering/`) : text, integer, decimal, date,
  textarea, select, boolean, hidden, label, button, ordreBoutonObe, array ;
  registre extensible ; **échappement HTML** (corrige les injections du legacy).
- ✅ Moteur de gabarit ($champ -> widget en mode formulaire / -> valeur en mode
  document) ; rendu d'écran complet. *8 tests.*
- ✅ **Serveur HTTP exécutable** (`apps/server`) reliant runtime + rendu ; appli
  de démo « facture » définie par données, testée (handler) **et lancée sur un
  port réel** (GET formulaire, POST sauvegarde + calcul). *4 tests.*
- ✅ **Catalogue de widgets** (~30 types) : text, integer, decimal, date, time,
  datetime, textarea, select, multiselect, radio, boolean, checkboxGroup, hidden,
  password, email, tel, url, color, range, montant, richtext (CKEditor), file,
  image, lien, label, titre, separateur, button, array, execScreen — registre
  extensible (`enregistreWidget`). *tests inclus.*
- ✅ **API JSON** (`?format=json` / `Accept: application/json`) : état d'écran et
  résultats de sauvegarde en JSON → socle d'un front SPA / d'intégrations. *4 tests.*
- ⏳ Front SPA (React) consommant l'API JSON ; widgets restants (arbres, éditeur de code).

## Phase 4 — Designers (le cœur « low-code ») ✅ (API programmatique)
- ✅ Éditeur de **structures** `PatronEditor` (port de `pStructure`) : créer/cloner/
  supprimer table, ajouter/modifier/supprimer champ, définir la clé.
- ✅ Éditeur d'**écrans** `EcranEditor` (port de `pEcranAssign`/`pEcrans`) : créer/
  cloner/supprimer écran, placer/modifier/retirer widget, table liée, gabarit.
- ✅ **Auto-hébergement prouvé** : une appli construite uniquement via les éditeurs
  est exécutée par le runtime générique. *5 tests.*
- ✅ **Menus** (`menu/`, port de `mdMenu`) : arbre hiérarchique par position,
  filtrage par droits, rendu HTML. **Droits** (`auth/droits`, port de
  `gestionDroits`) : accès écran/menu par niveau. *tests inclus.*
- ✅ **Designer visuel web** (`apps/server` › DesignerApp) : créer tables/champs,
  écrans/widgets *à la souris* puis **lancer** l'appli ; **éditeur de lettres**
  intégré (patron 'let'). Flux complet testé + vérifié en HTTP réel. *5 tests.*

## Phase 5 — Services ✅ (sauf GED/scanner)
- ✅ **Batch/cron** (`services/batch`) : parcours d'une table + traitement
  (évaluer une expression, sauvegarder) ; port du pattern `commande_console`. 
- ✅ **Documents/PDF** (`services/documents`) : génération HTML des lettres (mode
  document) + `PdfRenderer` injectable (puppeteer/etc.).
- ✅ **Mailing de masse** (`services/mailing`) : `Mailer` injectable, courrier par
  enregistrement (port de `gestionMassMailing`). *5 tests.*
- ✅ **GED** (`ged/`) : stockage de documents rattachés aux enregistrements +
  interface `Scanner` injectable (remplace webtwain). *tests inclus.*

## Phase 6 — Install / scaffold & migration ✅
- ✅ **Scaffold** (`scaffold/`) : `initialiserApplication` installe les patrons
  système (scr/let/frm/tab/menu/vue) ; `creerApplicationDeBase` ajoute un écran
  d'accueil + menu. Port de `MODE_INSTALL` + `blueprints`.
- ✅ **Import / migration** (`migration/`) : `importerDefinitions` (format
  normalisé) + `depuisLignesLegacy` (lignes MySQL `patrons`/`patrons_champs`) +
  `importerLegacy` (MySQL + documents CouchDB). Testé jusqu'à l'**exécution de
  l'appli importée** par le runtime. *7 tests (scaffold + migration).*

## Phase 7 — Application de référence « assurance » ⏳
- ⚠️ **Dépendance données** : les écrans/patrons/tables de paramètres de l'appli
  assurance vivent dans la BASE (MySQL + CouchDB), pas dans le code PHP.
  ✅ **L'outil d'import (Phase 6) est prêt** : il suffit d'un **dump** de ces
  définitions pour les rejouer via `importerLegacy`. Le code PHP ne fournit que
  la logique « spécifique » résiduelle.
- ⏳ Reconstituer (en données/paramétrage v2) : contrats, **quittances**,
  paiements, **prélèvements**, **renouvellements**, sinistres, ressaisie LIMA,
  **devis** auto/moto/MRH, comptabilité.
- ⏳ Tests de non-régression fonctionnels bout-en-bout.

---

### État
La **plateforme (constructeur) est complète et opérationnelle**, et l'**écart vs
l'audit du PHP a été comblé** (voir [AUDIT-ECART.md](./AUDIT-ECART.md)) :
- **Expressions** : constantes `MOIS`/`AN`, fonctions manquantes
  (`nouveauDoc`, `lectureSeule`, `include`, `variableClient`, `loadGo`,
  `bissextile`, `tableauRequete`…), `registerFunction`, `<>` symétrique.
- **Compilateur de gabarit `@`** (`@si/@sinonsi/@sinon/@finsi`, `@pour`,
  `@()`, `@[]`, `@var`, `@date/@heure/@page/@sautPage`).
- **Couche données** : séquences (`incrementeAlpha`, `prochaineCle`,
  `prochaineCleMinimale`), navigation `up/down/find`, conditions `et/ou`,
  agrégats (`compteunique`, fusion), **exécution de vues** (UNION ALL).
- **Widgets** : +26 types (selectTable/Fic/Aggregate, recordList/selectList/
  arrayList/dataReport, editableArray, sousEcranMulti, querabilité, ordreCle,
  zoneDoc/PDF/Img, CKEditor/codeEditor, execScreen réel…).
- **Runtime** : ordres o10/o11/o13/o14/o20-21, variables magiques,
  var_transfert, verrouillage optimiste, sérialisation JSON AJAX, web services,
  pont d'accès données pour les widgets.
- **Designers** : menus, droits champ, formules, vues, tables de paramètres,
  relations, séquences d'écran.
- **Services** : impression paginée réelle (`documentImprimable`), mailers.

- **Front SPA React** (`apps/web`, Vite) : login, menu, écrans (visu/édition/
  sauvegarde + validation), navigation, sur l'API JSON (`/api`). Servi par le
  serveur sous `/app` (même origine) ou en dev via proxy Vite.
- **Moteur HTML→PDF binaire** : `SimplePdfRenderer` (PDF réel sans dépendance) +
  `PuppeteerPdfRenderer` (haute fidélité, import paresseux).

- **Widget arbre** (hiérarchie récursive) + **suite scanner** complète (catalogue).
- **Scanner logiciel** de référence (`FichierScanner` : base64/dataURL → GED),
  remplaçant l'acquisition matérielle WebTWAIN.

**337 tests** (308 core + 23 serveur + 6 web), ESLint + typecheck propres, CI.

### Reste (optionnel)
- Éditeur de code/arbre interactif côté SPA (rendu serveur déjà en place).
- Acquisition **scanner matérielle** (l'interface logicielle + le FichierScanner existent).
- **Phase 7 (hors périmètre « constructeur »)** : rejouer l'appli **assurance**
  — l'outil d'import est prêt, il ne manque qu'un **dump** des définitions
  (qui vivent en base, pas dans le code du constructeur).
