const API_BASE = window.location.origin;

let knownOperatorNames = [];
let allOperators = [];
let rowCounter = 0;

const CLASS_ORDER = ['Vanguard', 'Guard', 'Defender', 'Medic', 'Sniper', 'Caster', 'Supporter', 'Specialist'];
const CLASS_LABEL_VI = {
  Vanguard: 'TIÊN PHONG', Guard: 'CẬN VỆ', Defender: 'TRỌNG GIÁP', Medic: 'Y SƯ',
  Sniper: 'XẠ THỦ', Caster: 'THUẬT SĨ', Supporter: 'HỖ TRỢ', Specialist: 'ĐẶC CHỦNG'
};
let pickerSelections = {}; // name -> elite (0/1/2)

// Elite cap theo rarity: 1-2 sao chỉ E0, 3 sao tối đa E1, 4-6 sao tối đa E2
function maxEliteForRarity(rarity) {
  if (rarity <= 2) return 0;
  if (rarity === 3) return 1;
  return 2;
}

// ---------- Clock ----------
function tickClock() {
  const el = document.getElementById('clock');
  const now = new Date();
  el.textContent = now.toTimeString().slice(0, 8);
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Load known operator names for datalist ----------
async function loadOperators() {
  try {
    const res = await fetch(`${API_BASE}/api/operators`);
    const data = await res.json();
    allOperators = data.operators;
    knownOperatorNames = allOperators.map(o => o.name);
    const dl = document.getElementById('operatorNames');
    dl.innerHTML = knownOperatorNames.map(n => `<option value="${n}">`).join('');
  } catch (e) {
    console.error('Không tải được operator database', e);
  }
}

// ---------- Roster rows ----------
function addRosterRow(prefill) {
  rowCounter++;
  const id = `row_${rowCounter}`;
  const wrap = document.getElementById('rosterTable');
  const row = document.createElement('div');
  row.className = 'roster-row';
  row.id = id;
  row.innerHTML = `
    <input list="operatorNames" placeholder="Texas" class="f-name" value="${prefill?.name || ''}">
    <select class="f-elite">
      <option value="0">E0</option>
      <option value="1">E1</option>
      <option value="2">E2</option>
    </select>
    <input type="number" min="1" max="90" placeholder="60" class="f-level" value="${prefill?.level || ''}">
    <input placeholder="S2M3" class="f-skill" value="${prefill?.skill || ''}">
    <button class="row-remove" type="button" title="Xoá">✕</button>
  `;
  row.querySelector('.f-elite').value = prefill?.elite ?? 0;
  row.querySelector('.row-remove').addEventListener('click', () => row.remove());

  const nameInput = row.querySelector('.f-name');
  const eliteSelect = row.querySelector('.f-elite');
  function restrictEliteByName() {
    const op = allOperators.find(o => o.name.toLowerCase() === nameInput.value.trim().toLowerCase());
    const opts = eliteSelect.querySelectorAll('option');
    if (!op) {
      opts.forEach(o => o.disabled = false);
      return;
    }
    const maxElite = maxEliteForRarity(op.rarity || 0);
    opts.forEach(o => { o.disabled = parseInt(o.value, 10) > maxElite; });
    if (parseInt(eliteSelect.value, 10) > maxElite) eliteSelect.value = String(maxElite);
  }
  nameInput.addEventListener('input', restrictEliteByName);
  nameInput.addEventListener('change', restrictEliteByName);
  if (prefill?.name) restrictEliteByName();

  wrap.appendChild(row);
}

document.getElementById('addRowBtn').addEventListener('click', () => addRosterRow());

function upsertRosterRow(name, elite, level, skill) {
  const rows = document.querySelectorAll('.roster-row:not(.roster-row-head)');
  for (const row of rows) {
    if (row.querySelector('.f-name').value.trim().toLowerCase() === name.toLowerCase()) {
      row.querySelector('.f-elite').value = elite;
      if (level) row.querySelector('.f-level').value = level;
      if (skill) row.querySelector('.f-skill').value = skill;
      return;
    }
  }
  addRosterRow({ name, elite, level, skill });
}

function removeRosterRowByName(name) {
  const rows = document.querySelectorAll('.roster-row:not(.roster-row-head)');
  for (const row of rows) {
    if (row.querySelector('.f-name').value.trim().toLowerCase() === name.toLowerCase()) {
      row.remove();
      return;
    }
  }
}

// ---------- Bulk paste import ----------
// Parse dòng dạng "Texas E2 60 S2M3" -- chỉ Tên + Elite là bắt buộc, level/skill tuỳ chọn.
function parseRosterLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const eliteIdx = tokens.findIndex(t => /^E[0-2]$/i.test(t));
  if (eliteIdx === -1 || eliteIdx === 0) return null;
  const name = tokens.slice(0, eliteIdx).join(' ');
  const elite = parseInt(tokens[eliteIdx].slice(1), 10);
  let level = '';
  let skill = '';
  for (let i = eliteIdx + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d+$/.test(t) && !level) level = t;
    else if (/^S\d/i.test(t) && !skill) skill = t;
  }
  return { name, elite, level, skill };
}

document.getElementById('togglePasteBtn').addEventListener('click', () => {
  document.getElementById('pasteBulkPanel').classList.toggle('hidden');
});

document.getElementById('pasteBulkImportBtn').addEventListener('click', () => {
  const text = document.getElementById('pasteBulkInput').value;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let ok = 0, failed = 0;
  lines.forEach(line => {
    const parsed = parseRosterLine(line);
    if (!parsed) { failed++; return; }
    upsertRosterRow(parsed.name, parsed.elite, parsed.level, parsed.skill);
    ok++;
  });
  const status = document.getElementById('pasteBulkStatus');
  status.textContent = failed > 0
    ? `Đã thêm ${ok} operator, ${failed} dòng không nhận diện được (thiếu E0/E1/E2?)`
    : `Đã thêm ${ok} operator.`;
  if (ok > 0) document.getElementById('pasteBulkInput').value = '';
});

// ---------- Operator Picker Modal ----------
const pickerOverlay = document.getElementById('pickerOverlay');

function openPicker() {
  // Preload current roster into pickerSelections so reopening reflects state
  pickerSelections = {};
  collectRoster().forEach(r => { pickerSelections[r.name] = r.elite; });
  renderPicker();
  pickerOverlay.classList.remove('hidden');
  document.getElementById('pickerSearch').value = '';
  document.getElementById('pickerSearch').focus();
}

function closePicker() {
  pickerOverlay.classList.add('hidden');
}

document.getElementById('openPickerBtn').addEventListener('click', openPicker);
document.getElementById('closePickerBtn').addEventListener('click', closePicker);
document.getElementById('pickerCancelBtn').addEventListener('click', closePicker);
pickerOverlay.addEventListener('click', (e) => { if (e.target === pickerOverlay) closePicker(); });

document.getElementById('pickerSearch').addEventListener('input', (e) => renderPicker(e.target.value.trim()));

function renderPicker(filterText) {
  filterText = (filterText || '').toLowerCase();
  const body = document.getElementById('pickerBody');
  const groups = {};
  CLASS_ORDER.forEach(c => groups[c] = []);

  allOperators.forEach(op => {
    if (!CLASS_ORDER.includes(op.profession)) return; // skip Token/Trap/non-playable
    if (filterText && !op.name.toLowerCase().includes(filterText)) return;
    groups[op.profession].push(op);
  });

  let html = '';
  let anyResults = false;

  CLASS_ORDER.forEach(cls => {
    const ops = groups[cls].sort((a, b) => a.name.localeCompare(b.name));
    if (ops.length === 0) return;
    anyResults = true;
    html += `
      <div class="picker-class-group">
        <div class="picker-class-head">${CLASS_LABEL_VI[cls]} · ${cls} <span class="picker-class-count">(${ops.length})</span></div>
        <div class="picker-op-list">
          ${ops.map(op => renderPickerOpRow(op)).join('')}
        </div>
      </div>
    `;
  });

  body.innerHTML = anyResults ? html : '<p class="picker-empty">Không tìm thấy operator nào khớp.</p>';

  body.querySelectorAll('.elite-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const elite = parseInt(btn.dataset.elite, 10);
      if (pickerSelections[name] === elite) {
        delete pickerSelections[name]; // toggle off
      } else {
        pickerSelections[name] = elite;
      }
      renderPicker(document.getElementById('pickerSearch').value.trim());
    });
  });

  updatePickerCount();
}

function renderPickerOpRow(op) {
  const selected = pickerSelections.hasOwnProperty(op.name);
  const curElite = pickerSelections[op.name];
  const stars = '★'.repeat(op.rarity || 0);
  const maxElite = maxEliteForRarity(op.rarity || 0);
  const eliteOptions = [];
  for (let e = 0; e <= maxElite; e++) eliteOptions.push(e);
  return `
    <div class="picker-op-row ${selected ? 'selected' : ''}">
      <span class="picker-op-name">${esc(op.name)} <span class="picker-op-rarity">${stars}</span></span>
      <div class="elite-toggle">
        ${eliteOptions.map(e => `
          <button type="button" class="elite-btn ${selected && curElite === e ? 'active' : ''}"
            data-name="${esc(op.name)}" data-elite="${e}">E${e}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function updatePickerCount() {
  const n = Object.keys(pickerSelections).length;
  document.getElementById('pickerSelectedCount').textContent = `${n} đã chọn`;
  document.getElementById('pickerConfirmCount').textContent = n;
}

document.getElementById('pickerConfirmBtn').addEventListener('click', () => {
  // Remove roster rows for operators that got deselected
  const currentNames = collectRoster().map(r => r.name.toLowerCase());
  currentNames.forEach(n => {
    if (!Object.keys(pickerSelections).some(sel => sel.toLowerCase() === n)) {
      removeRosterRowByName(n);
    }
  });
  // Add/update selected
  Object.entries(pickerSelections).forEach(([name, elite]) => upsertRosterRow(name, elite));
  closePicker();
});

// Không seed dòng trống nữa — dùng picker "Chọn từ Database" làm luồng chính.
// "+ Thêm tay" vẫn hoạt động cho operator gõ tự do (chưa có trong database).

// ---------- Collect roster from DOM ----------
function collectRoster() {
  const rows = document.querySelectorAll('.roster-row:not(.roster-row-head)');
  const roster = [];
  rows.forEach(row => {
    const name = row.querySelector('.f-name').value.trim();
    if (!name) return;
    roster.push({
      name,
      elite: parseInt(row.querySelector('.f-elite').value, 10) || 0,
      level: parseInt(row.querySelector('.f-level').value, 10) || 1,
      skill: row.querySelector('.f-skill').value.trim()
    });
  });
  return roster;
}

function collectBase() {
  return {
    layout: document.getElementById('layoutInput').value.trim(),
    reception: intVal('rm_reception'),
    office: intVal('rm_office'),
    trainingRoom: intVal('rm_training'),
    workshop: intVal('rm_workshop'),
    dorm: intVal('rm_dorm'),
    factory: intVal('rm_factory'),
    tradingPost: intVal('rm_trading'),
    powerPlant: intVal('rm_power')
  };
}
function intVal(id) { return parseInt(document.getElementById(id).value, 10) || 1; }

// ---------- Analyze ----------
document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);

async function runAnalysis() {
  const roster = collectRoster();
  const base = collectBase();
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'ĐANG PHÂN TÍCH...';

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster, base })
    });
    const data = await res.json();
    renderResults(data);
  } catch (e) {
    alert('Không kết nối được backend. Đảm bảo server Java đang chạy (xem README).');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">▶</span> PHÂN TÍCH BASE';
  }
}

// ---------- Render ----------
function renderResults(data) {
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('resultsWrap').classList.remove('hidden');

  renderCombos(data.combos || []);
  renderPriority(data.priority || {});
  renderFuture(data.not_owned_suggestions || []);
}

const STATUS_LABEL = {
  active: 'ĐANG HOẠT ĐỘNG',
  partial: 'CẦN NÂNG CẤP',
  unavailable: 'CHƯA ĐỦ ĐIỀU KIỆN',
  not_owned: 'CHƯA SỞ HỮU'
};

function renderCombos(combos) {
  const wrap = document.getElementById('tab-combos');
  const order = { active: 0, partial: 1, unavailable: 2, not_owned: 3 };
  const sorted = [...combos].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  if (sorted.length === 0) {
    wrap.innerHTML = '<p class="priority-empty">Không có combo nào khớp.</p>';
    return;
  }

  wrap.innerHTML = sorted.map(c => {
    const activeOps = (c.active_operators || []).map(o => `
      <div class="op-item">
        <span class="op-name">${esc(o.name)} <span class="op-meta">— ${esc(o.skill || '')}</span></span>
        <span class="op-meta">${o.value_pct ? o.value_pct + '%' : ''}</span>
      </div>`).join('');

    const underOps = (c.underleveled_operators || []).map(o => `
      <div class="op-item underleveled">
        <span class="op-name">${esc(o.name)} <span class="op-meta">— cần E${o.required_elite} (hiện E${o.current_elite})</span></span>
        <span class="op-meta">~${fmtLmd(o.est_lmd_cost)} LMD</span>
      </div>`).join('');

    const missingOps = (c.missing_owned_operators || []).map(n => `
      <div class="op-item missing"><span class="op-name">${esc(n)}</span><span class="op-meta">chưa sở hữu</span></div>
    `).join('');

    return `
      <div class="combo-card">
        <div class="combo-card-head">
          <div>
            <p class="combo-title">${esc(c.name)}</p>
            <span class="combo-room">${esc(c.room)}</span>
          </div>
          <span class="status-badge status-${c.status}">${STATUS_LABEL[c.status] || c.status}</span>
        </div>
        <p class="combo-desc">${esc(c.description || '')}</p>
        ${c.notes ? `<p class="combo-notes">${esc(c.notes)}</p>` : ''}
        <div class="op-list">${activeOps}${underOps}${missingOps}</div>
      </div>
    `;
  }).join('');
}

function renderPriority(priority) {
  const wrap = document.getElementById('tab-priority');
  const tiers = [
    { key: 'S', label: 'PRIORITY S — Excellent ROI' },
    { key: 'A', label: 'PRIORITY A — Good ROI' },
    { key: 'B', label: 'PRIORITY B — Situational' },
    { key: 'C', label: 'PRIORITY C — Not Worth (filler)' }
  ];

  wrap.innerHTML = tiers.map(t => {
    const items = priority[t.key] || [];
    const body = items.length === 0
      ? '<p class="priority-empty">Không có mục nào ở mức này.</p>'
      : items.map(i => `
        <div class="priority-item">
          <div class="priority-item-top">
            <span class="priority-op">${esc(i.operator)} <span class="op-meta">(${esc(i.elite_upgrade)})</span></span>
            <span class="priority-cost">~${fmtLmd(i.est_lmd_cost)} LMD</span>
          </div>
          <div class="op-meta">${esc(i.combo)} · ${esc(i.room)}</div>
          <div class="priority-reason">${esc(i.reason)}</div>
        </div>
      `).join('');

    return `
      <div class="priority-block">
        <h3><span class="tier-tag tier-${t.key}">${t.key}</span> ${t.label}</h3>
        ${body}
      </div>
    `;
  }).join('');
}

function renderFuture(suggestions) {
  const wrap = document.getElementById('tab-future');
  if (suggestions.length === 0) {
    wrap.innerHTML = '<p class="priority-empty">Không có combo tiềm năng nào cần operator bạn chưa sở hữu (dựa trên seed database hiện tại).</p>';
    return;
  }
  wrap.innerHTML = suggestions.map(s => `
    <div class="future-item">
      <strong>${esc(s.combo)}</strong> (${esc(s.room)})<br>
      Cần: ${s.operators_needed.map(esc).join(', ')}<br>
      <span>${esc(s.note)}</span>
    </div>
  `).join('');
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Utils ----------
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmtLmd(n) {
  if (!n) return '0';
  return Number(n).toLocaleString('en-US');
}

loadOperators();
