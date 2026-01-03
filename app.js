/* Sky ウニカウンター v4（履歴なし / Undoなし）
   - 未確定：最大10セット（1セット=4個）
   - セット内表示：常に S→M→L
   - 「確定して保存」：4つ揃ったセットだけ集計へ加算して未確定から削除
   - localStorage：未確定メモ + 確定済み集計のみ保持
*/

const STORAGE_KEY = "sky_uni_counter_v4";
const MAX_PENDING_SETS = 10;

const SIZE_META = {
  S: { light: 5 },
  M: { light: 10 },
  L: { light: 15 },
};
const ORDER = { S: 0, M: 1, L: 2 };

const state = loadState() ?? {
  pendingSets: [], // [{raw:["S","S","M","M"]}, ...] 最大10
  stats: {
    totalSets: 0,
    totalUrchins: 0,
    totalLight: 0,
    counts: { S: 0, M: 0, L: 0 },
  },
};

const el = {
  pendingList: document.getElementById("pendingList"),
  pendingFull: document.getElementById("pendingFull"),
  pendingActive: document.getElementById("pendingActive"),
  commitBtn: document.getElementById("commitBtn"),

  totalSets: document.getElementById("totalSets"),
  totalUrchins: document.getElementById("totalUrchins"),
  totalLight: document.getElementById("totalLight"),
  avgPerSet: document.getElementById("avgPerSet"),

  countS: document.getElementById("countS"),
  countM: document.getElementById("countM"),
  countL: document.getElementById("countL"),
  pctS: document.getElementById("pctS"),
  pctM: document.getElementById("pctM"),
  pctL: document.getElementById("pctL"),

  resetAllBtn: document.getElementById("resetAllBtn"),
};

document.querySelectorAll(".sizeBtn").forEach(btn => {
  btn.addEventListener("click", () => addToPending(btn.dataset.size));
});
el.commitBtn.addEventListener("click", commitPending);

el.resetAllBtn.addEventListener("click", () => {
  const ok = confirm("全データ（未確定メモ＋確定済み集計）をリセットします。よろしいですか？");
  if (!ok) return;
  state.pendingSets = [];
  state.stats = {
    totalSets: 0,
    totalUrchins: 0,
    totalLight: 0,
    counts: { S: 0, M: 0, L: 0 },
  };
  saveAndRender();
});

/* helpers */
function sortItemsSML(items){
  return [...items].sort((a,b) => (ORDER[a] ?? 99) - (ORDER[b] ?? 99));
}
function calcSetLight(items){
  return items.reduce((sum, s) => sum + (SIZE_META[s]?.light ?? 0), 0);
}
function ensurePendingIndex(i){
  if (i < 0 || i >= MAX_PENDING_SETS) return null;
  if (!state.pendingSets[i]) state.pendingSets[i] = { raw: [] };
  return state.pendingSets[i];
}
function findActivePendingIndex(){
  for (let i = 0; i < MAX_PENDING_SETS; i++){
    const set = state.pendingSets[i];
    if (!set) return i;
    if (Array.isArray(set.raw) && set.raw.length < 4) return i;
  }
  return -1;
}
function countFullPending(){
  let n = 0;
  for (const s of state.pendingSets){
    if (s && Array.isArray(s.raw) && s.raw.length === 4) n++;
  }
  return n;
}
function compactPending(){
  while (state.pendingSets.length > 0){
    const last = state.pendingSets[state.pendingSets.length - 1];
    if (last && Array.isArray(last.raw) && last.raw.length === 0) state.pendingSets.pop();
    else break;
  }
}
function toNonNegInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/* actions */
function addToPending(size){
  if (!SIZE_META[size]) return;

  const idx = findActivePendingIndex();
  if (idx === -1) return; // 10セット埋まり

  const set = ensurePendingIndex(idx);
  if (!set) return;
  if (!Array.isArray(set.raw)) set.raw = [];
  if (set.raw.length >= 4) return;

  set.raw.push(size);
  saveAndRender();
}

function resetPending(i){
  const set = state.pendingSets[i];
  if (!set || !Array.isArray(set.raw) || set.raw.length === 0) return;
  set.raw = [];
  saveAndRender();
}

function commitPending(){
  const fullSets = state.pendingSets.filter(s => s && Array.isArray(s.raw) && s.raw.length === 4);
  if (fullSets.length === 0) return;

  for (const s of fullSets){
    const items = sortItemsSML(s.raw);

    state.stats.totalSets += 1;
    state.stats.totalUrchins += 4;
    state.stats.totalLight += calcSetLight(items);
    for (const v of items){
      if (state.stats.counts[v] != null) state.stats.counts[v] += 1;
    }
  }

  // 4つ揃ったセットだけ未確定から削除（未完了は残す）
  state.pendingSets = state.pendingSets.filter(s => !(s && Array.isArray(s.raw) && s.raw.length === 4));
  compactPending();
  saveAndRender();
}

/* render */
function renderPending(){
  el.pendingList.innerHTML = "";

  const activeIdx = findActivePendingIndex();
  const fullCount = countFullPending();

  el.pendingFull.textContent = String(fullCount);
  el.pendingActive.textContent = activeIdx === -1 ? "—" : String(activeIdx + 1);

  // 入力ボタン disable（10セット全部埋まってる時だけ）
  const disableInput = (activeIdx === -1);
  document.querySelectorAll(".sizeBtn").forEach(btn => (btn.disabled = disableInput));

  // commit enable（4つ揃ったセットが1つでもある）
  el.commitBtn.disabled = fullCount === 0;

  // 10セット固定表示（空も出す）
  for (let i = 0; i < MAX_PENDING_SETS; i++){
    const set = state.pendingSets[i] ?? { raw: [] };
    const raw = Array.isArray(set.raw) ? set.raw : [];
    const sorted = sortItemsSML(raw);

    const isActive = (activeIdx === i);
    const isFull = raw.length === 4;

    const card = document.createElement("div");
    card.className = "pendingRow" + (isActive ? " active" : "") + (isFull ? " full" : "");

    const header = document.createElement("div");
    header.className = "pendingHeader";
    header.innerHTML = `
      <div class="pendingName">セット ${i + 1}</div>
      <div class="pendingMeta">${raw.length}/4　|　🔥: ${calcSetLight(sorted)}</div>
    `;

    const body = document.createElement("div");
    body.className = "pendingBody";

    const slots = document.createElement("div");
    slots.className = "slots";
    for (let k = 0; k < 4; k++){
      const v = sorted[k];
      const d = document.createElement("div");
      d.className = "slot" + (v ? "" : " empty");
      d.textContent = v ? v : "–";
      slots.appendChild(d);
    }

    const resetBtn = document.createElement("button");
    resetBtn.className = "smallBtn";
    resetBtn.textContent = "リセット";
    resetBtn.disabled = raw.length === 0;
    resetBtn.addEventListener("click", () => resetPending(i));

    body.appendChild(slots);
    body.appendChild(resetBtn);

    card.appendChild(header);
    card.appendChild(body);

    el.pendingList.appendChild(card);
  }
}

function renderStats(){
  const s = state.stats;
  const totalSets = s.totalSets || 0;
  const totalUrchins = s.totalUrchins || 0;
  const totalLight = s.totalLight || 0;
  const counts = s.counts || { S:0, M:0, L:0 };

  const avgPerSet = totalSets ? Math.round((totalLight / totalSets) * 10) / 10 : 0;
  const denom = totalUrchins || 1;
  const pct = (n) => totalUrchins ? (Math.round((n / denom) * 1000) / 10) : 0;

  el.totalSets.textContent = String(totalSets);
  el.totalUrchins.textContent = String(totalUrchins);
  el.totalLight.textContent = String(totalLight);
  el.avgPerSet.textContent = String(avgPerSet);

  el.countS.textContent = String(counts.S ?? 0);
  el.countM.textContent = String(counts.M ?? 0);
  el.countL.textContent = String(counts.L ?? 0);

  el.pctS.textContent = String(pct(counts.S ?? 0));
  el.pctM.textContent = String(pct(counts.M ?? 0));
  el.pctL.textContent = String(pct(counts.L ?? 0));
}

function saveAndRender(){
  compactPending();
  saveState(state);
  renderPending();
  renderStats();
}

/* storage */
function saveState(obj){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }catch(e){
    console.warn("localStorage save failed", e);
  }
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj) return null;

    const pendingSets = Array.isArray(obj.pendingSets) ? obj.pendingSets : [];
    const safePending = pendingSets.slice(0, MAX_PENDING_SETS).map(s => {
      const arr = Array.isArray(s?.raw) ? s.raw : [];
      const clean = arr.filter(x => SIZE_META[x]).slice(0,4);
      return { raw: clean };
    });

    const statsIn = obj.stats || {};
    const countsIn = statsIn.counts || {};
    const stats = {
      totalSets: toNonNegInt(statsIn.totalSets),
      totalUrchins: toNonNegInt(statsIn.totalUrchins),
      totalLight: toNonNegInt(statsIn.totalLight),
      counts: {
        S: toNonNegInt(countsIn.S),
        M: toNonNegInt(countsIn.M),
        L: toNonNegInt(countsIn.L),
      }
    };

    return { pendingSets: safePending, stats };
  }catch(e){
    return null;
  }
}

saveAndRender();
