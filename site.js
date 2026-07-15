// Shared interaction layer for the justshotyou single-page site.
// - discipline tabs: swap the active banner + grid in place (no navigation)
// - in-page smooth scroll for #anchors
// - custom blend-mode cursor (pointer devices only)
(function () {
  var root = document.querySelector('.jsy');
  if (!root) return;

  // ── Discipline tabs + top-nav switches ──
  function activate(disc) {
    root.setAttribute('data-active', disc);
    root.querySelectorAll('[data-pane]').forEach(function (p) {
      var on = p.getAttribute('data-pane') === disc;
      if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    root.querySelectorAll('[data-tab]').forEach(function (t) {
      t.setAttribute('aria-selected', t.getAttribute('data-tab') === disc ? 'true' : 'false');
    });
    root.querySelectorAll('[data-go]').forEach(function (t) {
      t.setAttribute('aria-current', t.getAttribute('data-go') === disc ? 'true' : 'false');
    });
    syncVideos();
  }
  root.querySelectorAll('[data-tab],[data-go]').forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      activate(t.getAttribute('data-tab') || t.getAttribute('data-go'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ── Mobile menu ──
  var menu = root.querySelector('[data-menu]');
  var menuBtn = root.querySelector('[data-menu-btn]');
  function closeMenu() { if (menu) { menu.setAttribute('hidden', ''); document.body.style.overflow = ''; } }
  function openMenu() { if (menu) { menu.removeAttribute('hidden'); document.body.style.overflow = 'hidden'; } }
  if (menuBtn) menuBtn.addEventListener('click', openMenu);
  if (menu) {
    menu.querySelectorAll('[data-menu-close], [data-menu-go]').forEach(function (el) {
      el.addEventListener('click', function () { closeMenu(); });
    });
  }

  // ── In-page smooth scroll ──
  root.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
      }
    });
  });

  // ── Banner videos via the YouTube IFrame API ──
  // Browsers block autoplay WITH sound, so banners autoplay muted on load with
  // a custom sound toggle (bottom-right). Clicking the video pauses it and
  // reveals a play button. The active tab's video plays; others pause.
  function frameActive(frame) { var pane = frame.closest('[data-pane]'); return !pane || !pane.hasAttribute('hidden'); }
  function syncVideos() {
    root.querySelectorAll('[data-yt]').forEach(function (frame) {
      var p = frame._yt; if (!p || !p.playVideo) return;
      try { frameActive(frame) ? p.playVideo() : p.pauseVideo(); } catch (e) {}
    });
  }
  if (root.querySelector('[data-yt]')) {
    window.onYouTubeIframeAPIReady = function () {
      root.querySelectorAll('[data-yt]').forEach(function (frame) {
        var host = frame.querySelector('.yt-host'); if (!host) return;
        var id = frame.getAttribute('data-yt');
        var p = new YT.Player(host, {
          videoId: id,
          width: '100%', height: '100%',
          playerVars: { autoplay: 1, mute: 1, loop: 1, playlist: id, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0, cc_lang_pref: 'none' },
          events: {
            onReady: function (e) { try { e.target.unloadModule('captions'); e.target.unloadModule('cc'); } catch (_) {} frame.setAttribute('data-ready', ''); if (frameActive(frame)) { try { e.target.playVideo(); } catch (_) {} } },
            onStateChange: function (e) {
              if (e.data === 1) { frame.removeAttribute('data-paused'); frame.setAttribute('data-ready', ''); }
              else if (e.data === 2) { frame.setAttribute('data-paused', ''); }
            }
          }
        });
        frame._yt = p;
        var sb = frame.querySelector('.v-sound');
        if (sb) sb.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var l = sb.querySelector('.v-label');
          if (p.isMuted && p.isMuted()) { p.unMute(); p.setVolume(100); sb.setAttribute('data-on', ''); if (l) l.textContent = 'sound on'; }
          else { p.mute(); sb.removeAttribute('data-on'); if (l) l.textContent = 'muted'; }
        });
        var tg = frame.querySelector('.v-toggle');
        if (tg) tg.addEventListener('click', function () { (p.getPlayerState && p.getPlayerState() === 1) ? p.pauseVideo() : p.playVideo(); });
      });
    };
    var tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
  }

  // ── Fashion project galleries ──
  // Photos come from the client's shared Google Drive (window.JSY_FASHION maps
  // slug -> [file IDs]); Google serves them resized. Falls back to local files
  // in assets/fashion/<slug>/N.jpg if no manifest entry exists.
  (function () {
    var FASHION = window.JSY_FASHION || {};
    var EXTS = ['jpg', 'jpeg', 'JPG', 'JPEG', 'png', 'webp'];
    function driveUrls(id, w) {
      return ['https://lh3.googleusercontent.com/d/' + id + '=w' + w,
              'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + w];
    }
    function tryUrls(urls, i, onOk, onFail) {
      if (i >= urls.length) { onFail(); return; }
      var im = new Image();
      im.onload = function () { onOk(urls[i]); };
      im.onerror = function () { tryUrls(urls, i + 1, onOk, onFail); };
      im.src = urls[i];
    }
    function tryFolder(base, n, i, onOk, onFail) {
      if (i >= EXTS.length) { onFail(); return; }
      var p = new Image();
      p.onload = function () { onOk(p.src); };
      p.onerror = function () { tryFolder(base, n, i + 1, onOk, onFail); };
      p.src = base + n + '.' + EXTS[i];
    }
    var lb = root.querySelector('[data-lightbox]');
    var lbBody = root.querySelector('[data-lb-body]');
    var lbName = lb && lb.querySelector('.lb-name');
    function addImg(src, alt) {
      var el = document.createElement('img');
      el.alt = alt; el.loading = 'lazy';
      el.addEventListener('load', function () { el.setAttribute('data-loaded', ''); });
      el.src = src;
      if (el.complete) el.setAttribute('data-loaded', '');
      lbBody.appendChild(el);
    }
    function openGallery(slug, name) {
      if (!lb) return;
      if (lbName) lbName.textContent = name;
      lbBody.innerHTML = '';
      lb.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      var ids = FASHION[slug];
      if (ids && ids.length) {
        ids.forEach(function (id) {
          var el = document.createElement('img');
          el.alt = name; el.loading = 'lazy';
          el.addEventListener('load', function () { el.setAttribute('data-loaded', ''); });
          lbBody.appendChild(el);
          tryUrls(driveUrls(id, 1600), 0, function (src) { el.src = src; if (el.complete) el.setAttribute('data-loaded', ''); }, function () { el.remove(); });
        });
        return;
      }
      var base = 'assets/fashion/' + slug + '/';
      (function seq(n) {
        if (n > 80) return;
        tryFolder(base, n, 0, function (src) { addImg(src, name + ' ' + n); seq(n + 1); },
          function () { if (n === 1) { var e = document.createElement('div'); e.className = 'lb-empty'; e.textContent = 'photos coming soon'; lbBody.appendChild(e); } });
      })(1);
    }
    function closeGallery() { if (!lb) return; lb.setAttribute('hidden', ''); lbBody.innerHTML = ''; document.body.style.overflow = ''; }
    root.querySelectorAll('.proj').forEach(function (btn) {
      var slug = btn.getAttribute('data-slug');
      var img = btn.querySelector('.proj-img');
      var ids = FASHION[slug];
      if (ids && ids.length) {
        tryUrls(driveUrls(ids[0], 1000), 0, function (src) { img.src = src; img.setAttribute('data-loaded', ''); }, function () {});
      } else {
        tryFolder('assets/fashion/' + slug + '/', 1, 0, function (src) { img.src = src; img.setAttribute('data-loaded', ''); }, function () {});
      }
      btn.addEventListener('click', function () { openGallery(slug, btn.getAttribute('data-name')); });
    });
    var closeBtn = root.querySelector('[data-lb-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeGallery);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeGallery(); });
  })();

  // ── Home stage — one merged experience: a stream of photos flowing through
  // space that resolves, as you scroll, into the 3D revolving category carousel.
  // Everything (flow, the intro→carousel transition, and horizontal drag on the
  // ring) is driven from a single rAF loop so it stays smooth on every device.
  (function () {
    var wrap = root.querySelector('[data-home-scroll]');
    var stage = root.querySelector('[data-stage]');
    var field = root.querySelector('[data-flow]');
    var ring = root.querySelector('[data-ring]');
    var title = root.querySelector('[data-title]');
    var eyebrow = root.querySelector('[data-eyebrow]');
    var hint = root.querySelector('[data-hint]');
    if (!wrap || !ring) return;

    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }

    // Fashion card cover for the carousel tile.
    var man = window.JSY_FASHION || {};
    var fImg = root.querySelector('.cat-img[data-cover="fashion"]');
    if (fImg && man['varun-bahl'] && man['varun-bahl'][0]) {
      var fid = man['varun-bahl'][0];
      var furls = ['https://lh3.googleusercontent.com/d/' + fid + '=w800', 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w800'];
      (function tryU(i) { if (i >= furls.length) return; var im = new Image(); im.onload = function () { fImg.src = furls[i]; fImg.setAttribute('data-loaded', ''); }; im.onerror = function () { tryU(i + 1); }; im.src = furls[i]; })(0);
    }

    // ── space-flow particle pool ──
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var parts = [], maxR = 0;
    if (field && !reduce) {
      // Stream every photo from every Drive project, round-robined across
      // projects so the flow stays varied instead of clustering by set.
      var covers = [], lists = Object.keys(man).map(function (k) { return man[k] || []; }), maxLen = 0;
      lists.forEach(function (a) { if (a.length > maxLen) maxLen = a.length; });
      for (var c = 0; c < maxLen; c++) for (var l = 0; l < lists.length; l++) if (lists[l][c]) covers.push(lists[l][c]);
      var grads = [
        'linear-gradient(135deg,#F3E8D6,#8C6647)', 'linear-gradient(150deg,#DCE7EE,#3A5A74)',
        'linear-gradient(150deg,#C2CDB6,#43514A)', 'linear-gradient(140deg,#EBDFCB,#3A4E86)',
        'linear-gradient(128deg,#E9DECC,#2A3C66)', 'linear-gradient(140deg,#EDE6DC,#6E6152)'
      ];
      var recycle = function (p) {
        p.ang = Math.random() * Math.PI * 2;
        p.spin = Math.random() * 14 - 7;
        p.fill.style.background = grads[p.gi++ % grads.length];
        if (!covers.length) return;
        var id = covers[p.ci++ % covers.length];
        var urls = ['https://lh3.googleusercontent.com/d/' + id + '=w620', 'https://drive.google.com/thumbnail?id=' + id + '&sz=w620'];
        p.img.removeAttribute('data-loaded');   // fade out via CSS; opacity is driven by the attribute only (no inline override)
        (function tryU(i) { if (i >= urls.length) return; var im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = function () { p.img.src = urls[i]; p.img.setAttribute('data-loaded', ''); }; im.onerror = function () { tryU(i + 1); }; im.src = urls[i]; })(0);
      };
      for (var i = 0; i < 16; i++) {
        var el = document.createElement('span'); el.className = 'flow';
        el.style.width = (128 + Math.round(Math.random() * 118)) + 'px';
        var inner = document.createElement('span'); inner.className = 'flow-inner';
        var fill = document.createElement('span'); fill.className = 'flow-fill';
        var img = document.createElement('img'); img.className = 'flow-img'; img.alt = ''; img.referrerPolicy = 'no-referrer';
        inner.appendChild(fill); inner.appendChild(img); el.appendChild(inner);
        field.appendChild(el);
        var p = { el: el, fill: fill, img: img, phase: i / 16, dur: 6.5 + Math.random() * 3.8, ang: 0, spin: 0, last: 2, gi: i, ci: i };
        recycle(p); parts.push(p);
      }
      var sizeR = function () { maxR = Math.max(window.innerWidth, window.innerHeight) * 0.62; };
      sizeR(); window.addEventListener('resize', sizeR);
    }

    // ── scroll progress across the whole merged stage ──
    var prog = 0;
    function compute() {
      var r = wrap.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      prog = total > 0 ? clamp(-r.top / total) : 0;
    }
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    compute();

    // ── horizontal drag / swipe on the carousel ──
    var dragRot = 0, down = false, decided = false, dragging = false, lastX = 0, startX = 0, startY = 0, moved = 0, lastDragEnd = 0;
    function pDown(e) { down = true; decided = dragging = false; moved = 0; lastX = startX = e.clientX; startY = e.clientY; }
    function pMove(e) {
      if (!down) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { decided = true; dragging = Math.abs(dx) > Math.abs(dy); if (dragging && stage.setPointerCapture) try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
      }
      if (dragging) { dragRot -= (e.clientX - lastX) * 0.35; moved += Math.abs(e.clientX - lastX); lastX = e.clientX; if (e.cancelable) e.preventDefault(); }
    }
    function pUp() { if (dragging && moved > 8) lastDragEnd = Date.now(); down = dragging = decided = false; }
    if (stage) {
      stage.addEventListener('pointerdown', pDown);
      stage.addEventListener('pointermove', pMove);
      window.addEventListener('pointerup', pUp);
      stage.addEventListener('pointercancel', pUp);
      // Swallow the click that ends a drag so it doesn't open a category.
      ring.addEventListener('click', function (e) { if (Date.now() - lastDragEnd < 260) { e.stopPropagation(); e.preventDefault(); } }, true);
    }

    // ── one loop drives it all ──
    var cur = 0, t0 = null, lastHint = '';
    function frame(now) {
      if (t0 === null) t0 = now;
      var t = (now - t0) / 1000, p = prog;

      // space flow — fades away as the carousel resolves
      if (parts.length) {
        var flowVis = 1 - smooth(0.30, 0.58, p);
        for (var i = 0; i < parts.length; i++) {
          var q = parts[i];
          var u = ((t / q.dur) + q.phase) % 1;
          if (u < q.last) recycle(q);
          q.last = u;
          var z = -760 + u * 1120;
          var dist = maxR * u * u;
          var rx = Math.cos(q.ang) * dist;
          var ry = Math.sin(q.ang) * dist * 0.78;
          var op = Math.min(1, u / 0.16) * Math.min(1, (1 - u) / 0.28) * 0.9 * flowVis;
          q.el.style.opacity = op.toFixed(3);
          q.el.style.transform = 'translate(-50%,-50%) translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateZ(' + (q.spin * u).toFixed(2) + 'deg)';
        }
      }

      // headline recedes; eyebrow surfaces
      if (title) {
        var tp = smooth(0.05, 0.32, p);
        title.style.opacity = (1 - tp).toFixed(3);
        title.style.transform = 'translateY(calc(-50% - ' + (48 * tp).toFixed(1) + 'px)) scale(' + (1 - 0.2 * tp).toFixed(3) + ')';
      }
      if (eyebrow) eyebrow.style.opacity = smooth(0.34, 0.56, p).toFixed(3);

      // carousel resolves in and revolves (scroll + drag)
      var ringOp = smooth(0.14, 0.44, p);
      var ringSc = 0.58 + 0.42 * smooth(0.16, 0.52, p);
      var scrollRot = smooth(0.34, 1, p) * 360;      // one full revolution over the back half
      var targetRot = scrollRot + dragRot;
      cur += (targetRot - cur) * 0.12;
      if (Math.abs(targetRot - cur) < 0.01) cur = targetRot;
      ring.style.opacity = ringOp.toFixed(3);
      ring.style.pointerEvents = ringOp > 0.6 ? 'auto' : 'none';
      ring.style.transform = 'scale(' + ringSc.toFixed(3) + ') translateZ(calc(var(--r) * -1)) rotateY(' + (-cur).toFixed(2) + 'deg)';

      if (hint) {
        var h = p < 0.3 ? 'scroll' : 'drag or scroll to revolve · tap to enter';
        if (h !== lastHint) { hint.textContent = h; lastHint = h; }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ── Custom cursor (pointer devices only) ──
  var fine = window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(hover:none)').matches;
  var ring = root.querySelector('[data-cursor-ring]');
  var inner = root.querySelector('[data-cursor-inner]');
  if (!fine || !ring) { if (ring) ring.style.display = 'none'; return; }

  var st = document.createElement('style');
  st.textContent = '.jsy, .jsy a, .jsy button, .jsy * { cursor: none !important; }';
  document.head.appendChild(st);

  var tgt = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var cur = { x: tgt.x, y: tgt.y };
  window.addEventListener('pointermove', function (e) { tgt.x = e.clientX; tgt.y = e.clientY; }, { passive: true });

  // Bind cursor labels for current + future elements (panes start hidden).
  function bindCursor(el) {
    if (el.__bound) return; el.__bound = true;
    el.addEventListener('pointerenter', function () {
      inner.setAttribute('data-big', '1');
      inner.setAttribute('data-label', el.getAttribute('data-cursor') || '');
    });
    el.addEventListener('pointerleave', function () { inner.removeAttribute('data-big'); });
  }
  root.querySelectorAll('[data-cursor]').forEach(bindCursor);

  (function loop() {
    cur.x += (tgt.x - cur.x) * 0.2;
    cur.y += (tgt.y - cur.y) * 0.2;
    ring.style.transform = 'translate(' + cur.x + 'px,' + cur.y + 'px)';
    requestAnimationFrame(loop);
  })();
})();
