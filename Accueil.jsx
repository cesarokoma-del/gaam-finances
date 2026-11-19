import { useMemo, useState } from "react";
import { peutSaisir, peutValider, DEVISES, estInterne } from "../lib/constantes";
import { fmtMontant, totaux, totalUSD, triRecent, sansPiece, fmtDate } from "../lib/outils";
import { LigneEcriture, FicheEcriture, Modal } from "../composants";
import { FormulaireEcriture } from "./Saisie";

export default function PageAccueil({ ctx }) {
  const { ecritures, activites, profil, taux, aller } = ctx;
  const [ouverte, setOuverte] = useState(null);
  const [aCorriger, setACorriger] = useState(null);

  const validees = useMemo(() => ecritures.filter((e) => e.statut === "validee" && !estInterne(e)), [ecritures]);
  const t = useMemo(() => totaux(validees), [validees]);
  const aValider = ecritures.filter((e) => e.statut === "en_attente" && e.saisiPar?.uid !== profil.uid);
  const mesAttentes = ecritures.filter((e) => e.statut === "en_attente" && e.saisiPar?.uid === profil.uid);
  const mesRejets = ecritures.filter((e) => e.statut === "rejetee" && e.saisiPar?.uid === profil.uid);
  const sansPieces = ecritures.filter((e) => sansPiece(e) && ["validee", "en_attente"].includes(e.statut));
  const ouvertes = activites.filter((a) => a.statut !== "cloturee").sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || ""));
  const devises = ["USD", "CDF", "EUR"].filter((d) => t[d]);

  const taches = [
    peutValider(profil.role) && aValider.length > 0 && { n: aValider.length, texte: "écriture(s) à valider", vue: "a_valider", ton: "orange" },
    mesRejets.length > 0 && { n: mesRejets.length, texte: "de vos écritures rejetée(s), à corriger", vue: "mes_rejets", ton: "rouge" },
    sansPieces.length > 0 && { n: sansPieces.length, texte: "écriture(s) sans pièce justificative", vue: "sans_piece", ton: "orange" },
  ].filter(Boolean);

  return (
    <div className="page">
      <h1>Bonjour, {profil.nom.split(" ")[0]}</h1>

      {taches.length > 0 ? (
        <div className="carte">
          <h2>À faire</h2>
          {taches.map((x) => (
            <button key={x.vue} className={`tache ${x.ton}`} onClick={() => aller("journal", { vue: x.vue })}>
              <strong>{x.n}</strong><span>{x.texte}</span><span className="fleche">›</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="encart ok">Rien en attente de votre côté.</p>
      )}
      {mesAttentes.length > 0 && <p className="discret">{mesAttentes.length} de vos saisies attend(ent) la validation d'une autre personne.</p>}

      <div className="carte">
        <h2>Solde des écritures validées</h2>
        {devises.length === 0 ? <p className="vide">Aucune écriture validée pour l'instant.</p> : (
          <div className="soldes">
            {devises.map((d) => (
              <div className="solde" key={d}>
                <span className="solde-dev">{DEVISES[d].label}</span>
                <span className={`solde-val ${t[d].solde < 0 ? "rouge" : ""}`}>{fmtMontant(t[d].solde, d)}</span>
                <span className="solde-det">↑ {fmtMontant(t[d].recettes, d)}<br />↓ {fmtMontant(t[d].depenses, d)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="discret">Chaque devise est suivie séparément ; rien n'est converti.</p>
      </div>

      <div className="carte">
        <div className="titre-ligne">
          <h2>Activités en cours</h2>
          <button className="lien" onClick={() => aller("activites")}>Toutes ›</button>
        </div>
        {ouvertes.length === 0 ? <p className="vide">Aucune activité ouverte.</p> : ouvertes.slice(0, 4).map((a) => {
          const liste = validees.filter((e) => e.activiteId === a.id);
          const u = totalUSD(liste, taux);
          const pct = a.budget > 0 ? Math.min(100, Math.round((u.depenses / a.budget) * 100)) : null;
          return (
            <button key={a.id} className="activite-mini" onClick={() => aller("rapports", { activiteId: a.id })}>
              <span className="activite-nom">{a.nom}</span>
              <span className="discret">{fmtDate(a.dateDebut)}{a.dateFin && a.dateFin !== a.dateDebut ? ` – ${fmtDate(a.dateFin)}` : ""} · {liste.length} écriture(s) validée(s)</span>
              {pct !== null && (
                <span className="jauge-ligne">
                  <span className="jauge"><span style={{ width: `${pct}%` }} className={u.depenses > a.budget ? "depasse" : ""} /></span>
                  <span className="discret">{fmtMontant(u.depenses, "USD")} dépensés sur {fmtMontant(a.budget, "USD")} prévus</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="carte sans-marge">
        <div className="titre-ligne pad">
          <h2>Dernières écritures</h2>
          <button className="lien" onClick={() => aller("journal")}>Journal ›</button>
        </div>
        {ecritures.length === 0
          ? <p className="vide">Le journal est vide.{peutSaisir(profil.role) ? " Commencez par l'onglet Saisir." : ""}</p>
          : [...ecritures].sort((a, b) => (b.saisiLe || 0) - (a.saisiLe || 0) || triRecent(a, b)).slice(0, 5)
              .map((e) => <LigneEcriture key={e.id} e={e} activites={activites} onClick={() => setOuverte(e.id)} />)}
      </div>

      {ouverte && !aCorriger && <FicheEcriture id={ouverte} ctx={ctx} onClose={() => setOuverte(null)} onCorriger={setACorriger} />}
      {aCorriger && (
        <Modal titre={`Corriger ${aCorriger.numero || "l'écriture"}`} onClose={() => setACorriger(null)} large>
          <FormulaireEcriture ctx={ctx} initiale={aCorriger} onFini={() => { setACorriger(null); setOuverte(null); }} />
        </Modal>
      )}
    </div>
  );
}
