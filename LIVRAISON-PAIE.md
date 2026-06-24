# Application de PAIE — guide de lancement

Application de paie **low-code** (employeurs, salariés, rubriques paramétrables,
bulletins calculés par formules). Données **persistées sur disque**.

## Prérequis (une seule fois)

- **Node.js 20 ou plus** : https://nodejs.org → bouton « LTS » → installer (suivant, suivant, terminer).
  *(Astuce : prenez la version « LTS » la plus récente — 20.19+ ou 22 — pour éviter un avertissement jaune sans gravité au moment de l'installation.)*
- **Connexion Internet au tout premier lancement** : la 1ʳᵉ fois, l'application télécharge ses composants
  depuis Internet (1–2 min). **Ensuite, elle fonctionne entièrement hors-ligne.**

## Lancer l'application (Windows)

1. **Double-cliquez sur `lancer-paie.bat`**.
   - 1ʳᵉ fois : il installe les composants (1–2 min), ensuite c'est immédiat.
2. Le navigateur s'ouvre sur **http://localhost:3000**.
   *(S'il s'ouvre trop tôt et affiche une erreur, patientez 5 s et rafraîchissez — Ctrl+F5.)*
3. Connexion : **`admin` / `admin`**.
4. **Laissez la fenêtre noire ouverte** pendant l'utilisation. Pour arrêter : fermez-la.

> **Si rien ne s'ouvre / message « port déjà utilisé »** : l'application est sûrement déjà lancée dans une
> autre fenêtre. Fermez-la, puis relancez. (Au besoin, on peut changer le port — voir l'annexe technique.)

## Utilisation

Menu **Paie** :
- **Salariés** — liste ; « + Nouveau salarié » pour ajouter ; cliquer une ligne pour modifier/supprimer.
- **Rubriques** — catalogue des cotisations ; « + Nouvelle rubrique » ; cliquer pour modifier/supprimer.
  Une rubrique = code, libellé, base (`brut`/`plafond`/`base_csg`), taux salarial, taux patronal,
  « réintégré au net imposable » (0/1). Ajouter/modifier une rubrique **recalcule** les bulletins.
- **Bulletins de paie** — liste ; « + Nouveau bulletin » : choisir le salarié, la période, le salaire de
  base → tout se calcule (brut, cotisations salariales/patronales, net à payer, net imposable, coût
  employeur). Bouton **PDF** pour l'imprimer.

Paramétrage avancé (barème, formules) : barre du haut → **Designer** (Tables de paramètres `tx` =
plafond SS / abattement CSG ; Formules nommées = règles de calcul).

## Données & sauvegarde

- Tout est enregistré dans le dossier **`apps/server/paie-data/`** (2 fichiers JSON).
- **Sauvegarde** = copier ce dossier. **Restauration** = le remettre en place.
- Pour repartir d'une base vierge : supprimer ce dossier puis relancer.

## Mettre l'application sur un serveur (accès à plusieurs)

- **Même réseau (Wi-Fi/bureau)** : lancer sur un poste, les autres ouvrent `http://<IP-du-poste>:3000`
  (autoriser le port 3000 dans le pare-feu Windows).
- **Accès Internet** : héberger sur un petit serveur Linux (Node 20), lancer avec **pm2** ou un service
  **systemd**, et placer **nginx** devant pour le HTTPS + un nom de domaine. Le dossier `paie-data/`
  contient les données à sauvegarder.

## Identifiants

- `admin` / `admin` — accès complet (voit le coût employeur).
- `gestionnaire` / `gestionnaire` — le coût employeur lui est masqué.

---

## Annexe technique (pour un informaticien)

### Lancer sur macOS / Linux (ou sans le `.bat`)
```
node --version            # doit afficher v20 ou plus
npm install               # une seule fois (nécessite Internet)
npm run start:paie -w @maides/server
```
Puis ouvrir http://localhost:3000.

### Changer le port
Le port par défaut est **3000**. Pour en utiliser un autre, définir la variable d'environnement `PORT` :
```
# Windows (PowerShell)
$env:PORT = "3001"; npm run start:paie -w @maides/server
# macOS / Linux
PORT=3001 npm run start:paie -w @maides/server
```
Si le port est déjà occupé, l'application affiche un message clair et s'arrête (au lieu d'une erreur technique).

### Emplacement des données
Le dossier de données peut être déplacé via la variable `PAIE_DATA` (défaut : `apps/server/paie-data/`).
