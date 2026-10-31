# Plan de travail — GazMap Québec

Une tâche à la fois, dans l'ordre. Cocher la case quand **tous** les critères d'acceptation sont remplis
(`npx tsc --noEmit`, `npm run lint`, `npm test` passent ; `npx supabase test db` à partir de la tâche 3). Un commit par tâche.

## Phase 1 — Carte des prix (sans backend)

- [x] **1. Socle Next.js + carte des stations (données locales)**
  - Next.js (App Router) + TypeScript strict + Tailwind + Vitest initialisés ; dépôt git créé.
  - Fichier Régie copié dans `supabase/fixtures/regie/` (exemple de format de référence).
  - Adaptateur pur `supabase/functions/import-regie/adapter.ts` : lignes Excel → `Station[]`
    (prix `"185.9¢"` → `1859`, `"N/D"` ou vide → `null`, lignes sans coordonnées ignorées).
    Tests unitaires de l'adaptateur.
  - Script `npm run data:regie` : lit l'Excel et produit `public/data/stations.json` (en attendant Supabase).
  - Accueil `src/app/page.tsx` : carte MapLibre centrée sur le Québec, une pastille par station colorée selon le prix,
    sélecteur de carburant (ordinaire / super / diesel), clic → fiche (nom, bannière, adresse, 3 prix au format `183,9 ¢/L`).
  - Mention « Source : Régie de l'énergie » visible sur la carte.
  - Tous les textes dans `src/i18n/fr-CA.json`. Mobile d'abord, cibles tactiles ≥ 44 px.

- [x] **2. Liste des stations près de moi**
  - Bouton « Me localiser » (Geolocation demandée au clic seulement) + champ d'adresse en alternative.
  - Liste triée par prix des stations dans un rayon réglable, synchronisée avec la carte.
  - Formatage fr-CA dans `src/lib/format.ts`, testé.

## Phase 2 — Backend Supabase

- [x] **3. Supabase local + schéma stations**
  - `supabase init`, migration `stations` (PostGIS `geography(Point)`, prix en entiers, `updated_at`), RLS lecture publique.
  - Tests pgTAP du schéma.
- [x] **4. Import Régie automatisé**
  - Edge Function `import-regie` utilisant l'adaptateur de la tâche 1 ; `pg_cron` périodique ; historique des prix.
  - Le site lit les stations depuis Supabase (TanStack Query) au lieu du JSON.
- [x] **5. Requête « stations proches »** : fonction SQL PostGIS (rayon, carburant), testée.

## Phase 3 — Recommandation au coût total

- [x] **6. Calcul du coût total du plein** : `src/features/recommendation` (formule du CLAUDE.md), tests unitaires exhaustifs.
- [x] **7. Profil véhicule sans compte** : Zustand + `localStorage` (try/catch), import RNCan → `vehicle_models`, attribution.
- [x] **8. Détour réel** : route API serveur vers Mapbox Directions (jeton côté serveur), repli aller-retour.
- [x] **8a. Itinéraire et module de navigation pur**
  - Route API `POST /api/itineraire` (Mapbox Directions `driving-traffic`, `steps`, `voice_instructions`,
    `banner_instructions`, `language=fr`, `geojson`, `overview=full`) : reçoit l'id de la station (cherchée en base,
    pas de destination libre), renvoie seulement ce dont le client a besoin ; jeton côté serveur, aucune coordonnée journalisée.
  - `src/features/navigation` sans DOM : progression (projection sur la ligne, distance et durée restantes, étape,
    prochaine manœuvre), sortie de trajet (> 50 m sur 3 positions, ≤ 1 recalcul / 15 s), annonces vocales
    (`distanceAlongGeometry`, une seule fois, pas d'annonce périmée), arrivée (< 50 m de la station), liens profonds.
  - Tests Vitest sur un trajet GeoJSON de démonstration à Montréal (synthétique, au format Mapbox).
- [x] **8b. Écran de guidage `/trajet/[id]`**
  - Carte MapLibre centrée sur l'utilisateur, orientée dans le sens de déplacement, tracé du trajet.
  - Bandeau haut : icône + distance + rue de la prochaine manœuvre ; bas : durée, distance, heure d'arrivée.
  - Voix `speechSynthesis` (fr-CA sinon fr), bouton couper le son ; Screen Wake Lock redemandé sur `visibilitychange`,
    relâché à l'arrivée et à l'arrêt ; reprise du trajet après avoir quitté la page (localStorage, 2 h max).
  - Message de sécurité court avant le départ ; « Arrêter » et « Ouvrir dans Waze / Google Maps » toujours visibles.
  - Repli sur les liens externes si géolocalisation ou Wake Lock non supportés, localisation refusée ou itinéraire
    indisponible ; Wake Lock refusé en cours de route → guidage maintenu avec avertissement.
  - Contrôleur de guidage en TS pur (dépendances injectées), testé avec un faux GPS.
- [x] **8c. Arrivée → carte de retour**
  - À < 50 m : arrêt de `watchPosition`, Wake Lock relâché, ouverture de `/retour/[id]` (version minimale, rien
    n'est enregistré avant la tâche 12).
  - Test Playwright : déplacement simulé le long du trajet (géolocalisation mockée) jusqu'à la carte de retour ;
    une seule requête d'itinéraire ; repli quand la localisation est refusée.
- [x] **9. Classement affiché** : meilleure station mise en avant, étiquette « commanditée » sans effet sur l'ordre.

## Phase 4 — Comptes, trajet, retour

- [x] **10. Auth Supabase + consentements** (conditions ; statistiques décoché par défaut), horodatés, retirables.
- [x] **11. « J'y vais »** : historique des trajets pour les comptes (liens profonds et `watchPosition` déjà faits en 8b).
- [x] **12. Retour après le plein** : enregistrer la réponse de `/retour/[id]` (ouverte à < 50 m, tâche 8c) ou à la visite suivante (< 12 h) ; carburant + prix confirmé.
- [x] **13. Suppression du compte** en libre-service + purge 30 jours (`pg_cron`) : aucune position n'étant stockée, la purge vise les comptes sans conditions acceptées et les journaux Auth des comptes supprimés.

## Phase 5 — Mise en production

- [x] **14. PWA** : manifest, `@serwist/next`, coquille hors ligne, installable.
- [x] **15. Bannière de témoins, pages légales, accessibilité AA, Playwright (2-3 parcours).** Textes légaux encore en brouillon : relecture par un juriste avant la mise en ligne.
- [x] **16. Déploiement Vercel**, `.env.example` à jour, budget performance < 3 s en 4G. Configuration prête (en-têtes, `docs/DEPLOIEMENT.md`) ; hébergeur passé de Vercel à Netlify le 2026-10-31 (`netlify.toml`) ; mise en ligne publique en attente de la relecture juridique (réutilisation des prix Régie acceptée le 2026-10-30).
- [x] **17. Schéma `analytics`** : vues agrégées, seuil 20 utilisateurs distincts par cellule. Vues `fill_up_prices` et `trip_activity` (région × mois, mois terminés, consentement « statistiques » en cours), rôle `analytics_reader` ; procédure d'export dans `docs/DEPLOIEMENT.md` (2.8).
