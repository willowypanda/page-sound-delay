const api = window.pageSoundDelay;
const $ = id => document.getElementById(id);
let delay = 0;
let measuring = false;
let started = 0;
let timerId;

function setDelay(value) {
  delay = Math.max(0, Math.min(120, Math.round(value * 10) / 10));
  $('value').textContent = delay.toFixed(1) + 's';
  api.send('set-delay', delay);
}

document.querySelectorAll('[data-delta]').forEach(button => {
  button.onclick = () => setDelay(delay + Number(button.dataset.delta));
});

$('apply').onclick = () => {
  const value = Number($('manual').value);
  if (Number.isFinite(value) && value >= 0 && value <= 120) setDelay(value);
  else $('status').textContent = '延时应在 0–120 秒之间';
};

$('enabled').onchange = event => api.send('set-enabled', event.target.checked);
$('resume').onclick = () => api.send('resume');
$('open').onclick = () => {
  const room = $('room').value.trim();
  if (/^\d+$/.test(room)) api.send('open-room', room);
  else $('status').textContent = '请输入纯数字直播间 ID';
};
$('room').onkeydown = event => { if (event.key === 'Enter') $('open').click(); };

$('measure').onclick = () => {
  if (!measuring) {
    measuring = true;
    started = performance.now();
    $('measure').textContent = '结束计时';
    $('measure').classList.add('danger');
    timerId = setInterval(() => {
      $('timer').textContent = ((performance.now() - started) / 1000).toFixed(1) + 's';
    }, 100);
  } else {
    measuring = false;
    clearInterval(timerId);
    const result = Math.min(120, Math.round((performance.now() - started) / 100) / 10);
    $('measure').textContent = '测量延时';
    $('measure').classList.remove('danger');
    setDelay(result);
    $('enabled').checked = true;
    api.send('set-enabled', true);
  }
};

api.onStatus(status => { $('status').textContent = status; });
