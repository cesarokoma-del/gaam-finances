import { useMemo, useState } from "react";
import { store } from "../store";
import { CAT_RECETTES, CAT_DEPENSES, CAT_TRANSFERT, CAT_CHANGE, LIEUX, DEVISES, MODES, GENERAL, SOURCES_RECONSTITUTION, peutSaisir } from "../lib/constantes";
import { aujourdhui, messageErreur, fmtMontant, tauxParDefaut, convertirUSD } from "../lib/outils";
import { Champ, SelecteurPieces } from "../composants";

const nombre = (v) => parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
const tauxTexte = (devise, taux) => { const t = tauxParDefaut(devise, taux); return t ? String(t) : ""; };

// Taux du jour de l'opération : il reste attaché à l'écriture, pour que son
// équivalent en dollars ne change plus quand le taux des Réglages change.
function ChampTaux({ devise, valeur, onChange, montant }) {
  if (devise === "USD") return null;
  const t = nombre(valeur), m = nombre(montant);
  return (
    <Champ label={devise === "CDF" ? "Taux du jour : 1 USD = … FC" : "Taux du jour : 1 EUR = … USD"} requis
      aide={`Rempli avec le taux des Réglages. Mettez le taux réel du jour de l'opération si vous le connaissez.${t > 0 && m > 0 ? ` Équivalent : ${fmtMontant(convertirUSD(m, devise, t), "USD")}.` : ""}`}>
      <input type="text" inputMode="decimal" value={valeur} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} />
    </Champ>
  );
}

// Formulaire de saisie — sert aussi à corriger une écriture (prop « initiale »).
export function FormulaireEcriture({ ctx, initiale, activiteParDefaut, onFini }) {
  const { par, activites, signaler, taux } = ctx;
  const correction = !!initiale;
  const [f, setF] = useState(() => ({
    type: initiale?.type || "depense",
    activiteId: initiale?.activiteId || activiteParDefaut || "",
    devise: initiale?.devise || "USD",
    taux: initiale?.taux ? String(initiale.taux) : tauxTexte(initiale?.devise || "USD", taux),
    montant: initiale?.montant ? String(initiale.montant) : "",
    categorie: initiale?.categorie || "",
    date: initiale?.date || aujourdhui(),
    libelle: initiale?.libelle || "",
    tiers: initiale?.tiers || "",
    mode: initiale?.mode || "especes",
    reference: initiale?.reference || "",
    paiementDirect: initiale?.paiementDirect ?? true,
    reconstitue: initiale?.reconstitue || false,
    sourceReconstitution: initiale?.sourceReconstitution || "",
    sansPieceMotif: initiale?.sansPieceMotif || "",
    note: initiale?.note || "",
  }));
  const [pieces, setPieces] = useState([]);
  const [occupe, setOccupe] = useState(false);
  const [erreurs, setErreurs] = useState([]);
  const maj = (cle, v) => setF((x) => ({ ...x, [cle]: v }));

  const choixActivites = useMemo(
    () => activites.filter((a) => a.statut !== "cloturee" || a.id === initiale?.activiteId)
      .sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || "")),
    [activites, initiale]
  );
  const cats = f.type === "recette" ? CAT_RECETTES : CAT_DEPENSES;
  const groupes = [...new Set(CAT_DEPENSES.map((c) => c.g))];
  const nbPiecesTotal = (initiale?.nbPieces || 0) + pieces.length;
  const ancienne = f.date && (Date.now() - new Date(f.date + "T12:00:00").getTime()) / 86400000 > 30;

  const verifier = () => {
    const e = [];
    const m = parseFloat(String(f.montant).replace(",", "."));
    if (!f.activiteId) e.push("Choisissez l'activité concernée.");
    if (!(m > 0)) e.push("Indiquez un montant supérieur à zéro.");
    if (f.devise !== "USD" && !(nombre(f.taux) > 0)) e.push("Indiquez le taux du jour de l'opération.");
    if (!f.categorie) e.push("Choisissez une catégorie.");
    if (!f.date) e.push("Indiquez la date de l'opération.");
    else if (f.date > aujourdhui()) e.push("La date ne peut pas être dans le futur.");
    if (f.libelle.trim().length < 3) e.push("Décrivez l'opération en quelques mots.");
    if (f.type === "depense" && f.tiers.trim().length < 2) e.push("Indiquez à qui l'argent a été payé.");
    if (nbPiecesTotal === 0 && f.sansPieceMotif.trim().length < 5) e.push("Joignez une pièce, ou expliquez pourquoi il n'y en a pas.");
    if (f.reconstitue && !f.sourceReconstitution) e.push("Indiquez sur quoi s'appuie cette écriture reconstituée.");
    return e;
  };

  const enregistrer = async () => {
    const e = verifier();
    setErreurs(e);
    if (e.length) return;
    setOccupe(true);
    const donnees = {
      type: f.type, activiteId: f.activiteId, devise: f.devise,
      taux: f.devise === "USD" ? null : nombre(f.taux),
      montant: Math.round(parseFloat(String(f.montant).replace(",", ".")) * 100) / 100,
      categorie: f.categorie, date: f.date, libelle: f.libelle.trim(), tiers: f.tiers.trim(),
      mode: f.mode, reference: f.reference.trim(),
      paiementDirect: f.type === "depense" ? !!f.paiementDirect : null,
      reconstitue: !!f.reconstitue,
      sourceReconstitution: f.reconstitue ? f.sourceReconstitution : "",
      sansPieceMotif: nbPiecesTotal === 0 ? f.sansPieceMotif.trim() : "",
      note: f.note.trim(),
    };
    try {
      if (correction) {
        await store.corrigerEcriture(initiale.id, donnees);
        if (pieces.length) await store.ajouterPieces(initiale.id, pieces, par);
        signaler("Écriture corrigée — renvoyée en validation");
        onFini && onFini();
      } else {
        const r = await store.creerEcriture(donnees, pieces, par);
        signaler(r.horsLigne ? "Enregistrée dans le téléphone — envoi au retour du réseau" : `Enregistrée sous le n° ${r.numero}`);
        setF((x) => ({ ...x, montant: "", libelle: "", tiers: "", reference: "", sansPieceMotif: "", note: "", categorie: "" }));
        setPieces([]);
        onFini && onFini(r);
      }
    } catch (err) {
      setErreurs([messageErreur(err)]);
    }
    setOccupe(false);
  };

  return (
    <div className="formulaire">
      <div className="bascule">
        <button type="button" className={f.type === "recette" ? "actif recette" : ""} disabled={correction} onClick={() => { maj("type", "recette"); maj("categorie", ""); }}>↑ Recette</button>
        <button type="button" className={f.type === "depense" ? "actif depense" : ""} disabled={correction} onClick={() => { maj("type", "depense"); maj("categorie", ""); }}>↓ Dépense</button>
      </div>

      <Champ label="Activité concernée" requis>
        <select value={f.activiteId} onChange={(e) => maj("activiteId", e.target.value)}>
          <option value="">— Choisir —</option>
          {choixActivites.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          <option value={GENERAL.id}>{GENERAL.nom}</option>
        </select>
      </Champ>

      <div className="deux">
        <Champ label="Montant" requis>
          <input type="text" inputMode="decimal" placeholder="0" value={f.montant} onChange={(e) => maj("montant", e.target.value.replace(/[^0-9.,]/g, ""))} />
        </Champ>
        <Champ label="Devise" requis>
          <div className="segments">
            {Object.keys(DEVISES).map((d) => (
              <button type="button" key={d} className={f.devise === d ? "actif" : ""} onClick={() => setF((x) => ({
                ...x, devise: d, taux: initiale?.devise === d && initiale?.taux ? String(initiale.taux) : tauxTexte(d, taux),
              }))}>{DEVISES[d].symbole} {d}</button>
            ))}
          </div>
        </Champ>
      </div>
      <ChampTaux devise={f.devise} valeur={f.taux} montant={f.montant} onChange={(v) => maj("taux", v)} />

      <div className="deux">
        <Champ label="Date de l'opération" requis>
          <input type="date" max={aujourdhui()} value={f.date} onChange={(e) => maj("date", e.target.value)} />
        </Champ>
        <Champ label="Catégorie" requis>
          <select value={f.categorie} onChange={(e) => maj("categorie", e.target.value)}>
            <option value="">— Choisir —</option>
            {[CAT_TRANSFERT, CAT_CHANGE].filter((c) => initiale?.categorie === c.id).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            {f.type === "recette"
              ? cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)
              : groupes.map((g) => (
                <optgroup key={g} label={g}>
                  {CAT_DEPENSES.filter((c) => c.g === g).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </optgroup>
              ))}
          </select>
        </Champ>
      </div>

      <Champ label="Libellé" requis aide="Ce qui a été reçu ou payé, en quelques mots.">
        <input type="text" maxLength={140} value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder={f.type === "recette" ? "Ex. Don pour la visite de l'orphelinat" : "Ex. Achat de 10 sacs de riz"} />
      </Champ>

      <div className="deux">
        <Champ label={f.type === "recette" ? "Reçu de (donateur)" : "Payé à (fournisseur, bénéficiaire)"} requis={f.type === "depense"}>
          <input type="text" maxLength={100} value={f.tiers} onChange={(e) => maj("tiers", e.target.value)} placeholder={f.type === "recette" ? "Nom, ou « Anonyme »" : "Nom du fournisseur"} />
        </Champ>
        <Champ label="Mode de paiement">
          <select value={f.mode} onChange={(e) => maj("mode", e.target.value)}>
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Champ>
      </div>

      <Champ label="Référence" aide="N° du reçu, de la facture ou de la transaction (facultatif).">
        <input type="text" maxLength={60} value={f.reference} onChange={(e) => maj("reference", e.target.value)} />
      </Champ>

      {f.type === "depense" && (
        <label className="coche">
          <input type="checkbox" checked={!!f.paiementDirect} onChange={(e) => maj("paiementDirect", e.target.checked)} />
          <span>Le fournisseur a été payé directement (pas par une personne intermédiaire)</span>
        </label>
      )}

      <div className="bloc">
        <span className="champ-lbl">Pièces justificatives{correction && initiale.nbPieces > 0 ? ` — ${initiale.nbPieces} déjà jointe(s)` : ""}</span>
        <SelecteurPieces pieces={pieces} setPieces={setPieces} signaler={signaler} />
        {nbPiecesTotal === 0 && (
          <Champ label="Pas de pièce : pourquoi ?" requis aide="L'écriture sera signalée dans le rapport jusqu'à ce qu'une pièce soit jointe.">
            <input type="text" maxLength={140} value={f.sansPieceMotif} onChange={(e) => maj("sansPieceMotif", e.target.value)} placeholder="Ex. Reçu perdu, vendeur sans reçu…" />
          </Champ>
        )}
      </div>

      <label className="coche">
        <input type="checkbox" checked={f.reconstitue} onChange={(e) => maj("reconstitue", e.target.checked)} />
        <span>Écriture reconstituée après coup (l'opération n'avait pas été enregistrée à l'époque)</span>
      </label>
      {ancienne && !f.reconstitue && <p className="encart">Cette opération date de plus de 30 jours : si elle n'avait jamais été enregistrée, cochez la case ci-dessus.</p>}
      {f.reconstitue && (
        <Champ label="Sur quoi s'appuie cette écriture ?" requis>
          <select value={f.sourceReconstitution} onChange={(e) => maj("sourceReconstitution", e.target.value)}>
            <option value="">— Choisir —</option>
            {SOURCES_RECONSTITUTION.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Champ>
      )}

      <Champ label="Note (facultatif)">
        <textarea rows={2} maxLength={300} value={f.note} onChange={(e) => maj("note", e.target.value)} />
      </Champ>

      {erreurs.length > 0 && <ul className="encart rejet">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>}

      <button className="btn large" disabled={occupe} onClick={enregistrer}>
        {occupe ? "Enregistrement…" : correction ? "Enregistrer la correction" : "Enregistrer"}
      </button>
      <p className="discret centre">Une autre personne habilitée devra valider cette écriture.</p>
    </div>
  );
}

// Transfert entre deux lieux : crée la sortie d'un côté et l'entrée de l'autre.
export function FormulaireTransfert({ ctx }) {
  const { par, signaler } = ctx;
  const [f, setF] = useState({ de: "paypal", vers: "especes", devise: "USD", montant: "", date: aujourdhui(), reference: "", sansPieceMotif: "", note: "" });
  const [pieces, setPieces] = useState([]);
  const [occupe, setOccupe] = useState(false);
  const [erreurs, setErreurs] = useState([]);
  const maj = (cle, v) => setF((x) => ({ ...x, [cle]: v }));
  const nom = (id) => LIEUX.find((l) => l.id === id)?.label || id;

  const enregistrer = async () => {
    const e = [];
    const m = Math.round(parseFloat(String(f.montant).replace(",", ".")) * 100) / 100;
    if (f.de === f.vers) e.push("Le lieu de départ et le lieu d'arrivée sont identiques.");
    if (!(m > 0)) e.push("Indiquez un montant supérieur à zéro.");
    if (!f.date) e.push("Indiquez la date du transfert.");
    else if (f.date > aujourdhui()) e.push("La date ne peut pas être dans le futur.");
    if (pieces.length === 0 && f.sansPieceMotif.trim().length < 5) e.push("Joignez une preuve du transfert, ou expliquez pourquoi il n'y en a pas.");
    setErreurs(e);
    if (e.length) return;
    setOccupe(true);
    const commun = {
      activiteId: GENERAL.id, devise: f.devise, taux: tauxParDefaut(f.devise, ctx.taux), montant: m, categorie: CAT_TRANSFERT.id, date: f.date,
      libelle: `Transfert ${nom(f.de)} → ${nom(f.vers)}`, tiers: "Transfert interne", reference: f.reference.trim(),
      paiementDirect: null, reconstitue: false, sourceReconstitution: "",
      sansPieceMotif: pieces.length === 0 ? f.sansPieceMotif.trim() : "", note: f.note.trim(),
    };
    try {
      const sortie = await store.creerEcriture({ ...commun, type: "depense", mode: f.de }, pieces, par);
      const entree = await store.creerEcriture({ ...commun, type: "recette", mode: f.vers }, pieces, par);
      signaler(sortie.numero ? `Transfert enregistré : ${sortie.numero} et ${entree.numero}` : "Transfert enregistré dans le téléphone");
      setF((x) => ({ ...x, montant: "", reference: "", sansPieceMotif: "", note: "" }));
      setPieces([]);
    } catch (err) { setErreurs([messageErreur(err)]); }
    setOccupe(false);
  };

  return (
    <div className="formulaire">
      <p className="discret">Pour déplacer de l'argent déjà enregistré : retrait PayPal remis à la Trésorière, dépôt de la caisse à la banque… Ce n'est ni une recette ni une dépense.</p>
      <div className="deux">
        <Champ label="Sort de" requis>
          <select value={f.de} onChange={(e) => maj("de", e.target.value)}>{LIEUX.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
        </Champ>
        <Champ label="Entre dans" requis>
          <select value={f.vers} onChange={(e) => maj("vers", e.target.value)}>{LIEUX.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
        </Champ>
      </div>
      <div className="deux">
        <Champ label="Montant" requis>
          <input type="text" inputMode="decimal" placeholder="0" value={f.montant} onChange={(e) => maj("montant", e.target.value.replace(/[^0-9.,]/g, ""))} />
        </Champ>
        <Champ label="Devise" requis>
          <div className="segments">
            {Object.keys(DEVISES).map((d) => <button type="button" key={d} className={f.devise === d ? "actif" : ""} onClick={() => maj("devise", d)}>{DEVISES[d].symbole} {d}</button>)}
          </div>
        </Champ>
      </div>
      <div className="deux">
        <Champ label="Date du transfert" requis><input type="date" max={aujourdhui()} value={f.date} onChange={(e) => maj("date", e.target.value)} /></Champ>
        <Champ label="Référence"><input type="text" maxLength={60} value={f.reference} onChange={(e) => maj("reference", e.target.value)} /></Champ>
      </div>
      <div className="bloc">
        <span className="champ-lbl">Preuve du transfert</span>
        <SelecteurPieces pieces={pieces} setPieces={setPieces} signaler={signaler} />
        {pieces.length === 0 && (
          <Champ label="Pas de preuve : pourquoi ?" requis>
            <input type="text" maxLength={140} value={f.sansPieceMotif} onChange={(e) => maj("sansPieceMotif", e.target.value)} />
          </Champ>
        )}
      </div>
      <Champ label="Note (facultatif)"><textarea rows={2} maxLength={300} value={f.note} onChange={(e) => maj("note", e.target.value)} /></Champ>
      {erreurs.length > 0 && <ul className="encart rejet">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>}
      <button className="btn large" disabled={occupe} onClick={enregistrer}>{occupe ? "Enregistrement…" : "Enregistrer le transfert"}</button>
      <p className="discret centre">Deux écritures sont créées (une sortie, une entrée). Une autre personne devra les valider.</p>
    </div>
  );
}

// Change de devises : on donne une somme dans une devise, on en reçoit une autre.
// Le taux réellement obtenu est calculé et gardé sur les deux écritures.
export function FormulaireChange({ ctx }) {
  const { par, signaler } = ctx;
  const [f, setF] = useState({ de: "especes", deDevise: "USD", donne: "", vers: "especes", versDevise: "CDF", recu: "", date: aujourdhui(), tiers: "", reference: "", sansPieceMotif: "", note: "" });
  const [pieces, setPieces] = useState([]);
  const [occupe, setOccupe] = useState(false);
  const [erreurs, setErreurs] = useState([]);
  const maj = (cle, v) => setF((x) => ({ ...x, [cle]: v }));
  const nom = (id) => LIEUX.find((l) => l.id === id)?.label || id;
  const arrondi = (v) => Math.round(nombre(v) * 100) / 100;
  const donne = arrondi(f.donne), recu = arrondi(f.recu);

  // Valeur en dollars de ce qui est donné (= ce qui est reçu) : elle fixe le taux des deux côtés.
  const usdDonne = f.deDevise === "USD" ? donne : f.versDevise === "USD" ? recu : null;
  const tauxCote = (devise, montant) => {
    if (devise === "USD") return null;
    if (usdDonne > 0 && montant > 0) return devise === "CDF" ? Math.round((montant / usdDonne) * 10000) / 10000 : Math.round((usdDonne / montant) * 10000) / 10000;
    return tauxParDefaut(devise, ctx.taux); // EUR ↔ FC : pas de dollar dans l'opération
  };
  const tauxReel = donne > 0 && recu > 0
    ? (f.deDevise === "USD" && f.versDevise === "CDF" ? `1 USD = ${(recu / donne).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} FC`
      : f.deDevise === "CDF" && f.versDevise === "USD" ? `1 USD = ${(donne / recu).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} FC`
      : `1 ${f.deDevise} = ${(recu / donne).toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${f.versDevise}`)
    : null;

  const enregistrer = async () => {
    const e = [];
    if (f.deDevise === f.versDevise) e.push("Les deux devises sont identiques : utilisez plutôt « Transfert entre deux lieux ».");
    if (!(donne > 0)) e.push("Indiquez la somme donnée.");
    if (!(recu > 0)) e.push("Indiquez la somme reçue.");
    if (!f.date) e.push("Indiquez la date du change.");
    else if (f.date > aujourdhui()) e.push("La date ne peut pas être dans le futur.");
    if (pieces.length === 0 && f.sansPieceMotif.trim().length < 5) e.push("Joignez une preuve (bordereau, capture), ou expliquez pourquoi il n'y en a pas.");
    setErreurs(e);
    if (e.length) return;
    setOccupe(true);
    const libelle = `Change ${fmtMontant(donne, f.deDevise)} → ${fmtMontant(recu, f.versDevise)}`;
    const commun = {
      activiteId: GENERAL.id, categorie: CAT_CHANGE.id, date: f.date, libelle,
      tiers: f.tiers.trim() || "Bureau de change", reference: f.reference.trim(),
      paiementDirect: null, reconstitue: false, sourceReconstitution: "",
      sansPieceMotif: pieces.length === 0 ? f.sansPieceMotif.trim() : "",
      note: [tauxReel ? `Taux obtenu : ${tauxReel}` : "", f.note.trim()].filter(Boolean).join(" · "),
    };
    try {
      const sortie = await store.creerEcriture({ ...commun, type: "depense", mode: f.de, devise: f.deDevise, montant: donne, taux: tauxCote(f.deDevise, donne) }, pieces, par);
      const entree = await store.creerEcriture({ ...commun, type: "recette", mode: f.vers, devise: f.versDevise, montant: recu, taux: tauxCote(f.versDevise, recu) }, pieces, par);
      signaler(sortie.numero ? `Change enregistré : ${sortie.numero} et ${entree.numero}` : "Change enregistré dans le téléphone");
      setF((x) => ({ ...x, donne: "", recu: "", reference: "", sansPieceMotif: "", note: "" }));
      setPieces([]);
    } catch (err) { setErreurs([messageErreur(err)]); }
    setOccupe(false);
  };

  const Devises = ({ cle }) => (
    <div className="segments">
      {Object.keys(DEVISES).map((d) => <button type="button" key={d} className={f[cle] === d ? "actif" : ""} onClick={() => maj(cle, d)}>{DEVISES[d].symbole} {d}</button>)}
    </div>
  );

  return (
    <div className="formulaire">
      <p className="discret">Quand des dollars sont changés en francs (ou l'inverse). Ce n'est ni une recette ni une dépense : l'argent change seulement de devise.</p>
      <h3 className="sous-titre">Ce qui a été donné</h3>
      <div className="deux">
        <Champ label="Somme donnée" requis>
          <input type="text" inputMode="decimal" placeholder="0" value={f.donne} onChange={(e) => maj("donne", e.target.value.replace(/[^0-9.,]/g, ""))} />
        </Champ>
        <Champ label="Devise" requis><Devises cle="deDevise" /></Champ>
      </div>
      <Champ label="Prise dans" requis>
        <select value={f.de} onChange={(e) => maj("de", e.target.value)}>{LIEUX.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
      </Champ>
      <h3 className="sous-titre">Ce qui a été reçu</h3>
      <div className="deux">
        <Champ label="Somme reçue" requis>
          <input type="text" inputMode="decimal" placeholder="0" value={f.recu} onChange={(e) => maj("recu", e.target.value.replace(/[^0-9.,]/g, ""))} />
        </Champ>
        <Champ label="Devise" requis><Devises cle="versDevise" /></Champ>
      </div>
      <Champ label="Rangée dans" requis>
        <select value={f.vers} onChange={(e) => maj("vers", e.target.value)}>{LIEUX.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
      </Champ>
      {tauxReel && f.deDevise !== f.versDevise && <p className="encart ok">Taux obtenu : <strong>{tauxReel}</strong></p>}
      <div className="deux">
        <Champ label="Date du change" requis><input type="date" max={aujourdhui()} value={f.date} onChange={(e) => maj("date", e.target.value)} /></Champ>
        <Champ label="Changé chez"><input type="text" maxLength={100} placeholder="Bureau de change, cambiste, banque…" value={f.tiers} onChange={(e) => maj("tiers", e.target.value)} /></Champ>
      </div>
      <Champ label="Référence"><input type="text" maxLength={60} value={f.reference} onChange={(e) => maj("reference", e.target.value)} /></Champ>
      <div className="bloc">
        <span className="champ-lbl">Preuve du change</span>
        <SelecteurPieces pieces={pieces} setPieces={setPieces} signaler={signaler} />
        {pieces.length === 0 && (
          <Champ label="Pas de preuve : pourquoi ?" requis>
            <input type="text" maxLength={140} value={f.sansPieceMotif} onChange={(e) => maj("sansPieceMotif", e.target.value)} placeholder="Ex. Cambiste de rue, sans reçu" />
          </Champ>
        )}
      </div>
      <Champ label="Note (facultatif)"><textarea rows={2} maxLength={300} value={f.note} onChange={(e) => maj("note", e.target.value)} /></Champ>
      {erreurs.length > 0 && <ul className="encart rejet">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>}
      <button className="btn large" disabled={occupe} onClick={enregistrer}>{occupe ? "Enregistrement…" : "Enregistrer le change"}</button>
      <p className="discret centre">Deux écritures sont créées (la somme donnée sort, la somme reçue entre). Une autre personne devra les valider.</p>
    </div>
  );
}

export default function PageSaisie({ ctx, params }) {
  const [genre, setGenreBrut] = useState(["transfert", "change"].includes(params?.genre) ? params.genre : "ecriture");
  const setGenre = (g) => { setGenreBrut(g); ctx.memoriser({ activiteId: params?.activiteId, genre: g === "ecriture" ? "" : g }); };
  if (!peutSaisir(ctx.profil.role)) {
    return <div className="page"><p className="encart">Votre rôle ne permet pas de saisir des écritures.</p></div>;
  }
  return (
    <div className="page">
      <h1>Nouvelle écriture</h1>
      <div className="onglets">
        <button className={genre === "ecriture" ? "actif" : ""} onClick={() => setGenre("ecriture")}>Recette ou dépense</button>
        <button className={genre === "transfert" ? "actif" : ""} onClick={() => setGenre("transfert")}>Transfert entre deux lieux</button>
        <button className={genre === "change" ? "actif" : ""} onClick={() => setGenre("change")}>Change de devises</button>
      </div>
      {genre === "ecriture" && ctx.activites.length === 0 && (
        <p className="encart">Aucune activité n'existe encore. La Trésorerie peut en créer une dans l'onglet Activités ; en attendant, utilisez « Fonctionnement général ».</p>
      )}
      <div className="carte">
        {genre === "ecriture" ? <FormulaireEcriture ctx={ctx} activiteParDefaut={params?.activiteId} />
          : genre === "transfert" ? <FormulaireTransfert ctx={ctx} />
          : <FormulaireChange ctx={ctx} />}
      </div>
    </div>
  );
}
