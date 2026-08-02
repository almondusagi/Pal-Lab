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
// (ties broken by HIGHEST breeding_priority). This mirrors the in-game formula, so it
// automatically reflects 1.0's revised breeding order (no hardcoded pair table needed).
//
// NOTE on tie-break direction (fixed 2026-08): breeding_priority is normally just
// breeding_power * 100 for ordinary pals, but locked/special variants (Noct/Cryst/Ignis/
// Terra/Lux/Botan forms obtained via fixed pairs) have deliberately tiny override values
// (e.g. 572-577) so they lose ties against ordinary pals and aren't produced by the plain
// averaging formula. Picking the LOWER priority on a tie (the old behavior) had it backwards:
// it let those locked variants win ties they shouldn't, and on ordinary-vs-ordinary ties it
// rounded the wrong direction. Confirmed against a real in-game result: パチマル(2360) x
// モコロン(3050) -> target 2705, tied between ラヴィ(2700) and ツノガミ(2710) at distance 5;
// the game produces ツノガミ, i.e. the HIGHER breeding_priority/power wins the tie.
function childPowerFor(a, b){ return Math.floor((a.breeding_power + b.breeding_power + 1) / 2); }
function specialComboKey(aKey, bKey){
  return aKey < bKey ? (aKey + '|' + bKey) : (bKey + '|' + aKey);
}
function getChild(aKey, bKey){
  const a = palByKey.get(aKey), b = palByKey.get(bKey);
  if(!a || !b) return null;
  // Fixed/special combinations (fusion variants, Anubis, Grizzbolt, etc.) always override
  // the averaging formula in-game. Check that table first.
  const special = SPECIAL_COMBOS[specialComboKey(aKey, bKey)];
  if(special) return special;
  const target = childPowerFor(a, b);
  let best = null, bestDist = Infinity;
  for(const p of palList){
    const dist = Math.abs(p.breeding_power - target);
    if(dist < bestDist || (dist === bestDist && best && p.breeding_priority > best.breeding_priority)){
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

/* ---------- 図鑑シークレット設定（未所持パルの外見・名前を隠す） ---------- */
const SECRET_APPEARANCE_KEY = 'palbreed_secret_appearance_v1';
const SECRET_NAME_KEY = 'palbreed_secret_name_v1';
function loadBoolSetting(key, defaultVal){
  const raw = localStorage.getItem(key);
  if(raw === null) return defaultVal;
  return raw === '1';
}
function saveBoolSetting(key, val){ localStorage.setItem(key, val ? '1' : '0'); }
// デフォルトは両方とも「隠す」＝true
let secretAppearance = loadBoolSetting(SECRET_APPEARANCE_KEY, true);
let secretName = loadBoolSetting(SECRET_NAME_KEY, true);
function isPalSecret(p){ return !ownedSet.has(p.key); }

/* My図鑑グリッド自体でも、まだチェックしていないパルの名前を隠せるようにする（ネタバレ防止） */
const MYDEX_SECRET_NAME_KEY = 'palbreed_mydex_secret_name_v1';
let mydexSecretName = loadBoolSetting(MYDEX_SECRET_NAME_KEY, true);

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
function silhouetteTag(cls){
  return `<div class="pal-img pal-img-secret ${cls||''}"><span class="secret-mark">？</span></div>`;
}
// 未所持パルは「外見を隠す」「名前を隠す」のチェック状況に応じて画像/名前を伏せて表示する。
// My図鑑（ownedSet）に登録済みのパルは常にそのまま表示。
function dexImgTag(pal, cls){
  if(isPalSecret(pal) && secretAppearance) return silhouetteTag(cls);
  return imgTag(pal, cls);
}
function dexDisplayName(pal){
  if(isPalSecret(pal) && secretName) return '？？？？？';
  return pal.name_ja;
}
function dexDisplayNameEn(pal){
  if(isPalSecret(pal) && secretName) return '?????';
  return pal.name;
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
    if(view === 'dex') renderDex();
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
  const secret = isPalSecret(p);
  const maskImg = secret && secretAppearance;
  const maskName = secret && secretName;
  const suit = (p.suitability||[]).slice().sort((a,b)=>b.level-a.level).map(s=>`<span class="tag">${WORK_JA[s.type]||s.type} Lv${s.level}</span>`).join('') || '<span class="tag">-</span>';
  const guaranteed = (p.guaranteed_passives||[]).map(g=>`<span class="tag" style="border-color:var(--accent-2);">${g.name_ja}</span>`).join('') || '<span class="tag">なし</span>';
  const wildLevel = (p.min_wild_level!=null && p.max_wild_level!=null) ? `Lv${p.min_wild_level}〜${p.max_wild_level}` : '野生出現なし（配合/捕獲イベント等）';
  modalContent.innerHTML = `
    <button class="close-btn" onclick="closeModal()">&times;</button>
    ${maskImg ? silhouetteTag('pal-img-modal') : imgTag(p, 'pal-img-modal')}
    <h3>${dexDisplayName(p)} ${maskName ? '' : variantTag(p)}</h3>
    <div class="en-name">${dexDisplayNameEn(p)} ・ No.${p.dex_no}${p.is_variant?' (亜種)':''}</div>
    ${secret ? `<div class="secret-banner">🔒 未所持パルです。My図鑑にチェックを入れると外見・名前が表示されます。</div>` : ''}
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
  grid.innerHTML = filtered.map(p=>{
    const secret = isPalSecret(p);
    const showPower = !(secret && secretName); // 配合力も名前と一緒に伏せる（数値から推測されるのを防ぐ）
    return `
    <div class="pal-card ${secret ? 'is-secret' : ''}" onclick="openPalDetail('${p.key}')">
      ${dexImgTag(p)}
      <div class="num">No.${p.dex_no}${p.is_variant?' 亜種':''}</div>
      <div class="ja">${dexDisplayName(p)}</div>
      <div class="en">${dexDisplayNameEn(p)}</div>
      <div class="badges"><span class="tag" style="font-size:10px;">配合力 ${showPower ? p.breeding_power : '???'}</span></div>
    </div>
  `;
  }).join('');
}
document.getElementById('dex-search').addEventListener('input', renderDex);
dexWorkFilter.addEventListener('change', renderDex);

const dexSecretAppearanceChk = document.getElementById('dex-secret-appearance');
const dexSecretNameChk = document.getElementById('dex-secret-name');
if(dexSecretAppearanceChk){
  dexSecretAppearanceChk.checked = secretAppearance;
  dexSecretAppearanceChk.addEventListener('change', ()=>{
    secretAppearance = dexSecretAppearanceChk.checked;
    saveBoolSetting(SECRET_APPEARANCE_KEY, secretAppearance);
    renderDex();
  });
}
if(dexSecretNameChk){
  dexSecretNameChk.checked = secretName;
  dexSecretNameChk.addEventListener('change', ()=>{
    secretName = dexSecretNameChk.checked;
    saveBoolSetting(SECRET_NAME_KEY, secretName);
    renderDex();
  });
}

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

/* ==================== 汎用パル複数選択ピッカー（リスト追加式） ==================== */
function createPalMultiPicker(container, {placeholder='パル名で検索', maxItems=6, onChange=null} = {}){
  container.innerHTML = `
    <input type="text" placeholder="${placeholder}">
    <div class="pal-dropdown" style="display:none;"></div>
    <div class="multi-chip-list"><span class="placeholder">未選択</span></div>
  `;
  const input = container.querySelector('input');
  const dropdown = container.querySelector('.pal-dropdown');
  const chipList = container.querySelector('.multi-chip-list');
  let values = [];

  function renderOptions(q){
    const matches = palList.filter(p=>matchesQuery(p,q) && !values.includes(p.key)).slice(0,40);
    if(matches.length===0){ dropdown.innerHTML = '<div class="opt" style="color:var(--ink-dim)">該当なし</div>'; }
    else {
      dropdown.innerHTML = matches.map(p=>`<div class="opt" data-key="${p.key}"><span>${p.name_ja}${p.is_variant?' (亜種)':''}</span><span class="en">${p.name}</span></div>`).join('');
    }
    dropdown.style.display = 'block';
  }

  function renderChips(){
    if(values.length===0){
      chipList.innerHTML = '<span class="placeholder">未選択</span>';
      return;
    }
    chipList.innerHTML = values.map(key=>{
      const p = palByKey.get(key);
      if(!p) return '';
      return `
        <div class="multi-chip" data-key="${key}">
          <span class="ja">${p.name_ja}${p.is_variant?' (亜種)':''}</span>
          <button type="button" class="chip-remove" data-key="${key}" title="削除">&times;</button>
        </div>
      `;
    }).join('');
    chipList.querySelectorAll('.chip-remove').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        values = values.filter(k=>k!==btn.dataset.key);
        renderChips();
        if(onChange) onChange(values.slice());
      });
    });
  }

  input.addEventListener('focus', ()=> renderOptions(input.value));
  input.addEventListener('input', ()=> renderOptions(input.value));
  document.addEventListener('click', (e)=>{
    if(!container.contains(e.target)) dropdown.style.display='none';
  });
  dropdown.addEventListener('click', (e)=>{
    const opt = e.target.closest('.opt');
    if(!opt || !opt.dataset.key) return;
    if(values.length >= maxItems){
      dropdown.style.display='none';
      input.value='';
      showConfirm(`一度に指定できるのは最大${maxItems}匹までです。`, ()=>{});
      return;
    }
    if(!values.includes(opt.dataset.key)){
      values.push(opt.dataset.key);
      renderChips();
      if(onChange) onChange(values.slice());
    }
    dropdown.style.display='none';
    input.value='';
  });

  renderChips();
  return { getValues: ()=>values.slice(), clear: ()=>{ values=[]; renderChips(); } };
}

/* ==================== 配合検索 ==================== */
const pickerA = createPalPicker(document.getElementById('picker-a'), {onChange: updateBreedResult});
const pickerB = createPalPicker(document.getElementById('picker-b'), {onChange: updateBreedResult});

function renderSinglePartnerCombos(fixedKey, label){
  const fixed = palByKey.get(fixedKey);
  const resultEl = document.getElementById('breed-result');
  const rows = palList.map(partner=>{
    const childKey = getChild(fixedKey, partner.key);
    return { partner, child: palByKey.get(childKey) };
  });

  const PAGE_SIZE = 50;
  const first = rows.slice(0, PAGE_SIZE);
  const rest = rows.slice(PAGE_SIZE);

  const rowHtml = (r)=>`
    <div class="pair-item" onclick="openPalDetail('${r.child.key}')" style="cursor:pointer;">
      <span>${fixed.name_ja}</span><span class="plus">+</span><span>${r.partner.name_ja}</span>
      <span class="plus">=</span><b>${r.child.name_ja}${r.child.is_variant?'(亜種)':''}</b>
    </div>
  `;

  let html = `
    <p style="font-size:13px;color:var(--ink);margin:16px 0 12px;">
      <b>${fixed.name_ja}</b> と ${label} を組み合わせた場合の全 <b>${rows.length}</b> 通りです（もう一方の親パルも指定すると、その組み合わせだけの結果に絞り込まれます）。
    </p>
    <div class="pair-list" id="breed-combo-list-first">${first.map(rowHtml).join('')}</div>
  `;
  if(rest.length){
    html += `
      <div id="breed-combo-more-container">
        <button class="btn secondary" id="breed-combo-show-more-btn" style="width:100%; margin-top:8px;">さらに表示（残り ${rest.length} 通り）</button>
      </div>
      <div class="pair-list" id="breed-combo-list-rest" style="display:none; margin-top:8px;">${rest.map(rowHtml).join('')}</div>
    `;
  }
  html += `
    <div style="text-align:right;margin-top:16px;">
      <a href="javascript:void(0)" onclick="document.getElementById('view-breed').scrollIntoView({behavior:'smooth', block:'start'})" style="font-size:13px;color:var(--accent);text-decoration:none;">↑ 画面上部に戻る</a>
    </div>
  `;
  resultEl.innerHTML = html;
  document.getElementById('breed-combo-show-more-btn')?.addEventListener('click', (e)=>{
    document.getElementById('breed-combo-list-rest').style.display = 'block';
    e.target.parentNode.style.display = 'none';
  });
}

function updateBreedResult(){
  const a = pickerA.getValue(), b = pickerB.getValue();
  const resultEl = document.getElementById('breed-result');
  if(!a && !b){ resultEl.innerHTML=''; return; }
  if(a && !b){ renderSinglePartnerCombos(a, '手持ちの全パル'); return; }
  if(!a && b){ renderSinglePartnerCombos(b, '手持ちの全パル'); return; }
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

/* ==================== 継承ルート（複数起点・複数目標 スキル継承探索） ==================== */
const multiPickerRouteStart = createPalMultiPicker(document.getElementById('picker-route-start'), {placeholder: '例: レイバーン（追加でリストに入ります）', maxItems: 5});
const multiPickerRouteTarget = createPalMultiPicker(document.getElementById('picker-route-target'), {placeholder: '例: モコロン（追加でリストに入ります）', maxItems: 5});

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

/**
 * 複数の起点パル（すべてメインの血統に直接パートナーとして合流させる）から出発し、
 * 複数の目標パル（すべて経由して生み出す）を満たす最短の「一本道」配合ルートを探索する。
 * 状態 = (現在のパル, 合流済み起点ビットマスク, 到達済み目標ビットマスク)
 * 起点・目標ともに順不同で構わないが、単一のメイン血統のみを辿る前提（ツリー分岐なし）。
 */
function findMultiInheritanceRoutes(startKeys, targetKeys) {
  const graph = getBreedGraph();
  const S = startKeys.length;
  const T = targetKeys.length;
  const startIndex = new Map(startKeys.map((k,i)=>[k,i]));
  const targetIndex = new Map(targetKeys.map((k,i)=>[k,i]));
  const fullSMask = S>0 ? ((1<<S)-1) : 0;
  const fullTMask = T>0 ? ((1<<T)-1) : 0;

  function initialMasks(key){
    let sMask=0;
    if(startIndex.has(key)) sMask |= (1 << startIndex.get(key));
    // 目標パルとしてカウントされるのは「起点パル全員が合流し終えたあと」のみ。
    // (単一起点でその起点自体が目標でもある、というごく特殊なケースのみここで即座に成立しうる)
    let tMask=0;
    if(sMask === fullSMask && targetIndex.has(key)) tMask |= (1 << targetIndex.get(key));
    return [sMask, tMask];
  }

  const visited = new Map(); // `${cur}#${sMask}#${tMask}` -> depth found
  let queue = [];
  let results = [];

  for(const s of startKeys){
    const [sMask, tMask] = initialMasks(s);
    const stateKey = `${s}#${sMask}#${tMask}`;
    if(visited.has(stateKey)) continue;
    visited.set(stateKey, 0);
    const path = [{ pal:s, viaPartner:null }];
    if(sMask===fullSMask && tMask===fullTMask){
      results.push(path);
    } else {
      queue.push({ cur:s, sMask, tMask, path });
    }
  }
  if(results.length>0) return { routes: results, timedOut:false };

  const MAX_DEPTH = 16;
  const MAX_RESULTS = 300;
  const MAX_QUEUE = 40000;
  const TIME_LIMIT_MS = 8000;
  const startTime = Date.now();
  let depth = 0;
  let timedOut = false;

  while (queue.length > 0 && depth < MAX_DEPTH && results.length === 0) {
    depth++;
    const nextQueue = [];
    for (const state of queue) {
      if (Date.now() - startTime > TIME_LIMIT_MS) { timedOut = true; break; }
      const edges = graph.get(state.cur);
      if (!edges) continue;

      for (const [childKey, partners] of edges.entries()) {
        // このエッジ（state.cur → childKey）を成立させるパートナー候補の中に、
        // 「未合流の起点パル」が含まれていれば、それを使う分岐を追加する。
        const unclaimedStarts = [];
        let hasNonClaimingPartner = false;
        for (const pk of partners) {
          if (startIndex.has(pk) && !(state.sMask & (1 << startIndex.get(pk)))) {
            unclaimedStarts.push(pk);
          } else {
            hasNonClaimingPartner = true;
          }
        }
        const options = [];
        if (hasNonClaimingPartner) options.push(null);
        for (const u of unclaimedStarts) options.push(u);
        if (options.length === 0) continue;

        for (const opt of options) {
          const newSMask = opt ? (state.sMask | (1 << startIndex.get(opt))) : state.sMask;
          // 起点パル全員が合流し終えている（newSMask === fullSMask）場合のみ、
          // このステップで生まれた子パルを目標パルとしてカウントする。
          // まだ合流していない起点が残っている段階でたまたま目標パルと同じ個体が
          // 生まれても、その時点ではスキルを全て継承できていないためカウントしない。
          const newTMask = (newSMask === fullSMask && targetIndex.has(childKey))
            ? (state.tMask | (1 << targetIndex.get(childKey)))
            : state.tMask;
          const stateKey = `${childKey}#${newSMask}#${newTMask}`;
          if (visited.has(stateKey)) continue;
          visited.set(stateKey, depth);

          const newPath = [...state.path, { pal: childKey, viaPartner: opt }];
          if (newSMask === fullSMask && newTMask === fullTMask) {
            results.push(newPath);
            if (results.length >= MAX_RESULTS) break;
          } else {
            nextQueue.push({ cur: childKey, sMask: newSMask, tMask: newTMask, path: newPath });
          }
        }
        if (results.length >= MAX_RESULTS) break;
      }
      if (results.length >= MAX_RESULTS) break;
    }
    if (results.length > 0 || timedOut) break;
    queue = nextQueue.length > MAX_QUEUE ? nextQueue.slice(0, MAX_QUEUE) : nextQueue;
  }
  return { routes: results, timedOut };
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

function renderMultiRouteList(routeArrays, graph, targetSet, startIndexList = 0) {
  return routeArrays.map((route, idx) => {
    let routeHtml = `<div class="route-step" style="flex-direction:column; align-items:stretch; gap:6px;">`;
    routeHtml += `<div style="font-size:11px; color:var(--accent); font-weight:bold;">ルート ${startIndexList + idx + 1}</div>`;

    const firstKey = route[0].pal;
    const firstPal = palByKey.get(firstKey);
    const firstIsTarget = targetSet.has(firstKey);
    routeHtml += `<div style="font-size:12px; color:var(--ink-dim);">起点: <b style="color:var(--accent-2);">${firstPal.name_ja}</b>${firstIsTarget ? ' <span style="color:#ffd54f;font-weight:bold;">（目標兼用）</span>' : ''}</div>`;

    for (let j = 0; j < route.length - 1; j++) {
      const a = route[j].pal;
      const c = route[j+1].pal;
      const viaPartner = route[j+1].viaPartner;
      const pa = palByKey.get(a);
      const pc = palByKey.get(c);
      const isTargetHit = targetSet.has(c);

      let partnerHtml;
      if (viaPartner) {
        const partnerPal = palByKey.get(viaPartner);
        partnerHtml = `<span style="color:#ffd54f; font-weight:bold;">${partnerPal.name_ja}</span><span style="font-size:10px; color:#ffd54f; margin-left:4px;">（起点合流）</span>`;
      } else {
        const partners = graph.get(a).get(c) || [];
        const partnerNames = [...new Set(partners.map(pk => palByKey.get(pk).name_ja))];
        let partnerStr = partnerNames.length <= 4 ? partnerNames.join('、') : partnerNames.slice(0, 3).join('、') + ` など他${partnerNames.length - 3}種`;
        partnerHtml = `<span style="color:var(--ink-dim);">(${partnerStr})</span>`;
      }

      routeHtml += `
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; flex-wrap:wrap; background:rgba(0,0,0,0.15); padding:8px 12px; border-radius:6px; line-height:1.4; cursor:pointer;" onclick="openRouteStepDetail('${a}', '${c}')" title="クリックでパートナー詳細を確認">
          <span class="gen-badge">Step ${j+1}</span>
          <span style="font-weight:bold;">${pa.name_ja}</span>
          <span class="plus">＋</span>
          ${partnerHtml}
          <span style="margin:0 4px;">＝</span>
          <span style="font-weight:bold; ${isTargetHit ? 'color:#ffd54f; text-shadow:0 0 6px rgba(255,213,79,.55);' : 'color:var(--accent-2);'}">${pc.name_ja}${isTargetHit ? ' 🎯' : ''}</span>
        </div>
      `;
    }
    routeHtml += `</div>`;
    return routeHtml;
  }).join('');
}

document.getElementById('route-run-btn')?.addEventListener('click', ()=>{
  const startKeys = multiPickerRouteStart.getValues();
  const targetKeys = multiPickerRouteTarget.getValues();
  const resultEl = document.getElementById('route-result');

  if(startKeys.length===0 || targetKeys.length===0){
    resultEl.innerHTML = '<p style="color:var(--danger);font-size:13px;margin-top:14px;">起点パルと目標パルをそれぞれ1匹以上指定してください。</p>';
    return;
  }

  resultEl.innerHTML = '<p style="color:var(--ink-dim);font-size:13px;margin-top:14px;">経路を探索中...</p>';

  setTimeout(() => {
    const { routes, timedOut } = findMultiInheritanceRoutes(startKeys, targetKeys);
    if(routes.length === 0){
      resultEl.innerHTML = timedOut
        ? `<p style="color:var(--danger);font-size:13px;margin-top:14px;">探索に時間がかかりすぎたため打ち切りました。起点・目標の数を減らして再度お試しください。</p>`
        : `<p style="color:var(--danger);font-size:13px;margin-top:14px;">指定された条件を満たす配合ルートが見つかりませんでした（起点パルを直接パートナーとして使う一本道のルートが存在しない可能性があります）。</p>`;
      return;
    }
    
    const graph = getBreedGraph();
    const targetSet = new Set(targetKeys);
    let html = `<div style="margin-top:16px;">`;
    html += `<p style="font-size:13px;color:var(--ink);margin-bottom:12px;"><b>${routes.length}</b> 通りの最短ルートが見つかりました（起点 ${startKeys.length} 匹 / 目標 ${targetKeys.length} 匹をすべて満たすルート）。</p>`;
    
    const displayLimit = 5;
    const toDisplay = routes.slice(0, displayLimit);
    html += renderMultiRouteList(toDisplay, graph, targetSet, 0);
    
    if (routes.length > displayLimit) {
      const remaining = routes.length - displayLimit;
      html += `
        <div id="route-more-container">
          <button class="btn secondary" id="route-show-more-btn" style="width:100%; margin-top:8px;">その他 ${remaining} 通りのルートを見る</button>
        </div>
        <div id="route-more-list" style="display:none; margin-top:8px;">
          ${renderMultiRouteList(routes.slice(displayLimit), graph, targetSet, displayLimit)}
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
  grid.innerHTML = filtered.map(p=>{
    const owned = ownedSet.has(p.key);
    const masked = !owned && mydexSecretName;
    return `
    <div class="pal-card ownable ${masked?'is-secret':''}" data-key="${p.key}">
      <input type="checkbox" class="owned-check" ${owned?'checked':''}>
      <div class="num">No.${p.dex_no}${p.is_variant?' 亜種':''}</div>
      <div class="ja">${masked ? '？？？？？' : p.name_ja}</div>
      <div class="en">${masked ? '?????' : p.name}</div>
    </div>
  `;
  }).join('');
  grid.querySelectorAll('.pal-card').forEach(card=>{
    const key = card.dataset.key;
    const check = card.querySelector('.owned-check');
    check.addEventListener('click', e=>e.stopPropagation());
    check.addEventListener('change', ()=>{
      if(check.checked) ownedSet.add(key); else ownedSet.delete(key);
      saveOwned(ownedSet);
      updateMydexSummary();
      renderDiscover();
      renderMydexGrid();
    });
    card.addEventListener('click', (e)=>{
      if(e.target.classList.contains('owned-check')) return;
      openPalDetail(key);
    });
  });
}
document.getElementById('mydex-search').addEventListener('input', renderMydexGrid);
const mydexSecretNameChk = document.getElementById('mydex-secret-name');
if(mydexSecretNameChk){
  mydexSecretNameChk.checked = mydexSecretName;
  mydexSecretNameChk.addEventListener('change', ()=>{
    mydexSecretName = mydexSecretNameChk.checked;
    saveBoolSetting(MYDEX_SECRET_NAME_KEY, mydexSecretName);
    renderMydexGrid();
  });
}
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
        renderDiscover();
      });
    }catch(err){
      showConfirm('CSVの読み込みに失敗しました。ファイル形式をご確認ください。', ()=>{});
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file, 'UTF-8');
});

/* ---------- 一括チェック用: 除外No.リスト ---------- */
let excludeSet = new Set();

function renderExcludeList(){
  const container = document.getElementById('mydex-exclude-list');
  if(excludeSet.size === 0){
    container.innerHTML = '<span style="font-size:12px;color:var(--ink-dim);">（除外なし）</span>';
    return;
  }
  const nums = Array.from(excludeSet).sort((a,b)=>a-b);
  container.innerHTML = nums.map(n=>`
    <span class="tag" style="display:inline-flex;align-items:center;gap:4px;">
      No.${n}<a href="javascript:void(0)" data-num="${n}" class="exclude-remove" style="color:var(--danger);text-decoration:none;font-weight:700;">×</a>
    </span>
  `).join('');
  container.querySelectorAll('.exclude-remove').forEach(el=>{
    el.addEventListener('click', ()=>{
      excludeSet.delete(Number(el.dataset.num));
      renderExcludeList();
    });
  });
}
renderExcludeList();

document.getElementById('mydex-exclude-add-btn').addEventListener('click', ()=>{
  const input = document.getElementById('mydex-exclude-input');
  const n = parseInt(input.value, 10);
  if(!isNaN(n)){
    excludeSet.add(n);
    input.value = '';
    renderExcludeList();
  }
});
document.getElementById('mydex-exclude-input').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') document.getElementById('mydex-exclude-add-btn').click();
});
document.getElementById('mydex-exclude-clear-btn').addEventListener('click', ()=>{
  excludeSet.clear();
  renderExcludeList();
});

function applyOwnedChange(){
  saveOwned(ownedSet);
  renderMydexGrid();
  updateMydexSummary();
  renderDiscover();
}

/* ---------- 全てにチェック（亜種・除外Noを除く） ---------- */
document.getElementById('mydex-check-all-btn').addEventListener('click', ()=>{
  showConfirm('図鑑No.順の全パルにチェックを入れます（亜種・除外指定Noは対象外）。よろしいですか？', ()=>{
    palList.forEach(p=>{
      if(p.is_variant) return;
      if(excludeSet.has(p.dex_no)) return;
      ownedSet.add(p.key);
    });
    applyOwnedChange();
  });
});

/* ---------- No.範囲での一括チェック（亜種・除外Noを除く） ---------- */
document.getElementById('mydex-bulk-check-btn').addEventListener('click', ()=>{
  const startVal = document.getElementById('mydex-bulk-start').value;
  const endVal = document.getElementById('mydex-bulk-end').value;
  const start = parseInt(startVal, 10);
  const end = parseInt(endVal, 10);
  if(isNaN(start) || isNaN(end)){
    showConfirm('開始と終了のNo.を入力してください。', ()=>{});
    return;
  }
  const lo = Math.min(start, end), hi = Math.max(start, end);
  palList.forEach(p=>{
    if(p.is_variant) return;
    if(p.dex_no < lo || p.dex_no > hi) return;
    if(excludeSet.has(p.dex_no)) return;
    ownedSet.add(p.key);
  });
  applyOwnedChange();
});

function updateMydexSummary(){ document.getElementById('owned-count').textContent = ownedSet.size + ' / ' + palList.length; }

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
