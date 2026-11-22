import { DEVISES, TAUX_DEFAUT, GENERAL, categorie } from "./constantes";

// ── Formats ───────────────────────────────────────────
export const fmtMontant = (n, devise = "USD") => {
  const d = DEVISES[devise] || DEVISES.USD;
  const v = Math.abs(n || 0);
  const txt = v.toLocaleString(d.locale, { minimumFractionDigits: d.decimales, maximumFractionDigits: d.decimales });
  return `${n < 0 ? "−" : ""}${d.prefixe}${txt}${d.suffixe}`;
};

export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// "2026-07-11" → "11/07/2026"
export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [a, m, j] = String(iso).slice(0, 10).split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
};

export const fmtDateHeure = (ms) => {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

export const fmtNumero = (annee, n) => `GAAM-${annee}-${String(n).padStart(4, "0")}`;
export const anneeDe = (iso) => parseInt(String(iso || aujourdhui()).slice(0, 4), 10);

export const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const genMotDePasse = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

// ── Calculs ───────────────────────────────────────────
// ── Taux de change ────────────────────────────────────
// Chaque écriture en FC ou en EUR garde le taux du jour de l'opération (champ « taux ») :
//   CDF → nombre de FC pour 1 USD ;  EUR → nombre d'USD pour 1 EUR ;  USD → aucun.
// Son équivalent en dollars ne bouge donc plus quand on change le taux des Réglages.
// Les écritures plus anciennes, sans taux, prennent celui des Réglages.
export const tauxParDefaut = (devise, taux) => {
  const t = { ...TAUX_DEFAUT, ...(taux || {}) };
  if (devise === "CDF") return t.USD;
  if (devise === "EUR") return Math.round((t.EUR / t.USD) * 10000) / 10000;
  return null;
};
export const tauxDe = (e, taux) => (e.devise === "USD" || !e.devise ? null : e.taux > 0 ? e.taux : tauxParDefaut(e.devise, taux));
export const convertirUSD = (montant, devise, t) => {
  if (devise === "CDF") return (montant || 0) / t;
  if (devise === "EUR") return (montant || 0) * t;
  return montant || 0;
};
export const equivalentUSD = (e, taux) => convertirUSD(e.montant, e.devise || "USD", tauxDe(e, taux));
export const libelleTaux = (devise, t) => (devise === "CDF" ? `1 USD = ${Number(t).toLocaleString("fr-FR")} FC`
  : devise === "EUR" ? `1 EUR = ${Number(t).toLocaleString("fr-FR", { maximumFractionDigits: 4 })} USD` : "");
// Ancienne forme, gardée pour compatibilité.
export const enUSD = (montant, devise, taux) => convertirUSD(montant, devise, tauxParDefaut(devise, taux));

// Totaux par devise d'une liste d'écritures (déjà filtrée).
export const totaux = (ecritures) => {
  const t = {};
  ecritures.forEach((e) => {
    const d = e.devise || "USD";
    if (!t[d]) t[d] = { recettes: 0, depenses: 0, solde: 0 };
    if (e.type === "recette") t[d].recettes += e.montant || 0;
    else t[d].depenses += e.montant || 0;
    t[d].solde = t[d].recettes - t[d].depenses;
  });
  return t;
};

export const totalUSD = (ecritures, taux) => {
  let recettes = 0, depenses = 0;
  ecritures.forEach((e) => {
    const v = equivalentUSD(e, taux);
    if (e.type === "recette") recettes += v; else depenses += v;
  });
  return { recettes, depenses, solde: recettes - depenses };
};

// Regroupe par catégorie → { catId: { label, USD: x, CDF: y… } }
export const parCategorie = (ecritures, taux) => {
  const m = {};
  ecritures.forEach((e) => {
    const id = e.categorie || "—";
    if (!m[id]) m[id] = { id, label: categorie(id).label, groupe: categorie(id).g || "", montants: {}, usd: 0 };
    m[id].montants[e.devise] = (m[id].montants[e.devise] || 0) + (e.montant || 0);
    m[id].usd += equivalentUSD(e, taux);
  });
  return Object.values(m).sort((a, b) => a.label.localeCompare(b.label, "fr"));
};

export const devisesUtilisees = (ecritures) => {
  const ordre = ["USD", "CDF", "EUR"];
  const s = new Set(ecritures.map((e) => e.devise || "USD"));
  return ordre.filter((d) => s.has(d));
};

export const nomActivite = (activites, id) => {
  if (!id || id === GENERAL.id) return GENERAL.nom;
  return activites.find((a) => a.id === id)?.nom || "Activité inconnue";
};

// Tri : la plus récente d'abord (date de l'opération puis date de saisie).
export const triRecent = (a, b) => (b.date || "").localeCompare(a.date || "") || (b.saisiLe || 0) - (a.saisiLe || 0);
export const triAncien = (a, b) => (a.date || "").localeCompare(b.date || "") || (a.saisiLe || 0) - (b.saisiLe || 0);

// Une écriture « sans pièce » : aucune pièce jointe.
export const sansPiece = (e) => !(e.nbPieces > 0);

// ── Pièces justificatives ─────────────────────────────
// Les pièces sont stockées dans Firestore (pas de Storage payant) : chaque photo
// est réduite pour rester bien en dessous de la limite de 1 Mo par document.
const LIMITE = 650 * 1024;

const lireFichier = (fichier) =>
  new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => ko(new Error("Lecture du fichier impossible."));
    r.readAsDataURL(fichier);
  });

const chargerImage = (src) =>
  new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ko(new Error("Image illisible."));
    i.src = src;
  });

export const preparerPiece = async (fichier) => {
  if (fichier.type === "application/pdf") {
    const donnees = await lireFichier(fichier);
    if (donnees.length > LIMITE * 1.37) throw new Error("PDF trop lourd (650 Ko au maximum). Photographiez plutôt le document.");
    return { nomFichier: fichier.name, format: "pdf", donnees };
  }
  if (!fichier.type.startsWith("image/")) throw new Error("Seules les photos et les PDF sont acceptés.");
  const img = await chargerImage(await lireFichier(fichier));
  let cote = 1500;
  let qualite = 0.72;
  for (let essai = 0; essai < 6; essai++) {
    const ratio = Math.min(1, cote / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * ratio);
    c.height = Math.round(img.height * ratio);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const donnees = c.toDataURL("image/jpeg", qualite);
    if (donnees.length <= LIMITE * 1.37) return { nomFichier: fichier.name, format: "image", donnees };
    cote = Math.round(cote * 0.8);
    qualite = Math.max(0.5, qualite - 0.06);
  }
  throw new Error("Photo trop lourde, même après réduction.");
};

// ── Export CSV ────────────────────────────────────────
export const telechargerCSV = (nomFichier, lignes) => {
  const cellule = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texte = "﻿" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([texte], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const messageErreur = (e) => {
  const code = e?.code || "";
  const table = {
    "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
    "auth/wrong-password": "E-mail ou mot de passe incorrect.",
    "auth/user-not-found": "E-mail ou mot de passe incorrect.",
    "auth/invalid-email": "Adresse e-mail invalide.",
    "auth/email-already-in-use": "Cette adresse e-mail a déjà un compte.",
    "auth/weak-password": "Mot de passe trop court (8 caractères au minimum).",
    "auth/too-many-requests": "Trop d'essais. Réessayez dans quelques minutes.",
    "auth/network-request-failed": "Pas de connexion internet.",
    "auth/requires-recent-login": "Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer le mot de passe.",
    "permission-denied": "Action refusée : votre rôle ne le permet pas.",
    unavailable: "Pas de connexion internet. Réessayez.",
  };
  return table[code] || e?.message || "Une erreur est survenue.";
};
