# Design — site public La Qualia

Direction : **classique soigné**, doux et rassurant (niveau de finition visé : Headspace / Calm). Implémentation : `site.css`, chargée après `styles.css` par `/` et `/en/` seulement. L'application `/agent/` garde ses propres styles et n'est pas concernée.

## Couleurs

| Rôle | Valeur | Usage |
|---|---|---|
| Fond | `#fcfbf8` | page |
| Surface | `#ffffff` | cartes, formulaire, FAQ |
| Brume | `#f4f1fa` | panneaux des trois leviers, bloc « Notre valeur » |
| Encre | `#1c1631` | titres et texte principal (jamais noir pur) |
| Encre 2 / 3 | `#4c4662` / `#6e6884` | texte secondaire / légendes |
| Ligne | `#e9e4f1` | bordures fines |
| Marque | `#401098` (survol `#531fbd`) | seule couleur d'action : boutons, liens actifs |
| Nuit | `#1a1236` | section Évolution, pied de page |
| Accents du logo | orange `#ff5a00`, corail `#ff735c`, bleu `#005dff`, lime `#c7ff00` | petites touches seulement (point final des titres, icônes, courbes) |

Les leviers gardent une couleur d'identification discrète (`--band`) : violet (formé), bleu `#0052e0` (outillé), orange brûlé `#b33c00` (encadré), utilisée seulement pour le mot souligné et l'élément actif.

## Typographie

- Titres : Young Serif 400, interlettrage −0.02em, `text-wrap: balance`.
- Texte : Manrope, 17 px de base, interligne 1,65–1,7.
- Petits libellés au-dessus des titres : 13 px, 700, capitales espacées, couleur marque.

## Formes et profondeur

- Rayons : 40 px (grands panneaux), 28 px (cartes majeures, fenêtres), 20 px (cartes), 14 px (champs), pilule (boutons).
- Ombres en deux couches, décalées et diffuses, teintées d'encre prune (`--sh-1` à `--sh-3`). Pas de halo coloré.
- Les grands panneaux (accueil, leviers, Évolution, contact, pied de page) sont en retrait de 8 à 20 px des bords de l'écran.

## Composants

- Bouton principal : pilule violette, flèche SVG qui glisse au survol.
- En-tête : clair et translucide ; une bordure apparaît au défilement.
- FAQ : chaque question est une carte ; l'icône + pivote en ×.
- Interrupteur de consentement : case native restylée en bascule.

## Mouvement

Une seule entrée : le texte de l'accueil monte et se précise au chargement. Tout est désactivé avec `prefers-reduced-motion`.
