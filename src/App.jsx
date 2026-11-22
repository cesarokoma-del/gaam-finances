import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { store, DEMO } from "./store";
import { ROLES, TAUX_DEFAUT, peutSaisir } from "./lib/constantes";
import { messageErreur } from "./lib/outils";
import { PageConnexion, PageInstallation, PageMotDePasse } from "./pages/Connexion";
import PageAccueil from "./pages/Accueil";
import PageSaisie from "./pages/Saisie";
import PageJournal from "./pages/Journal";
import PageActivites from "./pages/Activites";
import PageRapports from "./pages/Rapports";
import PageCaisse from "./pages/Caisse";
import PageAdmin from "./pages/Admin";

// ── Navigation par l'adresse ──────────────────────────
// La page et ses réglages sont écrits après le « # » : actualiser garde la page,
// le bouton Retour revient à l'écran précédent, et un lien ouvre un écran précis.
const PAGES = ["accueil", "saisie", "journal", "caisse", "activites", "rapports", "reglages"];
const lireAdresse = () => {
  const brut = window.location.hash.replace(/^#/, "");
  const [page, requete = ""] = brut.split("?");
  const params = {};
  new URLSearchParams(requete).forEach((v, k) => { params[k] = v; });
  return { page: PAGES.includes(page) ? page : "accueil", params: Object.keys(params).length ? params : null };
};
const ecrireAdresse = (page, params) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
  const requete = q.toString();
  return "#" + page + (requete ? "?" + requete : "");
};

const INACTIVITE = 10 * 60 * 1000; // déconnexion après 10 minutes sans activité

const ONGLETS = [
  { id: "accueil",   label: "Accueil",   icone: "⌂" },
  { id: "saisie",    label: "Saisir",    icone: "＋", saisie: true },
  { id: "journal",   label: "Journal",   icone: "≣" },
  { id: "caisse",    label: "Caisse",    icone: "▣" },
  { id: "activites", label: "Activités", icone: "◈" },
  { id: "rapports",  label: "Rapports",  icone: "▤" },
];

export default function App() {
  const [installe, setInstalle] = useState(null);       // null = vérification en cours
  const [session, setSession] = useState(undefined);    // undefined = en cours, null = déconnecté
  const [profil, setProfil] = useState(null);
  const [avis, setAvis] = useState("");
  const [nav, setNav] = useState(() => ({ ...lireAdresse(), cle: 0 }));
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [activites, setActivites] = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [taux, setTaux] = useState({ ...TAUX_DEFAUT });
  const [tauxPret, setTauxPret] = useState(false); // les écrans attendent le vrai taux avant de s'afficher
  const [toast, setToast] = useState("");
  const [changerMdp, setChangerMdp] = useState(false);
  const [enLigne, setEnLigne] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const minuterieToast = useRef(null);
  const [menu, setMenu] = useState(false);
  const refMenu = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const dehors = (e) => { if (refMenu.current && !refMenu.current.contains(e.target)) setMenu(false); };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [menu]);

  const signaler = useCallback((msg) => {
    setToast(msg);
    clearTimeout(minuterieToast.current);
    minuterieToast.current = setTimeout(() => setToast(""), 3200);
  }, []);
  const aller = useCallback((page, params = null) => {
    const cible = ecrireAdresse(page, params);
    // Même adresse (on retouche l'onglet courant) : on recharge simplement l'écran.
    if (cible === window.location.hash) setNav((n) => ({ ...lireAdresse(), cle: n.cle + 1 }));
    else window.location.hash = cible; // déclenche « hashchange » ci-dessous
    window.scrollTo(0, 0);
  }, []);
  // Un écran enregistre ses réglages (activité choisie, filtres…) dans l'adresse,
  // sans créer d'étape supplémentaire pour le bouton Retour.
  const memoriser = useCallback((params) => {
    const cible = ecrireAdresse(lireAdresse().page, params);
    if (cible !== window.location.hash) window.history.replaceState(null, "", cible);
  }, []);
  useEffect(() => {
    const suivre = () => { setNav((n) => ({ ...lireAdresse(), cle: n.cle + 1 })); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);

  // ── Session ─────────────────────────────────────────
  useEffect(() => {
    store.estInstalle().then(setInstalle).catch((e) => { setAvis("Base de données inaccessible (" + (e?.code || e?.message || "erreur") + "). Vérifiez les règles Firestore et les variables Netlify."); setInstalle(true); });
    return store.surSession((s) => setSession(s));
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    let vivant = true;
    store.estInstalle().then((v) => vivant && setInstalle(v)).catch(() => {});
    if (!session) { setProfil(null); return () => { vivant = false; }; }
    store.lireProfil(session.uid)
      .then((p) => {
        if (!vivant) return;
        if (!p) { setAvis("Ce compte n'a pas de profil dans GAAM-Finances. Adressez-vous à l'administrateur."); store.deconnexion(); return; }
        if (p.statut !== "actif") { setAvis("Ce compte est suspendu."); store.deconnexion(); return; }
        setAvis("");
        setProfil(p);
      })
      .catch((e) => { if (vivant) { setAvis(messageErreur(e)); store.deconnexion(); } });
    return () => { vivant = false; };
  }, [session]);

  // ── Données ─────────────────────────────────────────
  const rechargerTaux = useCallback(() => store.lireTaux().then(setTaux), []);
  useEffect(() => {
    if (!profil) return;
    const erreur = (e) => signaler(messageErreur(e));
    const arrets = [
      store.ecouter("utilisateurs", setUtilisateurs, erreur),
      store.ecouter("activites", setActivites, erreur),
      store.ecouter("ecritures", setEcritures, erreur),
    ];
    setTauxPret(false);
    rechargerTaux()
      .catch((e) => signaler("Taux de change non lus (" + messageErreur(e) + ") — taux par défaut utilisés."))
      .finally(() => setTauxPret(true));
    return () => arrets.forEach((f) => f && f());
  }, [profil?.uid]);

  // Le profil suit les changements faits par l'administrateur (rôle, suspension).
  useEffect(() => {
    if (!profil) return;
    const moi = utilisateurs.find((u) => u.uid === profil.uid);
    if (!moi) return;
    if (moi.statut !== "actif") { setAvis("Ce compte est suspendu."); store.deconnexion(); return; }
    if (moi.role !== profil.role || moi.nom !== profil.nom || moi.doitChangerMotDePasse !== profil.doitChangerMotDePasse) setProfil(moi);
  }, [utilisateurs]);

  // ── Inactivité ──────────────────────────────────────
  useEffect(() => {
    if (!profil) return;
    let minuterie;
    const relancer = () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => { setAvis("Session fermée après 10 minutes d'inactivité."); store.deconnexion(); }, INACTIVITE);
    };
    const evts = ["touchstart", "click", "keydown", "scroll"];
    evts.forEach((e) => window.addEventListener(e, relancer, { passive: true }));
    relancer();
    return () => { clearTimeout(minuterie); evts.forEach((e) => window.removeEventListener(e, relancer)); };
  }, [profil?.uid]);

  useEffect(() => {
    const oui = () => setEnLigne(true), non = () => setEnLigne(false);
    window.addEventListener("online", oui);
    window.addEventListener("offline", non);
    return () => { window.removeEventListener("online", oui); window.removeEventListener("offline", non); };
  }, []);

  const ctx = useMemo(() => profil && ({
    profil, par: { uid: profil.uid, nom: profil.nom },
    utilisateurs, activites, ecritures, taux, signaler, aller, memoriser, rechargerTaux,
  }), [profil, utilisateurs, activites, ecritures, taux, signaler, aller, memoriser, rechargerTaux]);

  // ── Écrans d'entrée ─────────────────────────────────
  if (installe === null || session === undefined) return <div className="chargement"><div className="rond" /></div>;
  if (!session || !profil) {
    if (session && !profil) return <div className="chargement"><div className="rond" /></div>;
    return installe ? <PageConnexion avis={avis} /> : <PageInstallation onFini={() => setInstalle(true)} />;
  }
  if (profil.doitChangerMotDePasse || changerMdp) {
    return (
      <PageMotDePasse
        oblige={profil.doitChangerMotDePasse}
        onFini={() => { setChangerMdp(false); setProfil((p) => ({ ...p, doitChangerMotDePasse: false })); signaler("Mot de passe enregistré"); }}
        onAnnuler={() => (profil.doitChangerMotDePasse ? store.deconnexion() : setChangerMdp(false))}
      />
    );
  }

  const onglets = ONGLETS.filter((o) => !o.saisie || peutSaisir(profil.role));
  const aValider = ecritures.filter((e) => e.statut === "en_attente" && e.saisiPar?.uid !== profil.uid).length;
  const Page = { accueil: PageAccueil, saisie: PageSaisie, journal: PageJournal, activites: PageActivites, rapports: PageRapports, caisse: PageCaisse, reglages: PageAdmin }[nav.page] || PageAccueil;

  return (
    <div className="app">
      <header className="barre sans-impression">
        <div className="barre-ligne">
          <button className="marque" onClick={() => aller("accueil")}>GAAM<span>-Finances</span></button>
          <div className="barre-droite">
            <span className="qui"><strong>{profil.nom}</strong><br />{ROLES[profil.role]?.label}</span>
            <div className="menu" ref={refMenu}>
              <button className="menu-bouton" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>⋮</button>
              {menu && (
                <div className="menu-liste">
                  <button onClick={() => { setMenu(false); aller("reglages"); }}>Réglages</button>
                  <button onClick={() => { setMenu(false); setChangerMdp(true); }}>Changer mon mot de passe</button>
                  <button onClick={() => { setMenu(false); window.history.replaceState(null, "", window.location.pathname); store.deconnexion(); }}>Se déconnecter</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="frise" />
      </header>

      {DEMO && (
        <div className="bandeau demo sans-impression">
          <span>Mode démonstration — données fictives, gardées dans ce navigateur.</span>
          <select value={profil.uid} onChange={(e) => store.changerDeCompte(e.target.value)} aria-label="Changer de compte">
            {utilisateurs.filter((u) => u.statut === "actif").map((u) => <option key={u.uid} value={u.uid}>Voir comme : {u.nom}</option>)}
          </select>
        </div>
      )}
      {!enLigne && <div className="bandeau hors-ligne sans-impression">Hors connexion — vos saisies partiront au retour du réseau.</div>}

      <main>{tauxPret ? <Page key={nav.cle} ctx={ctx} params={nav.params} /> : <div className="chargement"><div className="rond" /></div>}</main>

      <nav className="onglets-bas sans-impression">
        {onglets.map((o) => (
          <button key={o.id} className={nav.page === o.id ? "actif" : ""} onClick={() => aller(o.id)}>
            <span className="icone">{o.icone}</span>
            <span>{o.label}</span>
            {o.id === "journal" && aValider > 0 && ["admin", "tresorier", "validateur"].includes(profil.role) && <span className="compteur">{aValider}</span>}
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
