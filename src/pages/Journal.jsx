import { useEffect, useMemo, useState } from "react";
import { GENERAL, STATUTS, categorie, mode, peutValider } from "../lib/constantes";
import { fmtDate, nomActivite, telechargerCSV, triRecent, sansPiece, tauxDe, equivalentUSD } from "../lib/outils";
import { LigneEcriture, FicheEcriture, Modal } from "../composants";
import { FormulaireEcriture } from "./Saisie";

const virgule = (n, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",");
export const lignesCSV = (ecritures, activites, taux) => [
  ["N°", "Date", "Type", "Activité", "Catégorie", "Libellé", "Tiers", "Mode", "Référence", "Montant", "Devise", "Taux", "Équivalent USD", "Statut", "Pièces", "Reconstituée", "Saisi par", "Validé par"],
  ...ecritures.map((e) => [
    e.numero || "", fmtDate(e.date), e.type === "recette" ? "Recette" : "Dépense", nomActivite(activites, e.activiteId),
    categorie(e.categorie).label, e.libelle || "", e.tiers || "", mode(e.mode).label, e.reference || "",
    String(e.montant).replace(".", ","), e.devise,
    e.devise === "USD" ? "" : virgule(tauxDe(e, taux), 4), virgule(equivalentUSD(e, taux)), STATUTS[e.statut]?.label || e.statut, e.nbPieces || 0,
    e.reconstitue ? "Oui" : "Non", e.saisiPar?.nom || "", e.validePar?.nom || "",
  ]),
];

export default function PageJournal({ ctx, params }) {
  const { ecritures, activites, profil, taux } = ctx;
  const [filtre, setFiltre] = useState({
    activiteId: params?.activiteId || "", type: params?.type || "", statut: params?.statut || "", vue: params?.vue || "", texte: "",
  });
  const { memoriser } = ctx;
  useEffect(() => {
    memoriser({ activiteId: filtre.activiteId, type: filtre.type, statut: filtre.statut, vue: filtre.vue });
  }, [filtre.activiteId, filtre.type, filtre.statut, filtre.vue, memoriser]);
  const [ouverte, setOuverte] = useState(null);
  const [aCorriger, setACorriger] = useState(null);
  const maj = (c, v) => setFiltre((x) => ({ ...x, [c]: v }));

  const liste = useMemo(() => {
    const t = filtre.texte.trim().toLowerCase();
    return ecritures
      .filter((e) => !filtre.activiteId || e.activiteId === filtre.activiteId)
      .filter((e) => !filtre.type || e.type === filtre.type)
      .filter((e) => !filtre.statut || e.statut === filtre.statut)
      .filter((e) => {
        if (filtre.vue === "a_valider") return e.statut === "en_attente" && e.saisiPar?.uid !== profil.uid;
        if (filtre.vue === "sans_piece") return sansPiece(e) && e.statut !== "annulee";
        if (filtre.vue === "mes_rejets") return e.statut === "rejetee" && e.saisiPar?.uid === profil.uid;
        return true;
      })
      .filter((e) => !t || [e.libelle, e.tiers, e.numero, e.reference, categorie(e.categorie).label].some((x) => (x || "").toLowerCase().includes(t)))
      .sort(triRecent);
  }, [ecritures, filtre, profil.uid]);

  const vues = [
    { id: "", label: "Tout" },
    ...(peutValider(profil.role) ? [{ id: "a_valider", label: "À valider" }] : []),
    { id: "sans_piece", label: "Sans pièce" },
    { id: "mes_rejets", label: "Mes rejets" },
  ];

  return (
    <div className="page">
      <div className="titre-ligne">
        <h1>Journal</h1>
        <button className="btn secondaire petit" disabled={!liste.length}
          onClick={() => telechargerCSV("gaam-journal.csv", lignesCSV(liste, activites, taux))}>Exporter (CSV)</button>
      </div>

      <div className="onglets">
        {vues.map((v) => <button key={v.id} className={filtre.vue === v.id ? "actif" : ""} onClick={() => maj("vue", v.id)}>{v.label}</button>)}
      </div>

      <div className="filtres">
        <select value={filtre.activiteId} onChange={(e) => maj("activiteId", e.target.value)} aria-label="Activité">
          <option value="">Toutes les activités</option>
          {activites.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          <option value={GENERAL.id}>{GENERAL.nom}</option>
        </select>
        <select value={filtre.type} onChange={(e) => maj("type", e.target.value)} aria-label="Type">
          <option value="">Recettes et dépenses</option>
          <option value="recette">Recettes</option>
          <option value="depense">Dépenses</option>
        </select>
        <select value={filtre.statut} onChange={(e) => maj("statut", e.target.value)} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <input type="search" placeholder="Rechercher (libellé, nom, n°)" value={filtre.texte} onChange={(e) => maj("texte", e.target.value)} />
      </div>

      <p className="discret">{liste.length} écriture{liste.length > 1 ? "s" : ""}</p>
      <div className="carte sans-marge">
        {liste.length === 0
          ? <p className="vide">Aucune écriture ne correspond.</p>
          : liste.map((e) => <LigneEcriture key={e.id} e={e} activites={activites} onClick={() => setOuverte(e.id)} />)}
      </div>

      {ouverte && !aCorriger && (
        <FicheEcriture id={ouverte} ctx={ctx} onClose={() => setOuverte(null)} onCorriger={(e) => setACorriger(e)} />
      )}
      {aCorriger && (
        <Modal titre={`Corriger ${aCorriger.numero || "l'écriture"}`} onClose={() => setACorriger(null)} large>
          {aCorriger.statut === "rejetee" && <p className="encart rejet">Rejetée : {aCorriger.motifRejet}</p>}
          <FormulaireEcriture ctx={ctx} initiale={aCorriger} onFini={() => { setACorriger(null); setOuverte(null); }} />
        </Modal>
      )}
    </div>
  );
}
