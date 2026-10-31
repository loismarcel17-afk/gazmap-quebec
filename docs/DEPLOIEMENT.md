# Mise en production

Tout est prêt dans le code. Ce guide liste ce qui se fait **une fois**, dans les tableaux de bord Supabase et Vercel.

> ⚠️ **Ne pas rendre le site public** tant que les pages légales n'ont pas été relues par un juriste (elles portent encore la mention « Brouillon »).
>
> Prix de la Régie de l'énergie : réutilisation acceptée par le propriétaire du projet le 2026-10-30. La Régie qualifie ces données de publiques et les offre au téléchargement, et d'autres sites les réutilisent. Elle n'a toutefois publié aucune licence (données ouvertes « à l'étude »). Garder la mention « Source : Régie de l'énergie » et suivre ses conditions si elle en publie.
>
> En attendant, on peut déployer une version de prévisualisation protégée (étape 3.4).

## Vue d'ensemble

| Pièce | Où | Région |
| --- | --- | --- |
| Site Next.js et routes `/api/*` | Vercel | `yul1` (Montréal), fixée dans `vercel.json` |
| Base de données, comptes, Edge Functions, tâches `pg_cron` | Supabase | Canada (Central), `ca-central-1` |
| Prix | Régie de l'énergie, importés toutes les 15 min | — |
| Itinéraires | Mapbox, appelé seulement par le serveur | — |

## 1. Prérequis

- Un dépôt Git : Vercel déploie à chaque `git push` sur `main` (CLAUDE.md). Le dossier n'est pas encore un dépôt Git. Créez-le, poussez-le sur GitHub, puis faites le premier commit par tâche du plan.
- Les comptes suivants :
  - Supabase ;
  - Vercel ;
  - Mapbox (le jeton existe déjà) ;
  - un fournisseur de courriel transactionnel (voir 2.4).

## 2. Supabase

### 2.1 Créer le projet

1. Dashboard Supabase → **New project** → région **Canada (Central)**.
2. Notez le mot de passe de la base dans un gestionnaire de mots de passe.

### 2.2 Envoyer le schéma et les fonctions

Depuis le dossier du projet :

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>   # le ref est dans l'URL du dashboard
npx supabase db push                               # rejoue supabase/migrations/ dans l'ordre
npx supabase functions deploy import-regie
npx supabase functions deploy import-nrcan
npx supabase config diff                           # aperçu, voir l'avertissement ci-dessous
npx supabase config push                           # réglages Auth et modèles de courriel de config.toml
```

⚠️ `config.toml` décrit l'environnement **local** : `site_url = "http://localhost:3000"`. `config push` le copierait en production. Pendant la confirmation, refusez la modification de `site_url`, des URL de redirection et du **secret CAPTCHA** (`config.toml` contient la clé de test de Cloudflare). Sinon, refaites les étapes 2.4 et 2.5 **après** chaque `config push`.

`db push` n'exécute **pas** `supabase/seed.sql`, et c'est voulu : ce fichier contient des secrets locaux de démonstration.

### 2.3 Secrets de la tâche planifiée (Vault)

La tâche `import-regie`, lancée toutes les 15 minutes, lit deux secrets dans le Vault. Pour les créer, ouvrez **SQL Editor** dans le dashboard et exécutez :

```sql
select vault.create_secret('https://<ref-du-projet>.supabase.co', 'project_url');
select vault.create_secret('<clé service_role>', 'service_role_key');
```

La clé `service_role` se trouve dans **Project Settings → API**. Ne la copiez **jamais** ailleurs que dans le Vault, et en aucun cas dans Vercel.

### 2.4 Comptes et courriels (Auth)

1. **Authentication → URL Configuration** (à refaire après chaque `config push`) :
   - Site URL : `https://<votre-domaine>` ;
   - Redirect URLs : le même domaine, plus l'URL de prévisualisation Vercel.
2. **Authentication → SMTP** : le service d'envoi intégré à Supabase ne sert qu'aux tests (quelques courriels par heure, seulement vers les membres de l'équipe). Branchez un fournisseur transactionnel (Postmark, Resend, Amazon SES `ca-central-1`…). Expéditeur suggéré : `GazMap Québec <connexion@votre-domaine>`.
3. Vérifiez que le modèle « Magic Link » affiche bien le code à 6 chiffres. C'est `supabase/templates/code-connexion.html`, envoyé par `config push`.

### 2.5 Anti-robot à l'inscription (Cloudflare Turnstile)

Sans cette vérification, un script pourrait demander des codes pour des milliers d'adresses. Il épuiserait le quota d'envoi et nuirait à la réputation de votre domaine.

1. Sur dash.cloudflare.com → **Turnstile** → **Add widget** : domaine `<votre-domaine>` (plus celui de prévisualisation Vercel), mode **Managed**.
2. La **clé de site** va dans Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, étape 3.2).
3. La **clé secrète** va dans Supabase, **Authentication → Attack Protection** → CAPTCHA → Turnstile. Elle ne va nulle part ailleurs (à refaire après chaque `config push`).

### 2.6 Sauvegardes

Le forfait gratuit de Supabase ne garde **aucune sauvegarde** récupérable par vous. Avant le lancement, passez au forfait **Pro**, qui fait des sauvegardes quotidiennes conservées 7 jours. Ajoutez l'option PITR si vous voulez revenir à n'importe quelle minute.

### 2.7 Premier chargement des données

1. **Prix :** attendez le premier passage de la tâche (15 min au plus), ou lancez-la tout de suite avec **Edge Functions → import-regie → Test (requête POST, sans corps)**.
2. **Véhicules :** lancez **Edge Functions → import-nrcan → Test** une fois, puis quelques fois par an.

Pour vérifier :

```sql
select count(*) from stations;                                       -- environ 2 500
select started_at, status, station_count from import_runs order by id desc limit 3;
select jobname, schedule from cron.job;                              -- import-regie, purge-abandoned-accounts
```

### 2.8 Statistiques agrégées (schéma `analytics`)

Le schéma `analytics` n'est **pas** exposé par l'API : ne l'ajoutez jamais dans **Settings → API → Exposed schemas**. Il ne contient que des vues agrégées (région × mois) : seuls les utilisateurs ayant consenti aux statistiques sont comptés, et une cellule de moins de 20 personnes distinctes n'apparaît pas.

Pour un export, dans l'éditeur SQL, une fois le mois terminé :

```sql
set role analytics_reader;   -- voit exactement ce qu'un acheteur verrait, rien de plus
select * from analytics.fill_up_prices where month = '2026-10-01';
select * from analytics.trip_activity  where month = '2026-10-01';
reset role;
```

Conservez le fichier exporté et ne refaites pas d'exports du même mois : comparer deux lectures avant et après le retrait d'un consentement pourrait isoler la contribution d'une personne. Pour donner un accès direct à un acheteur, créez-lui un utilisateur Postgres membre de `analytics_reader`, jamais une clé Supabase.

## 3. Vercel

### 3.1 Importer le dépôt

**Add New → Project** → choisir le dépôt GitHub. Le framework (Next.js), la commande de build (`npm run build`, qui construit aussi le service worker) et la région viennent de `vercel.json`.

### 3.2 Variables d'environnement

Dans **Settings → Environment Variables**, pour Production et pour Preview :

| Nom | Valeur | Visible dans le navigateur ? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref-du-projet>.supabase.co` | oui, c'est normal |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé publique (*publishable* ou *anon*) | oui, elle ne lit que ce que RLS permet |
| `NEXT_PUBLIC_MAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/liberty` | oui |
| `MAPBOX_DIRECTIONS_TOKEN` | un **nouveau** jeton Mapbox (voir 3.5) | **non**, serveur seulement |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | la clé de site Turnstile (2.5) | oui, elle est faite pour ça |

Ne mettez **jamais** la clé `service_role` dans Vercel.

### 3.3 Domaine

**Settings → Domains** : ajoutez votre domaine. Vercel s'occupe du certificat HTTPS et ajoute l'en-tête HSTS. Reportez ensuite le domaine dans Supabase (2.4).

### 3.4 Avant le lancement public

- **Settings → Deployment Protection** : activez « Vercel Authentication ». Seuls les membres de l'équipe Vercel voient alors le site.
- Pour le désactiver le jour du lancement, il faut que les deux conditions du haut de ce guide soient remplies.

### 3.5 Sécurité des comptes et des coûts

À faire une fois, avant le lancement :

1. **Double authentification (2FA)** sur GitHub, Vercel, Supabase, Mapbox et Cloudflare. Ces comptes donnent accès à tout : y entrer contourne toutes les protections du code.
2. **Nouveau jeton Mapbox.** Celui utilisé en développement a circulé dans une conversation. Créez un jeton réservé à la production (Mapbox → Access tokens), mettez-le dans Vercel, puis supprimez l'ancien.
3. **Plafond de dépenses Mapbox** : Mapbox → Billing → alertes d'utilisation. Le site limite déjà les appels (`src/lib/api-limits.ts`), mais chaque instance du serveur compte de son côté.
4. **Pare-feu Vercel** : **Firewall → Rules → Add rule**, chemin commençant par `/api/detours` ou `/api/itineraire`, action **Rate limit**, 60 requêtes par minute par IP. Cette limite vaut pour tous les serveurs à la fois, contrairement à celle du code.
5. **Mises à jour de sécurité** : sur GitHub, **Settings → Code security → Dependabot alerts et security updates**. En local, `npm audit` de temps en temps.

### 3.6 Alerte si les prix cessent de se mettre à jour

`https://<domaine>/api/sante` répond **200** si l'import tourne, **503** sinon :
- `import_stopped` : aucun import réussi depuis 45 minutes, soit 3 passages manqués ;
- `prices_stale` : la Régie n'a rien publié depuis 6 heures ;
- `database_unreachable` : Supabase ne répond pas.

1. Créez un compte gratuit chez un service de surveillance (UptimeRobot, Better Stack…).
2. Ajoutez une sonde **HTTP** sur cette adresse, toutes les 5 minutes, avec une alerte par courriel à makinetworksservices@gmail.com.
3. Testez l'alerte en suspendant la tâche une heure (SQL Editor : `select cron.unschedule('import-regie');`), puis remettez-la en relançant la migration `schedule_regie_import` (copiez son contenu dans le SQL Editor).

## 4. Vérifications après le premier déploiement

Sur un téléphone, en 4G, avec le Wi-Fi coupé :

- [ ] L'accueil affiche les prix en moins de 3 s (sur l'ordinateur, le test `e2e/performance.spec.ts` le mesure).
- [ ] « Ajouter à l'écran d'accueil » propose l'icône GazMap, et l'appli s'ouvre en plein écran.
- [ ] Un compte se crée avec le code reçu par courriel, et la suppression du compte fonctionne.
- [ ] Sans jeton anti-robot, Supabase refuse d'envoyer un code : `curl -s -X POST https://<ref>.supabase.co/auth/v1/otp -H "apikey: <clé publique>" -H "Content-Type: application/json" -d '{"email":"test@exemple.ca"}'` répond `captcha_failed`.
- [ ] `curl -sI https://<domaine>/` montre aussi `content-security-policy`, et la console du navigateur n'affiche aucune erreur « Content Security Policy » sur la carte ni sur `/compte`.
- [ ] `https://<domaine>/api/sante` répond `{"status":"ok", …}`, et la sonde de surveillance est verte.
- [ ] 40 appels rapides à `/api/detours` depuis la même machine finissent par recevoir des réponses `429`.
- [ ] Le guidage vocal démarre (Mapbox) ; sinon, les liens Waze, Google Maps et Plans s'affichent.
- [ ] En mode avion, l'appli s'ouvre et affiche le bandeau « Hors ligne ».
- [ ] `curl -sI https://<domaine>/` montre `x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy` et `strict-transport-security`.
- [ ] `curl -sI -H "Accept-Encoding: br" https://<domaine>/api/stations` montre `content-encoding: br`, puis `x-vercel-cache: HIT` à la deuxième requête.

## 5. Coûts à surveiller

| Service | Ce qui compte | Remarque |
| --- | --- | --- |
| Vercel | appels des fonctions | `/api/stations` est servie par le CDN : environ une construction par minute, quel que soit le trafic |
| Supabase | taille de la base, nombre de comptes | l'historique des prix grossit à chaque import qui change un prix |
| Mapbox | requêtes Matrix (`/api/detours`) et Directions (`/api/itineraire`) | sans jeton, le site estime les détours à vol d'oiseau et propose Waze, Google Maps et Plans |
