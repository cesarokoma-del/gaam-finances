import { useEffect, useMemo, useState } from "react";
import { ORG, GENERAL, DOMAINES, MOIS, categorie, mode, estInterne } from "../lib/constantes";
import {
  fmtMontant, fmtDate, totaux, totalUSD, parCategorie, devisesUtilisees, triAncien, sansPiece,
  telechargerCSV, aujourdhui, nomActivite,
} from "../lib/outils";
import { TableauCategories } from "../composants";
import { lignesCSV } from "./Journal";

function EnTete({ titre, sousTitre }) {
  return (
    <header className="rapport-tete">
      <img src="/logo.png" alt="" className="rapport-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div>
        <div className="rapport-org">{ORG.sigle}</div>
        <div className="rapport-org2">{ORG.nom} · {ORG.ville}</div>
      </div>
      <div className="rapport-titre">
        <h1>{titre}</h1>
        {sousTitre && <p>{sousTitre}</p>}
      </div>
    </header>
  );
}

function Synthese({ validees, taux, budget }) {
  const t = totaux(validees);
  const ds = devisesUtilisees(validees);
  const u = totalUSD(validees, taux);
  if (!ds.length) return <p className="discret">Aucune écriture validée.</p>;
  return (
    <>
      <table className="tab">
        <thead><tr><th>Devise</th><th className="num">Recettes</th><th className="num">Dépenses</th><th className="num">Solde</th></tr></thead>
        <tbody>
          {ds.map((d) => (
            <tr key={d}><td>{d}</td><td className="num">{fmtMontant(t[d].recettes, d)}</td><td className="num">{fmtMontant(t[d].depenses, d)}</td><td className="num fort">{fmtMontant(t[d].solde, d)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th>Équivalent en USD (indicatif)</th><th className="num">{fmtMontant(u.recettes, "USD")}</th><th className="num">{fmtMontant(u.depenses, "USD")}</th><th className="num">{fmtMontant(u.solde, "USD")}</th></tr>
        </tfoot>
      </table>
      {budget > 0 && (
        <p className="note">Budget prévu : {fmtMontant(budget, "USD")} — dépensé : {fmtMontant(u.depenses, "USD")} ({Math.round((u.depenses / budget) * 100)} %) — écart : {fmtMontant(budget - u.depenses, "USD")}.</p>
      )}
      <p className="note">Taux indicatifs : 1 USD = {Number(taux.USD).toLocaleString("fr-FR")} FC ; 1 EUR = {Number(taux.EUR).toLocaleString("fr-FR")} FC. Les montants sont tenus dans leur devise d'origine ; l'équivalent en dollars sert seulement de repère.</p>
    </>
  );
}

function JournalDetaille({ liste, avecActivite, activites }) {
  if (!liste.length) return <p className="discret">Aucune écriture.</p>;
  return (
    <table className="tab serre">
      <thead>
        <tr><th>N°</th><th>Date</th><th>Libellé</th><th>Tiers</th><th>Mode</th><th className="num">Recette</th><th className="num">Dépense</th><th>Pièces</th><th>Saisi / validé par</th></tr>
      </thead>
      <tbody>
        {liste.map((e) => (
          <tr key={e.id}>
            <td className="nowrap">{e.numero || "—"}</td>
            <td className="nowrap">{fmtDate(e.date)}</td>
            <td>{e.libelle}<br /><span className="discret">{categorie(e.categorie).label}{avecActivite ? ` · ${nomActivite(activites, e.activiteId)}` : ""}{e.reconstitue ? " · reconstituée" : ""}</span></td>
            <td>{e.tiers || "—"}</td>
            <td>{mode(e.mode).label}{e.reference ? <><br /><span className="discret">{e.reference}</span></> : null}</td>
            <td className="num nowrap">{e.type === "recette" ? fmtMontant(e.montant, e.devise) : ""}</td>
            <td className="num nowrap">{e.type === "depense" ? fmtMontant(e.montant, e.devise) : ""}</td>
            <td className={sansPiece(e) ? "rouge" : ""}>{sansPiece(e) ? "Aucune" : e.nbPieces}</td>
            <td>{e.saisiPar?.nom || "—"}<br /><span className="discret">{e.validePar?.nom || "—"}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PointsAttention({ toutes }) {
  const validees = toutes.filter((e) => e.statut === "validee");
  const points = [
    { titre: "Écritures en attente de validation (non comptées dans les totaux)", liste: toutes.filter((e) => e.statut === "en_attente") },
    { titre: "Écritures rejetées, à corriger (non comptées)", liste: toutes.filter((e) => e.statut === "rejetee") },
    { titre: "Écritures validées sans pièce justificative", liste: validees.filter(sansPiece), motif: (e) => e.sansPieceMotif },
    { titre: "Écritures reconstituées après coup", liste: validees.filter((e) => e.reconstitue), motif: (e) => e.sourceReconstitution },
    { titre: "Dépenses non payées directement au fournisseur", liste: validees.filter((e) => e.type === "depense" && e.paiementDirect === false) },
    { titre: "Écritures annulées", liste: toutes.filter((e) => e.statut === "annulee"), motif: (e) => e.motifAnnulation },
  ].filter((p) => p.liste.length);

  if (!points.length) return <p className="encart ok">Aucun point d'attention : toutes les écritures sont validées et justifiées.</p>;
  return points.map((p) => (
    <div key={p.titre} className="point">
      <h4>{p.titre} — {p.liste.length}</h4>
      <ul>
        {p.liste.sort(triAncien).map((e) => (
          <li key={e.id}>
            {e.numero || "sans n°"} · {fmtDate(e.date)} · {e.libelle} · {fmtMontant(e.montant, e.devise)}
            {p.motif && p.motif(e) ? <span className="discret"> — {p.motif(e)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  ));
}

function Signatures() {
  return (
    <div className="signatures">
      {["La Trésorière", "L'Administrateur Président", "La Commission de Contrôle"].map((s) => (
        <div key={s}><span>{s}</span><i>Nom, date et signature</i></div>
      ))}
    </div>
  );
}

function Rapport({ ctx, titre, sousTitre, infos, toutes, budget, avecActivite, nomCSV }) {
  const { taux, activites, profil } = ctx;
  const validees = useMemo(() => toutes.filter((e) => e.statut === "validee").sort(triAncien), [toutes]);
  const provisoire = toutes.some((e) => ["en_attente", "rejetee"].includes(e.statut)) || validees.some(sansPiece);

  return (
    <>
      <div className="actions gauche sans-impression">
        <button className="btn" onClick={() => window.print()}>Imprimer / PDF</button>
        <button className="btn secondaire" disabled={!toutes.length} onClick={() => telechargerCSV(nomCSV, lignesCSV([...toutes].sort(triAncien), activites))}>Exporter (CSV)</button>
      </div>
      <article className="rapport">
        <EnTete titre={titre} sousTitre={sousTitre} />
        <div className={`rapport-etat ${provisoire ? "provisoire" : "complet"}`}>
          {provisoire ? "RAPPORT PROVISOIRE — des écritures restent à valider ou à justifier (voir section 5)" : "RAPPORT COMPLET — toutes les écritures sont validées et justifiées"}
        </div>
        {infos && <dl className="details compact">{infos.map(([k, v]) => v ? <span key={k} className="paire"><dt>{k}</dt><dd>{v}</dd></span> : null)}</dl>}

        <h3>1. Synthèse</h3>
        <Synthese validees={validees} taux={taux} budget={budget} />

        <h3>2. Recettes par catégorie</h3>
        <TableauCategories lignes={parCategorie(validees.filter((e) => e.type === "recette"))} ecritures={validees.filter((e) => e.type === "recette")} titreTotal="Total des recettes" />

        <h3>3. Dépenses par catégorie</h3>
        <TableauCategories lignes={parCategorie(validees.filter((e) => e.type === "depense"))} ecritures={validees.filter((e) => e.type === "depense")} titreTotal="Total des dépenses" />

        <h3>4. Détail des écritures validées</h3>
        <JournalDetaille liste={validees} avecActivite={avecActivite} activites={activites} />

        <h3>5. Points d'attention</h3>
        <PointsAttention toutes={toutes} />

        <Signatures />
        <footer className="rapport-pied">
          Édité le {fmtDate(aujourdhui())} par {profil.nom} avec GAAM-Finances · {ORG.site} · {ORG.email}
        </footer>
      </article>
    </>
  );
}

export default function PageRapports({ ctx, params }) {
  const { activites, ecritures } = ctx;
  const maintenant = new Date();
  const [genre, setGenre] = useState(params?.genre || "activite");
  const [activiteId, setActiviteId] = useState(params?.activiteId || "");
  const [annee, setAnnee] = useState(parseInt(params?.annee, 10) || maintenant.getFullYear());
  const [mois, setMois] = useState(params?.mois !== undefined && !isNaN(parseInt(params.mois, 10)) ? parseInt(params.mois, 10) : -1); // -1 = toute l'année
  const { memoriser } = ctx;
  useEffect(() => {
    memoriser(genre === "activite" ? { activiteId } : { genre, annee, mois: mois < 0 ? "" : mois });
  }, [genre, activiteId, annee, mois, memoriser]);

  const annees = useMemo(() => {
    const s = new Set(ecritures.map((e) => parseInt((e.date || "").slice(0, 4), 10)).filter(Boolean));
    s.add(maintenant.getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [ecritures]);

  const a = activiteId === GENERAL.id ? { ...GENERAL } : activites.find((x) => x.id === activiteId);
  // Les transferts internes ne sont ni des recettes ni des dépenses : ils restent hors des rapports.
  const toutesActivite = useMemo(() => ecritures.filter((e) => e.activiteId === activiteId && !estInterne(e)), [ecritures, activiteId]);
  const toutesPeriode = useMemo(() => {
    const prefixe = mois < 0 ? `${annee}-` : `${annee}-${String(mois + 1).padStart(2, "0")}`;
    return ecritures.filter((e) => (e.date || "").startsWith(prefixe) && !estInterne(e));
  }, [ecritures, annee, mois]);

  return (
    <div className="page large">
      <h1 className="sans-impression">Rapports</h1>
      <div className="onglets sans-impression">
        <button className={genre === "activite" ? "actif" : ""} onClick={() => setGenre("activite")}>Par activité</button>
        <button className={genre === "periode" ? "actif" : ""} onClick={() => setGenre("periode")}>Par période</button>
      </div>

      {genre === "activite" ? (
        <>
          <div className="filtres sans-impression">
            <select value={activiteId} onChange={(e) => setActiviteId(e.target.value)} aria-label="Activité">
              <option value="">— Choisir une activité —</option>
              {[...activites].sort((x, y) => (y.dateDebut || "").localeCompare(x.dateDebut || "")).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
              <option value={GENERAL.id}>{GENERAL.nom}</option>
            </select>
          </div>
          {!a ? <p className="encart sans-impression">Choisissez une activité pour afficher son rapport financier.</p> : (
            <Rapport
              ctx={ctx}
              titre="Rapport financier d'activité"
              sousTitre={a.nom}
              infos={a.id === GENERAL.id ? null : [
                ["Dates", `${fmtDate(a.dateDebut)}${a.dateFin && a.dateFin !== a.dateDebut ? ` – ${fmtDate(a.dateFin)}` : ""}`],
                ["Lieu", a.lieu], ["Responsable", a.responsable],
                ["Domaine", DOMAINES.find((d) => d.id === a.domaine)?.label],
                ["État", a.statut === "cloturee" ? "Clôturée" : "Ouverte"],
                ["Description", a.description],
              ]}
              toutes={toutesActivite}
              budget={a.budget}
              nomCSV={`gaam-rapport-${(a.nom || "activite").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv`}
            />
          )}
        </>
      ) : (
        <>
          <div className="filtres sans-impression">
            <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value, 10))} aria-label="Année">
              {annees.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={mois} onChange={(e) => setMois(parseInt(e.target.value, 10))} aria-label="Mois">
              <option value={-1}>Toute l'année</option>
              {MOIS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <Rapport
            ctx={ctx}
            titre="Rapport financier de période"
            sousTitre={mois < 0 ? `Année ${annee}` : `${MOIS[mois]} ${annee}`}
            toutes={toutesPeriode}
            avecActivite
            nomCSV={`gaam-rapport-${annee}${mois < 0 ? "" : "-" + String(mois + 1).padStart(2, "0")}.csv`}
          />
        </>
      )}
    </div>
  );
}
