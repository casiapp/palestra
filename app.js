const CHIAVE = "palestra_app_v1"; // prefisso unico: stesso dominio di altre app casiapp
const N_SCHEDE = 4;

function statoVuoto() {
  return {
    versione: 1,
    attiva: 0,
    impost: { tSerie: 40, rec: 90, cambio: 60 },
    custom: [],
    schede: Array.from({ length: N_SCHEDE }, (_, i) => ({ nome: "", esercizi: [] })),
  };
}

let stato = carica();

function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE));
    if (s && s.schede) return Object.assign(statoVuoto(), s);
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

function opzioniEsercizi(selezionato) {
  let html = '<option value="">— scegli esercizio —</option>';
  for (const g of GRUPPI) {
    const voci = g === "Personalizzati"
      ? stato.custom.map((n) => [n, g, ""])
      : ESERCIZI_BASE.filter((e) => e[1] === g);
    if (!voci.length) continue;
    html += `<optgroup label="${g}">` + voci.map((e) =>
      `<option value="${esc(e[0])}"${e[0] === selezionato ? " selected" : ""}>${esc(e[0])}${e[2] ? " (" + e[2].toLowerCase() + ")" : ""}</option>`
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

function disegna() {
  // tab
  $("tabs").innerHTML = stato.schede.map((_, i) =>
    `<button data-i="${i}" class="${i === stato.attiva ? "attiva" : ""}">${esc(nomeTab(i))}</button>`).join("");
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.onclick = () => { stato.attiva = Number(b.dataset.i); salva(); disegna(); });

  const sc = scheda();
  $("nomeScheda").value = sc.nome;

  // lista esercizi
  const el = $("lista");
  if (!sc.esercizi.length) {
    el.innerHTML = '<div class="vuoto">Scheda vuota.<br>Tocca “Aggiungi esercizio”.</div>';
  } else {
    el.innerHTML = sc.esercizi.map((e, i) => `
      <div class="es" data-i="${i}">
        <div class="es-testa">
          <span class="num">${i + 1}.</span>
          <select data-k="nome">${opzioniEsercizi(e.nome)}</select>
        </div>
        <div class="campi">
          <div><label>Serie</label><input data-k="serie" type="number" inputmode="numeric" min="1" value="${e.serie}"></div>
          <div><label>Rip.</label><input data-k="rip" type="text" inputmode="text" value="${esc(e.rip)}"></div>
          <div><label>Peso kg</label><input data-k="peso" type="number" inputmode="decimal" step="0.5" min="0" value="${e.peso}"></div>
          <div><label>Rec. s</label><input data-k="rec" type="number" inputmode="numeric" min="0" placeholder="${stato.impost.rec}" value="${e.rec}"></div>
        </div>
        <div class="azioni">
          <button data-a="su" ${i === 0 ? "disabled" : ""}>↑</button>
          <button data-a="giu" ${i === sc.esercizi.length - 1 ? "disabled" : ""}>↓</button>
          <button data-a="dup">Duplica</button>
          <button data-a="del" class="del">Elimina</button>
        </div>
      </div>`).join("");
  }
  el.querySelectorAll(".es").forEach((card) => {
    const i = Number(card.dataset.i);
    card.querySelectorAll("[data-k]").forEach((inp) => {
      inp.onchange = () => { sc.esercizi[i][inp.dataset.k] = inp.value; salva(); riepilogo(); };
      if (inp.tagName === "INPUT") inp.oninput = () => { sc.esercizi[i][inp.dataset.k] = inp.value; salva(); riepilogo(); };
    });
    card.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => azione(b.dataset.a, i));
  });
  riepilogo();
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
  if (a === "su" && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
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
  if (confirm("Svuotare tutta la scheda? I pesi inseriti andranno persi.")) { scheda().esercizi = []; salva(); disegna(); }
};
$("nomeScheda").oninput = (ev) => {
  scheda().nome = ev.target.value; salva();
  document.querySelectorAll("#tabs button")[stato.attiva].textContent = nomeTab(stato.attiva);
};

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
    stato = Object.assign(statoVuoto(), s);
    salva(); disegna(); $("dlgImpost").close();
  } catch (e) { alert("File non valido."); }
  ev.target.value = "";
};

disegna();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
