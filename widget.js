/*
  Support chat widget
  Paste one line into any page:
  <script src="https://ibrahim-ademola.github.io/northline-demo/widget.js"
          data-client="demo-001" data-key="pk_..." data-name="Northline Sneakers" defer></script>

  Optional: data-color (accent, default #111827), data-greeting, data-endpoint.
  The public key only opens this one store's chat, so it is safe in page source.
*/
(function () {
  var script = document.currentScript;
  if (!script) return;

  var cfg = {
    endpoint: script.getAttribute('data-endpoint') || 'https://n8n-lbry-production.up.railway.app/webhook/support-chat',
    client: script.getAttribute('data-client'),
    key: script.getAttribute('data-key'),
    name: script.getAttribute('data-name') || 'Support',
    color: script.getAttribute('data-color') || '#111827',
    greeting: script.getAttribute('data-greeting') ||
      'Hi! Ask me about shipping, returns, refunds or payments. If I can\'t help, I\'ll pass you to the team.'
  };
  if (!cfg.client || !cfg.key) {
    console.warn('Support widget: data-client and data-key are required.');
    return;
  }

  var MAX_LEN = 1000;
  var TIMEOUT_MS = 45000;
  var SID_KEY = 'sw_sid_' + cfg.client;
  var LOG_KEY = 'sw_log_' + cfg.client;

  // ---------- storage (fails safely in private windows) ----------
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  var sid = load(SID_KEY);
  if (!sid) { sid = newId(); store(SID_KEY, sid); }

  var history = [];
  try { history = JSON.parse(load(LOG_KEY) || '[]'); } catch (e) { history = []; }
  function saveHistory() { store(LOG_KEY, JSON.stringify(history.slice(-50))); }

  // ---------- UI (shadow DOM keeps the host site's CSS out) ----------
  var host = document.createElement('div');
  host.setAttribute('data-support-widget', cfg.client);
  document.body.appendChild(host);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var css = '' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
    '.launch{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;' +
      'background:' + cfg.color + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:2147483646}' +
    '.launch svg{width:26px;height:26px}' +
    '.panel{position:fixed;right:20px;bottom:88px;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);' +
      'background:#fff;color:#111827;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;z-index:2147483647}' +
    '.panel.open{display:flex}' +
    '.head{background:' + cfg.color + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:8px}' +
    '.title{font-size:15px;font-weight:600;flex:1;line-height:1.3}' +
    '.sub{display:block;font-size:12px;font-weight:400;opacity:.8}' +
    '.icon{background:transparent;border:0;color:#fff;cursor:pointer;font-size:12px;padding:6px 8px;border-radius:6px;opacity:.9}' +
    '.icon:hover{background:rgba(255,255,255,.15)}' +
    '.log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f7f7f8}' +
    '.msg{max-width:85%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}' +
    '.bot{align-self:flex-start;background:#fff;border:1px solid #e5e7eb}' +
    '.me{align-self:flex-end;background:' + cfg.color + ';color:#fff}' +
    '.note{align-self:center;font-size:12px;color:#6b7280;text-align:center;max-width:90%}' +
    '.typing{align-self:flex-start;color:#6b7280;font-size:13px;padding:4px 2px}' +
    '.form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fff}' +
    '.input{flex:1;resize:none;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.4;max-height:96px;outline:none;color:#111827}' +
    '.input:focus{border-color:' + cfg.color + '}' +
    '.send{border:0;border-radius:10px;padding:0 14px;background:' + cfg.color + ';color:#fff;font-size:14px;font-weight:600;cursor:pointer}' +
    '.send:disabled{opacity:.5;cursor:default}' +
    '.foot{font-size:11px;color:#9ca3af;text-align:center;padding:0 12px 10px;background:#fff}' +
    '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}}';

  var style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // textContent only: never render customer or server text as HTML
    return n;
  }

  var launch = el('button', 'launch');
  launch.setAttribute('aria-label', 'Open chat with ' + cfg.name);
  launch.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var panel = el('div', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', cfg.name + ' support chat');

  var head = el('div', 'head');
  var title = el('div', 'title', cfg.name);
  title.appendChild(el('span', 'sub', 'Usually replies in seconds'));
  var resetBtn = el('button', 'icon', 'New chat');
  var closeBtn = el('button', 'icon', 'Close');
  closeBtn.setAttribute('aria-label', 'Close chat');
  head.appendChild(title); head.appendChild(resetBtn); head.appendChild(closeBtn);

  var log = el('div', 'log');
  log.setAttribute('aria-live', 'polite');

  var form = el('form', 'form');
  var input = el('textarea', 'input');
  input.rows = 1;
  input.maxLength = MAX_LEN;
  input.placeholder = 'Type your question...';
  input.setAttribute('aria-label', 'Your message');
  var send = el('button', 'send', 'Send');
  send.type = 'submit';
  form.appendChild(input); form.appendChild(send);

  var foot = el('div', 'foot', 'Answers come from ' + cfg.name + '\'s policies. A person takes over when needed.');

  panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(foot);
  root.appendChild(launch); root.appendChild(panel);

  // ---------- rendering ----------
  function add(kind, text, keep) {
    var cls = kind === 'me' ? 'msg me' : kind === 'note' ? 'note' : 'msg bot';
    log.appendChild(el('div', cls, text));
    log.scrollTop = log.scrollHeight;
    if (keep) { history.push({ k: kind, t: text }); saveHistory(); }
  }

  function renderAll() {
    log.textContent = '';
    add('bot', cfg.greeting, false);
    history.forEach(function (m) { add(m.k, m.t, false); });
  }
  renderAll();

  var typing = null;
  function setBusy(on) {
    send.disabled = on;
    input.disabled = on;
    if (on && !typing) { typing = el('div', 'typing', 'Typing...'); log.appendChild(typing); log.scrollTop = log.scrollHeight; }
    if (!on && typing) { typing.remove(); typing = null; }
  }

  // ---------- talking to the agent ----------
  function ask(text) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);

    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.client,
        public_key: cfg.key,
        channel: 'web',
        session_id: sid,
        message: text
      }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (res.status === 403) throw new Error('blocked');
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = '';
    add('me', text, true);
    setBusy(true);

    ask(text).then(function (data) {
      setBusy(false);
      if (data && typeof data.reply === 'string' && data.reply) {
        add('bot', data.reply, true);
        if (data.pending) add('note', 'Our team is reviewing your answer. Keep this page open or check back soon.', true);
      } else {
        add('note', 'Sorry, something went wrong. Please try again.', false);
      }
    }).catch(function (err) {
      setBusy(false);
      if (err && err.message === 'blocked') {
        add('note', 'This chat is not available right now.', false);
      } else if (err && err.name === 'AbortError') {
        add('note', 'That took too long. Please try again.', false);
      } else {
        add('note', 'Sorry, something went wrong. Please try again.', false);
      }
    }).then(function () { input.focus(); });
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  // ---------- open, close, reset ----------
  function open() { panel.classList.add('open'); launch.setAttribute('aria-expanded', 'true'); input.focus(); }
  function close() { panel.classList.remove('open'); launch.setAttribute('aria-expanded', 'false'); launch.focus(); }

  launch.addEventListener('click', function () { panel.classList.contains('open') ? close() : open(); });
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  resetBtn.addEventListener('click', function () {
    sid = newId();
    store(SID_KEY, sid);
    history = [];
    drop(LOG_KEY);
    renderAll();
    input.focus();
  });
})();
