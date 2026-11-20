# Registre interne d'anonymisation — GazMap Québec

> Document interne exigé par la Loi 25 (art. 23 de la Loi sur la protection des renseignements personnels dans le
> secteur privé et règlement sur l'anonymisation). **Brouillon à faire valider par un juriste avant la première vente
> ou communication de statistiques.** À tenir à jour à chaque nouvelle vue `analytics`, à chaque export et au moins une
> fois par an.

## 1. Responsable

| | |
| --- | --- |
| Responsable de la protection des renseignements personnels | (Marcel, Dirigeant)_ |
| Personne compétente qui mène l'analyse de risque | Marcel Loïs |
| Date de la première analyse de risque | _à remplir (avant le premier export)_ |
| Prochaine réévaluation | _au plus tard 12 mois après la précédente_ |

## 2. Finalités

Produire des statistiques sur le prix de l'essence au Québec (écart entre prix payé et prix affiché par la Régie, prix
moyens, activité des trajets) pouvant être **vendues ou communiquées à des tiers** (entreprises, chercheurs, médias,
organismes publics). Finalité annoncée dans le consentement « statistiques », version `2026-11-16`
(`STATISTICS_VERSION`, `src/features/account/consents.ts`).

## 3. Renseignements utilisés

Seulement ceux des personnes dont la **dernière** décision « statistiques » est un « oui » à une version qui annonce la
vente (`analytics.contributors`).

| Source | Champs utilisés | Jamais utilisés |
| --- | --- | --- |
| `public.fill_ups` | carburant, prix payé (¢/L), prix affiché (¢/L), date | identifiant (sert seulement au comptage), heure exacte |
| `public.trips` | région de la station, mois, mode (guidage ou lien externe), statut | identifiant, station exacte, heure exacte |
| `public.stations` | région administrative | — |

Ne sont **pas** sur le serveur, donc jamais dans les statistiques : position, adresse cherchée, destination, véhicule
(modèle, réservoir), niveau du réservoir, montant de la facture.

## 4. Techniques d'anonymisation

| Technique | Mise en œuvre |
| --- | --- |
| Agrégation | Cellules région administrative × mois (× carburant pour les prix) ; moyennes et proportions seulement |
| Seuil minimal | Cellule masquée si moins de **20 utilisateurs distincts** (`having count(distinct user_id) >= 20`) |
| Généralisation du temps | Mois civil (heure du Québec), jamais l'heure ni le jour |
| Généralisation du lieu | Région administrative, jamais la station |
| Arrondi | Prix en dixièmes de cent arrondis ; proportions à 2 décimales |
| Mois terminés seulement | Une cellule ne peut pas être observée pendant qu'elle se remplit |
| Copie figée | Un seul export par mois terminé, conservé ; jamais deux lectures du même mois (attaque par différence après un retrait de consentement) |
| Séparation | Schéma `analytics` non exposé par l'API ; rôle `analytics_reader` qui ne voit que les vues agrégées |

Implémentation : `supabase/migrations/*_analytics.sql`, `*_statistics_consent_version.sql` ; tests :
`supabase/tests/analytics.test.sql` ; export : `docs/DEPLOIEMENT.md`, section 2.8.

## 5. Analyse du risque de réidentification

Les trois critères du règlement :

| Critère | Risque | Mesure |
| --- | --- | --- |
| **Individualisation** (isoler une personne) | Faible | Aucune ligne individuelle ; ≥ 20 personnes par cellule ; région × mois |
| **Corrélation** (relier des jeux de données) | Faible | Ni identifiant, ni station, ni heure ; une personne n'est pas suivie d'un mois à l'autre ; aucun croisement véhicule × lieu |
| **Inférence** (déduire une information sur une personne) | Faible à modéré | Pas de cellule à < 20 personnes ; mois terminés ; copie figée unique. Risque résiduel : petites régions (Nord-du-Québec, Côte-Nord…) où 20 personnes peuvent rester repérables par recoupement local : réévaluer avant le premier export de ces régions |

Contrat avec chaque destinataire : interdiction de tenter de réidentifier, de croiser avec d'autres données pour
isoler une personne, et de revendre sans les mêmes clauses.

## 6. Règles pour toute nouvelle statistique

Avant d'ajouter une vue `analytics` ou une colonne :

- **Prix** : moyennes par station et par tranche horaire large (ex. 12 h – 14 h) acceptables, jamais l'heure exacte ni
  un identifiant ; garder le seuil de 20 personnes par cellule (rarement atteint par station : préférer la région).
- **Véhicule** (si un jour stocké sur le serveur, avec consentement) : catégories (VUS, berline compacte…) ou échelle
  ville / région ; **jamais** un modèle précis croisé avec une station précise.
- **Niveau du réservoir / plein** : jamais le pourcentage exact ni le montant de la facture ; tranches larges
  (ex. réservoir < 25 %) ou volumes moyens.
- Reprendre la jointure sur `analytics.contributors`, le seuil de 20, le filtre « mois terminé » ; accorder à
  `analytics_reader` seulement ; ajouter un test pgTAP ; mettre à jour ce registre et la politique de confidentialité
  (section « Statistiques »). Une nouvelle finalité exige une nouvelle version du consentement.

## 7. Journal

| Date | Événement | Vues / mois | Destinataire | Analyse de risque à jour ? | Par |
| --- | --- | --- | --- | --- | --- |
| 2026-10-29 | Création des vues `fill_up_prices`, `trip_activity` | — | — | à faire | — |
| 2026-11-16 | Consentement versionné (annonce de la vente) | — | — | à faire | — |
