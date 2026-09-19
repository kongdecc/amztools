const LENGTH_TO_INCH = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4 };
const WEIGHT_TO_POUND = { lb: 1, oz: 1 / 16, kg: 2.2046226218487757, g: 1 / 453.59237 };
const LENGTH_LABEL = { in: '英寸', cm: '厘米', mm: '毫米' };
const WEIGHT_LABEL = { lb: '磅', oz: '盎司', kg: '千克', g: '克' };
function localTodayISO() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
function seasonForDate(date) { const monthDay = date.slice(5); return monthDay >= '10-15' || monthDay <= '01-14' ? 'peak' : 'regular'; }
function initSeasonSelection(prefix) {
  const season = document.getElementById(`${prefix}-season`);
  season.value = seasonForDate(localTodayISO());
}

function unitControlsHTML(prefix) {
  return `<div class="unit-bar" aria-label="计量单位">
    <span class="unit-caption">计量单位</span>
    <div class="unit-presets" role="group" aria-label="常用单位组合">
      <button type="button" id="${prefix}-imperial" class="unit-preset active">英制</button>
      <button type="button" id="${prefix}-metric" class="unit-preset">公制</button>
    </div>
    <label>尺寸 <select id="${prefix}-length-unit" aria-label="尺寸单位"><option value="in">英寸 in</option><option value="cm">厘米 cm</option><option value="mm">毫米 mm</option></select></label>
    <label>重量 <select id="${prefix}-weight-unit" aria-label="重量单位"><option value="lb">磅 lb</option><option value="oz">盎司 oz</option><option value="kg">千克 kg</option><option value="g">克 g</option></select></label>
  </div>`;
}

function unitRoundInput(value) { return Number(value.toPrecision(12)); }
function convertUnitValue(value, from, to, factors) {
  return value * factors[from] / factors[to];
}
function initUnitControls(prefix, lengthIds, weightIds, onChange) {
  const lengthSelect = document.getElementById(`${prefix}-length-unit`);
  const weightSelect = document.getElementById(`${prefix}-weight-unit`);
  let previousLength = lengthSelect.value;
  let previousWeight = weightSelect.value;
  const convertInputs = (ids, from, to, factors) => {
    if (from === to) return;
    ids.forEach(id => {
      const input = document.getElementById(id);
      if (!input || input.value.trim() === '') return;
      const number = Number(input.value);
      if (Number.isFinite(number)) input.value = unitRoundInput(convertUnitValue(number, from, to, factors));
    });
  };
  const refresh = () => {
    const imperial = lengthSelect.value === 'in' && weightSelect.value === 'lb';
    const metric = lengthSelect.value === 'cm' && weightSelect.value === 'kg';
    document.getElementById(`${prefix}-imperial`).classList.toggle('active', imperial);
    document.getElementById(`${prefix}-metric`).classList.toggle('active', metric);
    lengthIds.forEach(id => { const label = document.querySelector(`label[for="${id}"]`); if (label) label.textContent = label.textContent.replace(/ · (英寸|厘米|毫米)$/, '') + ` · ${LENGTH_LABEL[lengthSelect.value]}`; });
    weightIds.forEach(id => { const label = document.querySelector(`label[for="${id}"]`); if (label) label.textContent = label.textContent.replace(/ · (磅|盎司|千克|克)(（可选）)?$/, '') + ` · ${WEIGHT_LABEL[weightSelect.value]}${id.endsWith('override') ? '（可选）' : ''}`; });
    if (onChange) onChange();
  };
  lengthSelect.addEventListener('change', () => { convertInputs(lengthIds, previousLength, lengthSelect.value, LENGTH_TO_INCH); previousLength = lengthSelect.value; refresh(); });
  weightSelect.addEventListener('change', () => { convertInputs(weightIds, previousWeight, weightSelect.value, WEIGHT_TO_POUND); previousWeight = weightSelect.value; refresh(); });
  document.getElementById(`${prefix}-imperial`).addEventListener('click', () => { lengthSelect.value = 'in'; lengthSelect.dispatchEvent(new Event('change')); weightSelect.value = 'lb'; weightSelect.dispatchEvent(new Event('change')); });
  document.getElementById(`${prefix}-metric`).addEventListener('click', () => { lengthSelect.value = 'cm'; lengthSelect.dispatchEvent(new Event('change')); weightSelect.value = 'kg'; weightSelect.dispatchEvent(new Event('change')); });
  refresh();
}
function unitLength(prefix, value) { return value * LENGTH_TO_INCH[document.getElementById(`${prefix}-length-unit`).value]; }
function unitWeight(prefix, value) { return value * WEIGHT_TO_POUND[document.getElementById(`${prefix}-weight-unit`).value]; }
function sizeInputNumber(id) {
  const value = Number(document.getElementById(id).value);
  return id === 'weight' ? unitWeight('size', value) : unitLength('size', value);
}
function unitDisplayLength(prefix, inches) {
  const unit = document.getElementById(`${prefix}-length-unit`).value;
  return `${fmt(convertUnitValue(inches, 'in', unit, LENGTH_TO_INCH))} ${LENGTH_LABEL[unit]}`;
}
function unitDisplayWeight(prefix, pounds) {
  const unit = document.getElementById(`${prefix}-weight-unit`).value;
  return `${fmt(convertUnitValue(pounds, 'lb', unit, WEIGHT_TO_POUND))} ${WEIGHT_LABEL[unit]}`;
}
function unitResultLine(prefix, lengths, weight) {
  const dimensions = lengths.map(value => unitDisplayLength(prefix, value)).join(' × ');
  return `<div class="unit-result">当前单位：${dimensions}；发货重量 ${unitDisplayWeight(prefix, weight)}。</div>`;
}
