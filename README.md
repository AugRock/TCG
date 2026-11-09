# Tribunes — jeu de cartes à collectionner (prototype)

Prototype jouable d'un TCG en ligne, inspiré de WikiMasters, Terradex, Policards et Terrafront :
on ouvre des paquets, on complète sa collection, on affronte un adversaire en « bataille de stats ».

**Thème actuel : les stades mythiques du monde** (football, rugby, tennis, cricket, baseball, F1…).

## Lancer
Aucune installation : ouvrir `index.html` dans un navigateur
(ou `python3 -m http.server` puis http://localhost:8000).
La progression est sauvegardée dans le navigateur (localStorage).

## Fonctionnalités
- **Boutique** : paquet gratuit toutes les 4 h, paquet standard (1 rare min.), paquet prestige (1 épique min.)
- **4 raretés** : commune, rare, épique, légendaire
- **Photos réelles** des stades (Wikimedia Commons, licences libres, auteur crédité dans la fiche de la carte)
- **Cartes full art** pour les épiques et légendaires : photo sur toute la carte, reflet holographique et inclinaison 3D qui suivent la souris
- **Collection** : progression, filtres par sport/rareté, fiche détaillée, recyclage des doublons en pièces
- **Duel** : ton deck = tes 5 meilleures cartes ; choisis Capacité / Ancienneté / Prestige, premier à 3 manches

## Structure
- `js/data.js` — **le thème** (cartes, raretés, stats). Changer de thème = remplacer ce fichier.
- `js/images.js` — chargement des photos depuis Wikipedia/Commons (avec cache)
- `js/app.js` — le moteur (paquets, collection, duel, sauvegarde)
- `index.html`, `styles.css` — l'interface

## Photos
Au lancement, le navigateur demande à Wikipedia l'image principale de chaque article (champ `wiki` dans `data.js`),
puis récupère sur Commons l'URL, l'auteur et la licence. Seuls les fichiers libres hébergés sur Commons sont gardés.
Si une photo ne convient pas (logo, plan…), ajoute `image: "Nom_du_fichier.jpg"` (nom de fichier Commons) à la carte.
Sans connexion, les cartes s'affichent avec une icône à la place de la photo.

## Idées de thèmes sportifs
| Thème | Pourquoi ça marche | Point d'attention |
|---|---|---|
| **Stades & arènes** (actuel) | Données réelles et vérifiables (capacité, année), mélange géographie + sport, pas de droits à l'image | Moins « émotionnel » que des joueurs |
| **Moments de légende** (finales, records, exploits) | Très fort en nostalgie, raretés naturelles (un 9.58 s de Bolt = légendaire) | Contenu à rédiger à la main |
| **Clubs du monde** | Stats faciles (titres, fondation, budget), rivalités = mécanique de duel | Logos et noms de marque protégés : ne pas utiliser les écussons |
| **Joueurs / athlètes** | L'idée la plus attractive | Droits à l'image (licences FIFPro, NBA…) : risqué pour un projet public |
| **Disciplines olympiques** | Énorme variété, éducatif | Stats moins évidentes à comparer |
| **Circuits & courses** (F1, Tour de France, marathons) | Stats chiffrées (longueur, dénivelé, virages) | Public plus de niche |

## Pistes pour la suite
- Comptes en ligne + sauvegarde serveur (Supabase / Firebase)
- Données générées automatiquement depuis Wikipedia/Wikidata (rareté = popularité de la page, comme WikiMasters)
- Échanges entre joueurs, classement, quêtes quotidiennes, sets saisonniers

## Base de données : 1000 stades de France
`scripts/build-cards.mjs` génère `js/cards.js` à partir de :
- **Recensement des équipements sportifs** (RES, ministère des Sports, jeu `data-es` sur equipements.sports.gouv.fr) :
  tous les équipements avec au moins 300 places en tribune, commune, région, année de mise en service, coordonnées
- **Wikidata** (CC0), rattaché au RES par proximité GPS (< 500 m) : stades en France non démolis, capacité, ouverture, ville, région, sport, club résident, photo
- **OpenStreetMap** (ODbL, attribution obligatoire) : optionnel (`USE_OSM=1`), serveurs publics souvent saturés
- **Wikimedia Commons** : URL, auteur et licence des photos

Rareté et prestige sont calculés à partir de la notoriété (nombre de Wikipédias qui parlent du lieu), répartis par sport :
chaque sport d'au moins 8 lieux a sa légendaire (le football en a 6), au moins 2 épiques et 3 rares ;
au total ≈ 4 % d'épiques et 15 % de rares. Le prestige est le meilleur entre le rang global et le rang dans sa discipline.

Le script tourne sur GitHub Actions (onglet **Actions → Générer les cartes → Run workflow**, nombre de cartes réglable)
et enregistre le résultat. Rapport du dernier passage : `data/build-report.txt`.

## Cartes légendaires
- **Ouverture de paquet** : si le paquet contient une légendaire, animation plein écran (tunnel des joueurs, entrée
  dans le stade, puis région → sport → ville → capacité → carte). Toucher l'écran pour passer. Code : `js/walkout.js`.
- **Vue 3D** : toucher une légendaire dans la collection ouvre une vue 3D du lieu, générée avec Three.js (`js/stadium3d.js`).
  Six décors selon le sport : stade (foot, rugby, athlé, tennis), salle couverte (basket, hand, hockey, natation, multisport),
  arènes, hippodrome, circuit, vélodrome. Taille des tribunes selon la capacité ; infos sur écran géant / cube suspendu,
  panneaux LED, tifo ou fronton de tribune.
  Ce n'est pas la maquette exacte du vrai stade. Three.js (MIT) est inclus dans `js/vendor/`.

## Mode démo (pour tester)
Ajoute `?demo=1` à l'adresse (ex. `https://augrock.github.io/TCG/?demo=1`), ou tape 5 fois rapidement sur le logo.
- Paquets gratuits et illimités, minuteur désactivé
- Boutons « Tester l'animation légendaire » et « Tester la vue 3D »
- Forcer la rareté des cartes tirées, débloquer toute la collection, ajouter des pièces, réinitialiser
- Progression séparée de la vraie partie ; `?demo=0` ou « Quitter le mode démo » pour en sortir

## Publier une nouvelle version
Les navigateurs gardent les fichiers en cache. À chaque mise à jour, augmenter le numéro `?v=` dans `index.html`
(et dans le pied de page « Tribunes vX.Y ») pour que les joueurs reçoivent les nouveaux fichiers.
