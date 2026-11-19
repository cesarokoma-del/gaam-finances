# GAAM-Finances

Application de suivi financier de GAAM ASBL, adaptée d'ECIG-Finances.
Version allégée, centrée sur les **activités** : chaque recette et chaque dépense
est rattachée à une activité, avec sa pièce justificative photographiée, puis
validée par une seconde personne. Le rapport financier d'une activité sort en un clic.

## Ce que fait l'application

- **Saisir** : recette ou dépense, activité, montant (USD, CDF, EUR), catégorie,
  tiers, mode de paiement, photo du reçu. Sans pièce, un motif est obligatoire.
- **Valider** : une écriture reste « en attente » tant qu'une *autre* personne
  habilitée ne l'a pas validée ou rejetée. On ne valide jamais sa propre saisie.
- **Caisse** : ce que GAAM détient, lieu par lieu (caisse en espèces, mobile money, banque, PayPal), avec le
  livre de caisse (entrée, sortie, solde après chaque opération) et le nom du détenteur des fonds.
  Un **transfert** déplace de l'argent d'un lieu à l'autre sans compter comme recette ni dépense.
- **Journal** : toutes les écritures, avec filtres (à valider, sans pièce, mes rejets) et export CSV.
- **Rapports** : par activité ou par période — synthèse, recettes et dépenses par
  catégorie, détail, points d'attention, signatures. Impression / PDF et export CSV.
- **Rien ne s'efface** : une écriture validée s'annule avec un motif et reste visible.
- **Écritures reconstituées** : pour rattraper une activité passée dont les traces
  manquent, cochez « reconstituée » et indiquez la source ; le rapport les signale à part.
- **Hors connexion** : une saisie faite sans réseau part au retour d'internet.

## Rôles

| Rôle | Saisir | Valider | Créer une activité, taux | Budget, clôture, annulation, détenteur des fonds | Utilisateurs |
|---|---|---|---|---|---|
| Administrateur Président | oui | oui | oui | oui | oui |
| Trésorière / Trésorier | oui | oui | oui | non | non |
| Agent de saisie | oui | non | non | non | non |
| Validateur (CA) | non | oui | non | non | non |
| Lecteur (CA / Contrôle) | non | non | non | non | non |

La Trésorerie garde l'argent : elle ne peut donc pas, seule, annuler une écriture validée, fixer ou
modifier un budget, clôturer une activité, ni désigner le détenteur d'une caisse (Statuts, art. 19, 21, 24 et 28).

Il faut au moins deux personnes actives pouvant valider ou saisir, puisque nul ne valide sa propre saisie.

## Essayer tout de suite (mode démonstration)

```bash
npm install
npm run dev
```

Sans fichier `.env`, l'application démarre en mode démonstration : les données
restent dans le navigateur. Le bouton « Essayer avec un exemple fictif » crée trois
comptes et une activité d'exemple ; le sélecteur « Voir comme » permet de passer de
l'un à l'autre pour essayer la validation à deux.

## Mise en service avec Firebase (projet propre à GAAM)

1. **Créer le projet** sur https://console.firebase.google.com (par ex. `gaam-finances`),
   avec le compte Google de GAAM. Ne pas réutiliser `ecig-gestion`.
2. **Authentication** > Mode de connexion > activer **Adresse e-mail/Mot de passe**.
3. **Firestore Database** > Créer une base (mode production, région `europe-west1` par exemple).
4. **Règles** : coller le contenu de `firestore.rules` dans Firestore > Règles, puis Publier.
5. **Application web** : Paramètres du projet > Vos applications > icône `</>` ; copier la configuration.
6. Copier `.env.example` en `.env` et y coller les six valeurs.
7. `npm run dev` : l'écran « Première installation » crée le compte de l'Administrateur
   Président. Faites-le vous-même, aussitôt les règles publiées.
8. Dans Réglages, ajouter la Trésorière et les autres utilisateurs. Chacun reçoit un
   mot de passe provisoire qu'il change à sa première connexion.

### Mise en ligne (Vercel ou Netlify)

- Pousser ce dossier dans un dépôt GitHub (le fichier `.env` n'y va pas).
- Netlify > Add new site > Import from GitHub. La commande (`npm run build`) et le
  dossier (`dist`) sont déjà dans `netlify.toml`.
- Netlify > Site configuration > Environment variables : ajouter les six `VITE_FIREBASE_…`.
- Firebase > Authentication > Paramètres > Domaines autorisés : ajouter le domaine du site
  (par ex. `finances.gaamasbl.org`).

### Logo

Déposer le logo dans `public/logo.png` : il apparaît sur l'écran d'entrée et en tête des rapports.

## À savoir

- Les pièces sont réduites puis stockées dans Firestore (pas de Storage payant) :
  photos compressées, PDF jusqu'à 650 Ko, cinq pièces par envoi.
- Les taux (Réglages) ne servent qu'à l'équivalent en dollars des rapports ; aucune écriture n'est convertie.
- Les catégories, rôles et modes de paiement se modifient dans `src/lib/constantes.js`.
- `firestore.rules` n'a pas pu être essayé contre un vrai projet Firebase lors de la
  rédaction : après l'installation, vérifiez qu'un agent de saisie ne peut pas valider
  sa propre écriture et qu'un lecteur ne peut rien saisir.

## Structure

```
src/App.jsx              coque : session, navigation
src/composants.jsx       fiche d'écriture, pièces, fenêtres
src/pages/               Accueil, Saisie, Journal, Activites, Rapports, Admin, Connexion
src/store/firebase.js    enregistrement Firebase
src/store/demo.js        mode démonstration
src/lib/                 constantes et outils
firestore.rules          règles de sécurité
```
