(() => {
  'use strict';

  if (window.__pageSoundDelayLoaded) return;
  window.__pageSoundDelayLoaded = true;

  const DEFAULT_ROOM = '8178490';
  const MAX_DELAY = 120;
  let currentVideo = null;
  let graph = null;
  let delaySeconds = 0;
  let delayEnabled = false;
  let measuring = false;
  let measureStart = 0;
  let measureTimer = null;

  const css = `
    #psd-panel { position: fixed; z-index: 2147483647; top: 0; left: 0; right: 0; width: auto; color: #e8edf2; background: rgba(22,27,34,.98); border-bottom: 1px solid #48515b; box-shadow: 0 3px 16px rgba(0,0,0,.4); font: 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding: 8px 14px; }
    #psd-panel * { box-sizing: border-box; }
    #psd-panel .psd-title { display:flex; justify-content:space-between; align-items:center; font-weight:700; white-space:nowrap; }
    #psd-panel .psd-row { display:flex; gap:5px; align-items:center; margin:0 8px 0 0; flex-wrap:wrap; }
    #psd-panel .psd-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    #psd-panel button, #psd-panel input { border:1px solid #59636d; border-radius:6px; color:#edf2f7; background:#28313a; padding:5px 8px; }
    #psd-panel button { cursor:pointer; white-space:nowrap; }
    #psd-panel button:hover { background:#3b4854; }
    #psd-panel .psd-primary { background:#1677d2; border-color:#2489e5; }
    #psd-panel .psd-danger { background:#a93636; border-color:#d45555; }
    #psd-panel input[type=number] { width:92px; }
    #psd-panel input[type=text] { width:110px; }
    #psd-panel .psd-value { font-size:16px; font-weight:700; min-width:48px; text-align:center; }
    #psd-panel .psd-status { color:#9fb1c2; font-size:12px; min-width:190px; }
    #psd-panel .psd-help { color:#91a0ae; font-size:11px; margin:5px 0 0; }
    #psd-panel .psd-close { border:0; background:transparent; color:#9aa7b3; padding:0 4px; }
    @media (max-width: 900px) { #psd-panel .psd-help { display:none; } #psd-panel .psd-status { min-width:0; } }
  `;

  function makePanel() {
    if (document.getElementById('psd-panel')) return;
    const style = document.createElement('style');
    style.id = 'psd-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'psd-panel';
    panel.innerHTML = `
      <div class="psd-toolbar">
        <div class="psd-title"><span>Page Sound Delay</span><button class="psd-close" id="psd-close">×</button></div>
        <div class="psd-row"><input id="psd-room" type="text" value="${DEFAULT_ROOM}" placeholder="直播间 ID"><button id="psd-room-go" class="psd-primary">打开直播间</button></div>
        <div class="psd-row"><button data-psd-delta="-5">−5s</button><button data-psd-delta="-1">−1s</button><button data-psd-delta="-0.5">−0.5s</button><button data-psd-delta="-0.1">−0.1s</button><span id="psd-value" class="psd-value">0.0s</span><button data-psd-delta="0.1">+0.1s</button><button data-psd-delta="0.5">+0.5s</button><button data-psd-delta="1">+1s</button><button data-psd-delta="5">+5s</button></div>
        <div class="psd-row"><input id="psd-manual" type="number" min="0" max="120" step="0.1" placeholder="延时秒数"><button id="psd-apply">应用</button><button id="psd-measure">测量延时</button><span id="psd-timer">0.0s</span></div>
        <div class="psd-row"><label><input id="psd-enabled" type="checkbox"> 启用延时</label><button id="psd-resume">播放 / 恢复音频</button></div>
        <div id="psd-status" class="psd-status">等待 Bilibili 播放器视频元素...</div>
      </div>
      <div class="psd-help">登录请直接使用 Bilibili 页面右上角登录。延时仅作用于声音,画面保持直播端。</div>
    `;
    document.documentElement.appendChild(panel);

    panel.querySelector('#psd-close').onclick = () => panel.remove();
    panel.querySelector('#psd-room-go').onclick = () => {
      const room = panel.querySelector('#psd-room').value.trim();
      if (/^\d+$/.test(room)) location.href = `https://live.bilibili.com/${room}`;
      else setStatus('请输入纯数字直播间 ID', true);
    };
    panel.querySelector('#psd-room').onkeydown = e => { if (e.key === 'Enter') panel.querySelector('#psd-room-go').click(); };
    panel.querySelectorAll('[data-psd-delta]').forEach(b => b.onclick = () => {
      setDelay(delaySeconds + Number(b.dataset.psdDelta));
    });
    panel.querySelector('#psd-apply').onclick = () => {
      const n = Number(panel.querySelector('#psd-manual').value);
      if (!Number.isFinite(n) || n < 0 || n > MAX_DELAY) setStatus(`延时应在 0-${MAX_DELAY} 秒之间`, true);
      else setDelay(n);
    };
    panel.querySelector('#psd-enabled').onchange = e => {
      delayEnabled = e.target.checked;
      updateGraph();
      setStatus(delayEnabled ? '声音延时已启用' : '声音延时已关闭,当前为实时声音');
    };
    panel.querySelector('#psd-resume').onclick = async () => {
      if (!graph) { findVideo(); }
      if (graph) {
        try { await graph.ctx.resume(); await currentVideo.play(); setStatus(delayEnabled ? '延时声音播放中' : '实时声音播放中'); }
        catch (e) { setStatus('播放失败: ' + e.message, true); }
      }
    };
    panel.querySelector('#psd-measure').onclick = toggleMeasure;
  }

  function setStatus(text, error = false) {
    const el = document.getElementById('psd-status');
    if (el) { el.textContent = text; el.style.color = error ? '#ff8b8b' : '#9fb1c2'; }
  }
  function setDelay(value) {
    delaySeconds = Math.max(0, Math.min(MAX_DELAY, Math.round(value * 10) / 10));
    const valueEl = document.getElementById('psd-value');
    if (valueEl) valueEl.textContent = delaySeconds.toFixed(1) + 's';
    if (graph) graph.delay.delayTime.setTargetAtTime(delaySeconds, graph.ctx.currentTime, 0.03);
  }
  function updateGraph() {
    if (!graph) return;
    graph.direct.gain.setTargetAtTime(delayEnabled ? 0 : 1, graph.ctx.currentTime, .03);
    graph.delayed.gain.setTargetAtTime(delayEnabled ? 1 : 0, graph.ctx.currentTime, .03);
    if (delayEnabled) graph.delay.delayTime.setTargetAtTime(delaySeconds, graph.ctx.currentTime, .03);
  }

  function findVideo() {
    makePanel();
    const video = [...document.querySelectorAll('video')].find(v => v.readyState >= 1 || v.src || v.currentSrc);
    if (!video || video === currentVideo) return;
    if (graph) { try { graph.source.disconnect(); graph.direct.disconnect(); graph.delayed.disconnect(); graph.delay.disconnect(); } catch (_) {} }
    currentVideo = video;
    try {
      // SourceNode 一生只能绑定一次,因此只对新 video 元素创建图。
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(video);
      const direct = ctx.createGain();
      const delayed = ctx.createGain();
      const delay = ctx.createDelay(MAX_DELAY + 1);
      source.connect(direct).connect(ctx.destination);
      source.connect(delay).connect(delayed).connect(ctx.destination);
      graph = { ctx, source, direct, delayed, delay };
      updateGraph();
      setStatus(ctx.state === 'suspended' ? '播放器已找到,请点击“播放 / 恢复音频”' : '播放器已连接');
      video.addEventListener('play', () => { if (ctx.state === 'suspended') ctx.resume(); }, { passive: true });
    } catch (e) {
      graph = null;
      setStatus('无法接管 Bilibili 音频: ' + e.message, true);
    }
  }

  function toggleMeasure() {
    const button = document.getElementById('psd-measure');
    const timer = document.getElementById('psd-timer');
    if (!measuring) {
      measuring = true; measureStart = performance.now();
      button.textContent = '结束计时'; button.classList.add('psd-danger');
      measureTimer = setInterval(() => { timer.textContent = ((performance.now() - measureStart) / 1000).toFixed(1) + 's'; }, 100);
    } else {
      measuring = false; clearInterval(measureTimer);
      const measured = Math.min(MAX_DELAY, Math.round((performance.now() - measureStart) / 100) / 10);
      button.textContent = '测量延时'; button.classList.remove('psd-danger');
      setDelay(measured);
      const enabled = document.getElementById('psd-enabled');
      enabled.checked = true; delayEnabled = true; updateGraph();
      setStatus(`测得 ${measured.toFixed(1)}s,声音延时已启动`);
    }
  }

  makePanel();
  const observer = new MutationObserver(() => findVideo());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  let tries = 0;
  const timer = setInterval(() => { findVideo(); if (++tries > 60) clearInterval(timer); }, 500);
})();
