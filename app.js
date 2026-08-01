/* ==================== パル配合ラボ app.js (Palworld 1.0 対応版) ==================== */

const WORK_JA = {
  handiwork:'手作業', transporting:'運搬', farming:'種まき', gathering:'採集',
  kindling:'火おこし', watering:'水やり', mining:'採掘', generating_electricity:'発電',
  lumbering:'伐採', medicine_production:'製薬', cooling:'冷却', planting:'種まき'
};
const SIZE_JA = {XS:'極小', S:'小', M:'中', L:'大', XL:'特大'};

const OWNED_KEY = 'palbreed_owned_v2';

/* ---------- indices ---------- */
const palByKey = new Map(PALS.map(p => [p.key, p]));
const palList = PALS.slice().sort((a,b)=> a.dex_no - b.dex_no || (a.is_variant?1:-1) - (b.is_variant?1:-1));

/* ---------- breeding formula (Palworld 1.0 CombiRank) ---------- */
// child breeding power = floor((A+B+1)/2); result = pal whose own breeding power is closest
// (ties broken by lowest breeding_priority). This mirrors the in-game formula, so it
// automatically reflects 1.0's revised breeding order (no hardcoded pair table needed).
function childPowerFor(a, b){ return Math.floor((a.breeding_power + b.breeding_power + 1) / 2); }
function getChild(aKey, bKey){
  const a = palByKey.get(aKey), b = palByKey.get(bKey);
  if(!a || !b) return null;
  const target = childPowerFor(a, b);
  let best = null, bestDist = Infinity;
  for(const p of palList){
    const dist = Math.abs(p.breeding_power - target);
    if(dist < bestDist || (dist === bestDist && best && p.breeding_priority < best.breeding_priority)){
      bestDist = dist; best = p;
    }
  }
  return best ? best.key : null;
}

/* ---------- owned set (My図鑑) ---------- */
function loadOwned(){
  try{
    const raw = localStorage.getItem(OWNED_KEY);
    if(!raw) return new Set();
    return new Set(JSON.parse(raw));
  }catch(e){ return new Set(); }
}
function saveOwned(set){ localStorage.setItem(OWNED_KEY, JSON.stringify(Array.from(set))); }
let ownedSet = loadOwned();

/* ---------- helpers ---------- */
function hiraToKata(s){
  return s.replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function matchesQuery(pal, q){
  if(!q) return true;
  q = q.trim().toLowerCase();
  const qKata = hiraToKata(q);
  return pal.name.toLowerCase().includes(q)
    || pal.name_ja.includes(q)
    || pal.name_ja.includes(qKata)
    || pal.key.toLowerCase().includes(q);
}
function variantTag(p){ return p.is_variant ? '<span class="tag" style="border-color:var(--accent);color:var(--accent);">亜種</span>' : ''; }

/* ---- pal images (hotlinked from Palworld Fandom wiki; hidden gracefully on 404) ---- */
function palImageUrl(pal){
  return 'https://palworld.fandom.com/wiki/Special:FilePath/' + encodeURIComponent(pal.name + '.png');
}
function imgTag(pal, cls){
  return `<img src="${palImageUrl(pal)}" alt="${pal.name}" class="pal-img ${cls||''}" loading="lazy" onerror="this.style.display='none';">`;
}
function highlightNumbers(text){
  if(!text) return '';
  return text.replace(/([+\-]\s?\d+(?:\.\d+)?%?)/g, (m)=>{
    const isPlus = m.trim().startsWith('+');
    return `<span class="${isPlus ? 'num-plus' : 'num-minus'}">${m}</span>`;
  });
}

/* ---------- custom confirm modal ---------- */
const confirmBackdrop = document.getElementById('confirm-backdrop');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
function showConfirm(message, onYes){
  confirmMessage.textContent = message;
  confirmBackdrop.classList.add('open');
  const cleanup = () => {
    confirmBackdrop.classList.remove('open');
    confirmYesBtn.removeEventListener('click', yesHandler);
    confirmCancelBtn.removeEventListener('click', cancelHandler);
  };
  const yesHandler = () => { cleanup(); onYes(); };
  const cancelHandler = () => { cleanup(); };
  confirmYesBtn.addEventListener('click', yesHandler);
  confirmCancelBtn.addEventListener('click', cancelHandler);
}
confirmBackdrop.addEventListener('click', e=>{ if(e.target===confirmBackdrop) confirmBackdrop.classList.remove('open'); });

/* ==================== Tabs ==================== */
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.querySelectorAll('section.view').forEach(s=>s.classList.remove('active'));
    document.getElementById('view-'+view).classList.add('active');
  });
});

/* ==================== Modal (pal detail) ==================== */
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
function closeModal(){ modalBackdrop.classList.remove('open'); }
modalBackdrop.addEventListener('click', e=>{ if(e.target===modalBackdrop) closeModal(); });

function openPalDetail(key){
  const p = palByKey.get(key);
  if(!p) return;
  const suit = (p.suitability||[]).slice().sort((a,b)=>b.level-a.level).map(s=>`<span class="tag">${WORK_JA[s.type]||s.type} Lv${s.level}</span>`).join('') || '<span class="tag">-</span>';
  const guaranteed = (p.guaranteed_passives||[]).map(g=>`<span class="tag" style="border-color:var(--accent-2);">${g.name_ja}</span>`).join('') || '<span class="tag">なし</span>';
  const wildLevel = (p.min_wild_level!=null && p.max_wild_level!=null) ? `Lv${p.min_wild_level}〜${p.max_wild_level}` : '野生出現なし（配合/捕獲イベント等）';
  modalContent.innerHTML = `
    <button class="close-btn" onclick="closeModal()">&times;</button>
    ${imgTag(p, 'pal-img-modal')}
    <h3>${p.name_ja} ${variantTag(p)}</h3>
    <div class="en-name">${p.name} ・ No.${p.dex_no}${p.is_variant?' (亜種)':''}</div>
    <div class="stat-row">
      <div class="stat-box"><div class="v">${p.stats?.hp ?? '-'}</div><div class="l">HP</div></div>
      <div class="stat-box"><div class="v">${p.stats?.attack ?? '-'}</div><div class="l">攻撃力</div></div>
      <div class="stat-box"><div class="v">${p.stats?.defense ?? '-'}</div><div class="l">防御力</div></div>
      <div class="stat-box"><div class="v">${p.stats?.walk_speed ?? '-'}</div><div class="l">歩行速度</div></div>
      <div class="stat-box"><div class="v">${p.stats?.run_speed ?? '-'}</div><div class="l">走行速度</div></div>
      <div class="stat-box"><div class="v">${p.stats?.stamina ?? '-'}</div><div class="l">スタミナ</div></div>
    </div>
    <div class="section-label">作業適性</div>
    <div class="tag-list">${suit}</div>
    <div class="section-label">確定パッシブスキル</div>
    <div class="tag-list">${guaranteed}</div>
    <div class="section-label">配合・基礎情報</div>
    <div class="tag-list">
      <span class="tag">配合力 ${p.breeding_power}</span>
      <span class="tag">レア度 ${p.rarity ?? '-'}</span>
      <span class="tag">サイズ ${SIZE_JA[p.size]||p.size||'-'}</span>
      <span class="tag">価格 ${p.price ?? '-'}</span>
      ${p.nocturnal ? '<span class="tag">夜行性</span>' : ''}
    </div>
    <div class="section-label">野生出現レベル</div>
    <div style="font-size:12px;color:var(--ink-dim);">${wildLevel}</div>
  `;
  modalBackdrop.classList.add('open');
}
window.closeModal = closeModal;

/* ==================== 図鑑タブ ==================== */
const dexWorkFilter = document.getElementById('dex-type-filter');
Object.keys(WORK_JA).forEach(w=>{
  if(dexWorkFilter.querySelector(`option[value="${w}"]`)) return;
  const opt = document.createElement('option');
  opt.value = w; opt.textContent = WORK_JA[w];
  dexWorkFilter.appendChild(opt);
});

function renderDex(){
  const q = document.getElementById('dex-search').value;
  const workF = dexWorkFilter.value;
  const grid = document.getElementById('dex-grid');
  const filtered = palList.filter(p => matchesQuery(p,q) && (!workF || (p.suitability||[]).some(s=>s.type===workF)));
  document.getElementById('dex-count').textContent = filtered.length + ' / ' + palList.length + ' 匹';
  grid.innerHTML = filtered.map(p=>`
    <div class="pal-card" onclick="openPalDetail('${p.key}')">
      ${imgTag(p)}
      <div class="num">No.${p.dex_no}${p.is_variant?' 亜種':''}</div>
      <div class="ja">${p.name_ja}</div>
      <div class="en">${p.name}</div>
      <div class="badges"><span class="tag" style="font-size:10px;">配合力 ${p.breeding_power}</span></div>
    </div>
  `).join('');
}
document.getElementById('dex-search').addEventListener('input', renderDex);
dexWorkFilter.addEventListener('change', renderDex);

/* ==================== 汎用パルピッカー ==================== */
function createPalPicker(container, {placeholder='パル名で検索', onChange=null} = {}){
  container.innerHTML = `
    <input type="text" placeholder="${placeholder}">
    <div class="pal-dropdown" style="display:none;"></div>
    <div class="selected-pal"><span class="placeholder">未選択</span></div>
  `;
  const input = container.querySelector('input');
  const dropdown = container.querySelector('.pal-dropdown');
  const selectedBox = container.querySelector('.selected-pal');
  let value = null;

  function renderOptions(q){
    const matches = palList.filter(p=>matchesQuery(p,q)).slice(0,40);
    if(matches.length===0){ dropdown.innerHTML = '<div class="opt" style="color:var(--ink-dim)">該当なし</div>'; }
    else {
      dropdown.innerHTML = matches.map(p=>`<div class="opt" data-key="${p.key}"><span>${p.name_ja}${p.is_variant?' (亜種)':''}</span><span class="en">${p.name}</span></div>`).join('');
    }
    dropdown.style.display = 'block';
  }

  input.addEventListener('focus', ()=> renderOptions(input.value));
  input.addEventListener('input', ()=> renderOptions(input.value));
  document.addEventListener('click', (e)=>{
    if(!container.contains(e.target)) dropdown.style.display='none';
  });
  dropdown.addEventListener('click', (e)=>{
    const opt = e.target.closest('.opt');
    if(!opt || !opt.dataset.key) return;
    setValue(opt.dataset.key);
    dropdown.style.display='none';
    input.value='';
  });

  function setValue(key){
    value = key;
    const p = palByKey.get(key);
    if(p){
      selectedBox.innerHTML = `<div class="pal-chip"><span class="ja">${p.name_ja}${p.is_variant?' (亜種)':''}</span><span class="en">${p.name}</span></div>`;
    } else {
      selectedBox.innerHTML = '<span class="placeholder">未選択</span>';
    }
    if(onChange) onChange(value);
  }

  return { getValue: ()=>value, setValue };
}

/* ==================== 配合検索 ==================== */
const pickerA = createPalPicker(document.getElementById('picker-a'), {onChange: updateBreedResult});
const pickerB = createPalPicker(document.getElementById('picker-b'), {onChange: updateBreedResult});
function updateBreedResult(){
  const a = pickerA.getValue(), b = pickerB.getValue();
  const resultEl = document.getElementById('breed-result');
  if(!a || !b){ resultEl.innerHTML=''; return; }
  const childKey = getChild(a,b);
  if(!childKey){ resultEl.innerHTML = '<div class="result-card">計算できませんでした。</div>'; return; }
  const child = palByKey.get(childKey);
  resultEl.innerHTML = `
    <div class="big-arrow">↓ 生まれるパル</div>
    <div class="result-card" onclick="openPalDetail('${child.key}')" style="cursor:pointer;">
      <div>
        <div class="name-ja">${child.name_ja}${child.is_variant?' (亜種)':''}</div>
        <div class="name-en">${child.name} ・ No.${child.dex_no}</div>
      </div>
      <span class="tag">配合力 ${child.breeding_power}</span>
    </div>
  `;
}

/* ==================== 逆引き検索 ==================== */
const pickerTarget = createPalPicker(document.getElementById('picker-target'), {onChange: updateReverseResult});
function updateReverseResult(){
  const key = pickerTarget.getValue();
  const resultEl = document.getElementById('reverse-result');
  if(!key){ resultEl.innerHTML=''; return; }
  const target = palByKey.get(key);
  const pairs = [];
  for(let i=0;i<palList.length;i++){
    for(let j=i;j<palList.length;j++){
      const a = palList[i], b = palList[j];
      if(getChild(a.key, b.key) === key) pairs.push([a.key, b.key]);
    }
  }
  if(pairs.length===0){ resultEl.innerHTML = `<p style="color:var(--ink-dim);font-size:13px;">「${target.name_ja}」を生む組み合わせが見つかりませんでした（自己配合以外では作れない可能性があります）。</p>`; return; }
  resultEl.innerHTML = `<p style="font-size:12px;color:var(--ink-dim);margin-top:12px;">${pairs.length} 通りの組み合わせが見つかりました。</p><div class="pair-list">${pairs.map(([a,b])=>{
    const pa = palByKey.get(a), pb = palByKey.get(b);
    return `<div class="pair-item"><span>${pa.name_ja}</span><span class="plus">×</span><span>${pb.name_ja}</span></div>`;
  }).join('')}</div>`;
}

/* ==================== 継承ルート（スキル継承探索） ==================== */
const pickerRouteStart = createPalPicker(document.getElementById('picker-route-start'), {placeholder: '例: レイバーン'});
const pickerRouteIntermediate = createPalPicker(document.getElementById('picker-route-intermediate'), {placeholder: '例: アヌビス (任意)'});
const pickerRouteTarget = createPalPicker(document.getElementById('picker-route-target'), {placeholder: '例: モコロン'});

let breedGraph = null;
function getBreedGraph() {
  if (breedGraph) return breedGraph;
  breedGraph = new Map();
  for (const p of palList) breedGraph.set(p.key, new Map());
  
  for (let i = 0; i < palList.length; i++) {
    for (let j = 0; j < palList.length; j++) {
      const a = palList[i].key, b = palList[j].key;
      const c = getChild(a, b);
      if (c) {
        if (!breedGraph.get(a).has(c)) breedGraph.get(a).set(c, []);
        breedGraph.get(a).get(c).push(b);
      }
    }
  }
  return breedGraph;
}

function findShortestPaths(start, target) {
  if (start === target) return [[start]];
  const graph = getBreedGraph();
  let queue = [[start]];
  let visited = new Map();
  visited.set(start, 0);
  
  let foundPaths = [];
  let currentDepth = 0;
  
  while (queue.length > 0 && currentDepth < 6) {
    let nextQueue = [];
    currentDepth++;
    
    for (const path of queue) {
      const current = path[path.length - 1];
      const edges = graph.get(current);
      if (!edges) continue;
      
      for (const next of edges.keys()) {
        if (visited.has(next) && visited.get(next) < currentDepth) continue;
        visited.set(next, currentDepth);
        
        const newPath = [...path, next];
        if (next === target) {
          foundPaths.push(newPath);
        } else {
          nextQueue.push(newPath);
        }
      }
    }
    if (foundPaths.length > 0) break;
    if (nextQueue.length > 10000) nextQueue = nextQueue.slice(0, 10000);
    queue = nextQueue;
  }
  return foundPaths;
}

function findInheritanceRoutes(start, target, intermediate) {
  if (!intermediate) {
    return findShortestPaths(start, target);
  } else {
    const p1 = findShortestPaths(start, intermediate);
    if (p1.length === 0) return [];
    const p2 = findShortestPaths(intermediate, target);
    if (p2.length === 0) return [];
    
    const combined = [];
    for (const a of p1) {
      for (const b of p2) {
        combined.push([...a, ...b.slice(1)]);
        if (combined.length > 1000) break;
      }
      if (combined.length > 1000) break;
    }
    return combined;
  }
}

window.openRouteStepDetail = function(aKey, cKey) {
  const graph = getBreedGraph();
  const partners = graph.get(aKey).get(cKey) || [];
  const pa = palByKey.get(aKey);
  const pc = palByKey.get(cKey);
  
  const uniqueKeys = [...new Set(partners)];
  const gridHtml = uniqueKeys.map(k => {
    const p = palByKey.get(k);
    return `
      <div class="pal-card" style="padding:8px;" onclick="openPalDetail('${k}')">
        ${imgTag(p)}
        <div class="num" style="font-size:10px;">No.${p.dex_no}${p.is_variant?' 亜種':''}</div>
        <div class="ja" style="font-size:13px; font-weight:bold;">${p.name_ja}</div>
      </div>
    `;
  }).join('');

  modalContent.innerHTML = `
    <button class="close-btn" onclick="closeModal()">&times;</button>
    <h3 style="font-size:18px; margin-bottom:12px;">Step 詳細</h3>
    <div style="display:flex; align-items:center; gap:8px; font-size:14px; margin-bottom:16px; flex-wrap:wrap; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
      <span style="font-weight:bold;">${pa.name_ja}</span>
      <span style="color:var(--ink-dim);">＋</span>
      <span style="color:var(--accent);">（以下のうちいずれか）</span>
      <span style="color:var(--ink-dim);">＝</span>
      <span style="font-weight:bold; color:var(--accent-2);">${pc.name_ja}</span>
    </div>
    <div class="pal-grid" style="grid-template-columns:repeat(auto-fill, minmax(110px,1fr)); max-height: 50vh; overflow-y:auto; padding-right:4px;">
      ${gridHtml}
    </div>
  `;
  modalBackdrop.classList.add('open');
};

function renderRouteList(routeArrays, graph, startIndex = 0) {
  return routeArrays.map((route, idx) => {
    let routeHtml = `<div class="route-step" style="flex-direction:column; align-items:stretch; gap:6px;">`;
    routeHtml += `<div style="font-size:11px; color:var(--accent); font-weight:bold;">ルート ${startIndex + idx + 1}</div>`;
    
    for (let j = 0; j < route.length - 1; j++) {
      const a = route[j];
      const c = route[j+1];
      const partners = graph.get(a).get(c);
      
      const pa = palByKey.get(a);
      const pc = palByKey.get(c);
      
      const partnerNames = partners.map(pk => palByKey.get(pk).name_ja);
      const uniquePartners = [...new Set(partnerNames)];
      let partnerStr = '';
      if (uniquePartners.length <= 4) {
         partnerStr = uniquePartners.join('、');
      } else {
         partnerStr = uniquePartners.slice(0, 3).join('、') + ` など他${uniquePartners.length - 3}種`;
      }
      
      routeHtml += `
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; flex-wrap:wrap; background:rgba(0,0,0,0.15); padding:8px 12px; border-radius:6px; line-height:1.4; cursor:pointer;" onclick="openRouteStepDetail('${a}', '${c}')" title="クリックでパートナー詳細を確認">
          <span class="gen-badge">Step ${j+1}</span>
          <span style="font-weight:bold;">${pa.name_ja}</span>
          <span class="plus">＋</span>
          <span style="color:var(--ink-dim);">(${partnerStr})</span>
          <span style="margin:0 4px;">＝</span>
          <span style="color:var(--accent-2); font-weight:bold;">${pc.name_ja}</span>
        </div>
      `;
    }
    routeHtml += `</div>`;
    return routeHtml;
  }).join('');
}

document.getElementById('route-run-btn')?.addEventListener('click', ()=>{
  const startKey = pickerRouteStart.getValue();
  const intKey = pickerRouteIntermediate.getValue();
  const targetKey = pickerRouteTarget.getValue();
  const resultEl = document.getElementById('route-result');
  
  if(!startKey || !targetKey){
    resultEl.innerHTML = '<p style="color:var(--danger);font-size:13px;margin-top:14px;">起点パルと目標パルは両方指定してください。</p>';
    return;
  }
  if(startKey === targetKey){
    resultEl.innerHTML = '<p style="color:var(--danger);font-size:13px;margin-top:14px;">起点と目標が同じパルです。</p>';
    return;
  }
  
  resultEl.innerHTML = '<p style="color:var(--ink-dim);font-size:13px;margin-top:14px;">経路を探索中...</p>';
  
  setTimeout(() => {
    const routes = findInheritanceRoutes(startKey, targetKey, intKey);
    if(routes.length === 0){
       resultEl.innerHTML = `<p style="color:var(--danger);font-size:13px;margin-top:14px;">指定された条件での配合ルートが見つかりませんでした。</p>`;
       return;
    }
    
    const graph = getBreedGraph();
    let html = `<div style="margin-top:16px;">`;
    html += `<p style="font-size:13px;color:var(--ink);margin-bottom:12px;"><b>${routes.length}</b> 通りの最短ルートが見つかりました。</p>`;
    
    const displayLimit = 5;
    const toDisplay = routes.slice(0, displayLimit);
    html += renderRouteList(toDisplay, graph, 0);
    
    if (routes.length > displayLimit) {
      const remaining = routes.length - displayLimit;
      html += `
        <div id="route-more-container">
          <button class="btn secondary" id="route-show-more-btn" style="width:100%; margin-top:8px;">その他 ${remaining} 通りのルートを見る</button>
        </div>
        <div id="route-more-list" style="display:none; margin-top:8px;">
          ${renderRouteList(routes.slice(displayLimit), graph, displayLimit)}
        </div>
      `;
    }
    html += `</div>`;
    resultEl.innerHTML = html;
    
    document.getElementById('route-show-more-btn')?.addEventListener('click', (e) => {
      document.getElementById('route-more-list').style.display = 'block';
      e.target.parentNode.style.display = 'none';
    });
  }, 10);
});

/* ==================== スキル検索 ==================== */
function categorize(sk){
  const text = sk.description || '';
  const cats = [];
  if(/movement speed/i.test(text)) cats.push('move_speed');
  if(/player.*work speed/i.test(text)) cats.push('player_work_speed');
  else if(/work speed/i.test(text)) cats.push('work_speed_pal');
  if(/player.*attack/i.test(text)) cats.push('player_attack');
  else if(/attack (damage )?[+\-]/i.test(text) || /^attack/i.test(text)) cats.push('attack_pal');
  if(/player.*defense/i.test(text)) cats.push('player_defense');
  else if(/defense/i.test(text)) cats.push('defense_pal');
  if(/(fire|water|electric|ice|grass|ground|dark|dragon|neutral).*(attack|damage)/i.test(text)) cats.push('elemental_attack');
  if(/incoming.*damage|damage taken/i.test(text)) cats.push('elemental_resist');
  if(/hunger|full stomach/i.test(text)) cats.push('hunger');
  if(/san\b/i.test(text)) cats.push('san');
  if(/mining/i.test(text)) cats.push('mining');
  if(/logging|lumbering/i.test(text)) cats.push('logging');
  if(cats.length===0) cats.push('other');
  return cats;
}
const SKILL_CATS = [
  {key:'all', label:'すべて'},
  {key:'move_speed', label:'移動速度上昇'},
  {key:'attack_pal', label:'攻撃力上昇（パル）'},
  {key:'player_attack', label:'攻撃力上昇（プレイヤー）'},
  {key:'work_speed_pal', label:'作業効率上昇（パル）'},
  {key:'player_work_speed', label:'作業効率上昇（プレイヤー）'},
  {key:'defense_pal', label:'防御力'},
  {key:'player_defense', label:'防御力（プレイヤー）'},
  {key:'elemental_attack', label:'属性攻撃強化'},
  {key:'elemental_resist', label:'被ダメージ軽減'},
  {key:'hunger', label:'満腹度関連'},
  {key:'san', label:'SAN値関連'},
  {key:'mining', label:'採掘効率'},
  {key:'logging', label:'伐採効率'},
  {key:'other', label:'その他'},
];
const RANK_BUCKETS = [
  {key:'5', label:'Rank5（虹）'},
  {key:'4', label:'Rank4（緑）'},
  {key:'3', label:'Rank3（黄）'},
  {key:'2', label:'Rank2（黄）'},
  {key:'1', label:'Rank1（白）'},
  {key:'neg', label:'Rank-1以下（赤）'},
];
function rankBucket(rank){ return rank >= 1 ? String(rank) : 'neg'; }
function rankClass(rank){ return 'rank-' + rankBucket(rank); }

const skillsWithCats = PASSIVES.map(s => ({...s, cats: categorize(s)}));
// exclude the meta "すべて" pseudo-category from real category list when building checkboxes
const REAL_CATS = SKILL_CATS.filter(c => c.key !== 'all');

let activeCats = new Set(REAL_CATS.map(c => c.key));
let activeRanks = new Set(RANK_BUCKETS.map(r => r.key));

function renderChkGroup(container, items, activeSet, countFn, onToggle){
  container.innerHTML = items.map(it=>{
    const count = countFn(it.key);
    const checked = activeSet.has(it.key);
    return `<label class="chk-pill ${checked?'checked':''}" data-key="${it.key}">
      <input type="checkbox" ${checked?'checked':''}>
      <span>${it.label} (${count})</span>
    </label>`;
  }).join('');
  container.querySelectorAll('.chk-pill').forEach(pill=>{
    pill.addEventListener('click', (e)=>{
      e.preventDefault();
      const key = pill.dataset.key;
      if(activeSet.has(key)) activeSet.delete(key); else activeSet.add(key);
      onToggle();
    });
  });
}

function refreshSkillFilters(){
  renderChkGroup(
    document.getElementById('skill-cats'), REAL_CATS, activeCats,
    (key)=> skillsWithCats.filter(s=>s.cats.includes(key)).length,
    ()=>{ refreshSkillFilters(); renderSkillTable(); }
  );
  renderChkGroup(
    document.getElementById('skill-ranks'), RANK_BUCKETS, activeRanks,
    (key)=> skillsWithCats.filter(s=>rankBucket(s.rank)===key).length,
    ()=>{ refreshSkillFilters(); renderSkillTable(); }
  );
}
document.getElementById('cat-all-btn').addEventListener('click', ()=>{ activeCats = new Set(REAL_CATS.map(c=>c.key)); refreshSkillFilters(); renderSkillTable(); });
document.getElementById('cat-none-btn').addEventListener('click', ()=>{ activeCats = new Set(); refreshSkillFilters(); renderSkillTable(); });
document.getElementById('rank-all-btn').addEventListener('click', ()=>{ activeRanks = new Set(RANK_BUCKETS.map(r=>r.key)); refreshSkillFilters(); renderSkillTable(); });
document.getElementById('rank-none-btn').addEventListener('click', ()=>{ activeRanks = new Set(); refreshSkillFilters(); renderSkillTable(); });

function renderSkillTable(){
  const list = skillsWithCats.filter(s =>
    s.cats.some(c => activeCats.has(c)) && activeRanks.has(rankBucket(s.rank))
  );
  const sorted = list.slice().sort((a,b)=> b.rank - a.rank);
  document.getElementById('skill-table').innerHTML = sorted.length ? sorted.map(s=>`
    <div class="skill-row-card ${rankClass(s.rank)}">
      <div class="names"><span class="ja">${s.name_ja}</span><span class="en">${s.name}</span></div>
      <div class="skill-effects">${highlightNumbers(s.description_ja || s.description || '')}</div>
      <span class="tier-pip ${rankClass(s.rank)}">Rank ${s.rank}</span>
    </div>
  `).join('') : '<p style="color:var(--ink-dim);font-size:13px;">条件に一致するスキルがありません。</p>';
}

/* ==================== My図鑑 ==================== */
function renderMydexGrid(){
  const q = document.getElementById('mydex-search').value;
  const grid = document.getElementById('mydex-grid');
  const filtered = palList.filter(p=>matchesQuery(p,q));
  grid.innerHTML = filtered.map(p=>`
    <div class="pal-card ownable" data-key="${p.key}">
      <input type="checkbox" class="owned-check" ${ownedSet.has(p.key)?'checked':''}>
      <div class="num">No.${p.dex_no}${p.is_variant?' 亜種':''}</div>
      <div class="ja">${p.name_ja}</div>
      <div class="en">${p.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.pal-card').forEach(card=>{
    const key = card.dataset.key;
    const check = card.querySelector('.owned-check');
    check.addEventListener('click', e=>e.stopPropagation());
    check.addEventListener('change', ()=>{
      if(check.checked) ownedSet.add(key); else ownedSet.delete(key);
      saveOwned(ownedSet);
      updateMydexSummary();
    });
    card.addEventListener('click', (e)=>{
      if(e.target.classList.contains('owned-check')) return;
      openPalDetail(key);
    });
  });
}
document.getElementById('mydex-search').addEventListener('input', renderMydexGrid);
document.getElementById('mydex-clear-btn').addEventListener('click', ()=>{
  showConfirm('My図鑑の所持パルを全て解除します。よろしいですか？', ()=>{
    ownedSet = new Set();
    saveOwned(ownedSet);
    renderMydexGrid();
    updateMydexSummary();
    renderDiscover();
  });
});

/* ---------- CSV export / import ---------- */
function csvEscape(s){
  s = String(s ?? '');
  if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}
document.getElementById('mydex-export-btn').addEventListener('click', ()=>{
  const rows = [['key','name','name_ja','owned']];
  palList.forEach(p=>{
    if(ownedSet.has(p.key)) rows.push([p.key, p.name, p.name_ja, '1']);
  });
  const csv = '\uFEFF' + rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `my-zukan_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('mydex-import-btn').addEventListener('click', ()=>{
  document.getElementById('mydex-import-file').click();
});
document.getElementById('mydex-import-file').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const text = String(reader.result).replace(/^\uFEFF/, '');
      const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
      if(lines.length === 0) throw new Error('empty');
      const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const keyIdx = header.indexOf('key');
      const ownedIdx = header.indexOf('owned');
      const startRow = keyIdx === -1 ? 0 : 1;
      const keyCol = keyIdx === -1 ? 0 : keyIdx;
      const imported = new Set();
      for(let i=startRow;i<lines.length;i++){
        const cols = lines[i].split(',').map(c=>c.trim().replace(/^"|"$/g,''));
        const key = cols[keyCol];
        if(!key || !palByKey.has(key)) continue;
        if(ownedIdx !== -1){
          if(cols[ownedIdx] === '1' || cols[ownedIdx].toLowerCase()==='true') imported.add(key);
        } else {
          imported.add(key);
        }
      }
      if(imported.size === 0){
        showConfirm('CSVから有効なパルが見つかりませんでした。ファイル形式をご確認ください。', ()=>{});
        return;
      }
      showConfirm(`CSVから ${imported.size} 匹の所持パルを読み込みます。現在のMy図鑑を上書きします。よろしいですか？`, ()=>{
        ownedSet = imported;
        saveOwned(ownedSet);
        renderMydexGrid();
        updateMydexSummary();
      });
    }catch(err){
      showConfirm('CSVの読み込みに失敗しました。ファイル形式をご確認ください。', ()=>{});
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file, 'UTF-8');
});

function updateMydexSummary(){ document.getElementById('owned-count').textContent = ownedSet.size; }

function renderDiscover(){
  const grid = document.getElementById('discover-grid');
  const owned = Array.from(ownedSet);
  if(owned.length===0){
    grid.innerHTML = '<p style="color:var(--ink-dim);font-size:13px;">My図鑑にパルを登録すると、配合で作れる未所持パルがここに表示されます。</p>';
    document.getElementById('discover-count').textContent = '0';
    return;
  }
  const foundMap = new Map();
  for(let i=0;i<owned.length;i++){
    for(let j=i;j<owned.length;j++){
      const a=owned[i], b=owned[j];
      const child = getChild(a,b);
      if(child && !ownedSet.has(child)){
        if(!foundMap.has(child)) foundMap.set(child, []);
        foundMap.get(child).push([a,b]);
      }
    }
  }
  document.getElementById('discover-count').textContent = foundMap.size;
  if(foundMap.size===0){
    grid.innerHTML = '<p style="color:var(--ink-dim);font-size:13px;">現在の手持ちの組み合わせだけでは、新しい未所持パルは作れません。</p>';
    return;
  }
  const entries = Array.from(foundMap.entries()).sort((a,b)=> palByKey.get(a[0]).dex_no - palByKey.get(b[0]).dex_no);
  grid.innerHTML = entries.map(([childKey, pairs])=>{
    const child = palByKey.get(childKey);
    const viaLines = pairs.slice(0,3).map(([a,b])=>{
      const pa=palByKey.get(a), pb=palByKey.get(b);
      return `<div><b>${pa.name_ja}</b> × <b>${pb.name_ja}</b></div>`;
    }).join('');
    const more = pairs.length>3 ? `<div>他 ${pairs.length-3} 通り</div>` : '';
    return `
      <div class="discover-card" onclick="openPalDetail('${childKey}')" style="cursor:pointer;">
        <div class="target">${child.name_ja}</div>
        <div class="en" style="color:var(--ink-dim);font-size:11px;">${child.name}</div>
        <div class="via">${viaLines}${more}</div>
      </div>
    `;
  }).join('');
}

/* ==================== init ==================== */
renderDex();
refreshSkillFilters();
renderSkillTable();
renderMydexGrid();
updateMydexSummary();
renderDiscover();

const versionTag = document.getElementById('data-version-tag');
if(versionTag) versionTag.textContent = DATA_VERSION;

/* ==================== Service worker (PWA offline) ==================== */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
