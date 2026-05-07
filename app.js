// FEEDBACK APTICO
function vibra() {
  if (navigator.vibrate) navigator.vibrate(40);
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & STATE
// ══════════════════════════════════════════════════════════════════════════════
const CATS = { antipasti: 'Antipasti', primi: 'Primi', secondi: 'Secondi', dolci: 'Dolci', bevande: 'Bevande' };
const CAT_KEYS = Object.keys(CATS);

let state = {
  menu: { antipasti: [], primi: [], secondi: [], dolci: [], bevande: [] },
  currentShift: null,
  orders: []
};

let stampQty    = {};
let stampNotes  = {};
let isSavingOrder = false;

let currentTab    = 'menu';
let openOrderId   = null;
let addModalCat   = null;

// ══════════════════════════════════════════════════════════════════════════════
// PERSISTENCE — IndexedDB
// ══════════════════════════════════════════════════════════════════════════════
const DB_NAME = 'CameriereDB';
const STORE_NAME = 'appState';

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function save() {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(state, 'cam_v1');
    return true;
  } catch(e) {
    toast('⚠ Errore di salvataggio.');
    return false;
  }
}

async function load() {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('cam_v1');
      req.onsuccess = () => {
        if (req.result) {
          const parsed = req.result;
          if (parsed.menu)         state.menu = { ...state.menu, ...parsed.menu };
          if (parsed.currentShift) state.currentShift = parsed.currentShift;
          if (parsed.orders)       state.orders = parsed.orders;
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch(e) { console.error(e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT MENU
// ══════════════════════════════════════════════════════════════════════════════
function salvaMenu() {
  robustShare('menu_preset.json', JSON.stringify(state.menu, null, 2), 'application/json');
  toast('Preset Menu in condivisione...');
}

function triggerCaricaMenu() { document.getElementById('importMenuInput').click(); }

function handleImportMenu(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();

  // Rendiamo asincrona la callback per poter aspettare il save()
  reader.onload = async function(evt) {
    try {
      const imp = JSON.parse(evt.target.result);
      
      if (imp && typeof imp === 'object') {
        CAT_KEYS.forEach(k => { 
          if (Array.isArray(imp[k])) state.menu[k] = imp[k]; 
        });
        
        // Aspettiamo l'esito della Promise
        const success = await save();
        if (success) { 
          renderMenu(); 
          toast('Menu caricato con successo!'); 
        }
      } else { 
        throw new Error('Formato non corrispondente'); 
      }
    } catch(err) { 
      toast('Formato file non valido!'); 
    } finally {
      // ⚠️ CRITICO PER ANDROID WEBVIEW: 
      // Resettiamo l'input solo DOPO che il file è stato completamente letto ed elaborato
      e.target.value = '';
    }
  };

  // Gestione esplicita di eventuali errori nativi di lettura
  reader.onerror = function() {
    toast('Errore di lettura del file.');
    e.target.value = '';
  };

  reader.readAsText(file);
}
// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION & RENDER DISPATCHER
// ══════════════════════════════════════════════════════════════════════════════
function goTo(tab) {
  vibra();
  currentTab = tab;
  document.querySelectorAll('.sec, .nb').forEach(el => el.classList.remove('active'));
  document.getElementById('sec-' + tab).classList.add('active');
  document.getElementById('nb-' + tab).classList.add('active');
  render();
}

function render() {
  renderPill();
  if (currentTab === 'menu')   renderMenu();
  if (currentTab === 'turno')  renderTurno();
  if (currentTab === 'orders') renderOrders();
  if (currentTab === 'stamp')  renderStamp();
}

function renderPill() {
  const pill = document.getElementById('shiftPill');
  const s = state.currentShift;
  if (s && !s.end) {
    pill.className = 'shift-pill on'; pill.textContent = '● Turno attivo';
  } else {
    pill.className = 'shift-pill off'; pill.textContent = 'Turno off';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MENU LOGIC
// ══════════════════════════════════════════════════════════════════════════════
function renderMenu() {
  let html = `
    <div class="shift-block" style="background: var(--subtle)">
      <div class="shift-block-title">Gestione Preset Menu</div>
      <div class="row">
        <button class="btn btn-black btn-sm btn-full" onclick="salvaMenu()">↓ Salva</button>
        <button class="btn btn-outline btn-sm btn-full" onclick="triggerCaricaMenu()">↑ Carica</button>
      </div>
    </div><div class="g16"></div>`;

  for (const [key, label] of Object.entries(CATS)) {
    const items = state.menu[key] || [];
    html += `<div class="cat-label">${label}<button class="btn btn-sm btn-outline" onclick="openAddModal('${key}')">+ Aggiungi</button></div>`;
    if (items.length === 0) { html += `<div class="mi-none">Nessuna voce</div>`; }
    else {
      items.forEach((item, idx) => {
        html += `
          <div class="mi">
            <div class="mi-name">${esc(item.name)}</div>
            <div class="mi-meta">€${num(item.price)} ${item.portions ? ' · '+item.portions+'pz' : ''}</div>
            <button class="mi-del" onclick="deleteMenuItem('${key}',${idx})">×</button>
          </div>`;
      });
    }
    html += `<div class="g16"></div>`;
  }
  document.getElementById('sec-menu').innerHTML = html;
}

function openAddModal(cat) {
  vibra();
  addModalCat = cat;
  document.getElementById('addModalTitle').textContent = 'Aggiungi — ' + CATS[cat];
  document.getElementById('mi-name').value = '';
  document.getElementById('mi-price').value = '';
  document.getElementById('mi-portions').value = '';
  document.getElementById('addModal').classList.add('open');
  history.pushState({ modal: 'add' }, '');
  setTimeout(() => document.getElementById('mi-name').focus(), 120);
}
function closeModal() {
  document.getElementById('addModal').classList.remove('open');
  if (history.state && history.state.modal) history.back();
}

window.addEventListener('popstate', (e) => {
  const addMod = document.getElementById('addModal');
  if (addMod && addMod.classList.contains('open')) {
    addMod.classList.remove('open');
  }
  const confMod = document.getElementById('confirmModal');
  if (confMod && confMod.classList.contains('open')) {
    const btnCancel = document.getElementById('btnConfirmCancel');
    if (btnCancel) btnCancel.click();
  }
});

function saveMenuItem() {
  const name = document.getElementById('mi-name').value.trim();
  const priceStr = document.getElementById('mi-price').value.trim().replace(',', '.');
  const price = parseFloat(priceStr) || 0;
  const portions = parseInt(document.getElementById('mi-portions').value) || null;
  if (!name) { toast('Inserisci un nome'); return; }
  if (!state.menu[addModalCat]) state.menu[addModalCat] = [];
  state.menu[addModalCat].push({ name, price, portions });
  if (save()) { closeModal(); renderMenu(); toast('Voce aggiunta'); }
}

async function deleteMenuItem(cat, idx) {
  if (!(await appConfirm('Eliminare "' + state.menu[cat][idx].name + '"?', true))) return;
  if (stampQty[cat]) {
    const newCat = {};
    for (const [k, v] of Object.entries(stampQty[cat])) {
      const ki = parseInt(k);
      if (ki < idx) newCat[ki] = v;
      else if (ki > idx) newCat[ki - 1] = v;
    }
    stampQty[cat] = newCat;
  }
  state.menu[cat].splice(idx, 1);
  save(); renderMenu(); toast('Voce eliminata');
}

// ══════════════════════════════════════════════════════════════════════════════
// TURNO LOGIC
// ══════════════════════════════════════════════════════════════════════════════
function renderTurno() {
  const shift = state.currentShift;
  const shiftOrders = shift ? state.orders.filter(o => o.shiftId === shift.id) : [];
  const revenue = shiftOrders.reduce((s, o) => s + (o.total || 0), 0);
  const coperti = shiftOrders.reduce((s, o) => s + (parseInt(o.covers) || 0), 0);

  let html = '';
  if (!shift || shift.end) {
    html += `<div class="shift-block dashed"><div class="shift-block-title">Nessun turno in corso</div><button class="btn btn-black btn-full" onclick="startShift()">▶ Inizia Turno</button></div>`;
    if (shift && shift.end) {
      const dur = Math.round((new Date(shift.end) - new Date(shift.start)) / 60000);
      html += `
        <div class="divider">Ultimo turno</div>
        <div class="shift-block">
          <div class="shift-block-title">${fmtDate(shift.start)}<br>${fmtTime(shift.start)} → ${fmtTime(shift.end)} &nbsp;·&nbsp; ${dur} min</div>
          <div class="stats-grid">
            <div class="stat-item"><div class="stat-val">${shiftOrders.length}</div><div class="stat-lbl">Comande</div></div>
            <div class="stat-item"><div class="stat-val">€${revenue.toFixed(0)}</div><div class="stat-lbl">Incasso</div></div>
            <div class="stat-item"><div class="stat-val">${coperti}</div><div class="stat-lbl">Coperti</div></div>
          </div>
          <button class="btn btn-outline btn-full btn-sm" onclick="exportShift('${shift.id}')">↓ Esporta riepilogo turno</button>
        </div>`;
    }
  } else {
    html += `
      <div class="shift-block">
        <div class="shift-block-title">Iniziato alle ${fmtTime(shift.start)} · ${fmtDate(shift.start)}</div>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-val">${shiftOrders.length}</div><div class="stat-lbl">Comande</div></div>
          <div class="stat-item"><div class="stat-val">€${revenue.toFixed(0)}</div><div class="stat-lbl">Incasso</div></div>
          <div class="stat-item"><div class="stat-val">${coperti}</div><div class="stat-lbl">Coperti</div></div>
        </div>
        <button class="btn btn-danger btn-full" onclick="endShift()">■ Termina Turno</button>
      </div>`;
    if (shiftOrders.length > 0) {
      html += `<div class="g8"></div><button class="btn btn-muted btn-full btn-sm" onclick="exportShift('${shift.id}')">↓ Esporta turno corrente</button>`;
    }
  }

  const pastOrders = state.orders.filter(o => !shift || o.shiftId !== shift.id);
  if (pastOrders.length > 0) {
    html += `<div class="divider">Gestione Dati</div>
             <button class="btn btn-outline btn-full btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="clearPastOrders()">🗑 Elimina ${pastOrders.length} Comande Passate</button>`;
  }

  document.getElementById('sec-turno').innerHTML = html;
}

async function startShift() {
  if (!(await appConfirm('Avviare un nuovo turno?'))) return;
  state.currentShift = { id: uid(), start: new Date().toISOString(), end: null };
  save(); render(); toast('Turno avviato');
}
async function endShift() {
  if (!(await appConfirm('Terminare il turno?'))) return;
  state.currentShift.end = new Date().toISOString();
  save(); render(); toast('Turno terminato');
}
function exportShift(shiftId) {
  const orders = state.orders.filter(o => o.shiftId === shiftId);
  const rev = orders.reduce((s, o) => s + (o.total || 0), 0);
  let txt = '='.repeat(36) + '\nRIEPILOGO TURNO\n';
  const s = state.currentShift;
  if (s) txt += `${fmtDate(s.start)}\n${fmtTime(s.start)} → ${s.end ? fmtTime(s.end) : 'in corso'}\n`;
  txt += '='.repeat(36) + '\n\n';
  orders.forEach(o => { txt += orderToText(o) + '\n' + '-'.repeat(36) + '\n\n'; });
  txt += `TOTALE TURNO:  €${rev.toFixed(2)}\nCOMANDE:       ${orders.length}\nCOPERTI:       ${orders.reduce((s,o)=>s+(parseInt(o.covers)||0),0)}\n`;
  const fname = 'turno_' + (s ? fmtDate(s.start).replace(/\//g,'-') : 'export') + '.txt';
  robustShare(fname, txt);
}
async function clearPastOrders() {
  if (!(await appConfirm('Eliminare definitivamente tutte le comande dei turni passati?\n(Il turno attuale non verrà toccato).', true))) return;
  const shiftId = state.currentShift ? state.currentShift.id : null;
  state.orders = state.orders.filter(o => o.shiftId === shiftId);
  save(); renderTurno(); toast('Memoria pulita');
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDERS LIST LOGIC
// ══════════════════════════════════════════════════════════════════════════════
function renderOrders() {
  const el = document.getElementById('sec-orders');
  const orders = [...state.orders].reverse();
  if (orders.length === 0) { el.innerHTML = '<div class="empty">Nessuna comanda.</div>'; return; }

  const shiftMap = {};
  orders.forEach(o => { const sid = o.shiftId || 'no-shift'; if (!shiftMap[sid]) shiftMap[sid]=[]; shiftMap[sid].push(o); });

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">${orders.length} comande</div>
      <button class="btn btn-sm btn-muted" onclick="exportAll()">↓ Esporta tutto</button>
    </div>`;

  const currSid = state.currentShift ? state.currentShift.id : null;
  const allSids = Object.keys(shiftMap).sort((a,b) => a===currSid ? -1 : b===currSid ? 1 : 0);

  allSids.forEach(sid => {
    const isCurr = sid === currSid;
    html += `<div class="divider">${isCurr ? '● Turno corrente' : 'Turno · ' + fmtDate(shiftMap[sid][shiftMap[sid].length-1].time)}</div>`;
    shiftMap[sid].forEach(o => {
      const isOpen = openOrderId === o.id;
      const total = (o.total || 0).toFixed(2);
      const covers = parseInt(o.covers) || 0;
      const titleDisplay = o.customerName ? `Tavolo ${esc(o.table)} — ${esc(o.customerName)}` : `Tavolo ${esc(o.table)}`;

      html += `
        <div class="oc ${isOpen ? 'open' : ''}" onclick="toggleOrder('${o.id}')">
          <div class="oc-head"><div class="oc-table">${titleDisplay}</div><div class="oc-time">${fmtTime(o.time)}</div></div>
          <div class="oc-sub"><span>${covers} coperti</span><span class="oc-sub-tot">€${total}</span></div>`;

      if (isOpen) {
        html += `<div class="oc-detail">`;
        CAT_KEYS.forEach(key => {
          const cat = o.categories?.[key]; if (!cat) return;
          const vis = (cat.items || []).filter(i => i.qty > 0);
          if (vis.length === 0 && !cat.notes) return;
          html += `<div class="oc-cat-lbl">${CATS[key]}</div>`;
          vis.forEach(i => html += `<div class="oc-line"><span>${esc(i.name)}</span><span>${i.qty}× €${(i.price * i.qty).toFixed(2)}</span></div>`);
          if (cat.notes) html += `<div class="oc-note">Nota: ${esc(cat.notes)}</div>`;
        });
        html += `<div class="oc-total"><span>Totale</span><span>€${total}</span></div>
          <div class="oc-actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();exportOrder('${o.id}')">↑ Condividi / Esporta</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteOrder('${o.id}')">Elimina</button>
          </div></div>`;
      }
      html += `</div>`;
    });
  });
  el.innerHTML = html;
}

function toggleOrder(id) { openOrderId = openOrderId === id ? null : id; renderOrders(); }

// ─── ESPORTAZIONE SINGOLA COMANDA ─────────────────────────────────────────────
// Chiamata DIRETTAMENTE dal bottone (senza async prima) per mantenere il
// "user gesture context" necessario a navigator.share su Android WebView.
function exportOrder(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;
  const fileName = 'tavolo_' + o.table + '_' + fmtTime(o.time).replace(':', '-') + '.txt';
  robustShare(fileName, orderToMarkdown(o));
}

async function deleteOrder(id) {
  if (!(await appConfirm('Eliminare comanda?', true))) return;
  state.orders = state.orders.filter(x => x.id !== id);
  if (openOrderId === id) openOrderId = null;
  save(); renderOrders(); toast('Eliminata');
}
function exportAll() {
  if (state.orders.length === 0) return;
  robustShare('tutte_le_comande.txt', state.orders.map(o => orderToMarkdown(o)).join('\n' + '═'.repeat(36) + '\n\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDER STAMP LOGIC
// ══════════════════════════════════════════════════════════════════════════════
function renderStamp() {
  const hasShift = state.currentShift && !state.currentShift.end;
  const menuEmpty = CAT_KEYS.every(k => (state.menu[k] || []).length === 0);
  let html = '';

  if (!hasShift) html += `<div class="warn-bar">⚠ Nessun turno attivo. Avvialo dal tab Turno.</div>`;

  html += `
    <div class="stamp-toprow">
      <div class="field"><label>N° Tavolo</label><input type="number" inputmode="numeric" pattern="[0-9]*" min="1" id="s-table" placeholder="1" style="font-size:20px;font-weight:600;"></div>
      <div class="field"><label>Coperti</label><input type="number" inputmode="numeric" pattern="[0-9]*" min="0" id="s-covers" placeholder="2" style="font-size:20px;font-weight:600;"></div>
    </div>
    <div class="field" style="margin-bottom: 20px;">
      <label>Nome (Opzionale)</label>
      <input type="text" id="s-name" placeholder="Es. Mario Rossi">
    </div>`;

  if (menuEmpty) {
    html += `<div class="empty">Nessun piatto nel menu.<br><button class="btn btn-outline btn-sm" style="margin-top:14px;" onclick="goTo('menu')">→ Menu</button></div>`;
  } else {
    for (const [key, label] of Object.entries(CATS)) {
      const items = state.menu[key] || [];
      if (items.length === 0) continue;
      html += `<div class="stamp-cat-block"><div class="cat-label">${label}</div>`;
      items.forEach((item, idx) => {
        const qty = stampQty[key]?.[idx] || 0;
        html += `
          <div class="stamp-item">
            <div class="stamp-item-info">
              <div class="stamp-item-name">${esc(item.name)}</div>
              <div class="stamp-item-price">€${num(item.price)} ${item.portions ? '· '+item.portions+'pz' : ''}</div>
            </div>
            <div class="qty-row">
              <button id="qb-m-${key}-${idx}" class="qb ${qty>0?'has':''}" onclick="changeQty('${key}',${idx},-1)">−</button>
              <span id="qv-${key}-${idx}" class="qv">${qty>0?qty:''}</span>
              <button id="qb-p-${key}-${idx}" class="qb ${qty>0?'has':''}" onclick="changeQty('${key}',${idx}, 1)">+</button>
            </div>
          </div>`;
      });
      const note = stampNotes[key] || '';
      html += `<div class="cat-notes"><input type="text" placeholder="Note ${label.toLowerCase()}..." value="${esc(note)}" oninput="stampNotes['${key}']=this.value"></div></div>`;
    }
  }

  html += `
    <div class="stamp-footer">
      <div><div class="stamp-total-lbl">Totale</div><div class="stamp-total-val" id="stamp-total-val">€${calcTotal().toFixed(2)}</div></div>
      <button id="btn-save-stamp" class="btn ${hasShift ? 'btn-black' : 'btn-muted'}" onclick="${hasShift ? 'saveStamp()' : 'goTo(\'turno\')'}" style="min-width:130px;">
        ${hasShift ? '✓ Salva' : '→ Avvia Turno'}
      </button>
    </div>`;

  document.getElementById('sec-stamp').innerHTML = html;
}

function changeQty(cat, idx, delta) {
  vibra();
  if (!stampQty[cat]) stampQty[cat] = {};
  const current = stampQty[cat][idx] || 0;
  const next = Math.max(0, current + delta);
  stampQty[cat][idx] = next;

  const vEl  = document.getElementById(`qv-${cat}-${idx}`);
  const bmEl = document.getElementById(`qb-m-${cat}-${idx}`);
  const bpEl = document.getElementById(`qb-p-${cat}-${idx}`);

  if (vEl)  vEl.textContent = next > 0 ? next : '';
  if (bmEl) next > 0 ? bmEl.classList.add('has') : bmEl.classList.remove('has');
  if (bpEl) next > 0 ? bpEl.classList.add('has') : bpEl.classList.remove('has');

  const totalEl = document.getElementById('stamp-total-val');
  if (totalEl) totalEl.textContent = '€' + calcTotal().toFixed(2);
}

function calcTotal() {
  let t = 0;
  for (const key of CAT_KEYS) {
    if (!stampQty[key]) continue;
    for (const [idx, qty] of Object.entries(stampQty[key])) {
      const item = state.menu[key]?.[parseInt(idx)];
      if (item && qty > 0) t += (item.price || 0) * qty;
    }
  }
  return t;
}

function saveStamp() {
  vibra();
  if (isSavingOrder) return;

  const table        = document.getElementById('s-table').value.trim();
  const covers       = parseInt(document.getElementById('s-covers').value) || 0;
  const customerName = document.getElementById('s-name').value.trim();

  if (!table) { toast('Inserisci il numero tavolo'); return; }
  const shift = state.currentShift;
  if (!shift || shift.end) { toast('Avvia un turno prima'); return; }

  const categories = {};
  for (const key of CAT_KEYS) {
    const items = [];
    for (const [idx, qty] of Object.entries(stampQty[key] || {})) {
      const item = state.menu[key]?.[parseInt(idx)];
      if (item && qty > 0) items.push({ name: item.name, qty, price: item.price || 0 });
    }
    categories[key] = { items, notes: stampNotes[key] || '' };
  }

  if (!CAT_KEYS.some(k => (categories[k]?.items || []).length > 0)) { toast('Aggiungi almeno un piatto'); return; }

  isSavingOrder = true;
  document.getElementById('btn-save-stamp').disabled = true;

  const order = { id: uid(), shiftId: shift.id, table, covers, customerName, time: new Date().toISOString(), categories, total: calcTotal() };
  state.orders.push(order);

  if (save()) {
    stampQty = {}; stampNotes = {};
    toast('Comanda salvata!');
    goTo('orders');
  }

  // Reset flag dopo un breve delay
  setTimeout(() => { isSavingOrder = false; }, 1000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ROBUST SHARE — 4 strategie per WebIntoApp / Android WebView
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Strategia 1 – navigator.share con File allegato (Android share sheet nativo)
 * Strategia 2 – navigator.share con testo puro (fallback se file non supportato)
 * Strategia 3 – Clipboard API (copia negli appunti)
 * Strategia 4 – Modal con textarea selezionabile + pulsante Copia
 *
 * IMPORTANTE: questa funzione NON è async e non usa await PRIMA di chiamare
 * navigator.share. Questo preserva il "user gesture context" necessario
 * alla WebView di Android per aprire il bottom sheet nativo.
 */
function robustShare(filename, text) {
  // ── Strategia 1: Share con file fisico ──────────────────────────────────
  if (typeof navigator.share === 'function') {
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain', lastModified: Date.now() });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ title: filename, files: [file] })
          .then(() => { /* share completato */ })
          .catch(err => {
            if (err.name !== 'AbortError') _shareAsText(filename, text);
          });
        return;
      }
    } catch (e) { /* canShare non disponibile, passo alla strategia 2 */ }

    // ── Strategia 2: Share testo senza file ──────────────────────────────
    _shareAsText(filename, text);
    return;
  }

  // ── Strategia 3+4: nessun navigator.share (browser desktop o WebView vecchio)
  _clipboardOrModal(filename, text);
}

function _shareAsText(filename, text) {
  navigator.share({ title: filename, text: text })
    .then(() => { /* ok */ })
    .catch(err => {
      if (err.name !== 'AbortError') _clipboardOrModal(filename, text);
    });
}

function _clipboardOrModal(filename, text) {
  // ── Strategia 3: Clipboard API ───────────────────────────────────────────
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast('📋 Testo copiato negli appunti!');
        _showShareModal(filename, text); // mostra comunque il modal per riferimento
      })
      .catch(() => _showShareModal(filename, text));
    return;
  }
  // ── Strategia 4: Modal con copia manuale ─────────────────────────────────
  _showShareModal(filename, text);
}

// Modal di fallback — mostra la comanda in un textarea copiabile
function _showShareModal(filename, text) {
  // Rimuovi eventuale modal precedente
  const existing = document.getElementById('robustShareModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'robustShareModal';
  overlay.className = 'modal-overlay open';
  overlay.style.cssText = 'z-index: 9999;';

  overlay.innerHTML = `
    <div class="modal-box" style="width:100%;max-width:480px;display:flex;flex-direction:column;gap:0;">
      <div class="modal-title" style="margin-bottom:12px;">📄 ${esc(filename)}</div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 10px;">
        Copia il testo qui sotto e incollalo dove vuoi (WhatsApp, Note, ecc.)
      </p>
      <textarea id="_shareTA" readonly
        style="width:100%;height:220px;font-family:monospace;font-size:11px;
               line-height:1.5;border:1.5px solid #ddd;border-radius:10px;
               padding:10px;box-sizing:border-box;resize:none;
               background:#f8f8f8;color:#222;"
      >${esc(text)}</textarea>
      <div class="g8"></div>
      <button class="btn btn-black btn-full" onclick="_copyShareText()">📋 Copia tutto</button>
      <div class="g8"></div>
      <button class="btn btn-muted btn-full" onclick="_closeShareModal()">Chiudi</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Seleziona tutto automaticamente per facilitare la copia manuale
  setTimeout(() => {
    const ta = document.getElementById('_shareTA');
    if (ta) { ta.focus(); ta.select(); }
  }, 200);
}

function _copyShareText() {
  const ta = document.getElementById('_shareTA');
  if (!ta) return;
  ta.select();
  ta.setSelectionRange(0, 99999); // mobile

  // Prova clipboard moderna
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value)
      .then(() => toast('✓ Copiato negli appunti!'))
      .catch(() => {
        try { document.execCommand('copy'); toast('✓ Copiato!'); } catch(e) { toast('Seleziona e copia manualmente'); }
      });
  } else {
    try { document.execCommand('copy'); toast('✓ Copiato!'); } catch(e) { toast('Seleziona il testo e copia manualmente'); }
  }
}

function _closeShareModal() {
  const m = document.getElementById('robustShareModal');
  if (m) m.remove();
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMATO COMANDA — Markdown leggibile
// ══════════════════════════════════════════════════════════════════════════════
function orderToMarkdown(o) {
  const SEP  = '─'.repeat(32);
  const SEP2 = '═'.repeat(32);
  let t = '';

  // Intestazione
  t += SEP2 + '\n';
  t += ` TAVOLO ${o.table}`;
  if (o.customerName) t += `  ·  ${o.customerName}`;
  t += '\n';
  t += ` ${fmtDate(o.time)}  ${fmtTime(o.time)}`;
  t += `  ·  Coperti: ${parseInt(o.covers) || 0}`;
  t += '\n' + SEP2 + '\n\n';

  // Categorie
  CAT_KEYS.forEach(key => {
    const cat = o.categories?.[key];
    if (!cat) return;
    const vis = (cat.items || []).filter(i => i.qty > 0);
    if (vis.length === 0 && !cat.notes) return;

    t += ` [ ${CATS[key].toUpperCase()} ]\n`;
    vis.forEach(i => {
      const nome  = i.name.substring(0, 22).padEnd(22);
      const qtaDen = `${i.qty}x`.padStart(3);
      const prezzo = i.price > 0 ? `€${(i.price * i.qty).toFixed(2)}` : '';
      t += `  ${qtaDen}  ${nome}  ${prezzo}\n`;
    });
    if (cat.notes) t += `  📝 ${cat.notes}\n`;
    t += '\n';
  });

  // Totale
  t += SEP + '\n';
  t += ` TOTALE:`.padEnd(24) + `€${(o.total || 0).toFixed(2)}\n`;
  t += SEP + '\n';

  return t;
}

// Formato scontrino ASCII (per esportazione turno)
function orderToText(o) {
  const line36 = '─'.repeat(36);
  let t = '╔' + '═'.repeat(34) + '╗\n';
  t += '║  TAVOLO ' + String(o.table).padEnd(26) + '║\n';
  if (o.customerName) {
    t += '║  Nome: ' + String(o.customerName).substring(0, 25).padEnd(27) + '║\n';
  }
  t += '║  Coperti: ' + String(parseInt(o.covers)||0).padEnd(24) + '║\n';
  t += '║  ' + fmtDate(o.time) + '  ' + fmtTime(o.time) + '                ║\n';
  t += '╚' + '═'.repeat(34) + '╝\n\n';
  CAT_KEYS.forEach(key => {
    const cat = o.categories?.[key]; if (!cat) return;
    const vis = (cat.items || []).filter(i => i.qty > 0);
    if (vis.length === 0 && !cat.notes) return;
    t += '  ── ' + CATS[key].toUpperCase() + ' ──\n';
    vis.forEach(i => t += ('  ' + i.name).padEnd(28) + (i.qty + 'x  €' + (i.price * i.qty).toFixed(2)) + '\n');
    if (cat.notes) t += '  [Nota: ' + cat.notes + ']\n';
    t += '\n';
  });
  t += line36 + '\n' + '  TOTALE:'.padEnd(28) + '€' + (o.total || 0).toFixed(2) + '\n' + line36 + '\n';
  return t;
}

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOM CONFIRM ASINCRONO
// ══════════════════════════════════════════════════════════════════════════════
function appConfirm(message, isDanger = false) {
  return new Promise((resolve) => {
    vibra();
    const overlay  = document.getElementById('confirmModal');
    const msgEl    = document.getElementById('confirmMessage');
    const btnOk    = document.getElementById('btnConfirmOk');
    const btnCancel = document.getElementById('btnConfirmCancel');

    msgEl.textContent = message;
    btnOk.className = 'btn ' + (isDanger ? 'btn-danger' : 'btn-black');
    btnOk.style.flex = '1';

    const cleanup = (result) => {
      overlay.classList.remove('open');
      btnOk.onclick = null;
      btnCancel.onclick = null;
      resolve(result);
    };

    btnOk.onclick    = () => cleanup(true);
    btnCancel.onclick = () => cleanup(false);
    overlay.classList.add('open');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════════════
function fmtTime(iso) { const d = new Date(iso); return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); }
function fmtDate(iso) { const d = new Date(iso); return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear(); }
function num(v) { return parseFloat(v || 0).toFixed(2); }
function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

document.getElementById('addModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
load().then(() => { render(); });

// Service Worker per funzionamento offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registrato:', reg.scope))
      .catch(err => console.error('SW errore:', err));
  });
}
