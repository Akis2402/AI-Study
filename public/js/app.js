'use strict';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  docs: [],              // {id, name, ext, chunks:[{id,text}], included:true}
  rules: [],
  history: [],            // {role, content:string}
  pendingImage: null,     // {mediaType, base64, url}
  thinkMode: 'fast',
  settings: { detail: 'tiêu chuẩn', lang: 'Tiếng Việt' }
};

const el = (id) => document.getElementById(id);
const threadEl = el('thread');
const statusEl = el('statusText');

/* ================= Gọi backend (KHÔNG bao giờ gọi Anthropic trực tiếp từ trình duyệt) ================= */
function apiHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (window.APP_CONFIG && window.APP_CONFIG.appKey) headers['x-app-key'] = window.APP_CONFIG.appKey;
  return headers;
}
async function apiPost(path, body) {
  const res = await fetch(path, { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) });
  let data;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const msg = (data && data.error) || `Lỗi máy chủ (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return data;
}

/* ================= Icons (SVG) ================= */
const ICONS = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
  presentation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
};
el('menuBtn').innerHTML = ICONS.menu;
el('settingsBtnTop').innerHTML = ICONS.settings;
el('attachBtn').innerHTML = ICONS.camera;
el('settingsGearIcon').innerHTML = ICONS.settings;
document.querySelectorAll('.think-opt .ic').forEach((s) => { s.innerHTML = ICONS[s.dataset.icon]; });

/* ================= Lưu trữ cục bộ (localStorage — trang web độc lập, không dùng window.storage) ================= */
const LS_KEYS = { rules: 'tro-giai:rules', theme: 'tro-giai:theme', think: 'tro-giai:think-mode', settings: 'tro-giai:settings' };
function lsGet(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* localStorage có thể bị chặn (chế độ ẩn danh) — bỏ qua an toàn */ }
}
function loadAll() {
  state.rules = lsGet(LS_KEYS.rules, []);
  renderRules();
  applyTheme(lsGet(LS_KEYS.theme, 'light'));
  state.thinkMode = lsGet(LS_KEYS.think, 'fast');
  applyThinkMode();
  state.settings = Object.assign(state.settings, lsGet(LS_KEYS.settings, {}));
  applySettingsUI();
}

/* ================= Theme ================= */
function applyTheme(theme) {
  el('main').setAttribute('data-theme', theme);
  el('themeBtn').innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
  el('setLightBtn').classList.toggle('active', theme === 'light');
  el('setDarkBtn').classList.toggle('active', theme === 'dark');
}
el('themeBtn').onclick = () => { const t = el('main').getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; applyTheme(t); lsSet(LS_KEYS.theme, t); };
el('setLightBtn').onclick = () => { applyTheme('light'); lsSet(LS_KEYS.theme, 'light'); };
el('setDarkBtn').onclick = () => { applyTheme('dark'); lsSet(LS_KEYS.theme, 'dark'); };

/* ================= Sidebar mobile ================= */
el('menuBtn').onclick = () => { el('sidebar').classList.add('open'); el('sidebarOverlay').classList.add('show'); };
el('closeSidebarBtn').onclick = () => { el('sidebar').classList.remove('open'); el('sidebarOverlay').classList.remove('show'); };
el('sidebarOverlay').onclick = () => { el('sidebar').classList.remove('open'); el('sidebarOverlay').classList.remove('show'); };

/* ================= Settings modal ================= */
function openSettings() { el('settingsOverlay').classList.add('show'); }
function closeSettings() { el('settingsOverlay').classList.remove('show'); }
el('settingsBtnSide').onclick = openSettings;
el('settingsBtnTop').onclick = openSettings;
el('settingsCloseBtn').onclick = closeSettings;
el('settingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsOverlay') closeSettings(); });

function applySettingsUI() {
  document.querySelectorAll('#detailChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.val === state.settings.detail));
  document.querySelectorAll('#langChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.val === state.settings.lang));
}
document.querySelectorAll('#detailChips .chip').forEach((c) => c.onclick = () => { state.settings.detail = c.dataset.val; applySettingsUI(); lsSet(LS_KEYS.settings, state.settings); });
document.querySelectorAll('#langChips .chip').forEach((c) => c.onclick = () => { state.settings.lang = c.dataset.val; applySettingsUI(); lsSet(LS_KEYS.settings, state.settings); });

el('clearHistoryBtn').onclick = () => {
  if (!confirm('Xóa toàn bộ lịch sử trò chuyện hiện tại?')) return;
  state.history = [];
  threadEl.innerHTML = '';
  welcome();
  closeSettings();
};

/* ================= Rules ================= */
function renderRules() {
  const ul = el('ruleList');
  ul.innerHTML = '';
  if (state.rules.length === 0) { ul.innerHTML = '<div class="set-empty">Chưa có quy tắc nào. AI sẽ ghi nhớ các quy tắc bạn thêm ở đây cho mọi câu hỏi sau này.</div>'; return; }
  state.rules.forEach((r, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span'); span.textContent = r;
    const btn = document.createElement('button'); btn.textContent = '✕';
    btn.onclick = () => { state.rules.splice(i, 1); lsSet(LS_KEYS.rules, state.rules); renderRules(); };
    li.appendChild(span); li.appendChild(btn);
    ul.appendChild(li);
  });
}
el('ruleAddBtn').onclick = () => {
  const v = el('ruleInput').value.trim();
  if (!v) return;
  state.rules.push(v);
  el('ruleInput').value = '';
  lsSet(LS_KEYS.rules, state.rules);
  renderRules();
};

/* ================= Chế độ suy nghĩ (thanh chat, kiểu Claude) ================= */
function applyThinkMode() {
  const btn = el('thinkBtn');
  const deep = state.thinkMode === 'deep';
  btn.innerHTML = (deep ? ICONS.sparkles : ICONS.zap) + `<span>${deep ? 'Suy nghĩ sâu' : 'Nhanh'}</span>`;
  btn.classList.toggle('deep', deep);
  document.querySelectorAll('.think-opt').forEach((o) => o.classList.toggle('active', o.dataset.mode === state.thinkMode));
}
el('thinkBtn').onclick = (e) => { e.stopPropagation(); el('thinkPopover').classList.toggle('show'); };
document.querySelectorAll('.think-opt').forEach((o) => {
  o.onclick = () => { state.thinkMode = o.dataset.mode; applyThinkMode(); lsSet(LS_KEYS.think, state.thinkMode); el('thinkPopover').classList.remove('show'); };
});
document.addEventListener('click', (e) => { if (!el('thinkBtnWrap').contains(e.target)) el('thinkPopover').classList.remove('show'); });

/* ================= Sources (kiểu NotebookLM) — đọc file hoàn toàn trên trình duyệt ================= */
let sourceCounter = 0;
function chunkText(text, size = 900) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  for (let i = 0; i < clean.length; i += size) chunks.push(clean.slice(i, i + size));
  return chunks.map((t, idx) => ({ id: idx + 1, text: t }));
}
async function parsePDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    full += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return full;
}
async function parseDocx(file) { const buf = await file.arrayBuffer(); const res = await mammoth.extractRawText({ arrayBuffer: buf }); return res.value; }
async function parseTxt(file) { return await file.text(); }
function iconFor(ext) { return ext === 'pdf' ? '📕' : ext === 'docx' ? '📘' : '📄'; }

function renderSources() {
  const list = el('sourceList');
  list.innerHTML = '';
  el('emptySources').style.display = state.docs.length ? 'none' : 'block';
  state.docs.forEach((doc) => {
    const li = document.createElement('li');
    li.className = 'source-card' + (doc.included ? '' : ' dim');
    const chars = doc.chunks.reduce((a, c) => a + c.text.length, 0);
    li.innerHTML = `
      <div class="row">
        <input type="checkbox" ${doc.included ? 'checked' : ''}>
        <span class="icon">${iconFor(doc.ext)}</span>
        <div class="meta">
          <div class="nm">${doc.name}</div>
          <div class="sub">${doc.chunks.length} đoạn · ${chars > 1000 ? Math.round(chars / 1000) + ' nghìn ký tự' : chars + ' ký tự'}</div>
        </div>
        <button class="rm" title="Xóa nguồn">✕</button>
      </div>
      <div class="preview">${(doc.chunks[0]?.text || '').slice(0, 320).replace(/</g, '&lt;')}…</div>
    `;
    const checkbox = li.querySelector('input[type=checkbox]');
    checkbox.onchange = () => { doc.included = checkbox.checked; li.classList.toggle('dim', !doc.included); };
    li.querySelector('.rm').onclick = (e) => { e.stopPropagation(); state.docs = state.docs.filter((d) => d.id !== doc.id); renderSources(); };
    li.querySelector('.row').addEventListener('click', (e) => {
      if (e.target === checkbox || e.target.closest('.rm')) return;
      li.classList.toggle('expanded');
    });
    list.appendChild(li);
  });
}

async function handleFiles(files) {
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const doc = { id: ++sourceCounter, name: file.name, ext, chunks: [{ id: 1, text: '⏳ Đang đọc…' }], included: true };
    state.docs.push(doc);
    renderSources();
    try {
      let text = '';
      if (ext === 'pdf') text = await parsePDF(file);
      else if (ext === 'docx') text = await parseDocx(file);
      else text = await parseTxt(file);
      doc.chunks = chunkText(text);
    } catch (e) {
      doc.chunks = [{ id: 1, text: '⚠️ Không đọc được nội dung file này.' }];
      console.error(e);
    }
    renderSources();
  }
}
el('addSourceBtn').onclick = () => el('fileInput').click();
el('dropHint').onclick = () => el('fileInput').click();
el('fileInput').onchange = (e) => handleFiles(e.target.files);
['dragover', 'dragleave', 'drop'].forEach((evt) => {
  el('dropHint').addEventListener(evt, (e) => {
    e.preventDefault();
    el('dropHint').classList.toggle('dragover', evt === 'dragover');
    if (evt === 'drop') handleFiles(e.dataTransfer.files);
  });
});

/* ================= Ảnh đính kèm ================= */
el('attachBtn').onclick = () => el('imageInput').click();
el('imageInput').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Ảnh vượt quá 5MB, vui lòng chọn ảnh nhỏ hơn.'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    const m = reader.result.match(/^data:(.*?);base64,(.*)$/);
    if (!m) return;
    state.pendingImage = { mediaType: m[1], base64: m[2], url: reader.result };
    renderImagePreview();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};
function renderImagePreview() {
  const wrap = el('imgPreviewWrap');
  el('attachBtn').classList.toggle('has-image', !!state.pendingImage);
  if (!state.pendingImage) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="img-chip show"><img src="${state.pendingImage.url}"><span>Ảnh đề bài đã đính kèm</span><button class="rm" type="button">✕</button></div>`;
  wrap.querySelector('.rm').onclick = () => { state.pendingImage = null; renderImagePreview(); };
}

/* ================= Truy hồi ngữ cảnh từ nguồn (chạy trên client, chỉ gửi đoạn liên quan lên server) ================= */
function retrieveContext(query, limit = 4) {
  const qWords = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const activeDocs = state.docs.filter((d) => d.included);
  if (qWords.length === 0 || activeDocs.length === 0) return [];
  const scored = [];
  activeDocs.forEach((doc) => {
    doc.chunks.forEach((ch) => {
      const lower = ch.text.toLowerCase();
      let score = 0;
      qWords.forEach((w) => { if (w.length > 2 && lower.includes(w)) score++; });
      if (score > 0) scored.push({ doc: doc.name, id: ch.id, text: ch.text, score });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
function highlightSnippet(text, query) {
  const qWords = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2);
  let snippet = text.length > 260 ? text.slice(0, 260) + '…' : text;
  let out = snippet.replace(/</g, '&lt;');
  qWords.slice(0, 6).forEach((w) => {
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    out = out.replace(re, '<span class="hl">$1</span>');
  });
  return out;
}

/* ================= Rendering ================= */
function extractThinking(text) {
  const m = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (!m) return { thinking: null, answer: text.trim() };
  return { thinking: m[1].trim(), answer: text.replace(m[0], '').trim() };
}
function renderMath(container) {
  if (window.renderMathInElement) {
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    } catch (e) { console.error(e); }
  }
}
function renderMarkdownLite(text) {
  const drawBlocks = [];
  const working = text.replace(/```(plot|shape)\n?([\s\S]*?)```/g, (m, kind, body) => {
    let spec = null;
    try { spec = JSON.parse(body.trim()); } catch (e) { spec = null; }
    drawBlocks.push({ kind, spec });
    return `\u0000DRAW${drawBlocks.length - 1}\u0000`;
  });
  let html = working
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/```([\s\S]*?)```/g, (m, c) => `<pre><code>${c.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(\d+)\]/g, '<sup class="cref">[$1]</sup>')
    .split(/\n{2,}/).map((block) => {
      const h = block.match(/^##\s?(.+)$/);
      if (h) return `<h3>${h[1].trim()}</h3>`;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('');

  const draws = [];
  html = html.replace(/\u0000DRAW(\d+)\u0000/g, (m, i) => {
    const b = drawBlocks[+i];
    if (!b || !b.spec) return '<p style="color:#c0392b;font-size:12px;">⚠️ Không thể hiển thị hình minh họa (dữ liệu không hợp lệ).</p>';
    const id = 'draw_' + Math.random().toString(36).slice(2, 9);
    draws.push({ id, kind: b.kind, spec: b.spec });
    return `<div class="draw-wrap" id="${id}"></div>`;
  });
  return { html, draws };
}

/* ---------- Vẽ hình học & đồ thị hàm số ---------- */
function renderDrawing(container, kind, spec) {
  if (!container) return;
  try {
    if (kind === 'plot') drawPlot(container, spec);
    else drawShape(container, spec);
  } catch (e) {
    container.innerHTML = '<p style="color:#c0392b;font-size:12px;">⚠️ Có lỗi khi vẽ minh họa.</p>';
    console.error(e);
  }
}
function drawPlot(container, spec) {
  const W = 520, H = 300, pad = 36;
  const xr = (spec.xrange && spec.xrange.length === 2) ? spec.xrange.map(Number) : [-10, 10];
  const exprs = (spec.expressions || []).slice(0, 4).filter(Boolean);
  const N = 240;
  const colors = ['#2955ff', '#0ea8b0', '#e0503f', '#b98a2b'];
  const series = exprs.map((expr) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / N;
      let y;
      try { y = math.evaluate(expr, { x }); } catch (e) { y = NaN; }
      pts.push([x, (typeof y === 'number' && isFinite(y)) ? y : null]);
    }
    return { expr, pts };
  });
  let yr = (spec.yrange && spec.yrange.length === 2) ? spec.yrange.map(Number) : null;
  if (!yr) {
    const vals = [];
    series.forEach((s) => s.pts.forEach((p) => { if (p[1] !== null) vals.push(p[1]); }));
    let mn = vals.length ? Math.min(...vals) : -1, mx = vals.length ? Math.max(...vals) : 1;
    if (mn === mx) { mn -= 1; mx += 1; }
    const m = (mx - mn) * 0.12 || 1;
    yr = [mn - m, mx + m];
  }
  const sx = (x) => pad + (x - xr[0]) / (xr[1] - xr[0]) * (W - 2 * pad);
  const sy = (y) => H - pad - (y - yr[0]) / (yr[1] - yr[0]) * (H - 2 * pad);

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
  svg += `<rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" fill="none" stroke="var(--rule)" stroke-width="1"/>`;
  if (xr[0] <= 0 && xr[1] >= 0) svg += `<line x1="${sx(0)}" y1="${pad}" x2="${sx(0)}" y2="${H - pad}" stroke="var(--muted)" stroke-width="1.2"/>`;
  if (yr[0] <= 0 && yr[1] >= 0) svg += `<line x1="${pad}" y1="${sy(0)}" x2="${W - pad}" y2="${sy(0)}" stroke="var(--muted)" stroke-width="1.2"/>`;
  const yspan = yr[1] - yr[0];
  series.forEach((s, i) => {
    let d = ''; let drawing = false;
    s.pts.forEach((p) => {
      if (p[1] === null || p[1] < yr[0] - yspan || p[1] > yr[1] + yspan) { drawing = false; return; }
      const px = sx(p[0]).toFixed(1), py = sy(Math.max(yr[0] - yspan, Math.min(yr[1] + yspan, p[1]))).toFixed(1);
      d += (drawing ? 'L' : 'M') + px + ',' + py + ' ';
      drawing = true;
    });
    svg += `<path d="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  svg += `</svg>`;
  const legend = series.map((s, i) => `<span style="display:inline-flex;align-items:center;gap:5px;margin:2px 12px 2px 0;"><span style="width:10px;height:10px;border-radius:3px;background:${colors[i % colors.length]};display:inline-block;"></span><span style="font-family:'JetBrains Mono',monospace;">y = ${s.expr.replace(/</g, '&lt;')}</span></span>`).join('');
  container.innerHTML = svg + `<div class="draw-legend">${legend}</div>`;
}
function drawShape(container, spec) {
  const W = 420, H = 300, pad = 40;
  let pts = (spec.points || []).map((p) => [Number(p[0]), Number(p[1])]);
  if (spec.type === 'circle' && spec.center && spec.radius != null) {
    const [cx, cy] = spec.center.map(Number), r = Number(spec.radius);
    pts = pts.concat([[cx - r, cy - r], [cx + r, cy + r]]);
  }
  if (pts.length === 0) pts = [[0, 0], [1, 1]];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const mx = (xmax - xmin) * 0.18 + 0.5, my = (ymax - ymin) * 0.18 + 0.5;
  xmin -= mx; xmax += mx; ymin -= my; ymax += my;
  const scale = Math.min((W - 2 * pad) / (xmax - xmin), (H - 2 * pad) / (ymax - ymin));
  const ox = (W - (xmax - xmin) * scale) / 2;
  const oy = (H - (ymax - ymin) * scale) / 2;
  const sx = (x) => ox + (x - xmin) * scale;
  const sy = (y) => H - (oy + (y - ymin) * scale);

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
  const type = spec.type || 'polygon';
  if (type === 'circle' && spec.center && spec.radius != null) {
    const [cx, cy] = spec.center.map(Number);
    svg += `<circle cx="${sx(cx)}" cy="${sy(cy)}" r="${spec.radius * scale}" fill="var(--primary)" fill-opacity="0.08" stroke="var(--primary)" stroke-width="2"/>`;
    svg += `<circle cx="${sx(cx)}" cy="${sy(cy)}" r="2.5" fill="var(--primary)"/>`;
  } else if (type === 'segment' && pts.length >= 2) {
    svg += `<line x1="${sx(pts[0][0])}" y1="${sy(pts[0][1])}" x2="${sx(pts[1][0])}" y2="${sy(pts[1][1])}" stroke="var(--primary)" stroke-width="2.4"/>`;
  } else if (type === 'points') {
    // chỉ chấm điểm, vẽ ở vòng lặp bên dưới
  } else {
    const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1)).join(' ') + ' Z';
    svg += `<path d="${path}" fill="var(--primary)" fill-opacity="0.08" stroke="var(--primary)" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
  (spec.points || []).forEach((p, i) => {
    const x = Number(p[0]), y = Number(p[1]);
    const label = (spec.labels && spec.labels[i]) || '';
    svg += `<circle cx="${sx(x)}" cy="${sy(y)}" r="3" fill="var(--text)"/>`;
    if (label) svg += `<text x="${sx(x) + 7}" y="${sy(y) - 6}" font-size="13" font-family="Inter,sans-serif" fill="var(--text)" font-weight="600">${String(label).replace(/</g, '&lt;')}</text>`;
  });
  svg += `</svg>`;
  container.innerHTML = svg;
}

function addUserMsg(text, imageUrl) {
  const row = document.createElement('div');
  row.className = 'msg-row msg-user';
  row.innerHTML = '<div class="bubble"></div>';
  const bubble = row.querySelector('.bubble');
  if (imageUrl) { const img = document.createElement('img'); img.src = imageUrl; bubble.appendChild(img); }
  if (text) { const span = document.createElement('span'); span.textContent = text; bubble.appendChild(span); }
  threadEl.appendChild(row); threadEl.scrollTop = threadEl.scrollHeight;
}
function addAiMsg() {
  const row = document.createElement('div');
  row.className = 'msg-row msg-ai';
  row.innerHTML = '<div class="label">Lời giải</div><div class="content"><span class="typing"><span></span><span></span><span></span></span></div>';
  threadEl.appendChild(row); threadEl.scrollTop = threadEl.scrollHeight;
  return row;
}

/* ================= Gửi câu hỏi ================= */
el('qInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
el('qInput').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 150) + 'px'; });
el('sendBtn').onclick = sendMessage;

async function sendMessage() {
  const input = el('qInput');
  const query = input.value.trim();
  const image = state.pendingImage;
  if (!query && !image) return;
  input.value = ''; input.style.height = 'auto';
  el('sendBtn').disabled = true;
  const deep = state.thinkMode === 'deep';
  statusEl.textContent = deep ? 'ĐANG SUY LUẬN SÂU…' : (image ? 'ĐANG ĐỌC ẢNH…' : 'ĐANG GIẢI…');

  addUserMsg(query, image ? image.url : null);
  state.pendingImage = null; renderImagePreview();

  const aiRow = addAiMsg();
  const contentEl = aiRow.querySelector('.content');
  const contexts = retrieveContext(query, deep ? 6 : 4);

  try {
    const data = await apiPost('/api/chat', {
      query,
      deep,
      image: image ? { mediaType: image.mediaType, base64: image.base64 } : null,
      rules: state.rules,
      contexts,
      settings: state.settings,
      history: state.history
    });

    const raw = data.text || 'Xin lỗi, không nhận được phản hồi. Vui lòng thử lại.';
    const { thinking, answer } = extractThinking(raw);

    contentEl.innerHTML = '';
    if (thinking) {
      const details = document.createElement('details');
      details.className = 'thinking-block';
      details.innerHTML = '<summary>Xem quá trình suy luận sâu</summary><div class="think-body"></div>';
      details.querySelector('.think-body').textContent = thinking;
      contentEl.appendChild(details);
    }
    const answerWrap = document.createElement('div');
    const { html, draws } = renderMarkdownLite(answer);
    answerWrap.innerHTML = html;
    contentEl.appendChild(answerWrap);
    renderMath(contentEl);
    draws.forEach((d) => renderDrawing(document.getElementById(d.id), d.kind, d.spec));

    if (contexts.length) {
      const citeWrap = document.createElement('div');
      citeWrap.className = 'citations';
      citeWrap.innerHTML = '<div class="cite-title">Nguồn tham khảo</div>' +
        contexts.map((c, i) => `<div class="cite"><b>[${i + 1}] ${c.doc} · đoạn ${c.id}</b><br>${highlightSnippet(c.text, query)}</div>`).join('');
      aiRow.appendChild(citeWrap);
      renderMath(citeWrap);
    }

    const actions = document.createElement('div');
    actions.className = 'study-actions';
    actions.innerHTML = `
      <button class="study-btn ppt" data-act="ppt">${ICONS.presentation}<span>Xuất slide PPT</span></button>
      <button class="study-btn" data-act="flash">${ICONS.cards}<span>Flashcard ôn tập</span></button>
    `;
    actions.querySelector('[data-act="ppt"]').onclick = (e) => handleExportPPT(e.currentTarget, answer);
    actions.querySelector('[data-act="flash"]').onclick = (e) => handleFlashcards(e.currentTarget, aiRow, answer);
    aiRow.appendChild(actions);

    state.history.push({ role: 'user', content: query || (image ? '[Người dùng đã gửi ảnh đề bài để giải]' : '') });
    state.history.push({ role: 'assistant', content: answer });
    if (state.history.length > 20) state.history = state.history.slice(-20);
  } catch (e) {
    contentEl.innerHTML = `<p style="color:#c0392b;">⚠️ ${(e && e.message) || 'Có lỗi khi kết nối tới máy chủ.'}</p>`;
    console.error(e);
  } finally {
    el('sendBtn').disabled = false;
    statusEl.textContent = 'SẴN SÀNG';
    threadEl.scrollTop = threadEl.scrollHeight;
  }
}

/* ================= Học tập: Xuất PPT & Flashcard ================= */
async function handleExportPPT(btn, answerText) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Đang tạo slide…</span>';
  try {
    const spec = await apiPost('/api/generate/ppt-outline', { content: answerText });
    await buildAndDownloadPPT(spec);
  } catch (e) {
    console.error(e);
    alert((e && e.message) || 'Không tạo được file PPT, vui lòng thử lại.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function buildAndDownloadPPT(spec) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';
  const NAVY = '0A1120', PRIMARY = '2955FF';

  let s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addShape('rect', { x: 0, y: 3.1, w: 0.14, h: 1.3, fill: { color: PRIMARY } });
  s.addText(spec.title || 'Bài trình chiếu', { x: 0.7, y: 2.9, w: 11.9, h: 1.4, fontFace: 'Arial', fontSize: 36, bold: true, color: 'FFFFFF' });
  if (spec.subtitle) s.addText(spec.subtitle, { x: 0.7, y: 4.15, w: 11.9, h: 0.6, fontFace: 'Arial', fontSize: 16, color: 'A9C2FF' });
  s.addText('Tạo bởi Trợ Giải · AI học tập', { x: 0.7, y: 6.9, w: 8, h: 0.4, fontFace: 'Arial', fontSize: 10.5, color: '6B7593' });

  (spec.slides || []).forEach((sl) => {
    const sd = pptx.addSlide();
    sd.background = { color: 'FFFFFF' };
    sd.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: 'F3F5F9' } });
    sd.addShape('rect', { x: 0, y: 0.88, w: 13.33, h: 0.03, fill: { color: PRIMARY } });
    sd.addText(sl.heading || '', { x: 0.6, y: 0.18, w: 12.1, h: 0.6, fontFace: 'Arial', fontSize: 22, bold: true, color: '0E1524' });
    const bullets = (sl.bullets || []).map((b) => ({ text: b, options: { bullet: { code: '25CF', color: PRIMARY }, color: '0E1524', breakLine: true } }));
    if (bullets.length) sd.addText(bullets, { x: 0.8, y: 1.3, w: 11.7, h: 5.3, fontFace: 'Arial', fontSize: 18, lineSpacing: 34, valign: 'top' });
    if (sl.note) sd.addNotes(sl.note);
  });

  const last = pptx.addSlide();
  last.background = { color: NAVY };
  last.addText('Cảm ơn!', { x: 0.7, y: 3.1, w: 11.9, h: 1, fontFace: 'Arial', fontSize: 32, bold: true, color: 'FFFFFF' });
  last.addText('Trợ Giải · AI học tập', { x: 0.7, y: 4.0, w: 11.9, h: 0.5, fontFace: 'Arial', fontSize: 14, color: 'A9C2FF' });

  const fname = (spec.title || 'bai-trinh-chieu').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'bai-trinh-chieu';
  await pptx.writeFile({ fileName: fname + '.pptx' });
}

async function handleFlashcards(btn, aiRow, answerText) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Đang tạo thẻ…</span>';
  try {
    const data = await apiPost('/api/generate/flashcards', { content: answerText });
    let existing = aiRow.querySelector('.flash-wrap');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.className = 'flash-wrap';
    aiRow.appendChild(wrap);
    renderFlashcards(wrap, data.cards || []);
  } catch (e) {
    console.error(e);
    alert((e && e.message) || 'Không tạo được flashcard, vui lòng thử lại.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function renderFlashcards(wrap, cards) {
  if (!cards.length) { wrap.innerHTML = '<div class="set-empty">Không tạo được thẻ ôn tập.</div>'; return; }
  let idx = 0, showingAnswer = false;
  wrap.innerHTML = `
    <div class="flash-head"><span>Flashcard ôn tập</span>
      <div class="flash-nav"><button data-nav="prev">‹</button><button data-nav="next">›</button></div>
    </div>
    <div class="flash-card"><span class="qlabel">Hỏi</span><div class="txt"></div></div>
    <div class="flash-progress"></div>
  `;
  const card = wrap.querySelector('.flash-card');
  const txt = wrap.querySelector('.txt');
  const qlabel = wrap.querySelector('.qlabel');
  const progress = wrap.querySelector('.flash-progress');
  function render() {
    const c = cards[idx];
    txt.textContent = showingAnswer ? c.a : c.q;
    qlabel.textContent = showingAnswer ? 'Đáp án' : 'Hỏi';
    card.classList.toggle('showing-a', showingAnswer);
    progress.textContent = `Thẻ ${idx + 1}/${cards.length} · bấm vào thẻ để lật`;
  }
  card.onclick = () => { showingAnswer = !showingAnswer; render(); };
  wrap.querySelector('[data-nav="prev"]').onclick = () => { idx = (idx - 1 + cards.length) % cards.length; showingAnswer = false; render(); };
  wrap.querySelector('[data-nav="next"]').onclick = () => { idx = (idx + 1) % cards.length; showingAnswer = false; render(); };
  render();
}

function welcome() {
  const row = document.createElement('div');
  row.className = 'msg-row msg-ai';
  row.innerHTML = '<div class="label">Trợ Giải</div><div class="content"><p>Chào bạn 👋 Thêm nguồn tài liệu ở khung bên trái nếu muốn AI trích dẫn chính xác, chọn chế độ suy nghĩ ngay trong thanh chat, và mở ⚙️ Cài đặt để tinh chỉnh phong cách trả lời hoặc thêm quy tắc riêng. Sau mỗi lời giải, bạn có thể bấm <strong>Xuất slide PPT</strong> hoặc <strong>Flashcard ôn tập</strong> để phục vụ việc học. Dán đề bài hoặc đính kèm ảnh để bắt đầu.</p></div>';
  threadEl.appendChild(row);
}

welcome();
loadAll();
