// ══════════════════════════════════════════════════════
// GAAM-Finances — constantes
// ══════════════════════════════════════════════════════

export const ORG = {
  sigle: "GAAM ASBL",
  nom: "Groupe d'Action des Amis de Momba",
  devise: "Transformer des vies, bâtir de l'espoir",
  ville: "Kinshasa, R.D. Congo",
  site: "www.gaamasbl.org",
  email: "contact@gaamasbl.org",
};

// ── Rôles ─────────────────────────────────────────────
// Règle de base : celui qui saisit une écriture ne peut pas la valider.
export const ROLES = {
  admin:      { label: "Administrateur Président", court: "Admin",      desc: "Gère les utilisateurs, saisit et valide." },
  tresorier:  { label: "Trésorière / Trésorier",   court: "Trésorerie", desc: "Saisit, valide, gère les activités et les taux." },
  saisie:     { label: "Agent de saisie",          court: "Saisie",     desc: "Saisit les recettes et les dépenses avec leurs pièces." },
  validateur: { label: "Validateur (CA)",          court: "Validation", desc: "Valide ou rejette les écritures saisies par d'autres." },
  lecteur:    { label: "Lecteur (CA / Contrôle)",  court: "Lecture",    desc: "Consulte le journal et les rapports." },
};

export const peutSaisir          = (r) => ["admin", "tresorier", "saisie"].includes(r);
export const peutValider         = (r) => ["admin", "tresorier", "validateur"].includes(r);
export const peutGererActivites  = (r) => ["admin", "tresorier"].includes(r);
export const peutAnnuler         = (r) => ["admin", "tresorier"].includes(r);
export const estAdmin            = (r) => r === "admin";

// ── Devises ───────────────────────────────────────────
export const DEVISES = {
  USD: { label: "USD", symbole: "$",  prefixe: "$", suffixe: "",    locale: "en-US", decimales: 2 },
  CDF: { label: "CDF", symbole: "FC", prefixe: "",  suffixe: " FC", locale: "fr-FR", decimales: 0 },
  EUR: { label: "EUR", symbole: "€",  prefixe: "",  suffixe: " €",  locale: "fr-FR", decimales: 2 },
};
// Taux indicatifs (francs congolais pour 1 unité). Modifiables dans Réglages.
// Ils servent uniquement à donner un équivalent en dollars dans les rapports :
// aucune écriture n'est jamais convertie.
export const TAUX_DEFAUT = { CDF: 1, USD: 2850, EUR: 3100 };

// ── Domaines d'intervention de GAAM ───────────────────
export const DOMAINES = [
  { id: "orphelins",   label: "Soutien aux orphelins" },
  { id: "formation",   label: "Formation professionnelle des jeunes" },
  { id: "microfinance",label: "Microfinance solidaire" },
  { id: "eau_sante",   label: "Accès à l'eau et à la santé" },
  { id: "agro",        label: "Développement agro-pastoral" },
  { id: "education",   label: "Éducation accessible" },
  { id: "institution", label: "Vie de l'association" },
];

// ── Catégories ────────────────────────────────────────
export const CAT_RECETTES = [
  { id: "r_cotisation", label: "Cotisations des membres" },
  { id: "r_don",        label: "Dons de particuliers" },
  { id: "r_diaspora",   label: "Dons de la diaspora" },
  { id: "r_enligne",    label: "Dons en ligne (PayPal)" },
  { id: "r_collecte",   label: "Collecte lors d'un événement" },
  { id: "r_partenaire", label: "Subventions et partenaires" },
  { id: "r_nature",     label: "Dons en nature (valeur estimée)" },
  { id: "r_autre",      label: "Autres recettes" },
];

export const CAT_DEPENSES = [
  { id: "d_vivres",     g: "Bénéficiaires", label: "Vivres et dons remis" },
  { id: "d_scolaire",   g: "Bénéficiaires", label: "Fournitures scolaires" },
  { id: "d_sante",      g: "Bénéficiaires", label: "Santé et médicaments" },
  { id: "d_eau",        g: "Bénéficiaires", label: "Eau et hygiène" },
  { id: "d_transport",  g: "Logistique",    label: "Transport et carburant" },
  { id: "d_repas",      g: "Logistique",    label: "Restauration et rafraîchissement" },
  { id: "d_location",   g: "Logistique",    label: "Location (salle, matériel, sono)" },
  { id: "d_hebergement",g: "Logistique",    label: "Hébergement" },
  { id: "d_impression", g: "Communication", label: "Impression (bannières, livrets)" },
  { id: "d_visibilite", g: "Communication", label: "Polos et visibilité" },
  { id: "d_media",      g: "Communication", label: "Photo, vidéo, médias" },
  { id: "d_web",        g: "Communication", label: "Site web et internet" },
  { id: "d_formation",  g: "Projets",       label: "Formation professionnelle" },
  { id: "d_microfin",   g: "Projets",       label: "Microfinance (fonds remis)" },
  { id: "d_agro",       g: "Projets",       label: "Agro-pastoral" },
  { id: "d_equipement", g: "Projets",       label: "Équipement et matériel" },
  { id: "d_admin",      g: "Fonctionnement",label: "Frais administratifs et juridiques" },
  { id: "d_banque",     g: "Fonctionnement",label: "Frais bancaires, PayPal, mobile money" },
  { id: "d_bureau",     g: "Fonctionnement",label: "Fournitures de bureau" },
  { id: "d_telephone",  g: "Fonctionnement",label: "Téléphone et crédit" },
  { id: "d_autre",      g: "Fonctionnement",label: "Autres dépenses" },
];

const TOUTES = [...CAT_RECETTES, ...CAT_DEPENSES];
export const categorie = (id) => TOUTES.find((c) => c.id === id) || { id, label: id || "—" };

// ── Modes de paiement ─────────────────────────────────
export const MODES = [
  { id: "especes",  label: "Espèces" },
  { id: "mobile",   label: "Mobile money" },
  { id: "banque",   label: "Banque" },
  { id: "paypal",   label: "PayPal" },
  { id: "transfert",label: "Transfert (Western Union…)" },
  { id: "nature",   label: "En nature" },
];
export const mode = (id) => MODES.find((m) => m.id === id) || { id, label: id || "—" };

// ── Types de pièces justificatives ────────────────────
export const TYPES_PIECE = [
  { id: "recu",    label: "Reçu ou facture" },
  { id: "devis",   label: "Devis" },
  { id: "paiement",label: "Preuve de paiement" },
  { id: "remise",  label: "Photo de la remise" },
  { id: "liste",   label: "Liste ou décharge signée" },
  { id: "autre",   label: "Autre" },
];
export const typePiece = (id) => TYPES_PIECE.find((t) => t.id === id) || { id, label: id || "Pièce" };

// ── Sources d'une écriture reconstituée ───────────────
export const SOURCES_RECONSTITUTION = [
  "Reçu ou facture retrouvé",
  "Relevé PayPal, bancaire ou mobile money",
  "Message écrit (WhatsApp, e-mail)",
  "Déclaration écrite de la personne concernée",
  "Témoignage de deux membres",
];

// ── Statuts d'une écriture ────────────────────────────
export const STATUTS = {
  en_attente: { label: "En attente", classe: "attente" },
  validee:    { label: "Validée",    classe: "ok" },
  rejetee:    { label: "Rejetée",    classe: "rejet" },
  annulee:    { label: "Annulée",    classe: "annule" },
};

// Activité fictive pour ce qui ne relève d'aucune activité
export const GENERAL = { id: "general", nom: "Fonctionnement général" };

export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
