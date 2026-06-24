# Manuel d'utilisation — **maides v2**

> **maides v2** est un *constructeur d'applications de gestion* en **low-code** :
> on définit des applications par des **données** (tables, écrans, formules,
> droits, menus) — sans programmer — puis le moteur les **exécute** immédiatement.
> Ce manuel s'adresse à deux profils : le **concepteur** (qui construit les
> applications) et l'**utilisateur/décideur** (qui s'en sert au quotidien).

---

## Sommaire

- [Partie A — Pour bien comprendre (tout public)](#partie-a--pour-bien-comprendre)
- [Partie B — Démarrer et se connecter](#partie-b--démarrer-et-se-connecter)
- [Partie C — Utiliser une application au quotidien](#partie-c--utiliser-une-application-au-quotidien)
- [Partie D — Concevoir une application (le Designer low-code)](#partie-d--concevoir-une-application-le-designer-low-code)
- [Partie E — Le langage de formules](#partie-e--le-langage-de-formules)
- [Partie F — Le paramétrage (menus, formules, tables, droits)](#partie-f--le-paramétrage)
- [Partie G — Référence (widgets, ordres, fonctions)](#partie-g--référence)
- [Partie H — Sécurité et droits](#partie-h--sécurité-et-droits)
- [Partie I — Services (impression/PDF, e-mailing, documents)](#partie-i--services)
- [Partie J — Administration et dépannage](#partie-j--administration-et-dépannage)
- [Glossaire](#glossaire)

---

## Partie A — Pour bien comprendre

### Qu'est-ce que maides v2 ?
Un même moteur sert à fabriquer **n'importe quelle application de gestion**
(facturation, contrats, assurance, stock…). Au lieu d'écrire du code pour chaque
application, on la **décrit** :

| On définit… | …qui devient |
|---|---|
| une **table** (« patron ») et ses **champs** | là où les données sont stockées |
| un **écran** et ses **widgets** | l'interface de saisie/consultation |
| des **formules** sur les champs | les calculs automatiques (totaux, taxes, remises…) |
| des **droits** | qui peut voir / modifier quoi |
| un **menu** | la navigation de l'application |

Le moteur lit ces définitions et **exécute** l'application : saisie, calculs,
validation, enregistrement, impression — sans développement spécifique.

### Les 6 notions à retenir
1. **Table (patron)** : un type d'objet métier (ex. *Facture*, *Contrat*), avec
   ses **champs** (ex. *client*, *montant*) et une **clé** qui identifie chaque fiche.
2. **Écran** : un formulaire rattaché à une table, composé de **widgets**.
3. **Widget** : un contrôle de saisie/affichage posé sur un champ (zone texte,
   liste déroulante, case à cocher, montant, tableau…).
4. **Formule** : une expression qui calcule la valeur d'un champ
   (ex. `Total = quantité × prix`).
5. **Ordre** : l'action en cours sur un écran (consulter, créer, enregistrer…).
6. **Droits** : le niveau d'accès, par écran et par champ.

---

## Partie B — Démarrer et se connecter

### Prérequis
- **Node.js 20+** installé.

### Lancer l'application
Dans un terminal, à la racine du projet `maides-v2` :
```bash
npm install                      # une seule fois (installe les dépendances)
npm start -w @maides/server      # démarre le serveur
```
Le terminal affiche :
```
maides server: http://localhost:3000/  (login: admin / admin)
```

### Se connecter
1. Ouvrez **http://localhost:3000** dans un navigateur.
2. Identifiant **`admin`**, mot de passe **`admin`** → *Se connecter*.

> Pour changer le port : `PORT=3001 npm start -w @maides/server`.

### L'interface (repères de navigation)
- **Barre du haut** (présente partout) : logo *maides* (→ Accueil), onglets
  **Accueil** et **Designer**, votre nom et **Déconnexion**.
- **Accueil** : vos applications, présentées en **tuiles** regroupées par section.
- Sur chaque écran : un **fil d'Ariane**, un **badge** indiquant le mode en cours
  (Consultation / Création / Modification) et un bouton **← Menu** pour revenir.

### Version « application web moderne » (optionnel)
Une interface React (SPA) est disponible :
```bash
npm run build -w @maides/web     # construit l'interface
npm start -w @maides/server      # puis ouvrez http://localhost:3000/app
```

---

## Partie C — Utiliser une application au quotidien

Toutes les applications fonctionnent de la même façon (c'est l'intérêt du moteur).

### Ouvrir une fiche
Depuis l'**Accueil**, cliquez la tuile voulue (ex. *Nouvelle facture*, *Factures*).

### Créer une fiche
1. Ouvrez l'écran en mode **Création** (tuiles « Nouveau/Nouvelle … »).
2. Remplissez les champs. Les champs **calculés** (ex. *Total*) se mettent à jour
   automatiquement après enregistrement.
3. Cliquez **✓ Enregistrer**.
   - Si une **erreur de saisie** est détectée (champ obligatoire vide, valeur hors
     bornes…), un message s'affiche et l'enregistrement est refusé : corrigez puis
     ré-enregistrez.

### Consulter / Modifier / Supprimer
- **Consulter** : la fiche s'ouvre en lecture seule.
- **✎ Modifier** : passe en édition. Faites vos changements puis **✓ Enregistrer**.
- **Supprimer** : disponible en consultation (réservé aux administrateurs ; refusé
  s'il existe des données liées).
- **Annuler** : revient à la consultation sans enregistrer.
- **← Menu** : revient à l'accueil.

### Rechercher
La recherche universelle (« votre demande ») retrouve une fiche par un mot-clé
(nom, numéro…) selon ce que le concepteur a paramétré.

---

## Partie D — Concevoir une application (le Designer low-code)

> Réservé aux **super-administrateurs**. Menu → **Designer** (ou `/designer`).
> C'est ici qu'on **construit** une application sans coder.

### Étape 1 — Créer une table
1. Designer → formulaire **« Nouvelle table »** : saisissez un nom (ex. `client`),
   choisissez l'**emplacement** :
   - **Données** : tables de production (les fiches courantes).
   - **Paramètres** : tables de configuration partagées (taux, libellés…).
2. Cliquez **Créer la table** → la table s'ouvre.

### Étape 2 — Ajouter les champs et la clé
Dans la table :
1. **Nom du champ** (ex. `nom`), **Type** (voir ci-dessous), cochez **« Fait
   partie de la clé »** pour les champs identifiants.
2. **Ajouter le champ**. Répétez pour chaque champ.

**Types de champ disponibles** : `string` (texte), `integer` (entier),
`decimal` (nombre à virgule), `boolean` (oui/non), `date`, `datetime`, `clop`
(texte libre), `array` (liste).

> Astuce clé auto-numérotée : un champ entier marqué clé peut être
> **auto-incrémenté** (numéro attribué automatiquement à la création).

### Étape 3 — Créer un écran
1. Retour Designer → **« Nouvel écran »** : nom (ex. `clientSaisie`), **table liée**
   (ex. `client`), et un **gabarit** facultatif (voir Partie E) où l'on place les
   champs avec `$nom_du_champ`.
2. **Créer l'écran** → l'écran s'ouvre.

### Étape 4 — Poser les widgets
Dans l'écran, pour chaque champ :
- **Champ** : le nom du champ.
- **Widget** : le type de contrôle (liste complète en Partie G).
- **Libellé** : le texte affiché à l'utilisateur.
- **Formule de calcul** (optionnel) : rend le champ **calculé** (ex. `$qte * $pu`).
- **Obligatoire** : impose la saisie.

### Étape 5 — Lancer l'application
Cliquez **▶ lancer** : l'écran que vous venez de définir **s'exécute** dans le
moteur. Vous pouvez créer/consulter des fiches immédiatement.

### Lettres / documents
Le Designer permet aussi de créer des **lettres** (patron *let*) : un corps de
document avec champs `$…` et directives `@…`, destiné à l'impression/PDF.

---

## Partie E — Le langage de formules

Les formules pilotent les calculs et les règles. Elles s'écrivent sur les champs
(*Formule de calcul*) ou comme **formules nommées** réutilisables.

### Variables et littéraux
- `$nom_du_champ` : valeur d'un champ de l'écran (ex. `$qte`).
- Nombres : `12`, `3.5` · Texte : `"Bonjour"` · Date : `"31-12-2025"` (JJ-MM-AAAA).

### Opérateurs
| Catégorie | Opérateurs |
|---|---|
| Arithmétique | `+` `-` `*` `/` `^` (puissance) |
| Comparaison | `=` `<>` `<` `<=` `>` `>=` |
| Texte | `~=` (commence par) · `~~` (contient) · `=~` (finit par) · `+` (concatène) |
| Logique | `ET` · `OU` · `NON` |
| Affectation | `:=` (ex. `$total := $qte * $pu`) |

### Condition
`SI(condition ? valeurSiVrai : valeurSiFaux)`
Exemple : `SI($qte > 100 ? $pu * 0.9 : $pu)` (remise au-delà de 100).

### Sous-formules réutilisables
`[nom_de_formule]` insère une **formule nommée** (définie dans le Paramétrage),
ce qui permet de centraliser une règle (taux de TVA, barème…).

### Constantes
`JOUR`, `MOIS`, `AN` (date du jour), `VRAI`, `FAUX`, `UTI` (utilisateur connecté).

### Fonctions principales (≈ 60)
- **Nombres** : `int`, `rd`/`ru`/`rn` (arrondis inf./sup./proche), `min`, `max`,
  `ln`, `taille`, `chaine`.
- **Dates** : `date`, `heure`, `maintenant`, `an`, `mois`, `jour`, `age`,
  `bissextile`, `nbJour`, `dateMoins`, `datePlus`, `formateDate`, `dateLitterale`,
  `chaineVersDate`.
- **Texte / formats** : `formate` (type imprimante), `devise` (montant formaté),
  `remplace`, `decoupe`, `cle`.
- **Données / paramètres** : `table(nom, clé)` (lit une table de paramètres),
  `tableInf` / `tableSup` (valeur inférieure/supérieure la plus proche),
  `aggregate(op, table, champ, filtre)` (SOMME, COMPTE, MAX…), `requete`,
  `chargeEnregistrement`, `documentExiste`, `indice`.
- **Écran** : `nouveauDoc`, `estNouveau`, `lectureSeule(champ)`,
  `active`/`desactive(champ)`, `include(écran)`, `variableClient(nom)`.
- **Messages** : `messageErreur`, `messageAttention`, `messageSucces`.

> Le concepteur avancé peut **ajouter ses propres fonctions** (API
> `registerFunction`) sans toucher au moteur.

### Exemples concrets
```text
$qte * $pu                              -> total d'une ligne
rn(0.01, $base * $taux / 100)           -> taxe arrondie au centime
SI($solde > 0 ? "À payer" : "Soldé")    -> libellé d'état
$base * $prorata * ($bonus / 1000)      -> prime nette (bonus en millièmes)
table("tva", $code_tva)                 -> taux lu dans la table de paramètres
```

---

## Partie F — Le paramétrage

> Designer → lien **⚙ Paramétrage** (ou `/designer?config`).

- **Menus** : organisez la navigation. Chaque entrée a une **position** (ex.
  `z110` ; une entrée *sans script* sert de **titre de section**), un **libellé**,
  un **script** (cible, ex. `/clientSaisie?o=8&b=`) et un **niveau de droit**.
- **Formules nommées** : créez des formules réutilisables (`[nom]`) ; corps =
  une expression (ex. `10 * 2`).
- **Tables de paramètres** : couples *clé → valeur* par table (ex. table `tva`,
  clé `normal` = `20`), lisibles via `table(...)`.
- **Droits par champ** : pour une **table × champ × niveau**, définissez
  **C** (complet), **N** (modifiable seulement à la création), **L** (lecture
  seule), **P** (masqué).

---

## Partie G — Référence

### Catalogue des widgets
**Saisie simple** : `text`, `integer`, `decimal`, `date`, `time`, `datetime`,
`textarea`, `password`, `email`, `tel`, `url`, `color`, `range`, `montant`,
`currency` (avec symbole).
**Choix** : `select`, `selectTable` (depuis une table de paramètres),
`selectFic` (depuis une table/vue), `multiselect`, `radio`, `boolean`/`checkbox`,
`checkboxGroup`, `selectAggregate` (résultat d'agrégat).
**Affichage** : `display`, `label`, `titre`, `separateur`, `textZone`, `lien`,
`autoInc`, `hidden`, `hiddenData`, `iFrame`, `arbre` (hiérarchie).
**Éditeurs riches** : `richtext`, `CKEditor`, `codeEditor`.
**Listes / tableaux** : `recordList`, `selectList`, `arrayList`, `dataReport`,
`array`, `editableArray` (tableau éditable), `sousEcranMulti`.
**Recherche** : `querabilitePopup` + `querabiliteList`, `bigSearch`,
`simpleSearch`, `fullSearch`, `listeVariables`.
**Navigation/clé** : `ordreCle`, `ordreClePar`, `execScreen` (sous-écran).
**Boutons** : `button`, `buttonClose`, `ordreBoutonObe` (bouton d'action).
**Documents** : `zoneDoc`, `zonePDF`, `zoneImg`.
**Numérisation** : `scanInit`, `scanScan`, `scanFileUpload`, `scanSave`, etc.

### Les ordres (modes d'écran)
| Ordre | Action |
|---|---|
| **o1** | Consultation |
| **o8** | Édition / création |
| **o9** | Enregistrer |
| **o10** | Recalculer sans enregistrer |
| **o11** | Enregistrer puis ré-éditer |
| **o12** | Consulter si la fiche existe, sinon créer |
| **o2 / o3** | Fiche suivante / précédente |
| **o4** | Supprimer · **o5** Dupliquer |
| **o13 / o14** | Aperçu courrier / Génération PDF |
| **o18** | Enregistrer sans validation |
| **-1 / -2 / -3** | Revenir en arrière (pile de navigation) |

> Option d'enchaînement : `o=9:8` = enregistrer **puis** rester en édition.
> Dans une URL d'écran : `?o=8&b=<clé>` (b = la clé de la fiche).

---

## Partie H — Sécurité et droits

- **Niveaux** : `0` = le plus privilégié … `9` = le moins privilégié. Un compte
  sans niveau défini est, par sécurité, considéré comme **le moins privilégié**.
- **Super-administrateur** : accès total, dont le **Designer** et le Paramétrage.
- **Accès écran** : autorisé si le niveau de l'utilisateur est suffisant.
- **Droits par champ** (C/N/L/P) : appliqués automatiquement au rendu **et** à
  l'enregistrement. Un champ **P** n'apparaît pas et ne peut pas être soumis ; un
  champ **L** est en lecture seule.
- **Verrouillage** : si deux personnes modifient la même fiche, la seconde
  sauvegarde est refusée pour éviter d'écraser les changements.
- **Mots de passe** : stockés **hachés** (jamais en clair). Les saisies sont
  échappées (protection contre les injections).

> Comptes de démonstration : `admin/admin` (super-admin).

---

## Partie I — Services

- **Impression / PDF** : un écran de type *lettre* peut être rendu en document
  paginé et exporté en **PDF** (générateur intégré, sans dépendance ; un moteur
  haute-fidélité via navigateur sans tête est branchable).
- **Publipostage (e-mailing de masse)** : envoi d'un courrier par enregistrement,
  via un transport configurable.
- **GED (documents)** : rattachement de documents (PDF, images) aux fiches, avec
  acquisition par **téléversement de fichier** (ou scanner).
- **Traitements par lot** : parcours d'une table pour appliquer un traitement
  (utile pour des opérations périodiques).

---

## Partie J — Administration et dépannage

### Commandes utiles
```bash
npm start -w @maides/server          # démarrer (port 3000)
PORT=3001 npm start -w @maides/server# démarrer sur un autre port
npm test                             # lancer la base de tests automatiques
npm run build -w @maides/web         # construire l'interface React (/app)
```

### Problèmes fréquents
| Symptôme | Cause probable | Solution |
|---|---|---|
| `EADDRINUSE :3000` | un serveur tourne déjà sur le port | fermez-le, ou changez de port (`PORT=…`) |
| Redirigé vers `/login` | session expirée / non connecté | reconnectez-vous (admin/admin) |
| « Accès non autorisé » | niveau de droit insuffisant | utilisez un compte de niveau adéquat |
| Designer en 403 | compte non super-admin | connectez-vous en super-admin |
| Un champ calculé reste à 0 | la formule attend une valeur saisie | renseignez les champs sources puis Enregistrer |

### Sauvegarde / données
Selon la configuration, les données sont en mémoire (démo) ou en **PostgreSQL**
(production, format documents JSONB). En démo, les données sont réinitialisées au
redémarrage du serveur.

---

## Glossaire

- **Patron / table** : définition d'un type de données et de ses champs.
- **Clé** : champ(s) identifiant une fiche de façon unique.
- **Écran** : formulaire rattaché à une table.
- **Widget** : contrôle d'interface posé sur un champ.
- **Formule** : expression de calcul/règle.
- **Formule nommée** : formule réutilisable appelée par `[nom]`.
- **Ordre** : action/mode courant d'un écran (o1, o8, o9…).
- **Couches R4** : empilement de paramétrages (général → spécifique) permettant
  d'adapter une même application à plusieurs contextes (multi-société).
- **Vue** : assemblage de données issues d'une ou plusieurs tables.
- **GED** : gestion électronique de documents.
- **Super-administrateur** : profil ayant accès au Designer et au paramétrage.

---

*Document généré pour le projet maides v2. Pour une démonstration métier complète
(reconstruction d'une quittance d'assurance en low-code), voir le scénario
exécutable `apps/server/src/demo-assurance.ts` et les README/ROADMAP du dépôt.*
