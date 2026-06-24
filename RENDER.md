# Héberger l'application de PAIE sur Render

Render déploie depuis un dépôt **Git** (GitHub). Il n'y a pas d'envoi de ZIP :
on met le code sur GitHub, puis Render le récupère et le lance tout seul.

> ⚠️ **Données de paie** : le plan **gratuit** de Render a un disque **éphémère** —
> les salariés/rubriques/bulletins sont **remis à zéro** à chaque redéploiement
> et à chaque réveil après mise en veille. Le gratuit convient à une **démo**.
> Pour un **vrai usage**, voir « 4) Conserver les données » (plan payant + disque).

## 1) Mettre le code sur GitHub (une fois)

1. Créez un compte sur https://github.com (gratuit) et un dépôt **privé** (la paie
   est confidentielle) nommé `paie-maides` — **sans** README ni .gitignore (le projet en a déjà un).
2. Depuis le dossier `maides-v2` (qui est déjà un dépôt git), envoyez le code :
   ```bash
   git remote add origin https://github.com/<votre-compte>/paie-maides.git
   git branch -M main
   git push -u origin main
   ```
   *(Les données de test `paie-data/` et `node_modules/` sont déjà ignorées : elles ne partent pas.)*

## 2) Déployer sur Render (Blueprint)

1. Créez un compte sur https://render.com (connexion avec GitHub = plus simple).
2. **New ▸ Blueprint**.
3. Choisissez le dépôt `paie-maides`. Render lit le fichier **`render.yaml`** fourni
   et propose le service **paie-maides**. Cliquez **Apply**.
4. Render lance `npm install` puis `npm run start:paie`. Au bout de 2–4 min, le service
   passe **Live**.

> Sans `render.yaml` (config manuelle), créez un **Web Service** avec :
> - **Build Command** : `npm install`
> - **Start Command** : `npm run start:paie -w @maides/server`
> - **Environment variable** : `NODE_VERSION = 20.19.0`
> - Le port est géré automatiquement (l'app lit `PORT`).

## 3) Utiliser

- Render fournit une URL du type **`https://paie-maides.onrender.com`**.
- Connexion : **`admin` / `admin`** (et `gestionnaire` / `gestionnaire`).
- Partagez l'URL à votre patron — rien à installer chez lui.

> Sur le plan gratuit, le service **se met en veille** après ~15 min sans visite :
> la 1ʳᵉ ouverture suivante prend ~30 s à se réveiller, puis c'est instantané.

## 4) Conserver les données (recommandé pour la vraie paie)

Le plan gratuit perd les données. Pour les garder :

1. Ouvrez **`render.yaml`** et :
   - remplacez `plan: free` par **`plan: starter`** ;
   - décommentez le bloc **`disk:`** (mountPath `/data`, 1 Go) ;
   - décommentez la variable **`PAIE_DATA = /data`**.
2. Recommit + push :
   ```bash
   git add render.yaml && git commit -m "render: disque persistant" && git push
   ```
   Render applique le changement. Les données sont maintenant stockées sur le disque
   `/data` et **survivent aux redéploiements**.

Coût indicatif : plan **Starter ≈ 7 $/mois** + disque **≈ 0,25 $/Go/mois**.

> **Sauvegarde** : dans Render ▸ votre service ▸ onglet **Shell**, copiez le contenu de
> `/data` (`paie-data.json`, `paie-params.json`). C'est toute votre base.

## 5) Bonnes pratiques

- **Changez les mots de passe** par défaut (admin/admin) après la 1ʳᵉ connexion
  (barre du haut ▸ section Utilisateurs).
- Le dépôt GitHub doit rester **privé**.
- Alternative 100 % gratuite **avec** données conservées : voir `LIVRAISON-PAIE.md`
  (lancer sur un PC qui reste allumé + tunnel Cloudflare).
