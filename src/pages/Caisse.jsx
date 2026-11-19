import { useEffect, useMemo, useState } from "react";
import { store } from "../store";
import { ORG, LIEUX, lieuDe, DEVISES, peutGererActivites } from "../lib/constantes";
import { fmtMontant, fmtDate, triAncien, nomActivite, telechargerCSV, aujourdhui, messageErreur } from "../lib/outils";
import { FicheEcriture, Modal, Champ } from "../composants";
import { FormulaireEcriture } from "./Saisie";

// Entrées, sorties et solde d'une liste d'écritures (une seule devise).
const cumul = (liste) => {
  let entrees = 0, sorties = 0;
  liste.forEach((e) => { if (e.type === "recette") entrees += e.montant || 0; else sorties += e.montant || 0; });
  return { entrees, sorties, solde: entrees - sorties };
};

export default function PageCaisse({ ctx }) {
  const { ecritures, activites, profil, par, signaler } = ctx;
  const [lieu, setLieu] = useState("especes");
  const [devise, setDevise] = useState("");
  const [gardiens, setGardiens] = useState({});
  const [edition, setEdition] = useState(null);
  const [ouverte, setOuverte] = useState(null);
  const [aCorriger, setACorriger] = useState(null);
  const gestion = peutGererActivites(profil.role);

  useEffect(() => { store.lireCaisses().then(setGardiens).catch(() => {}); }, []);

  // Seules les écritures en argent comptent (pas les dons en nature).
  const enArgent = useMemo(() => ecritures.filter((e) => lieuDe(e) && e.statut !== "annulee" && e.statut !== "rejetee"), [ecritures]);
  const duLieu = useMemo(() => enArgent.filter((e) => lieuDe(e) === lieu), [enArgent, lieu]);
  const devises = ["USD", "CDF", "EUR"].filter((d) => duLieu.some((e) => e.devise === d));
  const dev = devises.includes(devise) ? devise : devises[0] || "USD";

  const validees = duLieu.filter((e) => e.devise === dev && e.statut === "validee").sort(triAncien);
  const attente = duLieu.filter((e) => e.devise === dev && e.statut === "en_attente");
  const t = cumul(validees);
  const ta = cumul(attente);

  // Livre de caisse : solde après chaque opération.
  let courant = 0;
  const livre = validees.map((e) => {
    courant += e.type === "recette" ? e.montant : -e.montant;
    return { e, solde: courant };
  });

  const enregistrerGardien = async () => {
    try {
      const suivant = { ...gardiens, [lieu]: edition.trim() };
      await store.enregistrerCaisses(suivant, par);
      setGardiens(suivant);
      setEdition(null);
      signaler("Enregistré");
    } catch (e) { signaler(messageErreur(e)); }
  };

  const nomLieu = LIEUX.find((l) => l.id === lieu)?.label;
  const exporter = () => telechargerCSV(`gaam-caisse-${lieu}-${dev}.csv`, [
    ["N°", "Date", "Libellé", "Activité", "Tiers", "Entrée", "Sortie", "Solde", "Devise", "Saisi par", "Validé par"],
    ...livre.map(({ e, solde }) => [
      e.numero || "", fmtDate(e.date), e.libelle || "", nomActivite(activites, e.activiteId), e.tiers || "",
      e.type === "recette" ? String(e.montant).replace(".", ",") : "", e.type === "depense" ? String(e.montant).replace(".", ",") : "",
      String(Math.round(solde * 100) / 100).replace(".", ","), dev, e.saisiPar?.nom || "", e.validePar?.nom || "",
    ]),
  ]);

  return (
    <div className="page large">
      <h1 className="sans-impression">Caisse</h1>
      <p className="discret sans-impression">Ce que GAAM détient, lieu par lieu : ce qui est entré, ce qui est sorti, et ce qui doit rester.</p>

      <div className="lieux sans-impression">
        {LIEUX.map((l) => {
          const liste = enArgent.filter((e) => lieuDe(e) === l.id && e.statut === "validee");
          const ds = ["USD", "CDF", "EUR"].filter((d) => liste.some((e) => e.devise === d));
          return (
            <button key={l.id} className={`lieu ${lieu === l.id ? "actif" : ""}`} onClick={() => setLieu(l.id)}>
              <span className="lieu-nom">{l.label}</span>
              {ds.length === 0 ? <span className="discret">Aucun mouvement</span>
                : ds.map((d) => <span key={d} className="lieu-solde">{fmtMontant(cumul(liste.filter((e) => e.devise === d)).solde, d)}</span>)}
              {gardiens[l.id] && <span className="discret">Détenu par {gardiens[l.id]}</span>}
            </button>
          );
        })}
      </div>

      <div className="actions gauche sans-impression">
        {devises.length > 1 && (
          <div className="segments etroit">
            {devises.map((d) => <button key={d} className={dev === d ? "actif" : ""} onClick={() => setDevise(d)}>{DEVISES[d].symbole} {d}</button>)}
          </div>
        )}
        <button className="btn secondaire petit" disabled={!livre.length} onClick={() => window.print()}>Imprimer / PDF</button>
        <button className="btn secondaire petit" disabled={!livre.length} onClick={exporter}>Exporter (CSV)</button>
        {gestion && <button className="lien" onClick={() => setEdition(gardiens[lieu] || "")}>{gardiens[lieu] ? "Changer le détenteur" : "Indiquer qui détient ces fonds"}</button>}
      </div>

      <article className="rapport">
        <header className="rapport-tete">
          <img src="/logo.png" alt="" className="rapport-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div>
            <div className="rapport-org">{ORG.sigle}</div>
            <div className="rapport-org2">{ORG.nom} · {ORG.ville}</div>
          </div>
          <div className="rapport-titre">
            <h1>Livre de caisse</h1>
            <p>{nomLieu} — {dev}{gardiens[lieu] ? ` — détenu par ${gardiens[lieu]}` : ""}</p>
          </div>
        </header>

        <div className="soldes">
          <div className="solde"><span className="solde-dev">ENTRÉES</span><span className="solde-val">{fmtMontant(t.entrees, dev)}</span></div>
          <div className="solde sortie"><span className="solde-dev">SORTIES</span><span className="solde-val">{fmtMontant(t.sorties, dev)}</span></div>
          <div className="solde reste"><span className="solde-dev">DOIT RESTER</span><span className={`solde-val ${t.solde < 0 ? "rouge" : ""}`}>{fmtMontant(t.solde, dev)}</span></div>
        </div>
        {t.solde < 0 && <p className="encart rejet">Le solde est négatif. Trois causes possibles : le solde d'ouverture n'a pas été saisi ; de l'argent est arrivé d'un autre lieu (retrait PayPal, par exemple) sans transfert enregistré dans Saisir ; ou une dépense a été payée d'une autre façon que celle indiquée.</p>}
        {attente.length > 0 && (
          <p className="encart">
            {attente.length} écriture(s) en attente de validation, non comptée(s) ci-dessus :
            {ta.entrees > 0 ? ` + ${fmtMontant(ta.entrees, dev)}` : ""}{ta.sorties > 0 ? ` − ${fmtMontant(ta.sorties, dev)}` : ""}.
            Une fois validées, le solde serait de {fmtMontant(t.solde + ta.solde, dev)}.
          </p>
        )}

        {livre.length === 0 ? <p className="vide">Aucune écriture validée pour ce lieu.</p> : (
          <table className="tab serre">
            <thead><tr><th>Date</th><th>N°</th><th>Libellé</th><th className="num">Entrée</th><th className="num">Sortie</th><th className="num">Solde</th></tr></thead>
            <tbody>
              {livre.map(({ e, solde }) => (
                <tr key={e.id} className="cliquable" onClick={() => setOuverte(e.id)}>
                  <td className="nowrap">{fmtDate(e.date)}</td>
                  <td className="nowrap">{e.numero || "—"}</td>
                  <td>{e.libelle}<br /><span className="discret">{nomActivite(activites, e.activiteId)}{e.tiers ? ` · ${e.tiers}` : ""}</span></td>
                  <td className="num nowrap">{e.type === "recette" ? fmtMontant(e.montant, dev) : ""}</td>
                  <td className="num nowrap">{e.type === "depense" ? fmtMontant(e.montant, dev) : ""}</td>
                  <td className={`num nowrap fort ${solde < 0 ? "rouge" : ""}`}>{fmtMontant(solde, dev)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={3}>Totaux</th><th className="num">{fmtMontant(t.entrees, dev)}</th><th className="num">{fmtMontant(t.sorties, dev)}</th><th className="num">{fmtMontant(t.solde, dev)}</th></tr></tfoot>
          </table>
        )}

        <div className="signatures deux-sign">
          <div><span>Détenteur des fonds</span><i>Je reconnais détenir le solde ci-dessus. Nom, date et signature</i></div>
          <div><span>Contrôle (comptage physique)</span><i>Montant compté : ………… Nom, date et signature</i></div>
        </div>
        <footer className="rapport-pied">Édité le {fmtDate(aujourdhui())} par {profil.nom} avec GAAM-Finances · Les dons en nature ne figurent pas dans la caisse.</footer>
      </article>

      {edition !== null && (
        <Modal titre={`Qui détient : ${nomLieu} ?`} onClose={() => setEdition(null)}>
          <Champ label="Nom du détenteur" aide="La personne qui garde ces fonds et en répond.">
            <input type="text" maxLength={80} value={edition} onChange={(e) => setEdition(e.target.value)} />
          </Champ>
          <button className="btn large" onClick={enregistrerGardien}>Enregistrer</button>
        </Modal>
      )}
      {ouverte && !aCorriger && <FicheEcriture id={ouverte} ctx={ctx} onClose={() => setOuverte(null)} onCorriger={setACorriger} />}
      {aCorriger && (
        <Modal titre={`Corriger ${aCorriger.numero || "l'écriture"}`} onClose={() => setACorriger(null)} large>
          <FormulaireEcriture ctx={ctx} initiale={aCorriger} onFini={() => { setACorriger(null); setOuverte(null); }} />
        </Modal>
      )}
    </div>
  );
}
