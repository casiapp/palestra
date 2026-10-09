const CHIAVE = "palestra_app_v1"; // prefisso unico: stesso dominio di altre app casiapp
const N_SCHEDE = 4;

function statoVuoto() {
  return {
    versione: 1,
    attiva: 0,
    impost: { tSerie: 40, rec: 90, cambio: 60 },
    custom: [],
    schede: Array.from({ length: N_SCHEDE }, (_, i) => ({ nome: "", esercizi: [], bloccata: false })),
    storico: {}, // { nomeEsercizio: [{ d: "AAAA-MM-GG", p: peso }] } ordinato per data
    esec: null,  // allenamento in corso: { s: indiceScheda, fatti: { indiceEsercizio: true } }
  };
}

// schede già compilate prima dell'introduzione del blocco: partono bloccate
function migra(s) {
  s = Object.assign(statoVuoto(), s);
  for (const sc of s.schede) if (sc.bloccata === undefined) sc.bloccata = sc.esercizi.length > 0;
  return s;
}

let stato = carica();

function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE));
    if (s && s.schede) return migra(s);
  } catch (e) {}
  return statoVuoto();
}
function salva() {
  try { localStorage.setItem(CHIAVE, JSON.stringify(stato)); } catch (e) { alert("Impossibile salvare i dati."); }
}

const $ = (id) => document.getElementById(id);
const scheda = () => stato.schede[stato.attiva];

function nomeTab(i) {
  const n = stato.schede[i].nome.trim();
  return n || "Scheda " + "ABCD"[i];
}

// attrezzo tra parentesi solo se non è già nel nome (confronto sulla radice: manubrio/manubri, cavo/cavi)
function etichettaAttrezzo(nome, attrezzo) {
  if (!attrezzo) return "";
  const a = attrezzo.toLowerCase();
  const radice = a.slice(0, Math.max(3, a.length - 1));
  return nome.toLowerCase().includes(radice) ? "" : " (" + a + ")";
}

function opzioniEsercizi(selezionato) {
  let html = '<option value="">— scegli esercizio —</option>';
  for (const g of GRUPPI) {
    const voci = g === "Personalizzati"
      ? stato.custom.map((n) => [n, g, ""])
      : ESERCIZI_BASE.filter((e) => e[1] === g);
    if (!voci.length) continue;
    html += `<optgroup label="${g}">` + voci.map((e) =>
      `<option value="${esc(e[0])}"${e[0] === selezionato ? " selected" : ""}>${esc(e[0])}${etichettaAttrezzo(e[0], e[2])}</option>`
    ).join("") + "</optgroup>";
  }
  return html;
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

function stimaSecondi(sc) {
  const { tSerie, rec, cambio } = stato.impost;
  let tot = 0;
  for (const e of sc.esercizi) {
    if (!e.nome) continue;
    const s = Number(e.serie) || 0;
    if (!s) continue;
    const r = e.rec === "" || e.rec == null ? rec : Number(e.rec);
    tot += s * tSerie + (s - 1) * r + cambio;
  }
  return tot;
}
function formatTempo(sec) {
  const min = Math.round(sec / 60);
  if (min < 60) return min + " min";
  return Math.floor(min / 60) + " h " + String(min % 60).padStart(2, "0") + " min";
}

const inEsec = () => !!stato.esec && stato.esec.s === stato.attiva;
const ultimoPeso = (nome) => { const a = stato.storico[nome]; return a && a.length ? a[a.length - 1] : null; };

function oggi() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function formatData(iso) { const [y, m, g] = iso.split("-"); return g + "/" + m + "/" + y.slice(2); }

function disegna() {
  // tab (durante un allenamento non si cambia scheda)
  $("tabs").innerHTML = stato.schede.map((_, i) =>
    `<button data-i="${i}" class="${i === stato.attiva ? "attiva" : ""}"${stato.esec && i !== stato.esec.s ? " disabled" : ""}>${esc(nomeTab(i))}</button>`).join("");
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.onclick = () => { stato.attiva = Number(b.dataset.i); salva(); disegna(); });

  const sc = scheda();
  const bloccata = sc.bloccata && sc.esercizi.length > 0;
  const esec = inEsec();
  $("nomeScheda").value = sc.nome;
  $("nomeScheda").disabled = bloccata;

  // lista esercizi
  const el = $("lista");
  if (!sc.esercizi.length) {
    el.innerHTML = '<div class="vuoto">Scheda vuota.<br>Tocca “Aggiungi esercizio”.</div>';
  } else {
    el.innerHTML = sc.esercizi.map((e, i) => {
      const fatto = esec && stato.esec.fatti[i];
      const ult = esec && e.nome ? ultimoPeso(e.nome) : null;
      return `
      <div class="es${fatto ? " fatto" : ""}" data-i="${i}">
        <div class="es-testa">
          <span class="num">${i + 1}.</span>
          ${bloccata ? `<div class="nome">${esc(e.nome)}</div>` : `<select data-k="nome">${opzioniEsercizi(e.nome)}</select>`}
        </div>
        ${bloccata
          ? (e.nota ? `<div class="nota-es">${esc(e.nota)}</div>` : "")
          : `<input class="nota-es" data-k="nota" type="text" placeholder="Nota (facoltativa)" value="${esc(e.nota || "")}">`}
        <div class="campi">
          <div><label>Serie</label><input data-k="serie" type="number" inputmode="numeric" min="1" value="${e.serie}"${bloccata ? " disabled" : ""}></div>
          <div><label>Rip.</label><input data-k="rip" type="text" inputmode="text" value="${esc(e.rip)}"${bloccata ? " disabled" : ""}></div>
          <div><label>Peso kg</label><input data-k="peso" type="number" inputmode="decimal" step="0.5" min="0" value="${e.peso}"></div>
          <div><label>Rec. s</label><input data-k="rec" type="number" inputmode="numeric" min="0" placeholder="${stato.impost.rec}" value="${e.rec}"${bloccata ? " disabled" : ""}></div>
        </div>
        ${esec ? `<div class="esec-riga">
          <span class="nota">${ult ? "Ultimo: " + ult.p + " kg (" + formatData(ult.d) + ")" : "Nessuno storico"}</span>
          <button data-a="fatto" class="${fatto ? "ok" : ""}">${fatto ? "✓ Fatto" : "Fatto"}</button>
        </div>` : ""}
        ${bloccata ? "" : `<div class="azioni">
          <button data-a="su" ${i === 0 ? "disabled" : ""}>↑</button>
          <button data-a="giu" ${i === sc.esercizi.length - 1 ? "disabled" : ""}>↓</button>
          <button data-a="dup">Duplica</button>
          <button data-a="del" class="del">Elimina</button>
        </div>`}
      </div>`;
    }).join("");
  }
  el.querySelectorAll(".es").forEach((card) => {
    const i = Number(card.dataset.i);
    card.querySelectorAll("[data-k]").forEach((inp) => {
      inp.onchange = () => { sc.esercizi[i][inp.dataset.k] = inp.value; salva(); riepilogo(); };
      if (inp.tagName === "INPUT") inp.oninput = () => { sc.esercizi[i][inp.dataset.k] = inp.value; salva(); riepilogo(); };
    });
    card.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => azione(b.dataset.a, i));
  });

  $("btnAggiungi").hidden = bloccata;
  $("btnSvuota").hidden = bloccata;
  comandi();
  riepilogo();
}

// pulsanti sotto il riepilogo: Modifica / Fine modifica / allenamento
function comandi() {
  const sc = scheda();
  const el = $("comandi");
  if (!sc.esercizi.length) { el.innerHTML = ""; return; }
  if (inEsec()) {
    const fatti = Object.keys(stato.esec.fatti).filter((k) => stato.esec.fatti[k]).length;
    el.innerHTML = `<div class="nota">Allenamento in corso: <b>${fatti}/${sc.esercizi.length}</b> esercizi fatti</div>
      <button data-c="fine-all" class="primario">Termina allenamento</button>
      <button data-c="annulla-all" class="secondario">Annulla allenamento</button>`;
  } else if (sc.bloccata) {
    el.innerHTML = `<button data-c="inizia" class="primario">Inizia allenamento</button>
      <button data-c="modifica" class="secondario">Modifica scheda</button>`;
  } else {
    el.innerHTML = `<button data-c="blocca" class="primario">Fine modifica</button>`;
  }
  el.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => comando(b.dataset.c));
}

function comando(c) {
  const sc = scheda();
  if (c === "modifica") sc.bloccata = false;
  else if (c === "blocca") {
    if (sc.esercizi.some((e) => !e.nome)) { alert("Ci sono esercizi senza nome: sceglili o eliminali."); return; }
    sc.bloccata = true;
  }
  else if (c === "inizia") stato.esec = { s: stato.attiva, fatti: {} };
  else if (c === "annulla-all") {
    if (!confirm("Annullare l'allenamento? Non verrà salvato nello storico.")) return;
    stato.esec = null;
  }
  else if (c === "fine-all") {
    const mancano = sc.esercizi.length - Object.keys(stato.esec.fatti).filter((k) => stato.esec.fatti[k]).length;
    if (mancano && !confirm("Mancano " + mancano + " esercizi. Terminare comunque?")) return;
    salvaAllenamento();
  }
  salva(); disegna();
}

// registra nello storico il peso degli esercizi fatti (un valore per esercizio al giorno)
function salvaAllenamento() {
  const sc = scheda();
  const d = oggi();
  for (const [i, e] of sc.esercizi.entries()) {
    if (!stato.esec.fatti[i] || !e.nome || e.peso === "" || isNaN(Number(e.peso))) continue;
    const arr = stato.storico[e.nome] || (stato.storico[e.nome] = []);
    const gia = arr.find((x) => x.d === d);
    if (gia) gia.p = Number(e.peso); else arr.push({ d, p: Number(e.peso) });
    arr.sort((a, b) => a.d.localeCompare(b.d));
  }
  stato.esec = null;
}

function riepilogo() {
  const sc = scheda();
  const es = sc.esercizi.filter((e) => e.nome);
  const serie = es.reduce((t, e) => t + (Number(e.serie) || 0), 0);
  $("riepilogo").innerHTML = es.length
    ? `<b>${es.length}</b> esercizi · <b>${serie}</b> serie totali<br>Durata stimata: <b>~${formatTempo(stimaSecondi(sc))}</b>`
    : "Nessun esercizio in questa scheda.";
}

function azione(a, i) {
  const l = scheda().esercizi;
  if (a === "fatto") stato.esec.fatti[i] = !stato.esec.fatti[i];
  else if (a === "su" && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
  else if (a === "giu" && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
  else if (a === "dup") l.splice(i + 1, 0, Object.assign({}, l[i]));
  else if (a === "del") {
    if (!confirm("Eliminare l'esercizio " + (i + 1) + "?")) return;
    l.splice(i, 1);
  }
  salva(); disegna();
}

$("btnAggiungi").onclick = () => {
  scheda().esercizi.push({ nome: "", serie: 3, rip: "10", peso: "", rec: "" });
  salva(); disegna();
  const sel = document.querySelectorAll(".es select");
  if (sel.length) sel[sel.length - 1].scrollIntoView({ block: "center" });
};
$("btnSvuota").onclick = () => {
  if (!scheda().esercizi.length) return;
  if (confirm("Svuotare tutta la scheda? I pesi inseriti andranno persi (lo storico resta).")) { scheda().esercizi = []; scheda().bloccata = false; salva(); disegna(); }
};
$("nomeScheda").oninput = (ev) => {
  scheda().nome = ev.target.value; salva();
  document.querySelectorAll("#tabs button")[stato.attiva].textContent = nomeTab(stato.attiva);
};

// --- progressione carichi ---
function disegnaStorico() {
  const nomi = Object.keys(stato.storico).filter((n) => stato.storico[n].length).sort();
  const sel = $("selStorico");
  const corrente = sel.value;
  sel.innerHTML = nomi.map((n) => `<option value="${esc(n)}"${n === corrente ? " selected" : ""}>${esc(n)}</option>`).join("");
  if (!nomi.length) { $("listaStorico").innerHTML = '<p class="nota">Ancora nessun allenamento registrato.</p>'; sel.hidden = true; return; }
  sel.hidden = false;
  const arr = stato.storico[sel.value];
  $("listaStorico").innerHTML = arr.map((x, k) => {
    const prec = k ? arr[k - 1].p : null;
    const diff = prec === null ? "" : x.p > prec ? `<span class="su">▲ +${+(x.p - prec).toFixed(2)}</span>` : x.p < prec ? `<span class="giu">▼ ${+(x.p - prec).toFixed(2)}</span>` : "=";
    return `<div class="custom"><span>${formatData(x.d)}</span><b>${x.p} kg</b><span>${diff}</span><button data-k="${k}" aria-label="Elimina">✕</button></div>`;
  }).reverse().join("");
  document.querySelectorAll("#listaStorico button").forEach((b) => b.onclick = () => {
    if (!confirm("Eliminare questa registrazione?")) return;
    arr.splice(Number(b.dataset.k), 1);
    if (!arr.length) delete stato.storico[sel.value];
    salva(); disegnaStorico();
  });
}
$("btnStorico").onclick = () => { disegnaStorico(); $("dlgStorico").showModal(); };
$("selStorico").onchange = disegnaStorico;
$("btnChiudiSto").onclick = () => $("dlgStorico").close();

// --- impostazioni ---
function disegnaCustom() {
  $("listaCustom").innerHTML = stato.custom.map((n, i) =>
    `<div class="custom"><span>${esc(n)}</span><button data-i="${i}" aria-label="Elimina">✕</button></div>`).join("")
    || '<p class="nota">Nessuno.</p>';
  document.querySelectorAll("#listaCustom button").forEach((b) => b.onclick = () => {
    stato.custom.splice(Number(b.dataset.i), 1); salva(); disegnaCustom(); disegna();
  });
}
$("btnImpost").onclick = () => {
  $("iTSerie").value = stato.impost.tSerie;
  $("iRec").value = stato.impost.rec;
  $("iCambio").value = stato.impost.cambio;
  disegnaCustom();
  $("dlgImpost").showModal();
};
$("btnChiudiImp").onclick = () => $("dlgImpost").close();
for (const [id, k] of [["iTSerie", "tSerie"], ["iRec", "rec"], ["iCambio", "cambio"]]) {
  $(id).oninput = (ev) => { stato.impost[k] = Number(ev.target.value) || 0; salva(); disegna(); };
}
$("btnAddEs").onclick = () => {
  const n = $("iNuovoEs").value.trim();
  if (!n) return;
  if (!stato.custom.includes(n) && !ESERCIZI_BASE.some((e) => e[0].toLowerCase() === n.toLowerCase())) stato.custom.push(n);
  $("iNuovoEs").value = "";
  salva(); disegnaCustom(); disegna();
};
$("btnBackup").onclick = () => {
  const blob = new Blob([JSON.stringify(stato, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "palestra-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("btnImporta").onclick = () => $("fileImporta").click();
$("fileImporta").onchange = async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!s.schede || !Array.isArray(s.schede)) throw new Error();
    if (!confirm("Sostituire tutti i dati attuali con quelli del backup?")) return;
    stato = migra(s);
    salva(); disegna(); $("dlgImpost").close();
  } catch (e) { alert("File non valido."); }
  ev.target.value = "";
};

disegna();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
