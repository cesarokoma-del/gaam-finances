import { useEffect, useRef, useState } from "react";
import { store } from "./store";
import {
  STATUTS, TYPES_PIECE, typePiece, categorie, mode, peutSaisir, peutValider, peutAnnuler,
} from "./lib/constantes";
import { fmtMontant, fmtDate, fmtDateHeure, nomActivite, preparerPiece, messageErreur, devisesUtilisees } from "./lib/outils";

export function Modal({ titre, onClose, children, large }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${large ? "large" : ""}`} role="dialog" aria-modal="true" aria-label={titre}>
        <div className="modal-tete">
          <h2>{titre}</h2>
          <button className="btn-x" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="modal-corps">{children}</div>
      </div>
    </div>
  );
}

export function Pastille({ statut }) {
  const s = STATUTS[statut] || { label: statut, classe: "" };
  return <span className={`pastille ${s.classe}`}>{s.label}</span>;
}

export function Champ({ label, aide, children, requis }) {
  return (
    <label className="champ">
      <span className="champ-lbl">{label}{requis && <em> *</em>}</span>
      {children}
      {aide && <span className="champ-aide">{aide}</span>}
    </label>
  );
}

// Totaux par devise sur une ligne : « $400.00 · 285 000 FC »
export function Montants({ t, cle, vide = "—" }) {
  const ds = Object.keys(t || {}).filter((d) => t[d][cle]);
  if (!ds.length) return <>{vide}</>;
  return <>{["USD", "CDF", "EUR"].filter((d) => ds.includes(d)).map((d) => fmtMontant(t[d][cle], d)).join(" · ")}</>;
}

export function LigneEcriture({ e, activites, onClick }) {
  return (
    <button className={`ligne ${e.statut === "annulee" ? "barree" : ""}`} onClick={onClick}>
      <span className={`sens ${e.type}`}>{e.type === "recette" ? "↑" : "↓"}</span>
      <span className="ligne-milieu">
        <span className="ligne-titre">{e.libelle || categorie(e.categorie).label}</span>
        <span className="ligne-sous">
          {fmtDate(e.date)} · {nomActivite(activites, e.activiteId)}
          {e.numero ? ` · ${e.numero}` : " · n° à attribuer"}
        </span>
        <span className="ligne-marques">
          <Pastille statut={e.statut} />
          {!(e.nbPieces > 0) && <span className="pastille alerte">Sans pièce</span>}
          {e.reconstitue && <span className="pastille neutre">Reconstituée</span>}
        </span>
      </span>
      <span className={`ligne-montant ${e.type}`}>{e.type === "depense" ? "−" : "+"}{fmtMontant(e.montant, e.devise)}</span>
    </button>
  );
}

// ── Choix des pièces justificatives (photo ou PDF) ────
export function SelecteurPieces({ pieces, setPieces, signaler }) {
  const photo = useRef(null);
  const fichier = useRef(null);
  const [occupe, setOccupe] = useState(false);

  const ajouter = async (liste) => {
    setOccupe(true);
    try {
      const nouvelles = [];
      for (const f of Array.from(liste || [])) nouvelles.push({ ...(await preparerPiece(f)), type: "recu" });
      setPieces([...pieces, ...nouvelles].slice(0, 5));
    } catch (e) {
      signaler(messageErreur(e));
    }
    setOccupe(false);
  };

  return (
    <div className="pieces">
      {pieces.map((p, i) => (
        <div className="piece" key={i}>
          {p.format === "image" ? <img src={p.donnees} alt={`Pièce ${i + 1}`} /> : <div className="piece-pdf">PDF</div>}
          <select value={p.type} onChange={(ev) => setPieces(pieces.map((x, j) => (j === i ? { ...x, type: ev.target.value } : x)))}>
            {TYPES_PIECE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button type="button" className="lien rouge" onClick={() => setPieces(pieces.filter((_, j) => j !== i))}>Retirer</button>
        </div>
      ))}
      {pieces.length < 5 && (
        <div className="pieces-actions">
          <button type="button" className="btn secondaire" disabled={occupe} onClick={() => photo.current.click()}>
            {occupe ? "Préparation…" : "Prendre une photo"}
          </button>
          <button type="button" className="btn secondaire" disabled={occupe} onClick={() => fichier.current.click()}>Choisir un fichier</button>
          <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => { ajouter(ev.target.files); ev.target.value = ""; }} />
          <input ref={fichier} type="file" accept="image/*,application/pdf" multiple hidden onChange={(ev) => { ajouter(ev.target.files); ev.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}

// ── Fiche complète d'une écriture, avec ses pièces et les actions ──
export function FicheEcriture({ id, ctx, onClose, onCorriger }) {
  const { profil, par, ecritures, activites, signaler } = ctx;
  const e = ecritures.find((x) => x.id === id);
  const [pieces, setPieces] = useState(null);
  const [aAjouter, setAAjouter] = useState([]);
  const [action, setAction] = useState(null); // "rejet" | "annulation"
  const [motif, setMotif] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let vivant = true;
    setPieces(null);
    store.lirePieces(id).then((p) => vivant && setPieces(p)).catch(() => vivant && setPieces([]));
    return () => { vivant = false; };
  }, [id, e?.nbPieces]);

  if (!e) return null;
  const role = profil.role;
  const estAuteur = e.saisiPar?.uid === profil.uid;
  const peutDecider = e.statut === "en_attente" && peutValider(role) && !estAuteur;
  const peutCorriger = ["en_attente", "rejetee"].includes(e.statut) && estAuteur && peutSaisir(role);
  const peutAnnulerIci = e.statut === "validee" && peutAnnuler(role);
  const peutJoindre = peutSaisir(role) && e.statut !== "annulee";

  const faire = async (fn, message) => {
    setOccupe(true);
    try { await fn(); signaler(message); setAction(null); setMotif(""); }
    catch (err) { signaler(messageErreur(err)); }
    setOccupe(false);
  };

  return (
    <Modal titre={e.numero || "Écriture sans numéro"} onClose={onClose} large>
      <div className="fiche-tete">
        <div className={`fiche-montant ${e.type}`}>{e.type === "depense" ? "−" : "+"}{fmtMontant(e.montant, e.devise)}</div>
        <div className="ligne-marques">
          <Pastille statut={e.statut} />
          <span className="pastille neutre">{e.type === "recette" ? "Recette" : "Dépense"}</span>
          {e.reconstitue && <span className="pastille neutre">Reconstituée</span>}
        </div>
      </div>

      <dl className="details">
        <dt>Libellé</dt><dd>{e.libelle || "—"}</dd>
        <dt>Activité</dt><dd>{nomActivite(activites, e.activiteId)}</dd>
        <dt>Catégorie</dt><dd>{categorie(e.categorie).label}</dd>
        <dt>Date de l'opération</dt><dd>{fmtDate(e.date)}</dd>
        <dt>{e.type === "recette" ? "Reçu de" : "Payé à"}</dt><dd>{e.tiers || "—"}</dd>
        <dt>Mode</dt><dd>{mode(e.mode).label}{e.reference ? ` · réf. ${e.reference}` : ""}</dd>
        {e.type === "depense" && <><dt>Paiement direct au fournisseur</dt><dd>{e.paiementDirect === true ? "Oui" : e.paiementDirect === false ? "Non" : "—"}</dd></>}
        <dt>Saisie par</dt><dd>{e.saisiPar?.nom} — {fmtDateHeure(e.saisiLe)}</dd>
        {e.validePar && <><dt>{e.statut === "rejetee" ? "Rejetée par" : "Validée par"}</dt><dd>{e.validePar.nom} — {fmtDateHeure(e.valideLe)}</dd></>}
        {e.statut === "rejetee" && <><dt>Motif du rejet</dt><dd className="rouge">{e.motifRejet || "—"}</dd></>}
        {e.statut === "annulee" && <><dt>Annulée par</dt><dd>{e.annulePar?.nom} — {fmtDateHeure(e.annuleLe)} : {e.motifAnnulation}</dd></>}
        {e.reconstitue && <><dt>Source de la reconstitution</dt><dd>{e.sourceReconstitution || "—"}</dd></>}
        {!(e.nbPieces > 0) && <><dt>Pas de pièce, parce que</dt><dd>{e.sansPieceMotif || "—"}</dd></>}
        {e.note && <><dt>Note</dt><dd>{e.note}</dd></>}
      </dl>

      <h3 className="sous-titre">Pièces justificatives ({e.nbPieces || 0})</h3>
      {pieces === null ? <p className="discret">Chargement…</p> : pieces.length === 0 ? (
        <p className="encart alerte">Aucune pièce jointe. Cette écriture apparaîtra dans les points d'attention du rapport.</p>
      ) : (
        <div className="galerie">
          {pieces.map((p) => (
            <figure key={p.id}>
              {p.format === "image"
                ? <button className="vignette" onClick={() => setZoom(p)}><img src={p.donnees} alt={typePiece(p.type).label} /></button>
                : <a className="vignette pdf" href={p.donnees} download={p.nomFichier || "piece.pdf"}>PDF<br />Télécharger</a>}
              <figcaption>{typePiece(p.type).label}<br /><span className="discret">{p.ajoutePar?.nom}</span></figcaption>
            </figure>
          ))}
        </div>
      )}

      {peutJoindre && (
        <div className="bloc">
          <SelecteurPieces pieces={aAjouter} setPieces={setAAjouter} signaler={signaler} />
          {aAjouter.length > 0 && (
            <button className="btn" disabled={occupe} onClick={() => faire(async () => { await store.ajouterPieces(e.id, aAjouter, par); setAAjouter([]); }, "Pièce ajoutée")}>
              Joindre {aAjouter.length > 1 ? `ces ${aAjouter.length} pièces` : "cette pièce"}
            </button>
          )}
        </div>
      )}

      {e.statut === "en_attente" && estAuteur && (
        <p className="encart">Vous avez saisi cette écriture : une autre personne habilitée doit la valider.</p>
      )}

      {action ? (
        <div className="bloc">
          <Champ label={action === "rejet" ? "Motif du rejet" : "Motif de l'annulation"} requis>
            <textarea rows={3} value={motif} onChange={(ev) => setMotif(ev.target.value)} placeholder="Expliquez en une phrase" />
          </Champ>
          <div className="actions">
            <button className="btn secondaire" onClick={() => { setAction(null); setMotif(""); }}>Retour</button>
            <button className="btn danger" disabled={occupe || motif.trim().length < 5}
              onClick={() => action === "rejet"
                ? faire(() => store.deciderEcriture(e.id, { decision: "rejetee", motif: motif.trim() }, par), "Écriture rejetée")
                : faire(() => store.annulerEcriture(e.id, motif.trim(), par), "Écriture annulée")}>
              Confirmer
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {peutDecider && <button className="btn danger-leger" disabled={occupe} onClick={() => setAction("rejet")}>Rejeter</button>}
          {peutDecider && <button className="btn" disabled={occupe} onClick={() => faire(() => store.deciderEcriture(e.id, { decision: "validee" }, par), "Écriture validée")}>Valider</button>}
          {peutCorriger && <button className="btn" onClick={() => onCorriger(e)}>Corriger</button>}
          {peutAnnulerIci && <button className="btn danger-leger" onClick={() => setAction("annulation")}>Annuler cette écriture</button>}
        </div>
      )}

      {zoom && (
        <div className="voile sombre" onClick={() => setZoom(null)}>
          <img className="zoom" src={zoom.donnees} alt="Pièce agrandie" />
        </div>
      )}
    </Modal>
  );
}

// Tableau « catégorie × devise » utilisé dans les rapports
export function TableauCategories({ lignes, ecritures, titreTotal }) {
  const ds = devisesUtilisees(ecritures);
  const total = {};
  lignes.forEach((l) => ds.forEach((d) => { total[d] = (total[d] || 0) + (l.montants[d] || 0); }));
  if (!lignes.length) return <p className="discret">Aucune écriture validée.</p>;
  return (
    <table className="tab">
      <thead><tr><th>Catégorie</th>{ds.map((d) => <th key={d} className="num">{d}</th>)}</tr></thead>
      <tbody>
        {lignes.map((l) => (
          <tr key={l.id}><td>{l.label}</td>{ds.map((d) => <td key={d} className="num">{l.montants[d] ? fmtMontant(l.montants[d], d) : "—"}</td>)}</tr>
        ))}
      </tbody>
      <tfoot><tr><th>{titreTotal}</th>{ds.map((d) => <th key={d} className="num">{fmtMontant(total[d] || 0, d)}</th>)}</tr></tfoot>
    </table>
  );
}
