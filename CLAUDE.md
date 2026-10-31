# GazMap Québec — instructions pour Claude Code

Site web (PWA installable sur l'écran d'accueil) qui recommande la station d'essence au **coût total du plein** le plus bas
près de l'utilisateur (prix × litres + coût du détour), ouvre l'itinéraire, puis recueille un retour après le plein
(carburant acheté, prix confirmé). Les données confirmées par les utilisateurs alimentent, plus tard, des produits de
données **agrégés** (jamais individuels). Le site est gratuit pour l'utilisateur.

Document de cadrage complet : voir le doc « Application Gaz Québec — Document de cadrage » (projet claude.ai « GAZ MAP APP QUEBEC »).
Plan de travail : `docs/PLAN.md` — travailler **une tâche à la fois**, dans l'ordre, et cocher la case une fois les critères d'acceptation remplis.

## Stack

| Couche | Choix |
| --- | --- |
| Site | Next.js (App Router) + React + TypeScript strict |
| Style | Tailwind CSS, mobile d'abord (la plupart des visites viennent d'un téléphone) |
| PWA | Manifest (`src/app/manifest.ts`) + service worker (`@serwist/next` en mode CLI, `src/sw/sw.ts`) : installable, coquille hors ligne. Ce qui est mis en cache est décidé par `src/features/pwa/cache-policy.ts` : jamais `/api/*` ni Supabase |
| Cartes | MapLibre GL JS (`react-map-gl/maplibre`) + tuiles MapTiler ou Mapbox ; itinéraires via l'API Mapbox Directions |
| Guidage | Guidage vocal virage par virage dans le site (`/trajet/[id]`, page ouverte au premier plan) : Mapbox Directions via la route API `/api/itineraire`, voix `speechSynthesis` fr-CA, Screen Wake Lock ; logique pure dans `src/features/navigation`. Liens profonds Waze / Google Maps / Apple Maps toujours proposés, et repli si géolocalisation ou Wake Lock indisponibles |
| Localisation / arrivée | API Geolocation du navigateur (`watchPosition`) seulement pendant un trajet, page ouverte |
| Backend | Supabase, **région Canada (ca-central-1)** : Auth, Postgres + PostGIS, Edge Functions, `pg_cron` |
| Requêtes / état | TanStack Query ; Zustand pour l'état local (profil véhicule sans compte dans `localStorage`, enveloppé de try/catch) |
| Tests | Vitest + Testing Library ; Playwright pour 2-3 parcours clés ; tests SQL `supabase test db` (pgTAP) |
| Hébergement | Netlify (adaptateur Next.js, `netlify.toml`), région des fonctions `yul` (Montréal, à côté de Supabase ; forfait Pro), déploiement à chaque push sur `main` ; procédure dans `docs/DEPLOIEMENT.md` |

Ne pas ajouter d'autre dépendance majeure sans le demander. Garder la logique métier dans `src/features/*` en TypeScript pur
(sans dépendance au DOM) pour pouvoir la réutiliser dans une future app React Native.

## Structure

```
src/
  app/                    # routes Next.js
    page.tsx              # carte + liste (accueil)
    station/[id]/page.tsx # fiche station
    trajet/[id]/page.tsx  # trajet en cours
    retour/[id]/page.tsx  # retour après le plein
    compte/               # connexion, réglages, consentements, suppression
    vehicule/             # profil véhicule
    legal/                # confidentialité, conditions
  features/               # logique métier pure (recommendation, vehicle, trip, feedback…)
  components/             # UI partagée
  lib/                    # client supabase, carte, i18n, formatage
  i18n/fr-CA.json         # TOUS les textes affichés
supabase/
  migrations/             # SQL versionné ; ne jamais modifier une migration déjà appliquée
  functions/              # edge functions (import-regie, import-nrcan…)
  fixtures/               # fichiers d'exemple Régie et RNCan
  tests/                  # pgTAP
docs/PLAN.md
```

## Règles métier

**Coût total du plein** (cœur du produit, couvert par des tests unitaires) :

```
litres_a_acheter = capacite_reservoir × (1 − niveau_actuel)      # défaut : 40 L si inconnu
km_detour        = distance_route_via_station − distance_route_directe ; à défaut aller-retour depuis la position
cout_detour      = km_detour × conso_L_100km / 100 × prix_station
cout_total       = prix_station × litres_a_acheter + cout_detour
```

- Prix stockés en **dixièmes de cent par litre** (entier, ex. 1839 = 183,9 ¢/L), distances en mètres ; affichage `183,9 ¢/L` (format fr-CA).
- Consommation : valeur combinée RNCan du véhicule ; défaut 9,5 L/100 km si aucun véhicule.
- Carburant recommandé : issu du jeu RNCan (X = ordinaire, Z = super, D = diesel, E = E85). Distinguer « super requis » et « super recommandé » quand l'info existe ; sinon afficher le type RNCan.
- Ne jamais fausser le classement par prix : toute station commanditée est étiquetée et n'altère pas l'ordre.

**Trajet et retour (limites du web)** : un site ne peut pas détecter l'arrivée en arrière-plan.
- Pendant un trajet, si la page reste ouverte, `watchPosition` déclenche la carte de retour à moins de 50 m de la station.
- Pendant le guidage, aucune position n'est envoyée au serveur sauf celle du départ et celles des recalculs d'itinéraire (sortie de trajet : > 50 m pendant 3 positions, au plus 1 recalcul / 15 s).
- Sinon, à la visite suivante (moins de 12 h après « J'y vais »), afficher « Avez-vous fait le plein chez X ? ».
- Arrêter `watchPosition` dès l'arrivée, l'annulation ou après 2 h.

## Données externes

- **Régie essence Québec** (prix temps réel, ~2 500 stations ; téléchargeable en Excel) : données publiques, réutilisation acceptée par le propriétaire du projet (2026-10-30) ; aucune licence formelle publiée par la Régie à ce jour. L'importateur passe par un **adaptateur** (`supabase/functions/import-regie/adapter.ts`) pour qu'un changement de format ne touche qu'un fichier. Si aucun fichier d'exemple n'est dans `supabase/fixtures/`, **demander à l'utilisateur** au lieu d'inventer un format. Afficher « Source : Régie de l'énergie » sur la carte.
- **RNCan — Cotes de consommation de carburant** (CSV par année modèle) : table de référence `vehicle_models`. Attribution requise.

## Vie privée (Loi 25) — non négociable

- La carte et la recommandation fonctionnent **sans compte**. Le compte sert à : profil véhicule synchronisé, « J'y vais », retours, historique.
- Localisation demandée par le navigateur seulement au moment où elle sert ; le site reste utilisable avec une adresse saisie.
- Bannière de témoins : aucun témoin ou script d'analyse non essentiel avant consentement. Aujourd'hui il n'y en a aucun : `StorageNotice` informe seulement (stockage essentiel). Tout outil non essentiel ajouté doit rester désactivé tant qu'un vrai choix « Accepter / Refuser » n'a pas été fait, et être listé dans la politique (section `temoins`).
- Deux consentements distincts, stockés avec horodatage : (1) conditions d'utilisation, (2) « contribuer anonymement aux statistiques » — **décoché par défaut**, retirable dans les réglages.
- Suppression du compte en libre-service (supprime toutes les données personnelles).
- Ne jamais journaliser (logs, Sentry, analytics) de coordonnées précises, de courriel ou de jeton.
- Aucune position de trajet n'est stockée (on garde station, date, carburant, prix). Purge quotidienne `pg_cron` : comptes sans conditions acceptées après **30 jours** et journaux Auth des comptes supprimés.
- RLS activée sur **toutes** les tables utilisateur ; aucune clé `service_role` côté navigateur.
- Données vendables dans un schéma séparé `analytics`, alimenté seulement par des vues agrégées avec **seuil minimal de 20 utilisateurs distincts** par cellule (zone × période). Aucun export direct des tables utilisateur. Implémenté dans `supabase/migrations/*_analytics.sql` : toute nouvelle vue y reprend la jointure sur `analytics.contributors`, le `having count(distinct user_id) >= 20` et le filtre « mois terminé », et n'est accordée qu'à `analytics_reader`.
- Factures (phase 2) lues dans le navigateur ; l'image n'est jamais envoyée au serveur.
- Concevoir comme si une app iOS/Android devait suivre : pas de transmission de localisation individuelle à des tiers.

## Conventions

- Interface en **français (fr-CA)** ; aucun texte en dur dans les composants, tout passe par `src/i18n/fr-CA.json`.
- Code, noms de variables, commits et migrations en anglais ; URL en français.
- TypeScript strict, pas de `any`. Types Supabase générés : `npx supabase gen types typescript --local > src/lib/database.types.ts`.
- Accessibilité : libellés sur tous les boutons, contrastes AA, navigation au clavier, cibles tactiles ≥ 44 px. Vérifiée par axe-core dans `e2e/accessibilite.spec.ts` : toute nouvelle page y est ajoutée.
- Performance : accueil utilisable en < 3 s sur un téléphone moyen en 4G, mesuré par `e2e/performance.spec.ts` (profil mobile de Lighthouse). La liste des stations passe par `/api/stations` (format compact, brotli, CDN 60 s, préchargée par la page) : ne pas la relire directement depuis Supabase dans le navigateur.
- Un commit par tâche du plan.

## Commandes

```bash
npm run dev                 # site en local (http://localhost:3000)
npx supabase start          # backend local
npx supabase db reset       # rejouer migrations + seed
npx supabase test db        # tests SQL
npm test                    # Vitest
npx playwright test         # parcours de bout en bout
npm run typecheck && npm run lint   # typecheck = site + service worker (src/sw)
npm run build && npx next start   # seul moyen de tester le service worker (désactivé en dev)
npm run icons               # régénérer les PNG après modification de public/icons/*.svg
```

Avant de déclarer une tâche finie : `npm run typecheck`, `npm run lint`, `npm test` et `npx supabase test db` passent.

## Secrets

Dans `.env.local` (jamais commité) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAP_STYLE_URL`,
`MAPBOX_DIRECTIONS_TOKEN` (côté serveur seulement, appels via une route API), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (anti-robot avant l'envoi d'un code ; sa clé secrète vit seulement dans Supabase). Garder `.env.example` à jour.

## Sécurité

- Toute route API qui appelle un service payant passe d'abord par `rateLimited()` (`src/lib/api-limits.ts`) : limite par adresse et par instance, réponse 429.
- Connexion : Supabase exige un jeton Turnstile (`[auth.captcha]`) ; le script Cloudflare n'est chargé que sur `/compte`, jamais sur la carte.
- Content-Security-Policy construite par `src/features/security/csp.ts` (production seulement) : tout nouveau service contacté par le navigateur doit y être ajouté, sinon `e2e/securite.spec.ts` échoue.
- Écritures des utilisateurs : privilèges par colonne. Le navigateur n'envoie que les champs saisis (trajet : `station_id, fuel, mode` ; retour : `trip_id, filled, fuel, price_paid` ; consentement : `kind, granted, document_version` ; fin de trajet : `status`). Identifiants, propriétaire, dates et prix viennent de la base. Toute nouvelle table utilisateur suit la même règle (`grant insert (colonnes…)`), avec un test pgTAP qui tente d'antidater une ligne.
- `/api/sante` (200 / 503) surveille l'import des prix ; règles dans `src/features/stations/import-health.ts`.
- Réglages de comptes à faire hors du code (2FA, limite de requêtes Netlify, plafond Mapbox, sauvegardes, Dependabot) : `docs/DEPLOIEMENT.md`, section 3.5.
