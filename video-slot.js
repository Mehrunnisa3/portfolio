// @ds-adherence-ignore -- omelette starter scaffold sibling (raw elements/hex/px by design)
/**
 * <video-slot> — user-fillable video placeholder (mp4/webm), same drop/
 * persist pattern as <image-slot> but for video files. Not size-limited by
 * canvas re-encode — stored as a base64 data URL in its own sidecar, so
 * keep source clips short/compressed (a few MB) for reasonable page size.
 *
 * Attributes:
 *   id           Persistence key. REQUIRED to survive reload.
 *   radius       Corner radius in px.                     (default 8)
 *   placeholder  Empty-state caption.
 *   poster       Optional poster image URL shown before play.
 *   autoplay/loop/muted/controls  Passed through to the underlying <video>.
 *                controls defaults on; muted+autoplay+loop default off.
 */
(() => {
  // Each video gets its own sidecar file (.video-slot-<id>.json) instead of
  // one shared file — videos are large as base64 data URLs, and a single
  // shared file quickly hits the per-file size cap once more than one or
  // two clips are stored. Legacy shared file is still read once as a
  // fallback for ids saved before this split.
  const LEGACY_FILE = '.video-slots.state.json';
  const fileFor = (id) => '.video-slot-' + id + '.state.json';
  const ACCEPT = ['video/mp4', 'video/webm', 'video/quicktime'];
  const MAX_BYTES = 60 * 1024 * 1024; // 60MB guard — data URLs get heavy fast

  const subs = new Set();
  const slots = {}; // id -> value, in-memory cache
  const loadedIds = new Set();
  const loadPs = {};
  let legacyChecked = null;

  function loadLegacy() {
    if (!legacyChecked) {
      legacyChecked = fetch(LEGACY_FILE, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return legacyChecked;
  }

  function load(id) {
    if (!id) return Promise.resolve();
    if (loadPs[id]) return loadPs[id];
    loadPs[id] = fetch(fileFor(id), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j) => {
        if (j && j.u) {
          if (!(id in slots)) slots[id] = j;
          return;
        }
        // fall back to legacy shared file for ids saved before the split
        const legacy = await loadLegacy();
        if (legacy && legacy[id] && !(id in slots)) slots[id] = legacy[id];
      })
      .catch(() => {})
      .then(() => { loadedIds.add(id); subs.forEach((fn) => fn()); });
    return loadPs[id];
  }

  const saving = {}, saveDirty = {};
  function save(id) {
    if (saving[id]) { saveDirty[id] = true; return; }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving[id] = true;
    const val = slots[id];
    const p = val ? w(fileFor(id), JSON.stringify(val)) : w(fileFor(id), '');
    Promise.resolve(p)
      .catch(() => {})
      .then(() => { saving[id] = false; if (saveDirty[id]) { saveDirty[id] = false; save(id); } });
  }

  function getSlot(id) { return slots[id] || null; }
  function setSlot(id, val) {
    if (!id) return;
    if (val) slots[id] = val; else delete slots[id];
    subs.forEach((fn) => fn());
    if (loadedIds.has(id)) save(id); else load(id).then(() => save(id));
  }

  function toDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  const stylesheet =
    ':host{display:inline-block;position:relative;vertical-align:top;' +
    '  font:13px/1.3 system-ui,-apple-system,sans-serif;color:rgba(0,0,0,.55);width:320px;height:180px}' +
    '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(0,0,0,.04)}' +
    '.frame video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;background:#000}' +
    '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
    '  justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;' +
    '  cursor:pointer;user-select:none}' +
    '.empty svg{opacity:.45}' +
    '.empty .cap{max-width:90%;font-weight:500;letter-spacing:.01em}' +
    '.empty .sub{font-size:11px}' +
    '.empty .sub u{text-underline-offset:2px;text-decoration-color:rgba(0,0,0,.25)}' +
    '.empty:hover .sub u{color:rgba(0,0,0,.75);text-decoration-color:currentColor}' +
    ':host([data-over]) .frame{outline:2px solid #c96442;outline-offset:-2px;' +
    '  background:rgba(201,100,66,.10)}' +
    '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(0,0,0,.25);' +
    '  transition:border-color .12s}' +
    ':host([data-over]) .ring{border-color:#c96442}' +
    ':host([data-filled]) .ring{display:none}' +
    '.ctl{position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:8px;' +
    '  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:2;' +
    '  white-space:nowrap}' +
    ':host([data-filled][data-editable]:hover) .ctl{opacity:1;pointer-events:auto}' +
    '.ctl button{appearance:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;' +
    '  background:rgba(0,0,0,.65);color:#fff;font:11px/1 system-ui,-apple-system,sans-serif;' +
    '  backdrop-filter:blur(6px)}' +
    '.ctl button:hover{background:rgba(0,0,0,.8)}' +
    '.err{position:absolute;left:8px;bottom:8px;right:8px;color:#b3261e;font-size:11px;' +
    '  background:rgba(255,255,255,.85);padding:4px 6px;border-radius:5px;pointer-events:none}';

  const icon =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m21 8-4 3.2v1.6L21 16V8Z"/></svg>';

  class VideoSlot extends HTMLElement {
    static get observedAttributes() {
      return ['radius', 'placeholder', 'poster', 'id', 'autoplay', 'loop', 'muted', 'controls', 'start', 'fit'];
    }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + stylesheet + '</style>' +
        '<div class="frame" part="frame">' +
        '  <video part="video" playsinline></video>' +
        '  <div class="empty" part="empty">' + icon +
        '    <div class="cap"></div>' +
        '    <div class="sub">or <u>browse files</u></div></div>' +
        '  <div class="ring" part="ring"></div>' +
        '</div>' +
        '<div class="ctl"><button data-act="replace" title="Replace video">Replace</button>' +
        '  <button data-act="clear" title="Remove video">Remove</button></div>' +
        '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._video = root.querySelector('video');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._input = root.querySelector('input');
      this._err = null;
      this._depth = 0;
      this._gen = 0;
      this._subFn = () => this._render();
      this._empty.addEventListener('click', () => this._input.click());
      root.addEventListener('click', (e) => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') this._input.click();
        if (act === 'clear') {
          this._gen++;
          this._local = null;
          if (this.id) setSlot(this.id, null); else this._render();
        }
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
    }

    connectedCallback() {
      if (!this.id && !VideoSlot._warned) {
        VideoSlot._warned = true;
        console.warn('<video-slot> without an id will not persist its dropped video.');
      }
      this.addEventListener('dragenter', this);
      this.addEventListener('dragover', this);
      this.addEventListener('dragleave', this);
      this.addEventListener('drop', this);
      subs.add(this._subFn);
      load(this.id);
      this._render();
    }

    disconnectedCallback() {
      subs.delete(this._subFn);
      this.removeEventListener('dragenter', this);
      this.removeEventListener('dragover', this);
      this.removeEventListener('dragleave', this);
      this.removeEventListener('drop', this);
    }

    attributeChangedCallback() { if (this.shadowRoot) this._render(); }

    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        if (--this._depth <= 0) { this._depth = 0; this.removeAttribute('data-over'); }
      } else if (e.type === 'drop') {
        e.preventDefault();
        e.stopPropagation();
        this._depth = 0;
        this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }

    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) {
        this._setError('Drop an MP4, WebM, or MOV video.');
        return;
      }
      if (file.size > MAX_BYTES) {
        this._setError('Video is too large (max 60MB) — compress it first.');
        return;
      }
      const gen = ++this._gen;
      try {
        const url = await toDataUrl(file);
        if (gen !== this._gen) return;
        const val = { u: url, t: file.type };
        setSlot(this.id || '', val);
        if (!this.id) { this._local = val; this._render(); }
      } catch (err) {
        if (gen !== this._gen) return;
        this._setError('Could not read that video.');
        console.warn('<video-slot> ingest failed:', err);
      }
    }

    _setError(msg) {
      if (this._err) { this._err.remove(); this._err = null; }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err'; d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => { if (this._err === d) { d.remove(); this._err = null; } }, 4000);
    }

    _render() {
      const n = parseFloat(this.getAttribute('radius'));
      const radius = (Number.isFinite(n) ? n : 8) + 'px';
      this._frame.style.borderRadius = radius;
      this._ring.style.borderRadius = radius;

      const editable = !!(window.omelette && window.omelette.writeFile);
      this.toggleAttribute('data-editable', editable);
      this._empty.querySelector('.sub').style.display = editable ? '' : 'none';

      let stored = this.id ? getSlot(this.id) : this._local;
      if (stored && stored.u && !/^data:video\//i.test(stored.u)) stored = null;
      const url = (stored && stored.u) || this.getAttribute('src') || '';
      this._cap.textContent = this.getAttribute('placeholder') || 'Drop a video';

      this._video.style.objectFit = this.getAttribute('fit') || 'cover';
      this._video.autoplay = this.hasAttribute('autoplay');
      const start = parseFloat(this.getAttribute('start')) || 0;
      const wantsLoop = this.hasAttribute('loop');
      this._video.loop = wantsLoop && start <= 0;
      if (start > 0) {
        if (!this._startBound) {
          this._startBound = true;
          this._video.preload = 'auto';
          this._video.style.visibility = 'hidden';
          this._video.addEventListener('loadedmetadata', () => { this._video.currentTime = start; });
          this._video.addEventListener('seeked', () => {
            if (this._video.currentTime >= start - 0.05) this._video.style.visibility = 'visible';
          });
          this._video.addEventListener('timeupdate', () => {
            if (wantsLoop && this._video.duration && this._video.currentTime >= this._video.duration - 0.15) {
              this._video.currentTime = start;
              this._video.play().catch(() => {});
            }
          });
        }
        if (this._video.readyState >= 1 && this._video.currentTime < start) this._video.currentTime = start;
      } else if (this._startBound) {
        this._video.style.visibility = 'visible';
      }
      this._video.muted = this.hasAttribute('muted') || this.hasAttribute('autoplay');
      this._video.controls = this.getAttribute('controls') !== 'false';
      const poster = this.getAttribute('poster');
      if (poster) this._video.poster = poster; else this._video.removeAttribute('poster');

      if (url) {
        if (this._video.getAttribute('src') !== url) this._video.src = url;
        this._video.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
      } else {
        // While the sidecar for a known id is still being fetched, stay
        // blank instead of flashing the "drop a video" placeholder.
        const pending = this.id && !loadedIds.has(this.id);
        this._video.style.display = 'none';
        this._video.removeAttribute('src');
        this._empty.style.display = pending ? 'none' : 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }

  if (!customElements.get('video-slot')) {
    customElements.define('video-slot', VideoSlot);
  }
})();
