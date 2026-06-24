# Parité UI — maides (PHP) ↔ maides-v2

Objectif : maides-v2 doit **faire tout ce que fait l'interface de maides** (parité
comportementale). Le thème visuel de v2 est volontairement modernisé (décision
produit) ; ce document ne traite donc que des **comportements**.

Méthode : audit multi-agent (6 dimensions) comparant la source originale
(`../maides`, `maidesJS.js`, `maidesWidgets.js`, `lib/widgets/*.php`) à
l'implémentation v2, chaque écart étant **vérifié de façon adversariale** (un
second agent tente de le réfuter en cherchant la fonctionnalité dans v2).

## Score de parité par dimension (avant correctifs → après)

| Dimension | Avant | Écarts confirmés | Après correctifs |
|-----------|------:|------------------|------------------|
| Navigation & ordres | 72 % | 4 | **~95 %** |
| Saisie / clavier / masques | 78 % | 9 | **~95 %** |
| Tableaux éditables & sous-écrans | 60 % | 5 | **~95 %** |
| Recherche & autocomplétion | 82 % | 5 | **~95 %** |
| Documents & scanner | 72 % | 7 | **~90 %** |
| Arbre / éditeurs / modales | 68 % | 6 | **~98 %** (vraies libs réintégrées) |

## Écarts corrigés (comportements rétablis)

- **Ordres de navigation** o=2 / o=3 (document suivant / précédent) et o=6 / o=7
  (séquence d'écrans, param `seq`) — routés HTTP + boutons ◀ ▶ dans la barre d'outils.
- **Validation inline au blur** (port des `mdJsCheck*`) : obligatoire, min/max,
  longueur, type, affichés à la sortie du champ (et plus seulement à l'envoi).
- **Masque + format heure** `HH:MM` ; **sélection du contenu** à l'entrée d'un champ.
- **`=`** ouvre la recherche quérabilité (port `keys.EQUAL`) ou déroule un `select`.
- **`sousEcranMulti`** traite la réponse serveur (`semRecoit` : valeurs + erreurs
  par champ), à parité avec `editableArray`.
- **`rehydrate()`** après ajout de ligne / bloc (masques, texte riche initialisés).
- **Notifications** (toasts) après enregistrement de ligne / bloc.
- **Lookup quérabilité** : libellé multi-champs (« nom prenom ») + message **« NON TROUVÉ ! »**.
- **Filtre `accept`** côté serveur au téléversement (HTTP 415 si type non autorisé).
- **`demander()`** (saisie modale, port jQuery UI) + **synchronisation des éditeurs
  riches** avant envoi (port `CKEForceUpdate`).

## Bibliothèques d'origine réintégrées

Les **vraies** bibliothèques de maides sont désormais vendorisées (`apps/server/src/public/vendor/`)
et câblées, avec **repli natif** si une lib est absente :

| Lib d'origine | Intégration v2 |
|---------------|----------------|
| **CKEditor 4** (texte riche) | `CKEDITOR.replace()` sur `.md-richtext`/`.md-ckeditor` (repli : contenteditable) |
| **CodeMirror 5** (code) | `CodeMirror.fromTextArea()` sur `.md-codeeditor`, n° de ligne, mode (repli : textarea+tab) |
| **jstree** (arbre) | `$(.md-arbre).jstree()`, sélection → `data-cible` (repli : pliage CSS) |
| **jQuery UI** | autocomplétion sur champs clé/quérabilité + datepicker sur les dates (repli : datalist + masque) |

Chargement conditionnel : jQuery/jQuery UI sur toutes les pages applicatives ;
CKEditor/CodeMirror/jstree **seulement** si l'écran utilise ces widgets (évite 5 Mo inutiles).
Synchronisation forcée vers les `textarea` avant envoi (port de `CKEForceUpdate` + `cm.save()`).

## Écarts restants assumés

| Écart d'origine | Raison / équivalent v2 |
|-----------------|------------------------|
| **Dynamsoft WebTWAIN** (scanner matériel) | matériel + licence propriétaire indisponibles → téléversement de fichier natif → GED (`/_upload`, `/doc`) |
| `mdAjaxHtmlDialog` (popup HTML AJAX) | `<dialog>` natif (confirm / recherche / saisie `demander`) |
| `touches()` (raccourcis clavier custom par appli) | raccourcis maides standard câblés (navigation, `=`, F1, dates) |
| Pile de navigation `-1/-2/-3` (état session) | retour via `← Menu` / historique navigateur |

## Endpoints ajoutés (parité serveur)

- `/_ws?op=recherche|cles|valeur` — recherche, clés, lookup (port `bax_webs`).
- `/_obe` (POST) — enregistrement/suppression d'une ligne de sous-écran
  (`o=9`/`o=4`) → `{ tuple:{col:{v,ne}}, obe:{b} }` (port `bax_obe_ajax`).
- `/_upload` (POST) + `/doc?t=&b=&c=` — GED : téléversement et service de documents.

## Vérification

- **364 tests** verts (315 core + 43 serveur + 6 web), `typecheck` + `lint` propres.
- Flux vérifiés en direct : login → liste → édition → sauvegarde AJAX, `/_obe`,
  `/_upload` + `/doc`, navigation o=2/o=3, barre d'outils ◀ ▶.
