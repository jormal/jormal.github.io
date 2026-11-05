// Registers the site service worker and shows a small offline-copy status bar.
// Pages stay fully readable without this script; it only adds the offline copy.
(() => {
  const script = document.currentScript;
  if (!script) return;

  const rootUrl = new URL('../', script.src);
  const supported = 'serviceWorker' in navigator && window.isSecureContext && 'caches' in window;
  const AUTO_REFRESH_MS = 6 * 60 * 60 * 1000;

  const bar = document.createElement('div');
  bar.className = 'offline-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', '오프라인 저장');
  const status = document.createElement('p');
  status.className = 'offline-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'offline-button';
  // On narrow screens CSS visually hides the middle words so the bar stays on one row;
  // the accessible name keeps the full label.
  const buttonLabel = document.createElement('span');
  buttonLabel.innerHTML = '지금 <span class="offline-button-long">오프라인용으로 </span>저장';
  const offlineLabel = document.createElement('span');
  offlineLabel.textContent = '연결되면 저장 가능';
  offlineLabel.hidden = true;
  button.append(buttonLabel, offlineLabel);
  bar.append(status, button);

  const header = document.querySelector('body > header');
  if (header) header.after(bar);
  else document.body.prepend(bar);

  let lastMeta = null;

  function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // The status line is "<label> · <time>"; the time never breaks across lines.
  function setState(state, text, time = '') {
    bar.dataset.state = state;
    const label = document.createElement('span');
    label.textContent = text;
    status.replaceChildren(label);
    if (time) {
      const stamp = document.createElement('span');
      stamp.className = 'offline-time';
      stamp.textContent = time;
      label.append(' ', stamp);
    }
    const offline = !navigator.onLine;
    button.disabled = state === 'saving' || offline;
    button.hidden = state === 'unsupported';
    buttonLabel.hidden = offline;
    offlineLabel.hidden = !offline;
  }

  function showMeta(meta) {
    lastMeta = meta;
    if (!meta) {
      setState('saving', '오프라인 저장 중…');
      return;
    }
    const time = formatTime(meta.updated);
    if (meta.refreshFailed) {
      setState('stale', '갱신 실패 · 저장본 유지', `${time} 기준`);
      return;
    }
    if (!navigator.onLine) {
      setState('stale', '오프라인 · 저장본 표시 중', `${time} 기준`);
      return;
    }
    if (meta.failed?.length) {
      setState('partial', `오프라인 저장됨 (${meta.failed.length}개 파일 제외) · 마지막 갱신`, time);
      return;
    }
    setState('saved', '오프라인 저장됨 · 마지막 갱신', time);
  }

  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out.')), ms); }),
    ]).finally(() => clearTimeout(timer));
  }

  // The first install downloads every listed page and image, so allow it a while.
  async function ask(type, ms) {
    const registration = await withTimeout(navigator.serviceWorker.ready, ms);
    const worker = navigator.serviceWorker.controller ?? registration.active;
    if (!worker) throw new Error('No active service worker.');
    const channel = new MessageChannel();
    try {
      return await withTimeout(new Promise((resolve, reject) => {
        channel.port1.onmessage = ({ data }) => (data?.ok ? resolve(data.meta) : reject(new Error(data?.error)));
        worker.postMessage({ type }, [channel.port2]);
      }), ms);
    } finally {
      channel.port1.close();
    }
  }

  async function refresh() {
    if (!navigator.onLine) {
      showMeta(lastMeta);
      return;
    }
    setState('saving', '오프라인 저장 중…');
    try {
      // Ask the browser to keep this site's storage; Chrome may grant it silently.
      await navigator.storage?.persist?.().catch(() => false);
      showMeta(await ask('refresh', 120000));
    } catch {
      setState('error', '오프라인 저장에 실패했습니다. 연결을 확인한 뒤 다시 눌러 주세요.');
    }
  }

  if (!supported) {
    setState('unsupported', window.isSecureContext
      ? '이 브라우저는 오프라인 저장을 지원하지 않습니다. 계획 페이지에서 HTML 파일로 저장해 주세요.'
      : '오프라인 저장은 https 주소에서만 동작합니다.');
    return;
  }

  button.addEventListener('click', refresh);
  window.addEventListener('online', () => showMeta(lastMeta));
  window.addEventListener('offline', () => showMeta(lastMeta));

  setState('saving', '오프라인 저장 중…');
  navigator.serviceWorker.register(new URL('sw.js', rootUrl), { scope: rootUrl.pathname })
    .then(() => ask('status', 120000))
    .then((meta) => {
      showMeta(meta);
      const age = meta ? Date.now() - new Date(meta.updated).getTime() : Infinity;
      if (navigator.onLine && !(age < AUTO_REFRESH_MS)) refresh();
    })
    .catch(() => setState('error', '오프라인 저장을 시작하지 못했습니다. 다시 눌러 주세요.'));
})();
