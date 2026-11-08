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
