const api = window.pageSoundDelay;
const $ = id => document.getElementById(id);
let delay = 0;
function readDelayInput() {
  const raw = $('delay').value.trim().replace(',', '.');
  if (raw === '' || raw === '.' || raw === '-') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}
let measuring = false;
let started = 0;
let timerId;

function validDelay(value) {
  return Number.isFinite(value) && value >= 0 && value <= 120;
}
function showDelay(value) {
  $('delay').value = value.toFixed(1);
}
function showApplied(value) {
  $('applied').textContent = value.toFixed(1) + 's';
}
function applyDelay(value) {
  if (!validDelay(value)) { alert('请输入 0 到 120 之间的合法延时（单位：秒）'); return false; }
  delay = Math.round(value * 10) / 10;
  showDelay(delay);
  showApplied(delay);
  api.send('set-delay', delay);
  return true;
}

document.querySelectorAll('[data-delta]').forEach(button => {
  button.onclick = () => applyDelay(delay + Number(button.dataset.delta));
});
$('apply').onclick = () => {
  const value = readDelayInput();
  applyDelay(value);
};
$('delay').addEventListener('keydown', event => {
  if (event.key === 'Enter') $('apply').click();
});
$('enabled').onchange = event => api.send('set-enabled', event.target.checked);
$('muted').onchange = event => api.send('set-muted', event.target.checked);

$('test').onclick = () => api.send('open-room', '8178490');
$('sage').onclick = () => api.send('open-room', '22604707');
$('custom').onclick = () => {
  $('custom-dialog').hidden = false;
  $('custom-value').value = '';
  $('custom-value').focus();
};
$('custom-cancel').onclick = () => { $('custom-dialog').hidden = true; };
$('custom-form').onsubmit = event => {
  event.preventDefault();
  const raw = $('custom-value').value.trim();
  if (!/^\d+$/.test(raw) && !/^https:\/\/live\.bilibili\.com\//i.test(raw)) {
    alert('直播间 URL 或 ID 无效，请检查后重试。');
    return;
  }
  $('custom-dialog').hidden = true;
  api.send('open-custom', raw);
};

$('measure').onclick = () => {
  if (!measuring) {
    measuring = true;
    started = performance.now();
    $('measure').textContent = '结束测量';
    $('measure').classList.add('danger');
    timerId = setInterval(() => showDelay((performance.now() - started) / 1000), 100);
  } else {
    measuring = false;
    clearInterval(timerId);
    const result = Math.min(120, Math.round((performance.now() - started) / 100) / 10);
    $('measure').textContent = '测量延时';
    $('measure').classList.remove('danger');
    applyDelay(result);
    $('enabled').checked = true;
    api.send('set-enabled', true);
  }
};

api.onStatus(status => { $('status').textContent = status; });
api.onState(state => {
  if (measuring) return;
  if (!state) return;
  delay = Number(state.delay) || 0;
  showDelay(delay);
  showApplied(delay);
  $('enabled').checked = Boolean(state.enabled);
  $('muted').checked = Boolean(state.muted);
});
showDelay(0);

// 主进程状态同步不能覆盖用户正在编辑的文本框。
stateSyncTimer = setInterval(() => api.send('request-state'), 1000);
