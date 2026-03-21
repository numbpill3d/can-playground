// CAN Frame Playground

// ── Globals ───────────────────────────────────────────────────────────────────
let canFrames = [];
let canGroups = new Map();
let fieldAnalysisMap = new Map();
let selectedId = null;
let darkMode = true;
let chart = null;
let annotations = new Map();
let graphOverlayIds = new Set();
let contextMenuFrame = null;

// virtual scroll state
let vs = null;       // { frames, allFrames, origIdxs, t0, maxLen, hlType, baseFrame, coverage }
let vsPending = false;
const VS_ROW_H = 38;
const VS_BUFFER = 8;
let vsScrollKey = '';
let vsScrollTop = 0;

const COLOR_PALETTE = [
    [255, 99, 132], [54, 162, 235], [255, 205, 86], [75, 192, 192],
    [153, 102, 255], [255, 159, 64], [99, 255, 132], [235, 54, 162]
];
function getColor(i, a = 1) {
    const [r, g, b] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    return `rgba(${r},${g},${b},${a})`;
}
function getColorTuple(i) { return COLOR_PALETTE[i % COLOR_PALETTE.length]; }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const logInput       = document.getElementById('logInput');
const parseBtn       = document.getElementById('parseBtn');
const clearBtn       = document.getElementById('clearBtn');
const exportBtn      = document.getElementById('exportBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const dbcImportBtn   = document.getElementById('dbcImportBtn');
const dbcFileInput   = document.getElementById('dbcFileInput');
const idList         = document.getElementById('idList');
const idFilter       = document.getElementById('idFilter');
const hexDumpContainer = document.getElementById('hexDumpContainer');
const selectedIdTitle  = document.getElementById('selectedIdTitle');
const highlightMode    = document.getElementById('highlightMode');
const frameFilterInput = document.getElementById('frameFilter');
const filterCount      = document.getElementById('filterCount');
const clearFilterBtn   = document.getElementById('clearFilterBtn');
const statusMessage  = document.getElementById('statusMessage');
const parseStats     = document.getElementById('parseStats');
const frameCount     = document.getElementById('frameCount');
const annotationList = document.getElementById('annotationList');
const annotationForm = document.getElementById('annotationForm');
const graphDeltaMode = document.getElementById('graphDeltaMode');
const graphHideStatic= document.getElementById('graphHideStatic');
const graphChartType = document.getElementById('graphChartType');
const graphInfo      = document.getElementById('graphInfo');
const compareIdsBtn  = document.getElementById('compareIdsBtn');
const idOverlayPanel = document.getElementById('idOverlayPanel');
const contextMenu    = document.getElementById('contextMenu');
const statsContainer = document.getElementById('statsContainer');
const bitmapInfo     = document.getElementById('bitmapInfo');
const openFileBtn    = document.getElementById('openFileBtn');
const logFileInput   = document.getElementById('logFileInput');
const saveSessionBtn = document.getElementById('saveSessionBtn');
const loadSessionBtn = document.getElementById('loadSessionBtn');
const sessionFileInput = document.getElementById('sessionFileInput');
const exportCsvBtn      = document.getElementById('exportCsvBtn');
const resetZoomBtn      = document.getElementById('resetZoomBtn');
const deltaModeLbl      = document.getElementById('deltaModeLbl');
const hideStaticLbl     = document.getElementById('hideStaticLbl');
const bitmapTooltipEl   = document.getElementById('bitmapTooltip');

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateFrameCount();
});

function setupEventListeners() {
    parseBtn.addEventListener('click', parseLog);
    clearBtn.addEventListener('click', clearAll);
    exportBtn.addEventListener('click', exportAnnotations);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    idFilter.addEventListener('input', filterIds);
    highlightMode.addEventListener('change', renderHexDump);
    frameFilterInput.addEventListener('input', renderHexDump);
    clearFilterBtn.addEventListener('click', () => { frameFilterInput.value = ''; renderHexDump(); });
    graphDeltaMode.addEventListener('change', renderGraph);
    graphHideStatic.addEventListener('change', renderGraph);
    graphChartType.addEventListener('change', () => { updateGraphToolbarState(); renderGraph(); });
    compareIdsBtn.addEventListener('click', toggleIdOverlayPanel);
    resetZoomBtn.addEventListener('click', () => { if (chart) chart.resetZoom(); });
    dbcImportBtn.addEventListener('click', () => dbcFileInput.click());
    dbcFileInput.addEventListener('change', handleDBCImport);
    annotationForm.addEventListener('submit', addAnnotation);

    // Ctrl+Enter to parse
    logInput.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') parseLog(); });

    // Clear form validation state on input
    annotationForm.querySelectorAll('input').forEach(inp =>
        inp.addEventListener('input', () => inp.classList.remove('input-error'))
    );

    updateGraphToolbarState();
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', switchTab));

    // File open
    openFileBtn.addEventListener('click', () => logFileInput.click());
    logFileInput.addEventListener('change', e => { if (e.target.files[0]) openLogFile(e.target.files[0]); e.target.value = ''; });

    // Drag-drop on textarea
    logInput.addEventListener('dragover',  e => { e.preventDefault(); logInput.classList.add('drag-over'); });
    logInput.addEventListener('dragleave', () => logInput.classList.remove('drag-over'));
    logInput.addEventListener('drop', e => {
        e.preventDefault();
        logInput.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) openLogFile(file);
    });

    // Session save/load
    saveSessionBtn.addEventListener('click', saveSession);
    loadSessionBtn.addEventListener('click', () => sessionFileInput.click());
    sessionFileInput.addEventListener('change', e => { if (e.target.files[0]) loadSession(e.target.files[0]); e.target.value = ''; });

    // Export CSV
    exportCsvBtn.addEventListener('click', exportDecodedCSV);

    // Context menu
    document.addEventListener('click', () => { contextMenu.style.display = 'none'; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') contextMenu.style.display = 'none'; });
    contextMenu.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', e => {
            e.stopPropagation();
            if (contextMenuFrame) copyFrameAs(contextMenuFrame, item.dataset.format);
            contextMenu.style.display = 'none';
        });
    });
}

// ── Graph Toolbar State ────────────────────────────────────────────────────────
function updateGraphToolbarState() {
    const t = graphChartType.value;
    const valuesOnly = t === 'values';
    graphDeltaMode.disabled  = !valuesOnly;
    graphHideStatic.disabled = !valuesOnly;
    deltaModeLbl.classList.toggle('toolbar-option-disabled', !valuesOnly);
    hideStaticLbl.classList.toggle('toolbar-option-disabled', !valuesOnly);
    resetZoomBtn.style.display = chart ? '' : 'none';
}

// ── Parse ─────────────────────────────────────────────────────────────────────
function parseLog() {
    const input = logInput.value.trim();
    if (!input) { showMessage('Paste some CAN log data first', 'error'); return; }

    canFrames = [];
    canGroups.clear();
    annotations.clear();
    fieldAnalysisMap.clear();
    graphOverlayIds.clear();

    const lines = input.split('\n').filter(l => l.trim());
    let parsed = 0, errors = 0;

    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        try {
            const frame = parseLine(line.trim(), li);
            if (frame) {
                canFrames.push(frame);
                parsed++;
                if (!canGroups.has(frame.id)) canGroups.set(frame.id, []);
                canGroups.get(frame.id).push(frame);
            }
        } catch { errors++; }
    }

    canGroups.forEach((frames, id) => fieldAnalysisMap.set(id, detectChangingFields(frames)));

    updateIdList();
    updateFrameCount();
    showMessage(`Parsed ${parsed} frames${errors ? ` (${errors} skipped)` : ''}`, 'success');
    if (canGroups.size > 0) selectCanId(Array.from(canGroups.keys())[0]);
}

function parseLine(line, idx = 0) {
    // candump: (ts) iface ID#payload
    const m1 = line.match(/^\((\d+\.\d+)\)\s+\w+\s+([0-9A-Fa-f]+)#([0-9A-Fa-f]*)$/);
    if (m1) return buildFrame(m1[2].toUpperCase(), parseFloat(m1[1]), m1[3]);
    // simple: ID#payload — use sequential synthetic timestamps
    const m2 = line.match(/^([0-9A-Fa-f]+)#([0-9A-Fa-f]*)$/);
    if (m2) return buildFrame(m2[1].toUpperCase(), idx * 0.001, m2[2]);
    throw new Error('no match');
}

function buildFrame(id, timestamp, hex) {
    const payload = [];
    for (let i = 0; i < hex.length; i += 2) payload.push(parseInt(hex.substr(i, 2), 16));
    return { id, timestamp, payload, dlc: payload.length };
}

// ── Field Analysis ────────────────────────────────────────────────────────────
function detectChangingFields(frames) {
    if (frames.length < 2) return [];
    const maxBytes = Math.max(...frames.map(f => f.payload.length));
    return Array.from({ length: maxBytes }, (_, j) => {
        const vals = frames.filter(f => j < f.payload.length).map(f => f.payload[j]);
        const unique = new Set(vals);
        let changes = 0;
        for (let i = 1; i < frames.length; i++) {
            if (j < frames[i].payload.length && j < frames[i-1].payload.length &&
                frames[i].payload[j] !== frames[i-1].payload[j]) changes++;
        }
        return {
            bytePosition: j, changes,
            changeFrequency: frames.length > 1 ? changes / (frames.length - 1) : 0,
            uniqueValues: unique.size,
            isStable: unique.size <= 1,
            isVariable: unique.size > 1
        };
    });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function updateIdList() {
    if (!canGroups.size) {
        idList.innerHTML = '<p class="empty-message">No data loaded.</p>';
        return;
    }
    idList.innerHTML = '';
    const sorted = Array.from(canGroups.keys()).sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
    for (const id of sorted) {
        const frames = canGroups.get(id);
        const analysis = fieldAnalysisMap.get(id) || [];
        const changing = analysis.filter(f => f.isVariable).length;
        const dur = (frames[frames.length-1].timestamp - frames[0].timestamp).toFixed(3);
        const div = document.createElement('div');
        div.className = 'id-item';
        div.dataset.id = id;
        div.innerHTML = `
            <div class="id-info">
                <span class="id-hex">${id}</span>
                <span class="id-count">${frames.length} frames</span>
            </div>
            <div class="id-stats">
                <span>${dur}s</span>
                ${changing
                    ? `<span class="id-changing">${changing} changing</span>`
                    : `<span class="id-static">static</span>`}
            </div>`;
        div.addEventListener('click', () => selectCanId(id));
        idList.appendChild(div);
    }
}

function filterIds() {
    const s = idFilter.value.toLowerCase();
    document.querySelectorAll('.id-item').forEach(el =>
        el.style.display = el.dataset.id.toLowerCase().includes(s) ? '' : 'none');
}

function selectCanId(id) {
    selectedId = id;
    document.querySelectorAll('.id-item').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.id-item[data-id="${id}"]`)?.classList.add('selected');

    const frames = canGroups.get(id);
    selectedIdTitle.textContent = `CAN ID: ${id}  ·  ${frames.length} frames  ·  DLC ${frames[0].dlc}`;

    renderHexDump();
    renderAnnotations();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'graph')  setTimeout(renderGraph, 20);
    if (activeTab === 'bitmap') setTimeout(renderBitMap, 20);
    if (activeTab === 'stats')  renderStats();
}

// ── Hex Dump ──────────────────────────────────────────────────────────────────
function parseFrameFilter(str) {
    if (!str.trim()) return null;
    const conditions = [];
    const parts = str.trim().split(/\s*&&\s*|\s+(?=B\d)/i);
    for (const part of parts) {
        const m = part.trim().match(/^B(\d+)\s*(==|!=|>=|<=|>|<)\s*(0x[0-9a-fA-F]+|\d+)$/i);
        if (m) conditions.push({
            byte: parseInt(m[1]),
            op: m[2],
            val: /^0x/i.test(m[3]) ? parseInt(m[3], 16) : parseInt(m[3])
        });
    }
    return conditions.length ? conditions : null;
}

function applyFilter(frames, conds) {
    if (!conds) return frames;
    return frames.filter(f => conds.every(c => {
        if (c.byte >= f.payload.length) return false;
        const v = f.payload[c.byte];
        switch (c.op) {
            case '==': return v === c.val;
            case '!=': return v !== c.val;
            case '>':  return v > c.val;
            case '<':  return v < c.val;
            case '>=': return v >= c.val;
            case '<=': return v <= c.val;
        }
    }));
}

function buildByteCoverage(id) {
    const coverage = {};
    (annotations.get(id) || []).forEach((ann, idx) => {
        const s = Math.floor(ann.startBit / 8);
        const e = Math.floor((ann.startBit + ann.length - 1) / 8);
        for (let b = s; b <= e; b++) {
            if (!coverage[b]) coverage[b] = [];
            coverage[b].push({ name: ann.name, idx });
        }
    });
    return coverage;
}

function renderHexDump() {
    if (!selectedId || !canGroups.has(selectedId)) {
        hexDumpContainer.innerHTML = '<p class="empty-message">Select a CAN ID to view hex dump</p>';
        hexDumpContainer.onscroll = null;
        vs = null;
        return;
    }

    const allFrames = canGroups.get(selectedId);
    const conds = parseFrameFilter(frameFilterInput.value);
    const frames = applyFilter(allFrames, conds);

    if (conds) {
        filterCount.textContent = `${frames.length} / ${allFrames.length}`;
        filterCount.style.color = frames.length < allFrames.length ? 'var(--warning)' : 'var(--success)';
    } else {
        filterCount.textContent = '';
    }

    if (!frames.length) {
        hexDumpContainer.innerHTML = '<p class="empty-message">No frames match the filter</p>';
        hexDumpContainer.onscroll = null;
        vs = null;
        return;
    }

    const maxLen    = Math.max(...frames.map(f => f.payload.length));
    const hlType    = highlightMode.value;
    const baseFrame = allFrames[0];
    const coverage  = buildByteCoverage(selectedId);
    const origIdxs  = frames.map(f => allFrames.indexOf(f));
    const colCount  = maxLen + 2;

    // Preserve scroll position when only highlight/annotation changes, not ID/filter
    const renderKey = `${selectedId}::${frameFilterInput.value}`;
    vsScrollTop = (renderKey === vsScrollKey) ? hexDumpContainer.scrollTop : 0;
    vsScrollKey = renderKey;

    vs = { frames, allFrames, origIdxs, t0: allFrames[0].timestamp, maxLen, hlType, baseFrame, coverage };

    // Build thead
    let thead = '<tr><th class="col-idx">#</th><th class="col-time">t (s)</th>';
    for (let j = 0; j < maxLen; j++) {
        const cov    = coverage[j];
        const badges = cov
            ? cov.map(c => `<span class="sig-badge" style="background:${getColor(c.idx,0.75)}">${c.name}</span>`).join('')
            : '';
        thead += `<th class="col-byte">${badges}<span>B${j}</span></th>`;
    }
    thead += '</tr>';

    hexDumpContainer.innerHTML = `<table class="hex-table">
        <thead>${thead}</thead>
        <tbody>
            <tr id="vsTop" class="vs-spacer"><td colspan="${colCount}"></td></tr>
            <tr id="vsBot" class="vs-spacer"><td colspan="${colCount}"></td></tr>
        </tbody>
    </table>`;

    hexDumpContainer.scrollTop = vsScrollTop;
    hexDumpContainer.onscroll = vsOnScroll;
    requestAnimationFrame(vsUpdate);
}

function vsOnScroll() {
    if (!vsPending) {
        vsPending = true;
        requestAnimationFrame(() => { vsPending = false; vsUpdate(); });
    }
}

function vsUpdate() {
    if (!vs) return;
    const { frames, allFrames, origIdxs, t0, maxLen, hlType, baseFrame, coverage } = vs;

    const scrollTop = hexDumpContainer.scrollTop;
    const viewH     = hexDumpContainer.clientHeight;
    const firstVis  = Math.max(0, Math.floor(scrollTop / VS_ROW_H) - VS_BUFFER);
    const lastVis   = Math.min(frames.length - 1, Math.ceil((scrollTop + viewH) / VS_ROW_H) + VS_BUFFER);

    const topEl = document.getElementById('vsTop');
    const botEl = document.getElementById('vsBot');
    if (!topEl || !botEl) return;

    topEl.firstElementChild.style.height = (firstVis * VS_ROW_H) + 'px';
    botEl.firstElementChild.style.height = (Math.max(0, frames.length - 1 - lastVis) * VS_ROW_H) + 'px';

    // Remove current data rows
    topEl.parentElement.querySelectorAll('.hex-row').forEach(r => r.remove());

    // Insert new rows before vsBot
    let rowsHtml = '';
    for (let i = firstVis; i <= lastVis; i++) {
        rowsHtml += buildRowHtml(frames[i], origIdxs[i], i, t0, maxLen, hlType, baseFrame, coverage, frames);
    }
    botEl.insertAdjacentHTML('beforebegin', rowsHtml);

    // Context menu handlers
    topEl.parentElement.querySelectorAll('.hex-row').forEach(row => {
        row.addEventListener('contextmenu', e => {
            e.preventDefault();
            contextMenuFrame = allFrames[parseInt(row.dataset.frameIdx)];
            showContextMenu(e.pageX, e.pageY);
        });
    });
}

function buildRowHtml(frame, origIdx, frameIdx, t0, maxLen, hlType, baseFrame, coverage, displayedFrames) {
    const rel = (frame.timestamp - t0).toFixed(3);
    let html = `<tr class="hex-row" data-frame-idx="${origIdx}">`;
    html += `<td class="col-idx">${origIdx}</td>`;
    html += `<td class="col-time">${rel}</td>`;

    for (let j = 0; j < maxLen; j++) {
        const v = j < frame.payload.length ? frame.payload[j] : null;
        if (v === null) { html += `<td class="byte-cell byte-missing">--</td>`; continue; }

        const hex = v.toString(16).toUpperCase().padStart(2, '0');
        const bin = v.toString(2).padStart(8, '0');
        let cellClass = 'byte-cell';
        let deltaInd = '';
        let tooltipDelta = '';

        const cov = coverage[j];
        const sigBorder = cov ? `style="border-bottom: 3px solid ${getColor(cov[0].idx, 0.9)}"` : '';

        if (hlType !== 'none') {
            const refFrame = hlType === 'baseline' ? baseFrame : (frameIdx > 0 ? displayedFrames[frameIdx - 1] : null);
            if (refFrame && j < refFrame.payload.length) {
                const rv = refFrame.payload[j];
                if (rv !== v) {
                    const diff = v - rv;
                    deltaInd = diff > 0 ? ' <span class="delta-up">▲</span>' : ' <span class="delta-down">▼</span>';
                    const ref = `0x${rv.toString(16).toUpperCase().padStart(2,'0')}`;
                    tooltipDelta = `Δ ${diff > 0 ? '+' : ''}${diff} from ${hlType === 'baseline' ? 'baseline' : 'prev'} (${ref})`;
                    const abs = Math.abs(diff);
                    if (abs > 200) cellClass += ' changed-heavy';
                    else if (abs > 50) cellClass += ' changed-medium';
                    else cellClass += ' changed-light';
                }
            }
        }

        const sigLabel = cov ? `<div class="tt-signal">Signal: ${cov.map(c => c.name).join(', ')}</div>` : '';
        const tooltip = `
            <div class="tt-title">B${j} · frame ${origIdx}</div>
            <div class="tt-row"><span>Hex</span><span>0x${hex}</span></div>
            <div class="tt-row"><span>Dec</span><span>${v}</span></div>
            <div class="tt-row"><span>Bin</span><span>${bin.slice(0,4)} ${bin.slice(4)}</span></div>
            ${tooltipDelta ? `<div class="tt-delta">${tooltipDelta}</div>` : ''}
            ${sigLabel}`;

        html += `<td class="${cellClass}" ${sigBorder}>
            <div class="cell-inner">
                <span class="cell-hex">0x${hex}${deltaInd}</span>
                <span class="cell-dec">${v}</span>
            </div>
            <div class="cell-tooltip">${tooltip}</div>
        </td>`;
    }
    html += '</tr>';
    return html;
}

// ── Graph ─────────────────────────────────────────────────────────────────────
function toggleIdOverlayPanel() {
    const visible = idOverlayPanel.style.display !== 'none';
    if (visible) {
        idOverlayPanel.style.display = 'none';
        compareIdsBtn.textContent = 'Compare IDs ▾';
    } else {
        buildIdOverlayPanel();
        idOverlayPanel.style.display = 'flex';
        compareIdsBtn.textContent = 'Compare IDs ▴';
    }
}

function buildIdOverlayPanel() {
    const ids = Array.from(canGroups.keys()).sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
    idOverlayPanel.innerHTML = ids
        .filter(id => id !== selectedId)
        .map(id => `
            <label class="overlay-id-option">
                <input type="checkbox" ${graphOverlayIds.has(id) ? 'checked' : ''} data-id="${id}">
                <span>${id}</span>
            </label>`)
        .join('');
    idOverlayPanel.querySelectorAll('input').forEach(cb => {
        cb.addEventListener('change', () => {
            cb.checked ? graphOverlayIds.add(cb.dataset.id) : graphOverlayIds.delete(cb.dataset.id);
            renderGraph();
        });
    });
}

function renderGraph() {
    if (!selectedId || !canGroups.has(selectedId)) return;

    const chartType = graphChartType.value;
    const isDelta   = graphDeltaMode.checked;
    const hideStatic = graphHideStatic.checked;
    const activeIds  = [selectedId, ...graphOverlayIds].filter(id => canGroups.has(id));
    const multiId    = activeIds.length > 1;

    const primaryFrames = canGroups.get(selectedId);
    const t0 = primaryFrames[0].timestamp;

    const datasets = [];
    let hiddenCount = 0;

    for (const id of activeIds) {
        const frames  = canGroups.get(id);
        const analysis = fieldAnalysisMap.get(id) || [];
        const idColorBase = activeIds.indexOf(id) * 8;

        if (chartType === 'rate') {
            const values = frames.slice(1).map((f, i) => (f.timestamp - frames[i].timestamp) * 1000);
            datasets.push({
                label: multiId ? `${id} interval` : 'Interval (ms)',
                data: values,
                borderColor: getColor(activeIds.indexOf(id)),
                backgroundColor: getColor(activeIds.indexOf(id), 0.1),
                borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0, spanGaps: true
            });
        } else if (chartType === 'signals') {
            const anns = annotations.get(id) || [];
            if (!anns.length && !multiId) {
                graphInfo.textContent = 'No signals defined — add annotations first';
            }
            for (let ai = 0; ai < anns.length; ai++) {
                const ann = anns[ai];
                const values = frames.map(f => decodeSignal(ann, f.payload));
                datasets.push({
                    label: multiId ? `${id} ${ann.name}` : ann.name,
                    data: values,
                    borderColor: getColor(idColorBase + ai),
                    backgroundColor: getColor(idColorBase + ai, 0.07),
                    borderWidth: 1.5,
                    pointRadius: frames.length > 200 ? 0 : 2,
                    pointHoverRadius: 4,
                    fill: false, tension: 0, spanGaps: true
                });
            }
        } else {
            const maxBytes = Math.max(...frames.map(f => f.payload.length));
            for (let j = 0; j < maxBytes; j++) {
                const ba = analysis[j];
                if (hideStatic && ba?.isStable) { if (!multiId) hiddenCount++; continue; }

                const values = frames.map((f, i) => {
                    if (j >= f.payload.length) return null;
                    if (isDelta) {
                        if (i === 0) return 0;
                        const prev = frames[i-1];
                        return j < prev.payload.length ? f.payload[j] - prev.payload[j] : null;
                    }
                    return f.payload[j];
                });

                datasets.push({
                    label: multiId ? `${id} B${j}` : `B${j}`,
                    data: values,
                    borderColor: getColor(idColorBase + j),
                    backgroundColor: getColor(idColorBase + j, 0.07),
                    borderWidth: 1.5,
                    pointRadius: frames.length > 200 ? 0 : 2,
                    pointHoverRadius: 4,
                    fill: false, tension: 0, spanGaps: true
                });
            }
        }
    }

    graphInfo.textContent = hiddenCount > 0
        ? `${hiddenCount} static byte${hiddenCount !== 1 ? 's' : ''} hidden`
        : multiId ? `${activeIds.length} IDs overlaid` : '';

    const labelFrames = chartType === 'rate' ? primaryFrames.slice(1) : primaryFrames;
    const labels = labelFrames.map(f => (f.timestamp - t0).toFixed(3));

    if (chart) chart.destroy();
    const ctx = document.getElementById('deltaChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true, position: 'top',
                    labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
                },
                tooltip: {
                    mode: 'index', intersect: false,
                    callbacks: {
                        title: items => `t+${items[0].label}s  (frame ${items[0].dataIndex})`,
                        label: ctx => {
                            const v = ctx.parsed.y;
                            if (v === null) return null;
                            if (chartType === 'rate') return ` ${ctx.dataset.label}: ${v.toFixed(3)} ms`;
                            if (chartType === 'signals') return ` ${ctx.dataset.label}: ${Number.isInteger(v) ? v : v.toFixed(4)}`;
                            if (isDelta) return ` ${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v}`;
                            return ` ${ctx.dataset.label}: 0x${v.toString(16).toUpperCase().padStart(2,'0')} (${v})`;
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time offset (s)' },
                    ticks: { maxTicksLimit: 12, maxRotation: 0 }
                },
                y: {
                    min: (chartType === 'rate' || isDelta || chartType === 'signals') ? undefined : 0,
                    max: (chartType === 'rate' || isDelta || chartType === 'signals') ? undefined : 255,
                    title: {
                        display: true,
                        text: chartType === 'rate' ? 'Interval (ms)' : chartType === 'signals' ? 'Signal value' : isDelta ? 'Delta' : 'Byte value'
                    },
                    ticks: {
                        callback: v => (chartType !== 'rate' && chartType !== 'signals' && !isDelta)
                            ? `0x${Math.round(v).toString(16).toUpperCase().padStart(2,'0')}` : v
                    }
                }
            },
            interaction: { mode: 'index', axis: 'x', intersect: false }
        }
    });
    updateGraphToolbarState();
}

// ── Bit Map ───────────────────────────────────────────────────────────────────
function renderBitMap() {
    if (!selectedId || !canGroups.has(selectedId)) return;

    const frames = canGroups.get(selectedId);
    if (!frames.length) return;

    const canvas  = document.getElementById('bitMapCanvas');
    const ctx     = canvas.getContext('2d');
    const maxBytes = Math.max(...frames.map(f => f.payload.length));

    // Subsampling for large datasets
    const subsample    = frames.length > 1000 ? Math.ceil(frames.length / 1000) : 1;
    const displayFrames = frames.filter((_, i) => i % subsample === 0);

    const BIT_H    = 5;   // px per bit row
    const BYTE_GAP = 6;   // px gap between byte groups
    const LEFT     = 52;  // left margin for labels
    const TOP      = 22;
    const FW       = displayFrames.length > 600 ? 1 : displayFrames.length > 200 ? 2 : 3;

    canvas.width  = LEFT + displayFrames.length * FW + 16;
    canvas.height = TOP  + maxBytes * (8 * BIT_H + BYTE_GAP) + 16;

    // Background
    ctx.fillStyle = darkMode ? '#1a1a1a' : '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header
    ctx.fillStyle = '#777';
    ctx.font = '10px monospace';
    ctx.fillText(`${frames.length} frames${subsample > 1 ? ` · 1:${subsample} subsampled` : ''}`, LEFT, 14);

    // Pre-compute bit stability for all bits
    const bitStats = [];
    for (let b = 0; b < maxBytes; b++) {
        for (let bi = 7; bi >= 0; bi--) {
            const vals = frames.filter(f => b < f.payload.length).map(f => (f.payload[b] >> bi) & 1);
            const has0 = vals.includes(0), has1 = vals.includes(1);
            bitStats.push({ toggle: has0 && has1, staticVal: has1 ? 1 : 0 });
        }
    }

    const toggleCount = bitStats.filter(b => b.toggle).length;
    bitmapInfo.textContent = `${toggleCount} / ${bitStats.length} bits toggling`;

    for (let b = 0; b < maxBytes; b++) {
        const baseY = TOP + b * (8 * BIT_H + BYTE_GAP);
        const [r, g, bc] = getColorTuple(b);

        // Byte label
        ctx.fillStyle = darkMode ? '#aaa' : '#555';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`B${b}`, 2, baseY + 4 * BIT_H);

        for (let bi = 0; bi < 8; bi++) {
            const bit   = 7 - bi;
            const bitY  = baseY + bi * BIT_H;
            const gBit  = b * 8 + bi;
            const stat  = bitStats[gBit];

            // Bit number label
            ctx.fillStyle = darkMode ? '#4a4a4a' : '#b0b0b0';
            ctx.font = '8px monospace';
            ctx.fillText(`${bit}`, LEFT - 14, bitY + BIT_H - 1);

            for (let fi = 0; fi < displayFrames.length; fi++) {
                const frame = displayFrames[fi];
                const x = LEFT + fi * FW;

                if (b >= frame.payload.length) {
                    ctx.fillStyle = darkMode ? '#222' : '#ddd';
                } else {
                    const bitVal = (frame.payload[b] >> bit) & 1;
                    if (!stat.toggle) {
                        // Static bit
                        ctx.fillStyle = bitVal
                            ? (darkMode ? '#2a3d4f' : '#aac8e0')
                            : (darkMode ? '#1c1c1c' : '#e8e8e8');
                    } else {
                        ctx.fillStyle = bitVal
                            ? `rgba(${r},${g},${bc},0.9)`
                            : (darkMode ? '#1a1a1a' : '#f0f0f0');
                    }
                }
                ctx.fillRect(x, bitY, FW, BIT_H - 1);
            }
        }

        // Separator between bytes
        if (b < maxBytes - 1) {
            ctx.fillStyle = darkMode ? '#2e2e2e' : '#d0d0d0';
            ctx.fillRect(LEFT, baseY + 8 * BIT_H, displayFrames.length * FW, 2);
        }
    }

    // Hover tooltip — styled overlay, not canvas.title
    canvas.onmousemove = e => {
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top)  * scaleY;

        if (cx < LEFT) { bitmapTooltipEl.style.display = 'none'; return; }

        const fi        = Math.floor((cx - LEFT) / FW);
        const byteFloat = (cy - TOP) / (8 * BIT_H + BYTE_GAP);
        const b         = Math.floor(byteFloat);
        const biFloat   = (byteFloat - b) * (8 * BIT_H + BYTE_GAP) / BIT_H;
        const bi        = Math.floor(biFloat);
        const bit       = 7 - bi;

        if (fi >= 0 && fi < displayFrames.length && b >= 0 && b < maxBytes && bit >= 0 && bit <= 7) {
            const frame   = displayFrames[fi];
            const realIdx = fi * subsample;
            const bitVal  = b < frame.payload.length ? (frame.payload[b] >> bit) & 1 : '?';
            const stat    = bitStats[b * 8 + bi];
            const byteHex = b < frame.payload.length
                ? '0x' + frame.payload[b].toString(16).toUpperCase().padStart(2,'0')
                : '--';

            bitmapTooltipEl.innerHTML =
                `<div class="btt-row"><span class="btt-lbl">Frame</span><span>${realIdx}</span></div>` +
                `<div class="btt-row"><span class="btt-lbl">Byte</span><span>B${b} (${byteHex})</span></div>` +
                `<div class="btt-row"><span class="btt-lbl">Bit</span><span>${bit}</span></div>` +
                `<div class="btt-row"><span class="btt-lbl">Value</span><span>${bitVal}</span></div>` +
                `<div class="btt-status ${stat.toggle ? 'btt-toggle' : 'btt-static'}">${stat.toggle ? 'toggling' : ('static ' + stat.staticVal)}</div>`;

            // Position near cursor, clamp to viewport
            let tx = e.clientX + 14, ty = e.clientY + 14;
            bitmapTooltipEl.style.display = 'block';
            const tw = bitmapTooltipEl.offsetWidth, th = bitmapTooltipEl.offsetHeight;
            if (tx + tw > window.innerWidth  - 4) tx = e.clientX - tw - 8;
            if (ty + th > window.innerHeight - 4) ty = e.clientY - th - 8;
            bitmapTooltipEl.style.left = tx + 'px';
            bitmapTooltipEl.style.top  = ty + 'px';
        } else {
            bitmapTooltipEl.style.display = 'none';
        }
    };
    canvas.onmouseleave = () => { bitmapTooltipEl.style.display = 'none'; };
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
    if (!selectedId || !canGroups.has(selectedId)) {
        statsContainer.innerHTML = '<p class="empty-message">Select a CAN ID to view statistics</p>';
        return;
    }

    const frames   = canGroups.get(selectedId);
    const maxBytes = Math.max(...frames.map(f => f.payload.length));

    let html = `<div class="stats-header">
        <strong>ID ${selectedId}</strong> — ${frames.length} frames, DLC ${frames[0].dlc}
    </div>`;

    html += `<table class="stats-table">
        <thead><tr>
            <th>Byte</th><th>Min</th><th>Max</th><th>Mean</th>
            <th>Stdev</th><th>Unique</th><th>Change %</th><th>Range (0–255)</th>
        </tr></thead><tbody>`;

    for (let j = 0; j < maxBytes; j++) {
        const vals = frames.filter(f => j < f.payload.length).map(f => f.payload[j]);
        if (!vals.length) continue;

        const min  = Math.min(...vals);
        const max  = Math.max(...vals);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const stdev = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
        const unique = new Set(vals).size;

        let changes = 0;
        for (let i = 1; i < frames.length; i++) {
            if (j < frames[i].payload.length && j < frames[i-1].payload.length &&
                frames[i].payload[j] !== frames[i-1].payload[j]) changes++;
        }
        const changeRate = frames.length > 1 ? (changes / (frames.length - 1) * 100) : 0;

        const [r, g, b] = getColorTuple(j);
        const minPct   = (min / 255 * 100).toFixed(1);
        const widthPct = ((max - min) / 255 * 100).toFixed(1);

        html += `<tr>
            <td class="stats-byte-lbl" style="border-left:3px solid rgba(${r},${g},${b},0.8)">B${j}</td>
            <td>0x${min.toString(16).toUpperCase().padStart(2,'0')} <span class="sdec">${min}</span></td>
            <td>0x${max.toString(16).toUpperCase().padStart(2,'0')} <span class="sdec">${max}</span></td>
            <td>${mean.toFixed(1)}</td>
            <td>${stdev.toFixed(2)}</td>
            <td>${unique}</td>
            <td class="${changeRate > 0 ? 'sc' : 'ss'}">${changeRate.toFixed(1)}%</td>
            <td class="stats-range-cell">
                <div class="stats-range-track">
                    <div class="stats-range-fill"
                        style="left:${minPct}%;width:${Math.max(parseFloat(widthPct),1)}%;background:rgba(${r},${g},${b},0.55)"></div>
                </div>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';

    // Timing stats
    if (frames.length > 1 && frames[0].timestamp !== frames[1].timestamp) {
        const intervals = [];
        for (let i = 1; i < frames.length; i++)
            intervals.push(frames[i].timestamp - frames[i-1].timestamp);

        const minI  = Math.min(...intervals) * 1000;
        const maxI  = Math.max(...intervals) * 1000;
        const meanI = intervals.reduce((a, b) => a + b, 0) / intervals.length * 1000;
        const dur   = frames[frames.length-1].timestamp - frames[0].timestamp;

        html += `<div class="stats-timing">
            <div class="stats-timing-title">Timing</div>
            <div class="stats-timing-grid">
                <div><span>Min interval</span><strong>${minI.toFixed(3)} ms</strong></div>
                <div><span>Max interval</span><strong>${maxI.toFixed(3)} ms</strong></div>
                <div><span>Avg interval</span><strong>${meanI.toFixed(3)} ms</strong></div>
                <div><span>Avg rate</span><strong>${(1000/meanI).toFixed(1)} Hz</strong></div>
                <div><span>Total span</span><strong>${dur.toFixed(3)} s</strong></div>
                <div><span>Frame count</span><strong>${frames.length}</strong></div>
            </div>
        </div>`;
    }

    statsContainer.innerHTML = html;
}

// ── DBC Import ────────────────────────────────────────────────────────────────
function handleDBCImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const result = applyDBC(parseDBC(ev.target.result));
        showMessage(
            `DBC: ${result.applied} signals applied to ${result.matched} IDs` +
            (result.skipped ? ` · ${result.skipped} IDs not in log` : ''),
            'success'
        );
        renderAnnotations();
        renderHexDump();
    };
    reader.readAsText(file);
    e.target.value = '';
}

function parseDBC(text) {
    const messages = {};
    let currentId = null;
    for (const line of text.split('\n')) {
        const msgM = line.match(/^BO_\s+(\d+)\s+\w+\s*:/);
        if (msgM) {
            const rawId = parseInt(msgM[1]);
            currentId = (rawId & 0x1FFFFFFF).toString(16).toUpperCase();
            if (!messages[currentId]) messages[currentId] = [];
            continue;
        }
        if (currentId) {
            // SG_ name : startBit|length@byteOrder signedness (factor,offset) [min|max] "unit"
            const sg = line.match(/^\s+SG_\s+(\w+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[[^\]]*\]\s*"([^"]*)"/);
            if (sg) messages[currentId].push({
                name:      sg[1],
                startBit:  parseInt(sg[2]),
                length:    parseInt(sg[3]),
                byteOrder: sg[4] === '1' ? 'intel' : 'motorola',
                type:      sg[5] === '+' ? 'unsigned' : 'signed',
                factor:    parseFloat(sg[6]),
                offset:    parseFloat(sg[7]),
                unit:      sg[8]
            });
        }
    }
    return messages;
}

function applyDBC(dbcMessages) {
    let applied = 0, matched = 0, skipped = 0;
    for (const [dbcId, signals] of Object.entries(dbcMessages)) {
        const loadedId = Array.from(canGroups.keys())
            .find(id => parseInt(id, 16) === parseInt(dbcId, 16));
        if (!loadedId) { skipped++; continue; }
        matched++;
        if (!annotations.has(loadedId)) annotations.set(loadedId, []);
        for (const s of signals) { annotations.get(loadedId).push(s); applied++; }
    }
    return { applied, matched, skipped };
}

// ── Annotations ───────────────────────────────────────────────────────────────
function decodeSignal(ann, payload) {
    const { startBit, length, type, factor, offset, byteOrder } = ann;
    let value = 0;
    if (byteOrder === 'intel') {
        for (let i = 0; i < length; i++) {
            const ab = startBit + i;
            const bi = Math.floor(ab / 8), bp = ab % 8;
            if (bi < payload.length) value |= (((payload[bi] >> bp) & 1) << i);
        }
    } else {
        for (let i = 0; i < length; i++) {
            const ab = startBit + i;
            const bi = Math.floor(ab / 8), bp = 7 - (ab % 8);
            if (bi < payload.length) value = (value << 1) | ((payload[bi] >> bp) & 1);
        }
    }
    if (type === 'signed' && (value & (1 << (length - 1)))) value -= (1 << length);
    return value * factor + offset;
}

function renderAnnotations() {
    if (!selectedId) {
        annotationList.innerHTML = '<p class="empty-message">Select a CAN ID</p>';
        return;
    }
    const anns   = annotations.get(selectedId) || [];
    const frames = canGroups.get(selectedId);
    const latest = frames?.[frames.length - 1];

    if (!anns.length) {
        annotationList.innerHTML = '<p class="empty-message">No annotations. Add one below or import a DBC file.</p>';
        return;
    }

    annotationList.innerHTML = anns.map((ann, idx) => {
        const [r, g, b] = getColorTuple(idx);
        const sB = Math.floor(ann.startBit / 8);
        const eB = Math.floor((ann.startBit + ann.length - 1) / 8);
        let decoded = '';
        if (latest) {
            const v = decodeSignal(ann, latest.payload);
            const fmt = Number.isInteger(v) ? v : v.toFixed(4);
            decoded = `<div class="annotation-value">Latest: <strong>${fmt}${ann.unit ? ' '+ann.unit : ''}</strong></div>`;
        }
        return `<div class="annotation-item" style="border-left-color:rgba(${r},${g},${b},0.85)">
            <div class="annotation-header">
                <h4>${ann.name}</h4>
                <button class="btn-icon btn-delete" onclick="deleteAnnotation('${selectedId}',${idx})">✕</button>
            </div>
            <p>Bits ${ann.startBit}–${ann.startBit+ann.length-1} · ${ann.length} bits · B${sB}${sB!==eB?`–B${eB}`:''}</p>
            <p>${ann.byteOrder==='intel'?'Intel LE':'Motorola BE'} · ${ann.type} · ×${ann.factor} +${ann.offset}${ann.unit?' · '+ann.unit:''}</p>
            ${decoded}
        </div>`;
    }).join('');
}

function deleteAnnotation(id, index) {
    annotations.get(id)?.splice(index, 1);
    renderAnnotations();
    renderHexDump();
    showMessage('Annotation removed', 'success');
}

function addAnnotation(e) {
    e.preventDefault();
    if (!selectedId) { showMessage('Select a CAN ID first', 'error'); return; }

    // Custom validation — mark invalid fields
    const nameEl   = document.getElementById('signalName');
    const startEl  = document.getElementById('signalStart');
    const lengthEl = document.getElementById('signalLength');
    let valid = true;
    [nameEl, startEl, lengthEl].forEach(el => {
        if (!el.value.trim() || (el.type === 'number' && isNaN(parseFloat(el.value)))) {
            el.classList.add('input-error');
            valid = false;
        }
    });
    if (!valid) { showMessage('Fill in required fields (Name, Start Bit, Length)', 'error'); return; }

    const ann = {
        name:      nameEl.value.trim(),
        startBit:  parseInt(startEl.value),
        length:    parseInt(lengthEl.value),
        type:      document.getElementById('signalType').value,
        byteOrder: document.getElementById('signalByteOrder').value,
        factor:    parseFloat(document.getElementById('signalFactor').value) || 1,
        offset:    parseFloat(document.getElementById('signalOffset').value) || 0,
        unit:      document.getElementById('signalUnit').value
    };
    if (!annotations.has(selectedId)) annotations.set(selectedId, []);
    annotations.get(selectedId).push(ann);
    renderAnnotations();
    renderHexDump();
    showMessage('Annotation added', 'success');
    annotationForm.reset();
    document.getElementById('signalFactor').value = '1';
    document.getElementById('signalOffset').value = '0';
}

// ── Context Menu ──────────────────────────────────────────────────────────────
function showContextMenu(x, y) {
    contextMenu.style.display = 'block';
    // Clamp to viewport
    const mw = contextMenu.offsetWidth  || 180;
    const mh = contextMenu.offsetHeight || 120;
    if (x + mw > window.innerWidth  - 4) x = window.innerWidth  - mw - 4;
    if (y + mh > window.innerHeight - 4) y = window.innerHeight - mh - 4;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top  = y + 'px';
}

// ── Copy Row As ───────────────────────────────────────────────────────────────
function copyFrameAs(frame, format) {
    const hexPay = frame.payload.map(b => b.toString(16).toUpperCase().padStart(2,'0')).join('');
    let text = '';
    switch (format) {
        case 'candump': text = `(${frame.timestamp.toFixed(6)}) can0 ${frame.id}#${hexPay}`; break;
        case 'hex':     text = hexPay; break;
        case 'python':  text = `b'${frame.payload.map(b=>`\\x${b.toString(16).padStart(2,'0')}`).join('')}'`; break;
        case 'c':       text = `{${frame.payload.map(b=>`0x${b.toString(16).toUpperCase().padStart(2,'0')}`).join(', ')}}`; break;
        case 'csv':     text = frame.payload.join(','); break;
    }
    navigator.clipboard.writeText(text).then(() => showMessage(`Copied as ${format}`, 'success'));
}

// ── Clear / Export ────────────────────────────────────────────────────────────
function clearAll() {
    canFrames = []; canGroups.clear(); fieldAnalysisMap.clear();
    annotations.clear(); graphOverlayIds.clear(); selectedId = null;
    vs = null;
    logInput.value = '';
    idList.innerHTML = '<p class="empty-message">No data loaded. Paste CAN log and click Parse.</p>';
    hexDumpContainer.innerHTML = '<p class="empty-message">Select a CAN ID to view hex dump</p>';
    hexDumpContainer.onscroll = null;
    selectedIdTitle.textContent = 'Select a CAN ID';
    annotationList.innerHTML = '<p class="empty-message">No annotations for selected ID</p>';
    statsContainer.innerHTML = '<p class="empty-message">Select a CAN ID to view statistics</p>';
    graphInfo.textContent = ''; filterCount.textContent = ''; frameFilterInput.value = '';
    if (chart) { chart.destroy(); chart = null; }
    const bCtx = document.getElementById('bitMapCanvas').getContext('2d');
    bCtx.clearRect(0, 0, bCtx.canvas.width, bCtx.canvas.height);
    updateFrameCount();
    showMessage('Data cleared', 'success');
}

function exportAnnotations() {
    if (!canGroups.size) { showMessage('No data to export', 'error'); return; }
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(
        JSON.stringify({ annotations: Object.fromEntries(annotations), timestamp: new Date().toISOString() }, null, 2)
    );
    a.download = 'can-annotations.json';
    a.click();
    showMessage('Annotations exported', 'success');
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    darkModeToggle.textContent = darkMode ? 'Light Mode' : 'Dark Mode';
    if (document.querySelector('.tab-btn.active')?.dataset.tab === 'bitmap') renderBitMap();
}

function switchTab(e) {
    const tabId = e.target.dataset.tab;

    // Close compare panel when leaving graph tab
    if (tabId !== 'graph' && idOverlayPanel.style.display !== 'none') {
        idOverlayPanel.style.display = 'none';
        compareIdsBtn.textContent = 'Compare IDs ▾';
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabId}Tab`).classList.add('active');

    switch (tabId) {
        case 'hex':         renderHexDump(); break;
        case 'graph':
            if (!selectedId) {
                graphInfo.textContent = '';
                if (chart) { chart.destroy(); chart = null; }
            } else { setTimeout(renderGraph, 20); }
            break;
        case 'bitmap':
            if (!selectedId) {
                bitmapInfo.textContent = '';
                const bCtx = document.getElementById('bitMapCanvas').getContext('2d');
                bCtx.clearRect(0, 0, bCtx.canvas.width, bCtx.canvas.height);
            } else { setTimeout(renderBitMap, 20); }
            break;
        case 'stats':       renderStats(); break;
        case 'annotations': renderAnnotations(); break;
    }
}

function updateFrameCount() {
    frameCount.textContent = `Frames: ${canFrames.length} | IDs: ${canGroups.size}`;
}

function showMessage(msg, type = 'info') {
    statusMessage.textContent = msg;
    statusMessage.className = `status-${type}`;
    setTimeout(() => {
        if (statusMessage.textContent === msg) { statusMessage.textContent = 'Ready'; statusMessage.className = ''; }
    }, 3000);
}

// ── File Open ─────────────────────────────────────────────────────────────────
function openLogFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        logInput.value = e.target.result;
        parseLog();
        showMessage(`Loaded: ${file.name}`, 'success');
    };
    reader.readAsText(file);
}

// ── Session Save / Load ───────────────────────────────────────────────────────
function saveSession() {
    if (!canGroups.size) { showMessage('No data to save', 'error'); return; }
    const session = {
        version: 1,
        savedAt: new Date().toISOString(),
        log: logInput.value,
        annotations: Object.fromEntries(annotations)
    };
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
    a.download = `can-session-${Date.now()}.json`;
    a.click();
    showMessage('Session saved', 'success');
}

function loadSession(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const session = JSON.parse(e.target.result);
            if (!session.log) throw new Error('missing log field');

            logInput.value = session.log;
            parseLog();

            // Restore annotations after parseLog re-populates canGroups
            if (session.annotations) {
                for (const [id, anns] of Object.entries(session.annotations)) {
                    if (canGroups.has(id)) annotations.set(id, anns);
                }
            }

            renderAnnotations();
            renderHexDump();
            showMessage(`Session loaded: ${file.name}`, 'success');
        } catch (err) {
            showMessage(`Failed to load session: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

// ── Export Decoded CSV ────────────────────────────────────────────────────────
function exportDecodedCSV() {
    if (!canGroups.size) { showMessage('No data to export', 'error'); return; }

    const rows = [];
    const header = ['id', 'frame', 'timestamp'];
    const sigHeaders = [];

    // Build header from all annotations
    for (const [id, anns] of annotations) {
        for (const ann of anns) sigHeaders.push(`${id}:${ann.name}${ann.unit ? ' ('+ann.unit+')' : ''}`);
    }
    rows.push([...header, ...sigHeaders].join(','));

    for (const [id, frames] of canGroups) {
        const anns = annotations.get(id) || [];
        for (let i = 0; i < frames.length; i++) {
            const f = frames[i];
            const row = [id, i, f.timestamp.toFixed(6)];
            // For each global signal column, emit value only if it belongs to this id
            for (const [sid, sanns] of annotations) {
                for (const ann of sanns) {
                    if (sid === id) row.push(decodeSignal(ann, f.payload).toFixed(6));
                    else row.push('');
                }
            }
            rows.push(row.join(','));
        }
    }

    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    a.download = 'can-decoded.csv';
    a.click();
    showMessage('CSV exported', 'success');
}
