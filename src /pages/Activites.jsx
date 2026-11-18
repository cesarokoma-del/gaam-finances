import { useState } from "react";
import { store } from "../store";
import { DOMAINES, peutGererActivites, peutSaisir } from "../lib/constantes";
import { fmtDate, fmtMontant, totaux, messageErreur, aujourdhui } from "../lib/outils";
import { Modal, Champ, Montants } from "../composants";

function FormulaireActivite({ ctx, initiale, onFini }) {
  const { par, signaler } = ctx;
  const [f, setF] = useState({
    nom: initiale?.nom || "", domaine: initiale?.domaine || "", lieu: initiale?.lieu || "",
    dateDebut: initiale?.dateDebut || aujourdhui(), dateFin: initiale?.dateFin || "",
    responsable: initiale?.responsable || "", budget: initiale?.budget ? String(initiale.budget) : "",
    description: initiale?.description || "",
  });
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (c, v) => setF((x) => ({ ...x, [c]: v }));

  const enregistrer = async () => {
    if (f.nom.trim().length < 3) return setErreur("Donnez un nom à l'activité.");
    if (!f.dateDebut) return setErreur("Indiquez la date de début.");
    if (f.dateFin && f.dateFin < f.dateDebut) return setErreur("La date de fin précède la date de début.");
    setOccupe(true);
    try {
      await store.enregistrerActivite({
        ...(initiale?.id ? { id: initiale.id } : {}),
        nom: f.nom.trim(), domaine: f.domaine, lieu: f.lieu.trim(), dateDebut: f.dateDebut,
        dateFin: f.dateFin || f.dateDebut, responsable: f.responsable.trim(),
        budget: parseFloat(String(f.budget).replace(",", ".")) || 0, description: f.description.trim(),
      }, par);
      signaler(initiale ? "Activité modifiée" : "Activité créée");
      onFini();
    } catch (e) { setErreur(messageErreur(e)); }
    setOccupe(false);
  };

  return (
    <div className="formulaire">
      <Champ label="Nom de l'activité" requis>
        <input type="text" maxLength={120} value={f.nom} onChange={(e) => maj("nom", e.target.value)} placeholder="Ex. Culte d'action de grâce et visite de l'orphelinat" />
      </Champ>
      <div className="deux">
        <Champ label="Date de début" requis><input type="date" value={f.dateDebut} onChange={(e) => maj("dateDebut", e.target.value)} /></Champ>
        <Champ label="Date de fin"><input type="date" value={f.dateFin} onChange={(e) => maj("dateFin", e.target.value)} /></Champ>
      </div>
      <div className="deux">
        <Champ label="Domaine d'intervention">
          <select value={f.domaine} onChange={(e) => maj("domaine", e.target.value)}>
            <option value="">— Choisir —</option>
            {DOMAINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Champ>
        <Champ label="Lieu"><input type="text" maxLength={80} value={f.lieu} onChange={(e) => maj("lieu", e.target.value)} /></Champ>
      </div>
      <div className="deux">
        <Champ label="Responsable"><input type="text" maxLength={80} value={f.responsable} onChange={(e) => maj("responsable", e.target.value)} /></Champ>
        <Champ label="Budget prévu (en USD)" aide="Sert de repère dans le rapport.">
          <input type="text" inputMode="decimal" value={f.budget} onChange={(e) => maj("budget", e.target.value.replace(/[^0-9.,]/g, ""))} />
        </Champ>
      </div>
      <Champ label="Description"><textarea rows={2} maxLength={400} value={f.description} onChange={(e) => maj("description", e.target.value)} /></Champ>
      {erreur && <p className="encart rejet">{erreur}</p>}
      <button className="btn large" disabled={occupe} onClick={enregistrer}>{occupe ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}

export default function PageActivites({ ctx }) {
  const { activites, ecritures, profil, par, aller, signaler } = ctx;
  const [edition, setEdition] = useState(null); // {} = nouvelle
  const gestion = peutGererActivites(profil.role);
  const liste = [...activites].sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || ""));

  const basculer = async (a) => {
    const enAttente = ecritures.filter((e) => e.activiteId === a.id && e.statut === "en_attente").length;
    if (a.statut !== "cloturee" && enAttente > 0) return signaler(`Impossible de clôturer : ${enAttente} écriture(s) encore en attente.`);
    try {
      await store.enregistrerActivite({ id: a.id, statut: a.statut === "cloturee" ? "ouverte" : "cloturee" }, par);
      signaler(a.statut === "cloturee" ? "Activité rouverte" : "Activité clôturée");
    } catch (e) { signaler(messageErreur(e)); }
  };

  return (
    <div className="page">
      <div className="titre-ligne">
        <h1>Activités</h1>
        {gestion && <button className="btn petit" onClick={() => setEdition({})}>+ Nouvelle</button>}
      </div>
      <p className="discret">Chaque recette et chaque dépense est rattachée à une activité : c'est ce qui permet de sortir son rapport financier.</p>

      {liste.length === 0 && <p className="encart">Aucune activité.{gestion ? " Créez la première avec le bouton « Nouvelle »." : ""}</p>}

      {liste.map((a) => {
        const toutes = ecritures.filter((e) => e.activiteId === a.id);
        const t = totaux(toutes.filter((e) => e.statut === "validee"));
        const attente = toutes.filter((e) => e.statut === "en_attente").length;
        return (
          <div className="carte" key={a.id}>
            <div className="titre-ligne">
              <h2>{a.nom}</h2>
              <span className={`pastille ${a.statut === "cloturee" ? "annule" : "ok"}`}>{a.statut === "cloturee" ? "Clôturée" : "Ouverte"}</span>
            </div>
            <p className="discret">
              {fmtDate(a.dateDebut)}{a.dateFin && a.dateFin !== a.dateDebut ? ` – ${fmtDate(a.dateFin)}` : ""}
              {a.lieu ? ` · ${a.lieu}` : ""}{a.responsable ? ` · ${a.responsable}` : ""}
            </p>
            <dl className="details compact">
              <dt>Recettes validées</dt><dd><Montants t={t} cle="recettes" /></dd>
              <dt>Dépenses validées</dt><dd><Montants t={t} cle="depenses" /></dd>
              {a.budget > 0 && <><dt>Budget prévu</dt><dd>{fmtMontant(a.budget, "USD")}</dd></>}
              <dt>Écritures</dt><dd>{toutes.length}{attente ? ` (dont ${attente} en attente)` : ""}</dd>
            </dl>
            <div className="actions gauche">
              <button className="btn petit" onClick={() => aller("rapports", { activiteId: a.id })}>Rapport financier</button>
              <button className="btn secondaire petit" onClick={() => aller("journal", { activiteId: a.id })}>Écritures</button>
              {peutSaisir(profil.role) && a.statut !== "cloturee" && <button className="btn secondaire petit" onClick={() => aller("saisie", { activiteId: a.id })}>Saisir</button>}
              {gestion && <button className="lien" onClick={() => setEdition(a)}>Modifier</button>}
              {gestion && <button className="lien" onClick={() => basculer(a)}>{a.statut === "cloturee" ? "Rouvrir" : "Clôturer"}</button>}
            </div>
          </div>
        );
      })}

      {edition && (
        <Modal titre={edition.id ? "Modifier l'activité" : "Nouvelle activité"} onClose={() => setEdition(null)} large>
          <FormulaireActivite ctx={ctx} initiale={edition.id ? edition : null} onFini={() => setEdition(null)} />
        </Modal>
      )}
    </div>
  );
}
