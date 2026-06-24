# Audit d'écart — Constructeur **maides** (PHP) → **maides-v2** (TypeScript)

> **Périmètre.** L'objet à reproduire « sans écart » est **le constructeur maides
> lui-même** (la plateforme low-code), *pas* les applications métier qu'il a
> servi à fabriquer (assurance / devis / compta). Ces dernières sont
> explicitement hors périmètre : elles vivent en **données** (patrons / écrans /
> formules / tables de paramètres) et seront rejouées via l'outil d'import une
> fois un dump disponible.

Source auditée : `../maides` (legacy PHP ~2017). Cible : ce dépôt.
Baseline avant travaux : **137 tests verts** (122 core + 15 serveur).

---

## 1. Ce qui est déjà porté fidèlement (acquis)

| Brique | État v2 | Réf source |
|---|---|---|
| Langage d'expressions (shunting-yard → RPN, tokens typés, `SI`, `:=`, `[sous-formule]`) | ✅ solide | `mdExpression.php` |
| Opérateurs FR (`ET/OU/NON`, `~= ~~ =~`, `^`, `u-`) | ✅ (+ bugs latents corrigés) | `mdExpression.php` |
| Métamodèle (patrons/champs/clé composite, dico) | ✅ | `pat`, `pStructure.php` |
| Cascade R4 (5 couches, premier-trouvé) | ✅ (store mémoire + PG) | `R4_gestion.php` |
| Runtime « bax » CRUD de base (o1/o4/o5/o8/o9/o12/o18) | ✅ | `bax_fonctions.php` |
| Hooks de code spécifique (`demarre`/`apres*`/`avant*`) | ✅ | `sp_*` |
| Rendu HTML widgets de base (~31 types) + échappement | ✅ | `jyWidget.php` |
| Designers programmatiques (structures, écrans) | ✅ | `pStructure`, `pEcranAssign` |
| Auth scrypt + droits par niveau + menus hiérarchiques | ✅ | `azxLogin`, `gestionDroits`, `mdMenu` |
| Serveur HTTP (login→menu→écrans) + API JSON + designer web | ✅ | `dispatch.php` |
| Scaffold + import/migration | ✅ | `MODE_INSTALL`, `blueprints` |

---

## 2. Écarts à combler (le constructeur, fonctionnalité par fonctionnalité)

### 2.1 Moteur d'expressions — écarts fins
- **Constantes `MOIS` / `AN`** : tokenisées mais non résolues → lèvent une erreur
  (`mdExpression.ts:319`). À implémenter (l'original les *intentionnait*).
- **Fonctions moteur manquantes** vs `mdExpressionFonctions.php` (61 `fFunc_`) :
  `nouveauDoc`, `lectureSeule`, `include`, `variableClient`, `loadGo`,
  `bissextile`, `tableauRequete`, `estNouveau`, `active`/`desactive`/
  `desactiveForm`/`ajouteJScript`. (v2 en a 44.)
- **API publique d'enregistrement de fonctions** : `specifique/expression.php`
  permet à une appli d'ajouter ses `fFunc_*`. **C'est une fonctionnalité du
  constructeur** (pas du métier) → exposer `registerFunction()`.
- **`<>`** (`op_dif`) compare `!=` brut alors que `=` passe par `looseEq`
  (asymétrie). À corriger.

### 2.2 Compilateur de gabarit `@…` — **absent de v2**
`lib/compilateurTemplate.php` (le drapeau `compiler` d'un écran) :
`@si/@sinonsi/@sinon/@finsi`, `@pour..@finpour`, `@(expr)` (affiche),
`@[expr]` (silencieux), `@var` / `@var[i]`, `@date/@heure/@page/@pageTotale`,
`@sautPage`, commentaires `/* */`, garde anti-injection `<?php`. v2 ne fait que
la substitution `$var`. **À porter intégralement.**

### 2.3 Runtime « bax » — ordres & fidélité du cycle
Ordres manquants (`bax.php` / `bax_fonctions.php`) :
- **o10** postage seul (écran sans table) · **o11** sauvegarde puis ré-édition
- **o13** aperçu courrier (`let`) · **o14** génération **PDF** (pagination
  `@sautPage`, chaînage `loadGo`)
- **o19** sauvegarde scan GED · **o29** upload fichier · **o20** créer lettre ·
  **o21** créer écran (utilisé par le designer)
- **o2/o3** fidèles (navigation `up`/`down` sur la clé) · **o6/o7** séquences
  d'écrans (`sq_ecran`)
- **AJAX** : `ajaxO1/ajaxO4/ajaxO9/ajaxO29` + format `genereSortieJson`
  (`{obe, tuple:{champ:{v,ro,ne}}}`)
- **Web services** `bax_webs` : `a=1..20` (listes clés, recherches, calcul
  formule, MAJ droits, focus, valeurs de table)

Fidélité du pipeline (`jyFonctions.php`) :
- **Variables magiques** (`__userLogin`/`UTI`, `__ecran`, `__patron`, `__o/__b/__e`, `__nouveau`)
- **Verrouillage optimiste** (`hashage` : snapshot `updated_at`, anti multi-submit `__frs__`)
- **imputageZzz** : formatage d'affichage + **masques** entiers (`N`/`Z`)
- **Pile de navigation** (`gestionPile`, ordres `-1/-2/-3`)
- **Variables de transfert** inter-écrans (`_vt_…`, `var_transfert`)
- **Ordre de focus** (`tabindex`, navigation clavier)

### 2.4 Catalogue de widgets — ~20 types manquants
vs `jyWidget.php` (~50 types). v2 a les saisies de base ; manquent :
- **Liés aux données** : `selectTable` (table `tab`), `selectFic` (table/vue +
  `editable`/datalist), `selectAggregate`, `recordList` (vue), `selectList`
  (SQL), `arrayList` (mémoire), `dataReport` (paginé), `editableArray`
  (tableau éditable multi-lignes), `sousEcranMulti`, `querabilitePopup` +
  `querabiliteList` (recherche popup), `ordreCle`/`ordreClePar`, `autoInc`,
  `listeVariables`.
- **Spéciaux** : `currency`, `display`, `textZone`, `hiddenData`, `iFrame`,
  `CKEditor` (vrai), `codeEditor`.
- **Documents** : `zoneDoc`, `zonePDF`, `zoneImg`.
- **`execScreen` réel** : v2 rend une `<div>` vide ; doit injecter le sous-écran.
- (Suite scanner WebTWAIN : interface seulement — pré-câblage `Scanner`.)
- Exposer **tous** les types dans le designer web (v2 n'en propose que 11).

### 2.5 Couche de données — primitives manquantes
- **Séquences / compteurs** : `derniereCle`, `prochaineCle`,
  `prochaineCleMinimale`, `incrementeAlpha` ; **auto-incrément** réellement généré.
- **Navigation séquentielle** : `up`/`down`/`find`/`findLight` (clé `_key`
  space-paddée à 20).
- **Transactions**.

### 2.6 R4 — moteur de vues & fusion
- **Vues** : `chargeVue` ne charge que le doc ; il manque l'**exécution** d'une
  vue (mono-table WHERE/OR, multi-table UNION ALL — port de `o_genererVue.php`).
- **`executeRequeteFusion`** : fusion de toutes les couches (dédup
  « plus spécifique gagne »).
- **`aggregate`** : `GROUP BY` et filtres composés (v2 = `champ=valeur` simple).

### 2.7 Designers — éditeurs manquants (le cœur low-code)
v2 a structures + écrans. Manquent : **menus** (`menu_position`), **droits champ**
(`pDroitTable` : grille table × champ × 9 groupes, valeurs `C/N/L/P`),
**formules nommées** (`frm`), **vues** (`vue`), **tables de paramètres** (`tab`),
**relations** (`relation`), **séquences d'écran** (`sq_ecran`).

### 2.8 Services — implémentations concrètes
PDF / Mailer / Scanner sont des **interfaces sans implémentation**. Fournir au
moins un moteur PDF (HTML→PDF) et un mailer de référence ; planification batch.

---

## 3. Politique de portage
- **Fidélité comportementale** d'abord ; les **bugs latents** documentés de
  l'original sont corrigés sciemment (puissance `^`, `~~`, `<>`, `MOIS/AN`, …) et
  consignés.
- **Failles de l'original NON reproduites** : mots de passe en clair (déjà scrypt
  en v2), injections SQL (requêtes paramétrées + allowlist via métamodèle),
  réhydratation de session depuis l'input client, XSS (échappement systématique).
- Chaque écart comblé arrive **avec tests** ; build vert maintenu à chaque étape.

---

## 4. Suivi
Voir la liste de tâches de la session (TaskList). Ordre indicatif : expressions
→ compilateur de gabarit → couche données/séquences → widgets → ordres runtime
→ R4 vues/fusion → designers → services.
