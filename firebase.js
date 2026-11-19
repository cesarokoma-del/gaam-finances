// ══════════════════════════════════════════════════════
// Enregistrement dans Firebase (Auth + Firestore) — projet propre à GAAM
// ══════════════════════════════════════════════════════
import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocs, setDoc, updateDoc, collection, onSnapshot,
  runTransaction, writeBatch, increment,
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword, sendPasswordResetEmail,
  setPersistence, browserSessionPersistence,
} from "firebase/auth";
import { TAUX_DEFAUT } from "../lib/constantes";
import { fmtNumero, anneeDe } from "../lib/outils";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let db, auth;
let attente = null;
const init = () => {
  if (db) return;
  const app = initializeApp(config);
  // Cache local : le journal reste lisible sans réseau et une saisie faite hors
  // connexion part d'elle-même dès que le téléphone retrouve internet.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  auth = getAuth(app);
  // La session se ferme avec l'onglet.
  setPersistence(auth, browserSessionPersistence).catch(() => {});
};

// Créer le compte d'un AUTRE utilisateur sans fermer la session de
// l'administrateur : on passe par une seconde instance Firebase.
const authSecondaire = () => {
  const nom = "gaam-secondaire";
  const app = getApps().find((a) => a.name === nom) || initializeApp(config, nom);
  return getAuth(app);
};

const enLigne = () => typeof navigator === "undefined" || navigator.onLine !== false;
const propre = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export const firebaseStore = {
  mode: "firebase",

  surSession(cb) {
    init();
    return onAuthStateChanged(auth, async () => {
      // Pendant l'installation, on attend que le profil soit écrit avant d'annoncer la session.
      if (attente) { try { await attente; } catch (e) {} }
      const u = auth.currentUser;
      cb(u ? { uid: u.uid, email: u.email } : null);
    });
  },

  async estInstalle() {
    init();
    const s = await getDoc(doc(db, "parametres", "installation"));
    return s.exists();
  },

  // Premier lancement : crée le compte de l'Administrateur Président.
  async installer({ nom, email, motDePasse }) {
    init();
    attente = (async () => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), motDePasse);
      const uid = cred.user.uid;
      const lot = writeBatch(db);
      lot.set(doc(db, "parametres", "installation"), { adminUid: uid, creeLe: Date.now() });
      lot.set(doc(db, "utilisateurs", uid), {
        uid, nom: nom.trim(), email: email.trim().toLowerCase(), role: "admin",
        statut: "actif", doitChangerMotDePasse: false, creeLe: Date.now(),
      });
      await lot.commit();
      return uid;
    })();
    try { return await attente; } finally { attente = null; }
  },

  async connexion(email, motDePasse) {
    init();
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), motDePasse);
    return { uid: cred.user.uid, email: cred.user.email };
  },

  async deconnexion() {
    init();
    await signOut(auth);
  },

  async motDePasseOublie(email) {
    init();
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  },

  async changerMotDePasse(nouveau) {
    init();
    await updatePassword(auth.currentUser, nouveau);
    await updateDoc(doc(db, "utilisateurs", auth.currentUser.uid), { doitChangerMotDePasse: false, modifieLe: Date.now() });
  },

  async lireProfil(uid) {
    init();
    const s = await getDoc(doc(db, "utilisateurs", uid));
    return s.exists() ? s.data() : null;
  },

  // nom : "utilisateurs" | "activites" | "ecritures"
  ecouter(nom, cb, surErreur) {
    init();
    return onSnapshot(
      collection(db, nom),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => surErreur && surErreur(e)
    );
  },

  async creerUtilisateur({ nom, email, role, motDePasse }, par) {
    init();
    const sec = authSecondaire();
    const cred = await createUserWithEmailAndPassword(sec, email.trim().toLowerCase(), motDePasse);
    const uid = cred.user.uid;
    await signOut(sec);
    await setDoc(doc(db, "utilisateurs", uid), {
      uid, nom: nom.trim(), email: email.trim().toLowerCase(), role,
      statut: "actif", doitChangerMotDePasse: true, creeLe: Date.now(), creePar: par,
    });
    return uid;
  },

  async majUtilisateur(uid, patch) {
    init();
    await updateDoc(doc(db, "utilisateurs", uid), { ...propre(patch), modifieLe: Date.now() });
  },

  async enregistrerActivite(activite, par) {
    init();
    const ref = activite.id ? doc(db, "activites", activite.id) : doc(collection(db, "activites"));
    const { id, ...reste } = activite;
    const donnees = activite.id
      ? { ...propre(reste), modifieLe: Date.now(), modifiePar: par }
      : { ...propre(reste), statut: reste.statut || "ouverte", creeLe: Date.now(), creePar: par };
    await setDoc(ref, donnees, { merge: true });
    return ref.id;
  },

  // Crée l'écriture, ses pièces et son numéro en une seule opération.
  async creerEcriture(donnees, pieces, par) {
    init();
    const ref = doc(collection(db, "ecritures"));
    const annee = anneeDe(donnees.date);
    const base = {
      ...propre(donnees), annee, nbPieces: pieces.length,
      statut: "en_attente", saisiPar: par, saisiLe: Date.now(),
    };
    const piecesDocs = pieces.map((p) => ({ ...p, ajoutePar: par, ajouteLe: Date.now() }));

    if (enLigne()) {
      try {
        let numero = null;
        await runTransaction(db, async (tx) => {
          const cRef = doc(db, "compteurs", String(annee));
          const c = await tx.get(cRef);
          const n = (c.exists() ? c.data().dernier || 0 : 0) + 1;
          numero = fmtNumero(annee, n);
          tx.set(cRef, { dernier: n });
          tx.set(ref, { ...base, numero });
          piecesDocs.forEach((p) => tx.set(doc(collection(ref, "pieces")), p));
        });
        return { id: ref.id, numero };
      } catch (e) {
        if (e?.code !== "unavailable") throw e;
      }
    }
    // Hors connexion : l'écriture est gardée dans le téléphone et envoyée au
    // retour du réseau. Son numéro sera attribué à la validation.
    const lot = writeBatch(db);
    lot.set(ref, { ...base, numero: null });
    piecesDocs.forEach((p) => lot.set(doc(collection(ref, "pieces")), p));
    lot.commit().catch(() => {});
    return { id: ref.id, numero: null, horsLigne: true };
  },

  // Correction par l'auteur, tant que l'écriture n'est pas validée.
  async corrigerEcriture(id, patch) {
    init();
    await updateDoc(doc(db, "ecritures", id), {
      ...propre(patch), statut: "en_attente", motifRejet: null, corrigeLe: Date.now(),
    });
  },

  // Validation ou rejet par une AUTRE personne que celle qui a saisi.
  async deciderEcriture(id, { decision, motif }, par) {
    init();
    const ref = doc(db, "ecritures", id);
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error("Écriture introuvable.");
      const e = s.data();
      if (e.statut !== "en_attente") throw new Error("Cette écriture a déjà été traitée.");
      if (e.saisiPar?.uid === par.uid) throw new Error("Vous ne pouvez pas valider votre propre saisie.");
      const patch = { statut: decision, validePar: par, valideLe: Date.now(), motifRejet: decision === "rejetee" ? motif || "" : null };
      if (decision === "validee" && !e.numero) {
        const annee = e.annee || anneeDe(e.date);
        const cRef = doc(db, "compteurs", String(annee));
        const c = await tx.get(cRef);
        const n = (c.exists() ? c.data().dernier || 0 : 0) + 1;
        tx.set(cRef, { dernier: n });
        patch.numero = fmtNumero(annee, n);
      }
      tx.update(ref, patch);
    });
  },

  // Une écriture validée ne s'efface jamais : elle s'annule, avec un motif.
  async annulerEcriture(id, motif, par) {
    init();
    await updateDoc(doc(db, "ecritures", id), {
      statut: "annulee", annulePar: par, annuleLe: Date.now(), motifAnnulation: motif,
    });
  },

  async lirePieces(ecritureId) {
    init();
    const snap = await getDocs(collection(db, "ecritures", ecritureId, "pieces"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ajouteLe || 0) - (b.ajouteLe || 0));
  },

  async ajouterPieces(ecritureId, pieces, par) {
    init();
    const ref = doc(db, "ecritures", ecritureId);
    const lot = writeBatch(db);
    pieces.forEach((p) => lot.set(doc(collection(ref, "pieces")), { ...p, ajoutePar: par, ajouteLe: Date.now() }));
    lot.update(ref, { nbPieces: increment(pieces.length) });
    await lot.commit();
  },

  // Qui détient les fonds de chaque lieu (écran Caisse).
  async lireCaisses() {
    init();
    try {
      const s = await getDoc(doc(db, "parametres", "caisses"));
      return s.exists() ? s.data().gardiens || {} : {};
    } catch (e) {
      return {};
    }
  },

  async enregistrerCaisses(gardiens, par) {
    init();
    await setDoc(doc(db, "parametres", "caisses"), { gardiens, modifieLe: Date.now(), modifiePar: par });
  },

  async lireTaux() {
    init();
    try {
      const s = await getDoc(doc(db, "parametres", "taux"));
      return s.exists() ? { ...TAUX_DEFAUT, ...s.data().taux } : { ...TAUX_DEFAUT };
    } catch (e) {
      return { ...TAUX_DEFAUT };
    }
  },

  async enregistrerTaux(taux, par) {
    init();
    await setDoc(doc(db, "parametres", "taux"), { taux, modifieLe: Date.now(), modifiePar: par });
  },
};
