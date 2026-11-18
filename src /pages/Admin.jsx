import { useState } from "react";
import { store, DEMO } from "../store";
import { ROLES, estAdmin, peutGererActivites } from "../lib/constantes";
import { genMotDePasse, messageErreur } from "../lib/outils";
import { Modal, Champ } from "../composants";

function NouvelUtilisateur({ ctx, onFini }) {
  const { par } = ctx;
  const [f, setF] = useState({ nom: "", email: "", role: "saisie" });
  const [cree, setCree] = useState(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const maj = (c, v) => setF((x) => ({ ...x, [c]: v }));

  const creer = async () => {
    if (f.nom.trim().length < 3) return setErreur("Indiquez le nom complet.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErreur("Adresse e-mail invalide.");
    setOccupe(true);
    setErreur("");
    const motDePasse = genMotDePasse();
    try {
      await store.creerUtilisateur({ ...f, motDePasse }, par);
      setCree({ ...f, motDePasse });
    } catch (e) { setErreur(messageErreur(e)); }
    setOccupe(false);
  };

  if (cree) {
    return (
      <div className="formulaire">
        <p className="encart ok">Compte créé pour {cree.nom}.</p>
        <dl className="details">
          <dt>E-mail</dt><dd>{cree.email.trim().toLowerCase()}</dd>
          <dt>Mot de passe provisoire</dt><dd><code className="code">{cree.motDePasse}</code></dd>
        </dl>
        <p className="discret">Transmettez ce mot de passe à la personne, de préférence de vive voix. Il ne sera plus affiché, et elle devra le changer à sa première connexion.</p>
        <button className="btn large" onClick={onFini}>Terminé</button>
      </div>
    );
  }
  return (
    <div className="formulaire">
      <Champ label="Nom complet" requis><input type="text" value={f.nom} onChange={(e) => maj("nom", e.target.value)} /></Champ>
      <Champ label="Adresse e-mail" requis aide="Une vraie adresse : elle sert à retrouver un mot de passe oublié.">
        <input type="email" value={f.email} onChange={(e) => maj("email", e.target.value)} />
      </Champ>
      <Champ label="Rôle" requis>
        <select value={f.role} onChange={(e) => maj("role", e.target.value)}>
          {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
      </Champ>
      <p className="discret">{ROLES[f.role].desc}</p>
      {erreur && <p className="encart rejet">{erreur}</p>}
      <button className="btn large" disabled={occupe} onClick={creer}>{occupe ? "Création…" : "Créer le compte"}</button>
    </div>
  );
}

function ReglageTaux({ ctx }) {
  const { taux, par, signaler, rechargerTaux } = ctx;
  const [usd, setUsd] = useState(String(taux.USD));
  const [eur, setEur] = useState(String(taux.EUR));
  const enregistrer = async () => {
    const u = parseFloat(usd), e = parseFloat(eur);
    if (!(u > 0) || !(e > 0)) return signaler("Taux invalides.");
    try { await store.enregistrerTaux({ CDF: 1, USD: u, EUR: e }, par); await rechargerTaux(); signaler("Taux enregistrés"); }
    catch (err) { signaler(messageErreur(err)); }
  };
  return (
    <div className="carte">
      <h2>Taux indicatifs</h2>
      <p className="discret">Ils servent seulement à donner un équivalent en dollars dans les rapports. Aucune écriture n'est convertie.</p>
      <div className="deux">
        <Champ label="1 USD = … FC"><input type="number" min="1" value={usd} onChange={(e) => setUsd(e.target.value)} /></Champ>
        <Champ label="1 EUR = … FC"><input type="number" min="1" value={eur} onChange={(e) => setEur(e.target.value)} /></Champ>
      </div>
      <button className="btn petit" onClick={enregistrer}>Enregistrer les taux</button>
    </div>
  );
}

export default function PageAdmin({ ctx }) {
  const { profil, utilisateurs, signaler } = ctx;
  const [nouveau, setNouveau] = useState(false);
  const admin = estAdmin(profil.role);
  const liste = [...utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const nbAdminsActifs = utilisateurs.filter((u) => u.role === "admin" && u.statut === "actif").length;

  const modifier = async (u, patch) => {
    const perdAdmin = u.role === "admin" && u.statut === "actif" && (patch.role && patch.role !== "admin" || patch.statut === "suspendu");
    if (perdAdmin && nbAdminsActifs <= 1) return signaler("Il doit rester au moins un administrateur actif.");
    try { await store.majUtilisateur(u.uid, patch); signaler("Modifié"); }
    catch (e) { signaler(messageErreur(e)); }
  };

  return (
    <div className="page">
      <h1>Réglages</h1>

      {admin && (
        <div className="carte">
          <div className="titre-ligne">
            <h2>Utilisateurs</h2>
            <button className="btn petit" onClick={() => setNouveau(true)}>+ Ajouter</button>
          </div>
          <p className="discret">Il faut au moins deux personnes actives : celle qui saisit une écriture ne peut pas la valider.</p>
          {liste.map((u) => (
            <div className={`utilisateur ${u.statut !== "actif" ? "suspendu" : ""}`} key={u.uid}>
              <div>
                <strong>{u.nom}</strong>{u.uid === profil.uid && <span className="discret"> (vous)</span>}
                <br /><span className="discret">{u.email}{u.doitChangerMotDePasse ? " · mot de passe provisoire" : ""}</span>
              </div>
              <select value={u.role} disabled={u.uid === profil.uid} onChange={(e) => modifier(u, { role: e.target.value })} aria-label={`Rôle de ${u.nom}`}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.court}</option>)}
              </select>
              {u.uid !== profil.uid && (
                <button className="lien" onClick={() => modifier(u, { statut: u.statut === "actif" ? "suspendu" : "actif" })}>
                  {u.statut === "actif" ? "Suspendre" : "Réactiver"}
                </button>
              )}
            </div>
          ))}
          <p className="discret">Un compte ne se supprime pas : on le suspend, et les écritures qu'il a saisies restent signées de son nom.</p>
        </div>
      )}

      {peutGererActivites(profil.role) && <ReglageTaux ctx={ctx} />}

      <div className="carte">
        <h2>Les rôles</h2>
        <dl className="details">
          {Object.entries(ROLES).map(([k, r]) => <span className="paire" key={k}><dt>{r.label}</dt><dd>{r.desc}</dd></span>)}
        </dl>
      </div>

      {DEMO && (
        <div className="carte">
          <h2>Mode démonstration</h2>
          <p className="discret">Les données restent dans ce navigateur. Rien n'est envoyé ni partagé.</p>
          <div className="actions gauche">
            <button className="btn secondaire petit" onClick={() => window.confirm("Remplacer les données de démonstration par le jeu d'exemple ?") && store.chargerExemple()}>Recharger l'exemple</button>
            <button className="btn danger-leger petit" onClick={() => window.confirm("Effacer toutes les données de démonstration ?") && store.toutEffacer()}>Tout effacer</button>
          </div>
        </div>
      )}

      {nouveau && (
        <Modal titre="Nouvel utilisateur" onClose={() => setNouveau(false)}>
          <NouvelUtilisateur ctx={ctx} onFini={() => setNouveau(false)} />
        </Modal>
      )}
    </div>
  );
}
