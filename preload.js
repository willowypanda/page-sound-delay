const { ipcRenderer } = require('electron');

(() => {
  'use strict';
  const MAX_DELAY = 120;
  let video = null;
  let graph = null;
  let delaySeconds = 0;
  let enabled = false;

  function status(message) {
    ipcRenderer.send('psd-page-status', message);
  }

  function updateGraph() {
    if (!graph) return;
    const now = graph.ctx.currentTime;
    graph.delay.delayTime.setTargetAtTime(delaySeconds, now, 0.03);
    graph.direct.gain.setTargetAtTime(enabled ? 0 : 1, now, 0.03);
    graph.delayed.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.03);
  }

  function findVideo() {
    const found = [...document.querySelectorAll('video')]
      .filter(item => item.isConnected)
      .sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
    if (!found || found === video) return;

    video = found;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(video);
      const direct = ctx.createGain();
      const delay = ctx.createDelay(MAX_DELAY + 1);
      const delayed = ctx.createGain();
      source.connect(direct).connect(ctx.destination);
      source.connect(delay).connect(delayed).connect(ctx.destination);
      graph = { ctx, source, direct, delay, delayed };
      updateGraph();
      status(ctx.state === 'running' ? '播放器已连接' : '播放器已找到，请点击“播放 / 恢复音频”');
      video.addEventListener('play', () => ctx.resume().catch(() => {}), { passive: true });
    } catch (error) {
      graph = null;
      status('音频接管失败：' + error.message);
    }
  }

  async function resume() {
    findVideo();
    if (!graph || !video) {
      status('尚未找到 Bilibili 播放器');
      return;
    }
    try {
      await graph.ctx.resume();
      await video.play();
      status(enabled ? `延时声音播放中（${delaySeconds.toFixed(1)}s）` : '实时声音播放中');
    } catch (error) {
      status('播放失败：' + error.message);
    }
  }

  ipcRenderer.on('psd-control', (_event, command) => {
    if (!command || typeof command.type !== 'string') return;
    if (command.type === 'set-delay') {
      const value = Number(command.payload);
      if (Number.isFinite(value)) delaySeconds = Math.max(0, Math.min(MAX_DELAY, value));
      updateGraph();
      status(`延时已设为 ${delaySeconds.toFixed(1)}s${enabled ? '（已启用）' : '（未启用）'}`);
    } else if (command.type === 'set-enabled') {
      enabled = Boolean(command.payload);
      updateGraph();
      status(enabled ? `声音延时已启用（${delaySeconds.toFixed(1)}s）` : '声音延时已关闭');
    } else if (command.type === 'resume') {
      resume();
    }
  });

  function boot() {
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    new MutationObserver(findVideo).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(findVideo, 1000);
    findVideo();
    status('Bilibili 页面已加载，正在寻找播放器…');
  }
  boot();
})();
