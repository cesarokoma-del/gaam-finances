// ══════════════════════════════════════════════════════
// MODE DÉMONSTRATION — tout reste dans ce navigateur (aucun serveur).
// Sert à essayer l'application et à former l'équipe avant de brancher Firebase.
// Les mêmes règles s'appliquent : on ne valide pas sa propre saisie.
// ══════════════════════════════════════════════════════
import { TAUX_DEFAUT } from "../lib/constantes";
import { fmtNumero, anneeDe, genId } from "../lib/outils";

const CLE = "gaam_finances_demo_v1";
const CLE_SESSION = "gaam_finances_demo_session";

const vide = () => ({ installe: false, utilisateurs: [], activites: [], ecritures: [], pieces: {}, compteurs: {}, taux: { ...TAUX_DEFAUT } });

let etat = null;
let memoireSession = null;

const charger = () => {
  if (etat) return etat;
  try { etat = JSON.parse(localStorage.getItem(CLE)) || vide(); } catch (e) { etat = vide(); }
  return etat;
};
const sauver = () => {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); }
  catch (e) { throw new Error("Mémoire du navigateur pleine : le mode démonstration ne peut plus garder de photos."); }
};
const lireSession = () => {
  if (memoireSession) return memoireSession;
  try { memoireSession = sessionStorage.getItem(CLE_SESSION); } catch (e) {}
  return memoireSession;
};
const ecrireSession = (uid) => {
  memoireSession = uid;
  try { uid ? sessionStorage.setItem(CLE_SESSION, uid) : sessionStorage.removeItem(CLE_SESSION); } catch (e) {}
};

const ecouteurs = { utilisateurs: new Set(), activites: new Set(), ecritures: new Set(), session: new Set() };
const sansSecret = (u) => { const { motDePasse, ...r } = u; return r; };
const diffuser = (nom) => {
  const s = charger();
  const liste = nom === "utilisateurs" ? s.utilisateurs.map(sansSecret) : s[nom];
  ecouteurs[nom].forEach((cb) => cb(liste.map((x) => ({ ...x }))));
};
const diffuserSession = () => {
  const uid = lireSession();
  const u = uid && charger().utilisateurs.find((x) => x.uid === uid);
  ecouteurs.session.forEach((cb) => cb(u ? { uid: u.uid, email: u.email } : null));
};
const erreur = (code, message) => Object.assign(new Error(message), { code });
const prochainNumero = (annee) => {
  const s = charger();
  const n = (s.compteurs[annee] || 0) + 1;
  s.compteurs[annee] = n;
  return fmtNumero(annee, n);
};

export const demoStore = {
  mode: "demo",

  surSession(cb) {
    ecouteurs.session.add(cb);
    setTimeout(() => {
      const uid = lireSession();
      const u = uid && charger().utilisateurs.find((x) => x.uid === uid);
      cb(u ? { uid: u.uid, email: u.email } : null);
    }, 0);
    return () => ecouteurs.session.delete(cb);
  },

  async estInstalle() { return charger().installe; },

  async installer({ nom, email, motDePasse }) {
    const s = charger();
    const uid = genId();
    s.utilisateurs.push({ uid, nom: nom.trim(), email: email.trim().toLowerCase(), role: "admin", statut: "actif", doitChangerMotDePasse: false, creeLe: Date.now(), motDePasse });
    s.installe = true;
    sauver();
    ecrireSession(uid);
    diffuser("utilisateurs");
    diffuserSession();
    return uid;
  },

  async connexion(email, motDePasse) {
    const u = charger().utilisateurs.find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.motDePasse !== motDePasse) throw erreur("auth/invalid-credential", "E-mail ou mot de passe incorrect.");
    ecrireSession(u.uid);
    diffuserSession();
    return { uid: u.uid, email: u.email };
  },

  async deconnexion() { ecrireSession(null); diffuserSession(); },

  async motDePasseOublie() {
    throw new Error("En mode démonstration, aucun e-mail n'est envoyé.");
  },

  async changerMotDePasse(nouveau) {
    const s = charger();
    const u = s.utilisateurs.find((x) => x.uid === lireSession());
    if (!u) throw new Error("Session expirée.");
    u.motDePasse = nouveau;
    u.doitChangerMotDePasse = false;
    sauver();
    diffuser("utilisateurs");
  },

  async lireProfil(uid) {
    const u = charger().utilisateurs.find((x) => x.uid === uid);
    return u ? sansSecret(u) : null;
  },

  ecouter(nom, cb) {
    ecouteurs[nom].add(cb);
    setTimeout(() => {
      const s = charger();
      const liste = nom === "utilisateurs" ? s.utilisateurs.map(sansSecret) : s[nom];
      cb(liste.map((x) => ({ ...x })));
    }, 0);
    return () => ecouteurs[nom].delete(cb);
  },

  async creerUtilisateur({ nom, email, role, motDePasse }, par) {
    const s = charger();
    const mail = email.trim().toLowerCase();
    if (s.utilisateurs.some((u) => u.email === mail)) throw erreur("auth/email-already-in-use", "Cette adresse e-mail a déjà un compte.");
    const uid = genId();
    s.utilisateurs.push({ uid, nom: nom.trim(), email: mail, role, statut: "actif", doitChangerMotDePasse: true, creeLe: Date.now(), creePar: par, motDePasse });
    sauver();
    diffuser("utilisateurs");
    return uid;
  },

  async majUtilisateur(uid, patch) {
    const s = charger();
    const u = s.utilisateurs.find((x) => x.uid === uid);
    if (u) Object.assign(u, patch, { modifieLe: Date.now() });
    sauver();
    diffuser("utilisateurs");
  },

  async enregistrerActivite(activite, par) {
    const s = charger();
    if (activite.id) {
      const a = s.activites.find((x) => x.id === activite.id);
      Object.assign(a, activite, { modifieLe: Date.now(), modifiePar: par });
    } else {
      activite = { ...activite, id: genId(), statut: activite.statut || "ouverte", creeLe: Date.now(), creePar: par };
      s.activites.push(activite);
    }
    sauver();
    diffuser("activites");
    return activite.id;
  },

  async creerEcriture(donnees, pieces, par) {
    const s = charger();
    const id = genId();
    const annee = anneeDe(donnees.date);
    const numero = prochainNumero(annee);
    s.ecritures.push({ ...donnees, id, annee, numero, nbPieces: pieces.length, statut: "en_attente", saisiPar: par, saisiLe: Date.now() });
    s.pieces[id] = pieces.map((p) => ({ ...p, id: genId(), ajoutePar: par, ajouteLe: Date.now() }));
    sauver();
    diffuser("ecritures");
    return { id, numero };
  },

  async corrigerEcriture(id, patch) {
    const s = charger();
    const e = s.ecritures.find((x) => x.id === id);
    Object.assign(e, patch, { statut: "en_attente", motifRejet: null, corrigeLe: Date.now() });
    sauver();
    diffuser("ecritures");
  },

  async deciderEcriture(id, { decision, motif }, par) {
    const s = charger();
    const e = s.ecritures.find((x) => x.id === id);
    if (!e) throw new Error("Écriture introuvable.");
    if (e.statut !== "en_attente") throw new Error("Cette écriture a déjà été traitée.");
    if (e.saisiPar?.uid === par.uid) throw new Error("Vous ne pouvez pas valider votre propre saisie.");
    Object.assign(e, { statut: decision, validePar: par, valideLe: Date.now(), motifRejet: decision === "rejetee" ? motif || "" : null });
    sauver();
    diffuser("ecritures");
  },

  async annulerEcriture(id, motif, par) {
    const s = charger();
    const e = s.ecritures.find((x) => x.id === id);
    Object.assign(e, { statut: "annulee", annulePar: par, annuleLe: Date.now(), motifAnnulation: motif });
    sauver();
    diffuser("ecritures");
  },

  async lirePieces(ecritureId) {
    return (charger().pieces[ecritureId] || []).map((p) => ({ ...p }));
  },

  async ajouterPieces(ecritureId, pieces, par) {
    const s = charger();
    const e = s.ecritures.find((x) => x.id === ecritureId);
    s.pieces[ecritureId] = [...(s.pieces[ecritureId] || []), ...pieces.map((p) => ({ ...p, id: genId(), ajoutePar: par, ajouteLe: Date.now() }))];
    e.nbPieces = s.pieces[ecritureId].length;
    sauver();
    diffuser("ecritures");
  },

  async lireCaisses() { return { ...(charger().gardiens || {}) }; },

  async enregistrerCaisses(gardiens) {
    charger().gardiens = gardiens;
    sauver();
  },

  async lireTaux() { return { ...TAUX_DEFAUT, ...charger().taux }; },

  async enregistrerTaux(taux) {
    charger().taux = taux;
    sauver();
  },

  // ── Réservé à la démonstration ──────────────────────
  // Jeu d'essai entièrement FICTIF : trois comptes et une activité d'exemple.
  async chargerExemple() {
    etat = vide();
    const s = etat;
    const mk = (nom, email, role) => {
      const u = { uid: genId(), nom, email, role, statut: "actif", doitChangerMotDePasse: false, creeLe: Date.now(), motDePasse: "demo1234" };
      s.utilisateurs.push(u);
      return { uid: u.uid, nom: u.nom };
    };
    const president = mk("Président (exemple)", "president@exemple.org", "admin");
    const tresoriere = mk("Trésorière (exemple)", "tresoriere@exemple.org", "tresorier");
    const agent = mk("Agent de saisie (exemple)", "saisie@exemple.org", "saisie");
    s.installe = true;

    const act = {
      id: genId(), nom: "EXEMPLE — Visite d'un orphelinat", domaine: "orphelins", lieu: "Kinshasa",
      dateDebut: "2026-03-14", dateFin: "2026-03-14", responsable: "Trésorière (exemple)",
      budget: 600, description: "Données fictives pour apprendre à utiliser l'application.",
      statut: "ouverte", creeLe: Date.now(), creePar: president,
    };
    s.activites.push(act);

    const pieceFactice = (titre) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300"><rect width="420" height="300" fill="#fffdf7" stroke="#b9ad98"/><text x="24" y="52" font-family="Georgia" font-size="22" fill="#2D6A4F">REÇU — EXEMPLE</text><text x="24" y="100" font-family="Arial" font-size="16" fill="#333">${titre}</text><text x="24" y="250" font-family="Arial" font-size="13" fill="#888">Pièce fictive (mode démonstration)</text></svg>`;
      return { type: "recu", format: "image", nomFichier: "exemple.svg", donnees: "data:image/svg+xml;utf8," + encodeURIComponent(svg) };
    };
    const ajouter = (d, auteur, valideur, avecPiece = true, extra = {}) => {
      const id = genId();
      const annee = anneeDe(d.date);
      const pieces = avecPiece ? [pieceFactice(d.libelle)] : [];
      s.ecritures.push({
        ...d, id, annee, numero: prochainNumero(annee), activiteId: act.id, nbPieces: pieces.length,
        statut: valideur ? "validee" : "en_attente", saisiPar: auteur, saisiLe: Date.now() - 86400000,
        ...(valideur ? { validePar: valideur, valideLe: Date.now() - 43200000 } : {}), ...extra,
      });
      s.pieces[id] = pieces.map((p) => ({ ...p, id: genId(), ajoutePar: auteur, ajouteLe: Date.now() - 86400000 }));
    };
    ajouter({ type: "recette", montant: 400, devise: "USD", categorie: "r_diaspora", date: "2026-03-02", libelle: "Dons de la diaspora (exemple)", tiers: "Membres de la diaspora", mode: "paypal", reference: "EX-001" }, tresoriere, president);
    ajouter({ type: "recette", montant: 285000, devise: "CDF", categorie: "r_collecte", date: "2026-03-08", libelle: "Collecte auprès des membres (exemple)", tiers: "Membres à Kinshasa", mode: "especes" }, agent, tresoriere);
    ajouter({ type: "depense", montant: 310, devise: "USD", categorie: "d_vivres", date: "2026-03-12", libelle: "Achat de vivres (exemple)", tiers: "Fournisseur (exemple)", mode: "especes", reference: "FACT-12", paiementDirect: true }, agent, tresoriere);
    ajouter({ type: "depense", montant: 142500, devise: "CDF", categorie: "d_transport", date: "2026-03-14", libelle: "Transport de la délégation (exemple)", tiers: "Transporteur (exemple)", mode: "especes", paiementDirect: true }, agent, tresoriere);
    ajouter({ type: "depense", montant: 45, devise: "USD", categorie: "d_repas", date: "2026-03-14", libelle: "Rafraîchissement (exemple)", tiers: "Commerce (exemple)", mode: "especes", paiementDirect: false, sansPieceMotif: "Reçu non remis par le vendeur", reconstitue: true, sourceReconstitution: "Témoignage de deux membres" }, tresoriere, president, false);
    ajouter({ type: "depense", montant: 60, devise: "USD", categorie: "d_impression", date: "2026-03-10", libelle: "Impression d'une bannière (exemple)", tiers: "Imprimeur (exemple)", mode: "mobile", paiementDirect: true }, agent, null);
    sauver();
    ecrireSession(tresoriere.uid);
    ["utilisateurs", "activites", "ecritures"].forEach(diffuser);
    diffuserSession();
  },

  // Passer d'un compte à l'autre sans mot de passe (pour essayer la validation à deux).
  async changerDeCompte(uid) { ecrireSession(uid); diffuserSession(); },

  async toutEffacer() {
    etat = vide();
    try { localStorage.removeItem(CLE); } catch (e) {}
    ecrireSession(null);
    ["utilisateurs", "activites", "ecritures"].forEach(diffuser);
    diffuserSession();
  },
};
