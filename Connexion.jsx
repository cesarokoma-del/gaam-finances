import { useState } from "react";
import { store, DEMO } from "../store";
import { ORG } from "../lib/constantes";
import { messageErreur } from "../lib/outils";
import { Champ } from "../composants";

function Cadre({ children, titre, sousTitre }) {
  return (
    <div className="entree">
      <div className="entree-marque">
        <img src="/logo.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="entree-sigle">GAAM<span>-Finances</span></div>
        <div className="entree-devise">{ORG.devise}</div>
      </div>
      <div className="frise" />
      <div className="carte entree-carte">
        <h1>{titre}</h1>
        {sousTitre && <p className="discret">{sousTitre}</p>}
        {children}
      </div>
      {DEMO && (
        <div className="carte entree-carte demo">
          <strong>Mode démonstration</strong>
          <p className="discret">L'application n'est pas encore reliée à la base de GAAM : tout reste dans ce navigateur.</p>
          <button className="btn secondaire large" onClick={() => store.chargerExemple()}>Essayer avec un exemple fictif</button>
        </div>
      )}
    </div>
  );
}

export function PageConnexion({ avis }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [occupe, setOccupe] = useState(false);

  const entrer = async (ev) => {
    ev.preventDefault();
    setOccupe(true); setErreur(""); setInfo("");
    try { await store.connexion(email, mdp); }
    catch (e) { setErreur(messageErreur(e)); setOccupe(false); }
  };
  const oublie = async () => {
    setErreur(""); setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErreur("Saisissez d'abord votre adresse e-mail.");
    try { await store.motDePasseOublie(email); setInfo("Si cette adresse a un compte, un e-mail vient d'être envoyé pour choisir un nouveau mot de passe."); }
    catch (e) { setErreur(messageErreur(e)); }
  };

  return (
    <Cadre titre="Connexion">
      <form className="formulaire" onSubmit={entrer}>
        {avis && <p className="encart rejet">{avis}</p>}
        <Champ label="Adresse e-mail"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Champ>
        <Champ label="Mot de passe"><input type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} required /></Champ>
        {erreur && <p className="encart rejet">{erreur}</p>}
        {info && <p className="encart ok">{info}</p>}
        <button className="btn large" disabled={occupe}>{occupe ? "Connexion…" : "Se connecter"}</button>
        <button type="button" className="lien centre" onClick={oublie}>Mot de passe oublié ?</button>
      </form>
    </Cadre>
  );
}

// Premier lancement : création du compte de l'Administrateur Président.
export function PageInstallation({ onFini }) {
  const [f, setF] = useState({ nom: "", email: "", mdp: "", mdp2: "" });
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const maj = (c, v) => setF((x) => ({ ...x, [c]: v }));

  const installer = async (ev) => {
    ev.preventDefault();
    if (f.nom.trim().length < 3) return setErreur("Indiquez votre nom complet.");
    if (f.mdp.length < 8) return setErreur("Le mot de passe doit compter au moins 8 caractères.");
    if (f.mdp !== f.mdp2) return setErreur("Les deux mots de passe sont différents.");
    setOccupe(true); setErreur("");
    try { await store.installer({ nom: f.nom, email: f.email, motDePasse: f.mdp }); onFini(); }
    catch (e) { setErreur(messageErreur(e)); setOccupe(false); }
  };

  return (
    <Cadre titre="Première installation" sousTitre="Créez le compte de l'Administrateur Président. Il ajoutera ensuite les autres utilisateurs.">
      <form className="formulaire" onSubmit={installer}>
        <Champ label="Nom complet"><input type="text" value={f.nom} onChange={(e) => maj("nom", e.target.value)} required /></Champ>
        <Champ label="Adresse e-mail"><input type="email" autoComplete="username" value={f.email} onChange={(e) => maj("email", e.target.value)} required /></Champ>
        <Champ label="Mot de passe (8 caractères au moins)"><input type="password" autoComplete="new-password" value={f.mdp} onChange={(e) => maj("mdp", e.target.value)} required /></Champ>
        <Champ label="Confirmez le mot de passe"><input type="password" autoComplete="new-password" value={f.mdp2} onChange={(e) => maj("mdp2", e.target.value)} required /></Champ>
        {erreur && <p className="encart rejet">{erreur}</p>}
        <button className="btn large" disabled={occupe}>{occupe ? "Création…" : "Créer le compte administrateur"}</button>
      </form>
    </Cadre>
  );
}

export function PageMotDePasse({ oblige, onFini, onAnnuler }) {
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const changer = async (ev) => {
    ev.preventDefault();
    if (mdp.length < 8) return setErreur("Le mot de passe doit compter au moins 8 caractères.");
    if (mdp !== mdp2) return setErreur("Les deux mots de passe sont différents.");
    setOccupe(true); setErreur("");
    try { await store.changerMotDePasse(mdp); onFini(); }
    catch (e) { setErreur(messageErreur(e)); setOccupe(false); }
  };

  return (
    <Cadre titre="Choisissez votre mot de passe" sousTitre={oblige ? "Votre mot de passe provisoire doit être remplacé avant de continuer." : "Il remplacera votre mot de passe actuel."}>
      <form className="formulaire" onSubmit={changer}>
        <Champ label="Nouveau mot de passe (8 caractères au moins)"><input type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} required /></Champ>
        <Champ label="Confirmez"><input type="password" autoComplete="new-password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} required /></Champ>
        {erreur && <p className="encart rejet">{erreur}</p>}
        <button className="btn large" disabled={occupe}>{occupe ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" className="lien centre" onClick={onAnnuler}>{oblige ? "Se déconnecter" : "Annuler"}</button>
      </form>
    </Cadre>
  );
}
