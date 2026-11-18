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
import PageAdmin from "./pages/Admin";

const INACTIVITE = 10 * 60 * 1000; // déconnexion après 10 minutes sans activité

const ONGLETS = [
  { id: "accueil",   label: "Accueil",   icone: "⌂" },
  { id: "saisie",    label: "Saisir",    icone: "＋", saisie: true },
  { id: "journal",   label: "Journal",   icone: "≣" },
  { id: "activites", label: "Activités", icone: "◈" },
  { id: "rapports",  label: "Rapports",  icone: "▤" },
];

export default function App() {
  const [installe, setInstalle] = useState(null);       // null = vérification en cours
  const [session, setSession] = useState(undefined);    // undefined = en cours, null = déconnecté
  const [profil, setProfil] = useState(null);
  const [avis, setAvis] = useState("");
  const [nav, setNav] = useState({ page: "accueil", params: null, cle: 0 });
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [activites, setActivites] = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [taux, setTaux] = useState({ ...TAUX_DEFAUT });
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
    setNav((n) => ({ page, params, cle: n.cle + 1 }));
    window.scrollTo(0, 0);
  }, []);

  // ── Session ─────────────────────────────────────────
  useEffect(() => {
    store.estInstalle().then(setInstalle).catch(() => setInstalle(true));
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
        setNav({ page: "accueil", params: null, cle: 0 });
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
    rechargerTaux();
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
    utilisateurs, activites, ecritures, taux, signaler, aller, rechargerTaux,
  }), [profil, utilisateurs, activites, ecritures, taux, signaler, aller, rechargerTaux]);

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
  const Page = { accueil: PageAccueil, saisie: PageSaisie, journal: PageJournal, activites: PageActivites, rapports: PageRapports, reglages: PageAdmin }[nav.page] || PageAccueil;

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
                  <button onClick={() => { setMenu(false); store.deconnexion(); }}>Se déconnecter</button>
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

      <main><Page key={nav.cle} ctx={ctx} params={nav.params} /></main>

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

