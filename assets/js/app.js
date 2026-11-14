// FursaHub front-end: listing, filters, search, saved items, theme,
// homepage rails & counters, countdowns, contact form, and auto-closing
// of anything past its deadline (checked on the visitor's own date, so
// nothing expired is shown even between updates).
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const dayNum = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
  const daysUntil = (iso) => dayNum(iso) - dayNum(TODAY);
  const isOpen = (o) => !o.deadline || o.deadline >= TODAY;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}${iso.slice(0, 4) !== TODAY.slice(0, 4) ? ' ' + iso.slice(0, 4) : ''}`;

  // deadline text + status pill for a deadline
  function deadlineInfo(deadline) {
    if (!deadline) return { text: 'Open until filled', cls: '', pill: 'Open', pillCls: 'open' };
    const d = daysUntil(deadline);
    if (d < 0) return { text: 'Closed', cls: 'closed', pill: 'Closed', pillCls: 'closed' };
    if (d === 0) return { text: 'Closes today', cls: 'urgent', pill: 'Last chance', pillCls: 'urgent' };
    if (d === 1) return { text: 'Closes tomorrow', cls: 'urgent', pill: 'Last chance', pillCls: 'urgent' };
    if (d <= 7) return { text: `${d} days left`, cls: 'soon', pill: 'Closing soon', pillCls: 'soon' };
    return { text: `Closes ${shortDate(deadline)}`, cls: '', pill: 'Open', pillCls: 'open' };
  }
  function ago(iso) {
    if (!iso) return '';
    const d = -daysUntil(iso);
    if (d <= 0) return 'today';
    if (d < 7) return `${d}d`;
    if (d < 60) return `${Math.floor(d / 7)}w`;
    return `${Math.floor(d / 30)}mo`;
  }
  // fill every [data-deadline] label / pill already in the page
  function paintDeadlines(scope = document) {
    $$('.deadline[data-deadline]', scope).forEach((el) => { const i = deadlineInfo(el.dataset.deadline); el.textContent = i.text; el.className = 'deadline ' + i.cls; });
    $$('.status[data-deadline]', scope).forEach((el) => { const i = deadlineInfo(el.dataset.deadline); el.textContent = i.pill; el.className = 'status ' + i.pillCls; });
  }

  // ---------- types ----------
  const TYPES = { job: 'Job', internship: 'Internship', scholarship: 'Scholarship', grant: 'Grant', fellowship: 'Fellowship', training: 'Training', consultancy: 'Consultancy', volunteer: 'Volunteer' };
  const GROUP = { job: 'jobs', consultancy: 'jobs', internship: 'internships', volunteer: 'internships', scholarship: 'scholarships', fellowship: 'scholarships', training: 'scholarships', grant: 'grants' };
  const GROUP_LABEL = { jobs: 'Jobs', internships: 'Internships', scholarships: 'Scholarships', grants: 'Grants' };

  const initials = (s = '') => {
    const w = s.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] || '?') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
  };
  const hue = (s = '') => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  // ---------- saved ----------
  let saved = new Set(store.get('saved', []));
  const persistSaved = () => { store.set('saved', [...saved]); updateSavedCount(); };
  function updateSavedCount() {
    $$('.saved-count').forEach((el) => { el.textContent = saved.size; el.hidden = saved.size === 0; });
  }
  function toggleSave(id) {
    saved.has(id) ? saved.delete(id) : saved.add(id);
    persistSaved();
    // update every Save button for this id (it can appear in a rail and the list)
    $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => { b.setAttribute('aria-pressed', saved.has(id)); b.textContent = saved.has(id) ? 'Saved' : 'Save'; });
    toast(saved.has(id) ? 'Saved ✓' : 'Removed from saved');
  }
  async function share(url, title) {
    try {
      if (navigator.share) return await navigator.share({ title, url });
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {}
  }
  function toast(msg) {
    $('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:10px 16px;border-radius:10px;font-weight:600;z-index:50;box-shadow:var(--shadow)';
    document.body.append(t);
    setTimeout(() => t.remove(), 1600);
  }

  // ---------- theme ----------
  $('#theme-toggle')?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {} // plain string, read by the <head> script
  });

  // Bottom-nav search button
  $$('[data-focus-search]').forEach((a) => a.addEventListener('click', (e) => {
    const s = $('#search');
    if (s) { e.preventDefault(); s.focus(); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }));

  // Reveal-on-scroll animations
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -40px' })
    : null;
  const observeReveals = () => $$('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  observeReveals();

  // Contact form → opens the visitor's email app with the message ready
  const cf = $('#contact-form');
  cf?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(cf);
    const subject = `[FursaHub] ${f.get('topic')}`;
    const body = `${f.get('message')}\n\n— ${f.get('name')}`;
    location.href = `mailto:${cf.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  updateSavedCount();
  paintDeadlines();

  // ---------- detail page ----------
  const detail = $('.detail');
  if (detail) {
    const dl = detail.dataset.deadline;
    if (dl && dl < TODAY) {
      $('.closed-banner', detail).hidden = false;
      const apply = $('.apply', detail);
      apply.setAttribute('aria-disabled', 'true');
      apply.textContent = 'Applications closed';
      apply.removeAttribute('href');
    }
    // live countdown to the end of the deadline day (visitor's time)
    const cd = $('.countdown', detail);
    if (cd) {
      const end = new Date(+dl.slice(0, 4), +dl.slice(5, 7) - 1, +dl.slice(8, 10), 23, 59, 59);
      const tick = () => {
        const ms = Math.max(0, end - Date.now());
        const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
        cd.innerHTML = ms ? `<div><b>${d}</b><span>days</span></div><div><b>${h}</b><span>hours</span></div><div><b>${m}</b><span>mins</span></div>` : '';
        cd.hidden = !ms;
      };
      tick();
      setInterval(tick, 30_000);
    }
    $$('[data-deadline-card]', detail).forEach((a) => { if (a.dataset.deadlineCard && a.dataset.deadlineCard < TODAY) a.remove(); });
    const sb = $('[data-save]', detail);
    if (sb) {
      const id = sb.dataset.save;
      sb.setAttribute('aria-pressed', saved.has(id)); sb.textContent = saved.has(id) ? 'Saved' : 'Save';
      sb.addEventListener('click', () => toggleSave(id));
    }
    $('[data-share]', detail)?.addEventListener('click', () => share(location.href, document.title));
    return;
  }

  // ---------- homepage extras: rotating word ----------
  const rot = $('.rotator');
  if (rot && !reduceMotion) {
    const words = $$('span', rot);
    let i = 0;
    words[0].classList.add('on');
    setInterval(() => {
      words[i].classList.replace('on', 'out');
      const prev = words[i];
      setTimeout(() => prev.classList.remove('out'), 450);
      i = (i + 1) % words.length;
      words[i].classList.add('on');
    }, 2200);
  } else if (rot) {
    $('span', rot).classList.add('on');
  }

  // ---------- listing pages ----------
  const app = $('#app');
  if (!app) return;

  const isHome = document.body.dataset.page === 'home';
  const view = app.dataset.view; // 'list' or 'saved'
  const presetGroup = app.dataset.presetGroup || '';
  const root = $('link[rel=stylesheet]').getAttribute('href').replace(/css\/style\.css$/, '');
  const params = new URLSearchParams(location.search);
  const state = {
    tab: params.get('tab') || 'all',
    chip: params.get('type') || '',
    q: params.get('q') || '',
    country: params.get('country') ?? store.get('country', ''),
    shown: 24,
  };
  let items = [];

  const searchEl = $('#search'), countryEl = $('#country');
  searchEl.value = state.q;
  if (location.hash === '#search') setTimeout(() => searchEl.focus(), 50);

  fetch(root + 'data/opportunities.json')
    .then((r) => r.json())
    .then((data) => {
      items = data.items.filter(isOpen); // ← auto-close: drop anything past its deadline
      if (view === 'saved') {
        const open = new Set(items.map((o) => o.id));
        saved = new Set([...saved].filter((id) => open.has(id))); // forget closed ones
        persistSaved();
      }
      const hrs = Math.round((Date.now() - new Date(data.updated)) / 36e5);
      $('#updated').textContent = `${items.length.toLocaleString('en')} open opportunities · updated ${hrs < 1 ? 'less than an hour' : hrs < 48 ? hrs + ' hours' : Math.round(hrs / 24) + ' days'} ago`;
      fillCountries();
      if (isHome) renderHome();
      render();
      if (location.hash === '#browse') $('#browse')?.scrollIntoView();
    })
    .catch(() => { $('#results').innerHTML = '<div class="empty"><strong>Couldn\'t load opportunities</strong>Please check your connection and refresh.</div>'; });

  function fillCountries() {
    const counts = {};
    for (const o of items) counts[o.country] = (counts[o.country] || 0) + 1;
    const list = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    countryEl.innerHTML = '<option value="">All countries</option>' + list.map(([c, n]) => `<option value="${esc(c)}">${esc(c)} (${n})</option>`).join('');
    if (!counts[state.country]) state.country = '';
    countryEl.value = state.country;
  }

  // Homepage: live stats, category counts, rails
  function renderHome() {
    const week = items.filter((o) => o.deadline && daysUntil(o.deadline) <= 7).length;
    const fresh = items.filter((o) => o.posted && -daysUntil(o.posted) <= 7).length;
    const live = { open: items.length, week, fresh, countries: new Set(items.map((o) => o.country)).size };
    $$('[data-stat]').forEach((el) => countUp(el, live[el.dataset.stat]));

    const cat = {};
    for (const o of items) cat[o.type] = (cat[o.type] || 0) + 1;
    cat.remote = items.filter((o) => o.remote).length;
    $$('[data-cat]').forEach((el) => {
      const n = cat[el.dataset.cat] || 0;
      el.textContent = n.toLocaleString('en');
      el.closest('.cat').classList.toggle('empty-cat', !n);
    });

    const rail = (sel, list, empty) => { $(sel).innerHTML = list.length ? list.map(card).join('') : `<p class="rail-empty">${empty}</p>`; };
    rail('#rail-closing', items.filter((o) => o.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 12), 'Nothing closing in the next few days.');
    rail('#rail-new', [...items].sort((a, b) => (b.posted || '').localeCompare(a.posted || '')).slice(0, 12), 'New opportunities are added every day.');
    const featured = items.filter((o) => o.featured);
    if (featured.length) { $('#featured-section').hidden = false; rail('#rail-featured', featured.slice(0, 12), ''); }
  }

  function countUp(el, target) {
    if (reduceMotion || !target) { el.textContent = (target || 0).toLocaleString('en'); return; }
    const start = performance.now(), dur = 1100;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const matchesQ = (o, q) => !q || `${o.title} ${o.org} ${o.country} ${TYPES[o.type]} ${o.summary}`.toLowerCase().includes(q);
  const TABS = [
    ['all', 'All', () => true],
    ['closing', 'Closing soon', (o) => o.deadline && daysUntil(o.deadline) <= 7],
    ['new', 'New', (o) => o.posted && -daysUntil(o.posted) <= 7],
    ['remote', 'Remote', (o) => o.remote],
  ];

  function render() {
    const q = state.q.trim().toLowerCase();
    const base = items.filter((o) =>
      (view !== 'saved' || saved.has(o.id)) &&
      (!presetGroup || GROUP[o.type] === presetGroup) &&
      (!state.country || o.country === state.country) &&
      matchesQ(o, q));

    $('#tabs').innerHTML = TABS.map(([key, label, fn]) =>
      `<button class="tab" role="tab" data-tab="${key}" aria-selected="${state.tab === key}">${label}<small>${base.filter(fn).length.toLocaleString('en')}</small></button>`).join('');
    const tabFn = (TABS.find((t) => t[0] === state.tab) || TABS[0])[2];
    const inTab = base.filter(tabFn);

    // chips: groups on general pages, specific types on a group page
    const keyOf = presetGroup ? (o) => o.type : (o) => GROUP[o.type];
    const labelOf = presetGroup ? (k) => TYPES[k] + 's' : (k) => GROUP_LABEL[k];
    const chipCounts = {};
    for (const o of inTab) { const k = keyOf(o); chipCounts[k] = (chipCounts[k] || 0) + 1; }
    const chipKeys = Object.keys(chipCounts).sort((a, b) => chipCounts[b] - chipCounts[a]);
    const chipValid = !state.chip || chipCounts[state.chip] || (presetGroup ? GROUP[state.chip] === presetGroup : GROUP_LABEL[state.chip]);
    if (!chipValid) state.chip = '';
    $('#chips').innerHTML = chipKeys.length > 1 || state.chip
      ? `<button class="chip" data-chip="" aria-pressed="${!state.chip}">All types<small>${inTab.length.toLocaleString('en')}</small></button>` +
        chipKeys.map((k) => `<button class="chip" data-chip="${k}" aria-pressed="${state.chip === k}">${labelOf(k)}<small>${chipCounts[k].toLocaleString('en')}</small></button>`).join('')
      : '';

    const list = inTab.filter((o) => !state.chip || keyOf(o) === state.chip);
    const byDeadline = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999');
    const byPosted = (a, b) => (b.posted || '').localeCompare(a.posted || '');
    list.sort(state.tab === 'closing' ? byDeadline : (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || byPosted(a, b));

    const res = $('#results');
    if (!list.length) {
      const label = state.chip ? (presetGroup ? TYPES[state.chip] + 's' : GROUP_LABEL[state.chip])?.toLowerCase() : 'opportunities';
      res.innerHTML = view === 'saved' && !saved.size
        ? '<div class="empty"><strong>🔖 Nothing saved yet</strong>Tap “Save” on any opportunity to keep it here.</div>'
        : `<div class="empty"><strong>No open ${label || 'opportunities'} right now</strong>New listings arrive every day. Try another search, country or tab.</div>`;
      $('#load-more').hidden = true;
      syncUrl();
      return;
    }
    const html = [];
    list.slice(0, state.shown).forEach((o, i) => {
      html.push(card(o));
      if ((i + 1) % 10 === 0) html.push('<div class="ad-slot"></div>'); // AdSense spot (hidden while empty)
    });
    res.innerHTML = html.join('');
    $('#load-more').hidden = list.length <= state.shown;
    $('#load-more').textContent = `Show more (${(list.length - state.shown).toLocaleString('en')} left)`;
    syncUrl();
  }

  function card(o) {
    const d = deadlineInfo(o.deadline);
    const isNew = o.posted && -daysUntil(o.posted) <= 3;
    const href = `${root}o/${o.slug}.html`;
    return `<article class="card${o.featured ? ' featured' : ''}">
      <div class="card-top">
        <span class="avatar" style="--h:${hue(o.org)}">${esc(initials(o.org))}</span>
        <div class="org"><b>${esc(o.org)}</b> · ${esc(o.country)}${o.posted ? ' · ' + ago(o.posted) : ''}</div>
      </div>
      <span class="status ${d.pillCls}">${d.pill}</span>
      <h3><a href="${href}">${esc(o.title)}</a></h3>
      ${o.summary ? `<p class="sum">${esc(o.summary)}</p>` : ''}
      <div class="card-foot">
        <span class="badge">${TYPES[o.type] || 'Opportunity'}</span>
        ${o.remote ? '<span class="badge remote">Remote</span>' : ''}
        ${isNew ? '<span class="badge new">New</span>' : ''}
        ${o.featured ? '<span class="badge new">★ Featured</span>' : ''}
        <span class="deadline ${d.cls}">${d.text}</span>
        <span class="card-actions">
          <button class="mini-btn" data-save="${esc(o.id)}" aria-pressed="${saved.has(o.id)}">${saved.has(o.id) ? 'Saved' : 'Save'}</button>
          <button class="mini-btn" data-share="${href}" data-title="${esc(o.title)}">Share</button>
        </span>
      </div>
    </article>`;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.tab !== 'all') p.set('tab', state.tab);
    if (state.chip) p.set('type', state.chip);
    if (state.q) p.set('q', state.q);
    if (state.country) p.set('country', state.country);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }

  // ---------- events ----------
  let timer;
  const goBrowse = () => { if (isHome) $('#browse').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); };
  searchEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = searchEl.value; state.shown = 24; render(); }, 180); });
  searchEl.closest('form').addEventListener('submit', () => { state.q = searchEl.value; render(); goBrowse(); searchEl.blur(); });
  countryEl.addEventListener('change', () => { state.country = countryEl.value; store.set('country', state.country); state.shown = 24; render(); goBrowse(); });
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { state.tab = b.dataset.tab; state.shown = 24; render(); } });
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-chip]'); if (b) { state.chip = b.dataset.chip; state.shown = 24; render(); } });
  $('#load-more').addEventListener('click', () => { state.shown += 24; render(); });
  // Save / Share buttons anywhere in the page (list and rails)
  document.addEventListener('click', (e) => {
    const s = e.target.closest('.card [data-save]');
    if (s) { toggleSave(s.dataset.save); if (view === 'saved') render(); return; }
    const sh = e.target.closest('.card [data-share]');
    if (sh) share(new URL(sh.dataset.share, location.href).href, sh.dataset.title);
  });
})();
