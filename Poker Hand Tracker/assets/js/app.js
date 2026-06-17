// ============================================================
//  app.js — Render + eventos (capa de presentación)
// ============================================================
(function () {
  'use strict';
  const C = window.PHTCalc;
  const Db = window.PHTDb;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- estado global ----
  const state = { user: null, cfg: null, sessions: [], hands: [], monthSel: C.monthKey(), entered: false };

  const MOOD_COLORS = { 1: '#ff5d5d', 2: '#ff8c42', 3: '#f5c518', 4: '#9be15d', 5: '#00ff88' };
  const CARD_RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
  const CARD_SUITS = [
    { key:'c', sym:'♣', color:'#2ecc71' },
    { key:'d', sym:'♦', color:'#5b8def' },
    { key:'h', sym:'♥', color:'#e74c3c' },
    { key:'s', sym:'♠', color:'#b0b0b8' },
  ];
  function parseCards(str) {
    return ((str||'').match(/[AKQJTakqjt2-9][cdhs]/gi)||[]).map(c=>c[0].toUpperCase()+c[1].toLowerCase());
  }
  function openCardPicker(inputEl, max, fmt) {
    const current = parseCards(inputEl.value);
    let selected = [...current];
    const overlay = document.createElement('div');
    overlay.className = 'card-picker-overlay';
    function getExcluded() {
      return [...document.querySelectorAll('.card-input')]
        .filter(el => el !== inputEl).flatMap(el => parseCards(el.value));
    }
    function render() {
      const excluded = getExcluded();
      overlay.innerHTML = `<div class="card-picker-modal">
        <div class="card-picker-head">
          <div class="card-picker-sel">
            ${selected.length ? selected.map(c=>{const s=CARD_SUITS.find(x=>x.key===c.slice(-1));return `<div class="crd suit-${c.slice(-1)}">${c.slice(0,-1)}<span>${s?.sym||''}</span></div>`;}).join('')
              : '<span style="color:var(--muted);font-size:13px">Ninguna</span>'}
            <span style="color:var(--faint);font-size:12px;margin-left:6px">${selected.length}/${max}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" id="cp-clear">Limpiar</button>
            <button class="btn btn-primary btn-sm" id="cp-ok">Confirmar</button>
          </div>
        </div>
        <div class="card-picker-grid">
          ${CARD_SUITS.map(suit=>`<div class="cp-suit-row">${CARD_RANKS.map(rank=>{
            const card=rank+suit.key, isSel=selected.includes(card), isExcl=excluded.includes(card);
            return `<button type="button" class="cp-btn${isSel?' sel':''}${isExcl?' excl':''}" data-card="${card}" style="--sc:${suit.color}"${isExcl?' disabled':''}>${rank}<span>${suit.sym}</span></button>`;
          }).join('')}</div>`).join('')}
        </div>
      </div>`;
      overlay.querySelectorAll('.cp-btn:not(.excl)').forEach(btn=>{
        btn.onclick=()=>{
          const c=btn.dataset.card;
          selected=selected.includes(c)?selected.filter(x=>x!==c):(selected.length<max?[...selected,c]:selected);
          render();
        };
      });
      overlay.querySelector('#cp-clear').onclick=()=>{selected=[];render();};
      overlay.querySelector('#cp-ok').onclick=()=>{
        inputEl.value=fmt==='space'?selected.join(' '):selected.join('');
        overlay.remove();
      };
      overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
    }
    render();
    document.body.appendChild(overlay);
  }
  const chartInstances = {};

  // ---- formato ----
  const curSym = () => ({ USD: '$', EUR: '€', ARS: '$', GBP: '£', BRL: 'R$' }[state.cfg?.currency] || '$');
  function money(n, sign = false) {
    n = C.num(n);
    const abs = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const s = curSym() + abs;
    if (!sign) return (n < 0 ? '−' : '') + s;
    return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
  }
  const pct = (n) => (C.num(n) * 100).toFixed(1) + '%';
  const hrs = (n) => C.num(n).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' h';
  const cls = (n) => (C.num(n) > 0 ? 'pos' : C.num(n) < 0 ? 'neg' : '');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ============================================================
  //  AUTH
  // ============================================================
  let authMode = 'login';

  function bindAuth() {
    $('#tab-login').onclick = () => setAuthMode('login');
    $('#tab-register').onclick = () => setAuthMode('register');
    $('#auth-form').onsubmit = onAuthSubmit;
    $('#demo-btn').onclick = onDemoLogin;
  }

  function setAuthMode(m) {
    authMode = m;
    $('#tab-login').classList.toggle('active', m === 'login');
    $('#tab-register').classList.toggle('active', m === 'register');
    $('#auth-submit').textContent = m === 'login' ? 'Entrar' : 'Crear cuenta';
    $('#auth-banner').innerHTML = '';
  }

  function showDemoOption() {
    $('#demo-divider').style.display = 'block';
    $('#demo-btn').style.display = 'block';
    $('#auth-sub-note').textContent = 'El modo demo usa datos de ejemplo guardados en tu navegador.';
  }

  async function onDemoLogin() {
    $('#demo-btn').disabled = true;
    $('#demo-btn').textContent = 'Cargando…';
    try {
      await Db.signIn('demo@poker.app', 'demo');
      const u = await Db.currentUser();
      state.user = u;
      await enterApp();
    } catch (err) {
      $('#auth-banner').innerHTML = `<div class="banner error">${esc(err.message)}</div>`;
      $('#demo-btn').disabled = false;
      $('#demo-btn').textContent = '🎮 Explorar en modo demo';
    }
  }

  async function onAuthSubmit(e) {
    e.preventDefault();
    const email = $('#auth-email').value.trim();
    const pass = $('#auth-pass').value;
    $('#err-email').textContent = '';
    $('#err-pass').textContent = '';
    if (!/^\S+@\S+\.\S+$/.test(email)) return ($('#err-email').textContent = 'Email no válido.');
    if (pass.length < 6) return ($('#err-pass').textContent = 'Mínimo 6 caracteres.');
    const btn = $('#auth-submit');
    btn.disabled = true;
    btn.textContent = 'Procesando…';
    try {
      if (authMode === 'register') {
        const signUpFn = Db.REAL_signUp || Db.signIn;
        const r = await signUpFn(email, pass);
        if (r && !r.session) {
          $('#auth-banner').innerHTML = '<div class="banner ok">✅ Cuenta creada. Revisá tu email para confirmar y luego iniciá sesión.</div>';
          setAuthMode('login');
          return;
        }
      } else {
        await Db.signIn(email, pass);
      }
      const u = await Db.currentUser();
      if (u) { state.user = u; await enterApp(); }
    } catch (err) {
      $('#auth-banner').innerHTML = `<div class="banner error">${esc(translateErr(err.message))}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? 'Entrar' : 'Crear cuenta';
    }
  }

  function translateErr(m = '') {
    if (/invalid login|invalid credentials/i.test(m)) return 'Email o contraseña incorrectos.';
    if (/already registered/i.test(m)) return 'Ese email ya está registrado.';
    if (/confirm/i.test(m)) return 'Confirmá tu email antes de entrar.';
    return m;
  }

  // ============================================================
  //  BOOT
  // ============================================================
  async function boot() {
    bindAuth();

    if (Db.demo) {
      // Sin Supabase: mostrar form deshabilitado + botón demo
      $('#auth-form').style.opacity = '.35';
      $('#auth-form').style.pointerEvents = 'none';
      $('#auth-tabs').style.opacity = '.35';
      $('#auth-banner').innerHTML =
        '<div class="banner warn">⚠️ Supabase no configurado. Editá <code>assets/js/config.js</code> para habilitar cuentas reales.</div>';
      showDemoOption();
      $('#loader').classList.add('hidden');
      $('#auth-screen').classList.remove('hidden');

      // Si ya estaba en demo antes, auto-login
      const cached = await Db.currentUser();
      if (cached) { state.user = cached; await enterApp(); }
      return;
    }

    // Con Supabase: flujo normal
    Db.onAuth(async (user) => {
      if (user && !state.entered) { state.user = user; await enterApp(); }
      else if (!user && state.entered) { location.reload(); }
    });
    const u = await Db.currentUser();
    if (u) { state.user = u; await enterApp(); }
    else { showAuth(); }
  }

  function showAuth() {
    $('#loader').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
  }

  async function enterApp() {
    if (state.entered) return;
    state.entered = true;
    $('#loader').classList.remove('hidden');
    try {
      state.cfg = await Db.loadConfig(state.user.id);
      state.sessions = await Db.loadSessions(state.user.id);
      state.hands = await Db.loadHands(state.user.id);
    } catch (err) {
      alert('Error cargando datos: ' + err.message);
      state.entered = false;
      return;
    }
    $('#auth-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#loader').classList.add('hidden');

    // Indicadores de usuario
    const isDemo = state.user.demo || Db.demo;
    $('#user-email').textContent = isDemo ? 'Modo Demo' : state.user.email;
    $('#user-av').textContent = isDemo ? '🎮' : (state.user.email[0] || 'P').toUpperCase();
    if (isDemo) {
      $('#demo-badge').classList.remove('hidden');
      $('#demo-app-banner').classList.remove('hidden');
    }

    initShell();
    fillStaticSelects();
    renderAll();
  }

  // ============================================================
  //  SHELL / NAV
  // ============================================================
  const PAGES = {
    inicio:    ['Inicio',           'Resumen rápido y objetivos del mes'],
    registro:  ['Registro',         'Todas tus sesiones'],
    manos:     ['Manos',            'Anotador de manos para estudio'],
    dashboard: ['Dashboard',        'Métricas globales de tu juego'],
    mensual:   ['Análisis mensual', 'Métricas filtradas por mes'],
    objetivos: ['Objetivos',        'Progreso de proceso del mes'],
    mental:    ['Mental Game',      'Tu estado mental vs. resultados'],
    config:    ['Config',           'Perfil y parámetros'],
  };

  function initShell() {
    $$('#nav a').forEach((a) => {
      a.addEventListener('click', (e) => { e.stopPropagation(); go(a.dataset.view); });
      a.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); go(a.dataset.view); });
    });
    $('#logout-btn').onclick = async () => {
      await Db.signOut();
      state.entered = false;
      location.reload();
    };
    $('#hamburger').onclick = (e) => { e.stopPropagation(); $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); };
    $('#scrim').onclick = closeSidebar;
    $('#scrim').addEventListener('touchend', (e) => { e.preventDefault(); closeSidebar(); });
    $('#month-sel').value = state.monthSel;
    $('#month-sel').onchange = (e) => { state.monthSel = e.target.value || C.monthKey(); renderMensual(); };
  }

  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

  function go(view) {
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    $$('.view').forEach((v) => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    $('#pg-title').textContent = PAGES[view][0];
    $('#pg-sub').textContent = PAGES[view][1];
    renderTopbar(view);
    closeSidebar();
    if (view === 'dashboard') renderCharts();
  }

  function renderTopbar(view) {
    const host = $('#topbar-actions');
    host.innerHTML = '';
    if (view === 'registro') {
      host.append(
        btn('⬇ CSV', 'btn-ghost', exportCSV),
        btn('＋ Nueva sesión', 'btn-primary', () => openSessionModal())
      );
    }
    if (view === 'objetivos') {
      host.append(btn('📚 Agregar estudio', 'btn-ghost', () => openStudyModal()));
    }
    if (view === 'manos') {
      host.append(btn('＋ Anotar mano', 'btn-primary', () => openHandModal()));
    }
  }

  function btn(label, klass, onClick) {
    const b = document.createElement('button');
    b.className = 'btn ' + klass;
    b.innerHTML = label;
    b.onclick = onClick;
    return b;
  }

  function fillStaticSelects() {
    const used = [...new Set(state.sessions.map((s) => s.stakes).filter(Boolean))];
    const defaults = ['NL10','NL25','NL50','NL100','NL200','NL500','1-2','1-3','2-5','5-10','10-20'];
    const suggestions = [...new Set([...used, ...defaults])];
    let dl = document.getElementById('stakes-suggestions');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'stakes-suggestions'; document.body.appendChild(dl); }
    dl.innerHTML = suggestions.map((s) => `<option value="${esc(s)}">`).join('');
    $('#flt-stake').innerHTML = '<option value="">Stake</option>' + used.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }

  // ============================================================
  //  RENDER ALL
  // ============================================================
  function renderAll() {
    renderInicio();
    renderRegistro();
    renderManos();
    renderDashboardKpis();
    renderMensual();
    renderObjetivos();
    renderMental();
    renderConfig();
    if ($('#view-dashboard').classList.contains('active')) renderCharts();
  }

  function kpi(k, v, valueClass = '', sub = '', glow = false) {
    return `<div class="kpi${glow ? ' glow' : ''}"><div class="k">${k}</div><div class="v ${valueClass} mono">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
  }

  // ---- INICIO ----
  function renderInicio() {
    const h = C.home(state.sessions, state.cfg);
    $('#home-kpis').innerHTML = [
      kpi('💰 Bankroll actual',  money(h.bankroll),              cls(h.bankroll - C.num(state.cfg.initial_bankroll)), '', true),
      kpi('📈 P&L del mes',      money(h.monthPL, true),         cls(h.monthPL)),
      kpi('⏱ $/hora del mes',   money(h.monthPerHour, true),    cls(h.monthPerHour)),
      kpi('🃏 Sesiones / mes',   h.monthSessions,                '',  `meta ${C.num(state.cfg.goal_sessions)}`),
      kpi('🕒 Horas / mes',      hrs(h.monthHours),              '',  `meta ${C.num(state.cfg.goal_hours)} h`),
      kpi('🎯 Obj. horas %',     pct(h.goalHoursPct),            h.goalHoursPct >= 1 ? 'pos' : ''),
    ].join('');
    $('#home-goals').innerHTML = goalsHtml(C.goals(state.sessions, state.cfg).slice(0, 2));
    animateBars($('#home-goals'));
  }

  // ---- REGISTRO ----
  function bindFilters() {
    ['flt-q', 'flt-mode', 'flt-stake', 'flt-month'].forEach((id) => {
      const el = $('#' + id);
      if (el && !el._b) { el._b = true; el.oninput = renderRegistro; el.onchange = renderRegistro; }
    });
    const cl = $('#clear-filters');
    if (cl && !cl._b) { cl._b = true; cl.onclick = () => { ['flt-q','flt-mode','flt-stake','flt-month'].forEach(id => $('#'+id).value=''); renderRegistro(); }; }
  }

  function filteredSessions() {
    const q = $('#flt-q').value.toLowerCase().trim();
    const mode = $('#flt-mode').value, stake = $('#flt-stake').value, month = $('#flt-month').value;
    return C.withBankroll(state.sessions, state.cfg.initial_bankroll).filter((s) => {
      if (mode && s.mode !== mode) return false;
      if (stake && s.stakes !== stake) return false;
      if (month && (s.played_on || '').slice(0, 7) !== month) return false;
      if (q && !((s.site||'') + ' ' + (s.notes||'') + ' ' + (s.stakes||'')).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderRegistro() {
    bindFilters();
    const rows = filteredSessions().sort((a, b) =>
      a.played_on < b.played_on ? 1 : a.played_on > b.played_on ? -1 : (a.created_at||'') < (b.created_at||'') ? 1 : -1
    );
    const body = $('#reg-body');
    $('#reg-empty').classList.toggle('hidden', rows.length > 0);
    body.innerHTML = rows.map((s) => {
      const r = C.result(s);
      const mc = MOOD_COLORS[s.mood] || '#5b5f6a';
      return `<tr>
        <td data-label="Fecha" class="mono">${esc(s.played_on)}</td>
        <td data-label="Modalidad"><span class="pill ${s.mode === 'Live' ? 'live' : s.mode === 'Estudio' ? 'study' : 'online'}">${esc(s.mode)}</span></td>
        <td data-label="Sitio">${esc(s.site) || '—'}</td>
        <td data-label="Stakes">${esc(s.stakes) || '—'}</td>
        <td data-label="Horas" class="mono">${C.num(s.hours)}</td>
        <td data-label="Buy-in" class="mono">${money(s.buyin)}</td>
        <td data-label="Cash-out" class="mono">${money(s.cashout)}</td>
        <td data-label="Resultado" class="mono ${cls(r)}"><b>${money(r, true)}</b></td>
        <td data-label="Bankroll" class="mono">${money(s.bankroll)}</td>
        <td data-label="Mood">${s.mood ? `<span class="mood-dot" style="background:${mc}">${s.mood}</span>` : '—'}</td>
        <td data-label="" style="text-align:right;white-space:nowrap">
          <button class="icon-btn" data-edit="${s.id}">✎</button>
          <button class="icon-btn danger" data-del="${s.id}">🗑</button>
        </td>
      </tr>`;
    }).join('');
    $$('[data-edit]', body).forEach((b) => (b.onclick = () => openSessionModal(b.dataset.edit)));
    $$('[data-del]',  body).forEach((b) => (b.onclick = () => removeSession(b.dataset.del)));
  }

  // ---- DASHBOARD KPIs ----
  function renderDashboardKpis() {
    const d = C.dashboard(state.sessions, state.cfg.initial_bankroll);
    $('#dash-kpis').innerHTML = [
      kpi('💰 P&L neto total',    money(d.pl, true),              cls(d.pl), '', true),
      kpi('🏦 Bankroll actual',   money(d.currentBankroll),       cls(d.currentBankroll - C.num(state.cfg.initial_bankroll))),
      kpi('⏱ $/hora total',      money(d.perHour, true),         cls(d.perHour)),
      kpi('🕒 Horas totales',     hrs(d.hours)),
      kpi('🃏 Sesiones',          d.sessions),
      kpi('✅ % ganadas',         pct(d.winPct)),
      kpi('🏆 Mejor sesión',      money(d.best, true),            'pos'),
      kpi('💀 Peor sesión',       money(d.worst, true),           cls(d.worst)),
      kpi('🔥 Mejor racha',       money(d.bestStreak, true),      'pos'),
      kpi('🧊 Peor racha',        money(d.worstStreak, true),     cls(d.worstStreak)),
      kpi('🎰 Stake más jugado',  d.mostStake),
      kpi('🟡 P&L Live',         money(d.plLive, true),          cls(d.plLive), money(d.perHourLive, true) + ' /h'),
      kpi('🟢 P&L Online',       money(d.plOnline, true),        cls(d.plOnline), money(d.perHourOnline, true) + ' /h'),
    ].join('');
  }

  // ============================================================
  //  CHARTS — Chart.js si está disponible, SVG propio si no
  // ============================================================
  function renderCharts() {
    const withBR = C.withBankroll(state.sessions, state.cfg.initial_bankroll);

    if (typeof Chart !== 'undefined') {
      renderChartJs(withBR);
    } else {
      renderSVGCharts(withBR);
    }
  }

  // ---- Chart.js ----
  function renderChartJs(withBR) {
    const labels = withBR.map((s) => s.played_on);
    const data   = withBR.map((s) => s.bankroll);
    const col    = (data[data.length - 1] ?? 0) >= C.num(state.cfg.initial_bankroll) ? '#00ff88' : '#ff5d5d';

    mkChart('chart-bankroll', {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['Inicio'],
        datasets: [{
          label: 'Bankroll', data: data.length ? data : [C.num(state.cfg.initial_bankroll)],
          borderColor: col, borderWidth: 2.5, tension: 0, fill: true,
          pointRadius: data.length > 40 ? 0 : 3, pointBackgroundColor: col,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return 'rgba(0,255,136,.15)';
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, col === '#00ff88' ? 'rgba(0,255,136,.35)' : 'rgba(255,93,93,.35)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            return g;
          },
        }],
      },
      options: baseOpts(true),
    });

    const byStake = C.plByStake(state.sessions);
    const stakes  = C.STAKES.filter((s) => state.sessions.some((x) => x.stakes === s));
    mkChart('chart-stake', {
      type: 'bar',
      data: {
        labels: stakes.length ? stakes : ['—'],
        datasets: [{
          data: (stakes.length ? stakes : ['—']).map((s) => byStake[s] || 0),
          backgroundColor: (stakes.length ? stakes : ['—']).map((s) => (byStake[s] >= 0 ? 'rgba(0,255,136,.7)' : 'rgba(255,93,93,.7)')),
          borderRadius: 7, borderSkipped: false,
        }],
      },
      options: baseOpts(false),
    });

    const md = C.moodDistribution(state.sessions);
    mkChart('chart-mood', {
      type: 'doughnut',
      data: {
        labels: ['1 Tilt', '2 Mal', '3 Neutral', '4 Bien', '5 A-Game'],
        datasets: [{ data: md, backgroundColor: [1,2,3,4,5].map((m) => MOOD_COLORS[m]), borderColor: '#0a0a0b', borderWidth: 3 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'right', labels: { color: '#8b8f9a', boxWidth: 12, font: { size: 11 } } } },
      },
    });
  }

  function baseOpts(isMoney) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#101014', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 10,
          callbacks: { label: (c) => money(c.parsed.y ?? c.parsed) },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#5b5f6a', maxTicksLimit: 8, font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#5b5f6a', font: { size: 10 }, callback: (v) => curSym() + v } },
      },
    };
  }

  function mkChart(id, conf) {
    const el = document.getElementById(id);
    if (!el) return;
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(el, conf);
  }

  // ---- SVG charts (fallback sin Chart.js) ----
  function svgWrap(id, svgContent, w = 800, h = 280) {
    const el = document.getElementById(id);
    if (!el) return;
    const wrap = el.parentElement;
    el.style.display = 'none';
    const old = wrap.querySelector('.svg-chart');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'svg-chart';
    div.style.cssText = 'width:100%;height:100%';
    div.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">${svgContent}</svg>`;
    wrap.appendChild(div);
  }

  function renderSVGCharts(withBR) {
    // --- Bankroll line ---
    const W = 800, H = 280, pad = { t: 20, b: 36, l: 60, r: 20 };
    const data = withBR.map((s) => s.bankroll);
    const initial = C.num(state.cfg.initial_bankroll);
    if (data.length === 0) {
      svgWrap('chart-bankroll',
        `<text x="400" y="140" fill="#5b5f6a" text-anchor="middle" font-size="14" font-family="Inter,sans-serif">Registrá sesiones para ver la evolución</text>`, W, H);
    } else {
      const allVals = [initial, ...data];
      const minV = Math.min(...allVals), maxV = Math.max(...allVals);
      const range = maxV - minV || 1;
      const xScale = (i) => pad.l + (i / (data.length - 1 || 1)) * (W - pad.l - pad.r);
      const yScale = (v) => pad.t + (1 - (v - minV) / range) * (H - pad.t - pad.b);
      const pts = data.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
      const lastY = yScale(data[data.length - 1]);
      const zy = yScale(initial);
      const posCol = data[data.length - 1] >= initial ? '#00ff88' : '#ff5d5d';
      const areaPath = `M${pad.l},${zy} L${data.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' L')} L${xScale(data.length - 1)},${zy} Z`;
      // grid lines
      const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + t * (H - pad.t - pad.b);
        const v = maxV - t * range;
        return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
                <text x="${pad.l - 6}" y="${y + 4}" fill="#5b5f6a" font-size="9" text-anchor="end" font-family="Inter,sans-serif">${curSym()}${v.toFixed(0)}</text>`;
      }).join('');
      // date labels (max 6)
      const step = Math.ceil(data.length / 6);
      const dateLabels = data.map((_, i) => i).filter((i) => i === 0 || i === data.length - 1 || i % step === 0).map((i) => {
        const x = xScale(i);
        return `<text x="${x}" y="${H - 6}" fill="#5b5f6a" font-size="9" text-anchor="middle" font-family="Inter,sans-serif">${withBR[i].played_on.slice(5)}</text>`;
      }).join('');

      svgWrap('chart-bankroll', `
        <defs>
          <linearGradient id="brGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${posCol}" stop-opacity=".3"/>
            <stop offset="100%" stop-color="${posCol}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <line x1="${pad.l}" y1="${zy}" x2="${W-pad.r}" y2="${zy}" stroke="${posCol}" stroke-dasharray="4,3" stroke-opacity=".4" stroke-width="1"/>
        <path d="${areaPath}" fill="url(#brGrad)"/>
        <polyline points="${pts}" fill="none" stroke="${posCol}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${data.length <= 30 ? data.map((v, i) => `<circle cx="${xScale(i)}" cy="${yScale(v)}" r="3" fill="${posCol}"/>`).join('') : ''}
        ${dateLabels}
      `, W, H);
    }

    // --- P&L por stake (barras) ---
    const byStake = C.plByStake(state.sessions);
    const stakes  = C.STAKES.filter((s) => state.sessions.some((x) => x.stakes === s));
    const SW = 760, SH = 260, sp = { t: 20, b: 36, l: 50, r: 20 };
    if (stakes.length === 0) {
      svgWrap('chart-stake', `<text x="380" y="130" fill="#5b5f6a" text-anchor="middle" font-size="14" font-family="Inter,sans-serif">Sin datos</text>`, SW, SH);
    } else {
      const vals = stakes.map((s) => byStake[s] || 0);
      const maxAbs = Math.max(1, ...vals.map(Math.abs));
      const bW = Math.min(54, (SW - sp.l - sp.r) / stakes.length - 8);
      const midY = sp.t + (SH - sp.t - sp.b) / 2;
      const yScale2 = (v) => midY - (v / maxAbs) * ((SH - sp.t - sp.b) / 2 - 4);
      const bars = stakes.map((s, i) => {
        const v = vals[i], x = sp.l + i * ((SW - sp.l - sp.r) / stakes.length) + ((SW - sp.l - sp.r) / stakes.length - bW) / 2;
        const col = v >= 0 ? '#00ff88' : '#ff5d5d';
        const barTop = Math.min(midY, yScale2(v)), barH = Math.abs(midY - yScale2(v));
        return `<rect x="${x}" y="${barTop}" width="${bW}" height="${Math.max(barH, 2)}" fill="${col}" opacity=".75" rx="5"/>
                <text x="${x + bW/2}" y="${barTop - 4}" fill="${col}" font-size="9" text-anchor="middle" font-family="Inter,sans-serif">${v >= 0 ? '+' : ''}${curSym()}${Math.abs(v).toFixed(0)}</text>
                <text x="${x + bW/2}" y="${SH - 8}" fill="#5b5f6a" font-size="9" text-anchor="middle" font-family="Inter,sans-serif">${s}</text>`;
      }).join('');
      svgWrap('chart-stake', `
        <line x1="${sp.l}" y1="${midY}" x2="${SW - sp.r}" y2="${midY}" stroke="rgba(255,255,255,.15)" stroke-width="1"/>
        ${bars}
      `, SW, SH);
    }

    // --- Distribución de mood (dona simplificada) ---
    const md = C.moodDistribution(state.sessions);
    const total = md.reduce((a, b) => a + b, 0);
    const DW = 760, DH = 260, cx = DW * 0.38, cy = DH / 2, R = 90, ri = 58;
    if (total === 0) {
      svgWrap('chart-mood', `<text x="380" y="130" fill="#5b5f6a" text-anchor="middle" font-size="14" font-family="Inter,sans-serif">Sin datos de mood</text>`, DW, DH);
    } else {
      const moodLabels = ['1 Tilt', '2 Mal', '3 Neutral', '4 Bien', '5 A-Game'];
      let angle = -Math.PI / 2;
      const slices = md.map((count, i) => {
        if (!count) return '';
        const a = (count / total) * Math.PI * 2;
        const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
        angle += a;
        const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
        const xi1 = cx + ri * Math.cos(angle - a), yi1 = cy + ri * Math.sin(angle - a);
        const xi2 = cx + ri * Math.cos(angle), yi2 = cy + ri * Math.sin(angle);
        const large = a > Math.PI ? 1 : 0;
        return `<path d="M${xi1},${yi1} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large} 0 ${xi1},${yi1} Z" fill="${MOOD_COLORS[i+1]}" opacity=".85"/>`;
      }).join('');
      const legend = moodLabels.map((lbl, i) => {
        const y = DH / 2 - 50 + i * 26;
        return md[i] ? `<rect x="${DW*.72}" y="${y - 8}" width="12" height="12" rx="3" fill="${MOOD_COLORS[i+1]}"/>
          <text x="${DW*.72+18}" y="${y+2}" fill="#8b8f9a" font-size="11" font-family="Inter,sans-serif">${lbl} · ${md[i]}</text>` : '';
      }).join('');
      const topMood = md.indexOf(Math.max(...md)) + 1;
      svgWrap('chart-mood', `
        ${slices}
        <circle cx="${cx}" cy="${cy}" r="${ri - 2}" fill="#0f0f12"/>
        <text x="${cx}" y="${cy - 6}" fill="#f4f5f7" font-size="20" text-anchor="middle" font-family="Inter,sans-serif">${topMood}</text>
        <text x="${cx}" y="${cy + 14}" fill="#5b5f6a" font-size="9" text-anchor="middle" font-family="Inter,sans-serif">mood top</text>
        ${legend}
      `, DW, DH);
    }
  }

  // ---- MENSUAL ----
  function renderMensual() {
    const m = C.monthly(state.sessions, state.monthSel);
    $('#month-kpis').innerHTML = [
      kpi('🃏 Sesiones del mes', m.sessions),
      kpi('🕒 Horas jugadas',    hrs(m.hours)),
      kpi('📈 P&L del mes',      money(m.pl, true),         cls(m.pl), '', true),
      kpi('⏱ $/hora del mes',   money(m.perHour, true),    cls(m.perHour)),
      kpi('🏆 Mejor sesión',     money(m.best, true),       'pos'),
      kpi('💀 Peor sesión',      money(m.worst, true),      cls(m.worst)),
      kpi('✅ % ganadoras',      pct(m.winPct)),
    ].join('');
  }

  // ---- OBJETIVOS ----
  function goalsHtml(rows) {
    return rows.map((g) => {
      const p = Math.max(0, Math.min(g.pct, 1)) * 100;
      const unit = (g.key === 'hours' || g.key === 'study') ? ' h' : '';
      const gold = g.key === 'study' || g.key === 'hands';
      const deltaCls = g.delta >= 0 ? 'pos' : 'neg';
      return `<div class="goal-row">
        <div class="goal-head">
          <span class="lbl">${g.label}</span>
          <span class="vals"><b>${fmtGoal(g.real)}${unit}</b> / ${fmtGoal(g.meta)}${unit} · ${pct(g.pct)}</span>
        </div>
        <div class="bar ${gold ? 'gold' : ''}"><span data-w="${p}"></span></div>
        <div class="delta ${deltaCls}">${g.delta >= 0 ? '▲ +' : '▼ '}${fmtGoal(Math.abs(g.delta))}${unit} vs meta</div>
      </div>`;
    }).join('');
  }
  const fmtGoal = (n) => C.num(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });

  function renderObjetivos() {
    $('#goals-full').innerHTML = goalsHtml(C.goals(state.sessions, state.cfg));
    animateBars($('#goals-full'));
  }

  function animateBars(root) {
    requestAnimationFrame(() =>
      $$('.bar > span', root).forEach((s) => (s.style.width = s.dataset.w + '%'))
    );
  }

  // ---- MENTAL ----
  function renderMental() {
    const m = C.mental(state.sessions);
    $('#mental-insight').innerHTML =
      `<div class="insight"><span class="em">${m.enoughData ? '🧠' : '🌱'}</span><p>${esc(m.insight)}</p></div>`;
    $('#mental-kpis').innerHTML = [
      kpi('🎭 Mood promedio',        m.moodAvg.toFixed(2),         '', '', true),
      kpi('😀 Mood ganadoras',       m.moodWin.toFixed(2)),
      kpi('😞 Mood perdedoras',      m.moodLose.toFixed(2)),
      kpi('🟢 % A-Game (4-5)',       pct(m.aGamePct),              'pos'),
      kpi('🔴 % Tilt (1-2)',         pct(m.tiltPct),               'neg'),
      kpi('💵 P&L prom. mood ≥4',   money(m.plHigh, true),        cls(m.plHigh)),
      kpi('💵 P&L prom. mood ≤2',   money(m.plLow, true),         cls(m.plLow)),
      kpi('⏱ $/h mood ≥4',          money(m.perHourHigh, true),   cls(m.perHourHigh)),
      kpi('⏱ $/h mood ≤2',          money(m.perHourLow, true),    cls(m.perHourLow)),
    ].join('');
  }

  // ---- CONFIG ----
  function renderConfig() {
    const c = state.cfg;
    $('#cfg-name').value        = c.name || '';
    $('#cfg-currency').value    = c.currency || 'USD';
    $('#cfg-bankroll').value    = C.num(c.initial_bankroll);
    $('#cfg-stake').value       = c.usual_stake || 'NL50';
    $('#cfg-goal-hours').value  = C.num(c.goal_hours);
    $('#cfg-goal-sessions').value = C.num(c.goal_sessions);
    $('#cfg-goal-study').value  = C.num(c.goal_study);
    $('#cfg-goal-hands').value  = C.num(c.goal_hands);
    const form = $('#cfg-form');
    if (!form._bound) {
      form._bound = true;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const patch = {
          name:             $('#cfg-name').value.trim() || 'Jugador',
          currency:         $('#cfg-currency').value,
          initial_bankroll: C.num($('#cfg-bankroll').value),
          usual_stake:      $('#cfg-stake').value,
          goal_hours:       C.num($('#cfg-goal-hours').value),
          goal_sessions:    C.num($('#cfg-goal-sessions').value),
          goal_study:       C.num($('#cfg-goal-study').value),
          goal_hands:       C.num($('#cfg-goal-hands').value),
        };
        try {
          state.cfg = await Db.saveConfig(state.user.id, patch);
          $('#cfg-banner').innerHTML = '<div class="banner ok">✅ Configuración guardada.</div>';
          setTimeout(() => ($('#cfg-banner').innerHTML = ''), 2500);
          renderAll();
        } catch (err) {
          $('#cfg-banner').innerHTML = `<div class="banner error">${esc(err.message)}</div>`;
        }
      };
    }
  }

  // ============================================================
  //  SESSION MODAL
  // ============================================================
  function openSessionModal(id) {
    const editing = state.sessions.find((s) => s.id === id);
    const s = editing || {
      played_on: new Date().toISOString().slice(0, 10),
      mode: 'Live', site: '', stakes: state.cfg.usual_stake || 'NL50',
      hours: '', buyin: '', cashout: '', mood: 3,
      study_hours: '', hands_analyzed: '', notes: '',
    };
    const stakeOpts = '';
    const moodBtns  = [1,2,3,4,5].map((m) =>
      `<button type="button" data-mood="${m}" class="${m === C.num(s.mood) ? 'sel' : ''}"
        style="${m === C.num(s.mood) ? `background:${MOOD_COLORS[m]}` : ''}">${m}</button>`
    ).join('');

    const host = $('#modal-host');
    host.innerHTML = `<div class="modal-back"><div class="modal">
      <h3>${editing ? '✎ Editar sesión' : '＋ Nueva sesión'}
        <button class="icon-btn" id="m-close">✕</button>
      </h3>
      <div id="m-banner"></div>
      <form id="m-form">
        <div class="form-grid">
          <div class="field"><label>Fecha</label><input type="date" id="m-date" value="${s.played_on}" required></div>
          <div class="field"><label>Modalidad</label>
            <select id="m-mode"><option ${s.mode==='Live'?'selected':''}>Live</option><option ${s.mode==='Online'?'selected':''}>Online</option></select>
          </div>
          <div class="field"><label>Sitio / Casino</label><input id="m-site" value="${esc(s.site)}" placeholder="Casino Buenos Aires"></div>
          <div class="field"><label>Stakes</label><input id="m-stakes" list="stakes-suggestions" value="${esc(s.stakes)}" placeholder="NL50, 1-2, 3-3…" autocomplete="off"></div>
          <div class="field"><label>Horas</label><input type="number" step="0.25" min="0" id="m-hours" value="${s.hours}" placeholder="0"></div>
          <div class="field"><label>Buy-in</label><input type="number" step="0.01" id="m-buyin" value="${s.buyin}" placeholder="0.00"></div>
          <div class="field"><label>Cash-out</label><input type="number" step="0.01" id="m-cashout" value="${s.cashout}" placeholder="0.00"></div>
          <div class="field"><label>Resultado (auto)</label>
            <div class="computed">Cash-out − Buy-in <b id="m-result" class="mono">—</b></div>
          </div>
          <div class="field full"><label>Mood (1–5)</label>
            <div class="mood-pick" id="m-mood">${moodBtns}</div>
            <div class="err-msg" id="m-err-mood"></div>
          </div>
          <div class="field"><label>Horas de estudio</label><input type="number" step="0.25" min="0" id="m-study" value="${s.study_hours}" placeholder="0"></div>
          <div class="field"><label>Manos analizadas</label><input type="number" min="0" id="m-hands" value="${s.hands_analyzed}" placeholder="0"></div>
          <div class="field full"><label>Notas</label>
            <textarea id="m-notes" rows="2" placeholder="Lectura, errores, línea…">${esc(s.notes)}</textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="m-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="m-save">${editing ? 'Guardar cambios' : 'Agregar sesión'}</button>
        </div>
      </form>
    </div></div>`;

    let mood = C.num(s.mood) || 3;

    const recompute = () => {
      const r = (parseFloat($('#m-cashout').value) || 0) - (parseFloat($('#m-buyin').value) || 0);
      const el = $('#m-result');
      el.textContent = money(r, true);
      el.className = 'mono ' + cls(r);
    };
    recompute();
    ['m-buyin', 'm-cashout'].forEach((id) => ($('#' + id).oninput = recompute));

    $$('#m-mood button').forEach((b) => (b.onclick = () => {
      mood = C.num(b.dataset.mood);
      $$('#m-mood button').forEach((x) => { x.classList.remove('sel'); x.style.background = ''; });
      b.classList.add('sel');
      b.style.background = MOOD_COLORS[mood];
    }));

    const close = () => (host.innerHTML = '');
    $('#m-close').onclick = close;
    $('#m-cancel').onclick = close;
    $('.modal-back').onclick = (e) => { if (e.target.classList.contains('modal-back')) close(); };

    $('#m-form').onsubmit = async (e) => {
      e.preventDefault();
      if (mood < 1 || mood > 5) return ($('#m-err-mood').textContent = 'Elegí un mood de 1 a 5.');
      const payload = {
        played_on:      $('#m-date').value,
        mode:           $('#m-mode').value,
        site:           $('#m-site').value.trim(),
        stakes:         $('#m-stakes').value,
        hours:          C.num($('#m-hours').value),
        buyin:          C.num($('#m-buyin').value),
        cashout:        C.num($('#m-cashout').value),
        mood,
        study_hours:    C.num($('#m-study').value),
        hands_analyzed: C.num($('#m-hands').value),
        notes:          $('#m-notes').value.trim(),
      };
      const save = $('#m-save');
      save.disabled = true;
      save.textContent = 'Guardando…';
      try {
        if (editing) {
          const upd = await Db.updateSession(editing.id, payload);
          const i = state.sessions.findIndex((x) => x.id === editing.id);
          state.sessions[i] = upd;
        } else {
          const created = await Db.addSession(state.user.id, payload);
          state.sessions.push(created);
        }
        close();
        renderAll();
        if ($('#view-dashboard').classList.contains('active')) renderCharts();
      } catch (err) {
        $('#m-banner').innerHTML = `<div class="banner error">${esc(err.message)}</div>`;
        save.disabled = false;
        save.textContent = 'Reintentar';
      }
    };
  }

  async function removeSession(id) {
    const s = state.sessions.find((x) => x.id === id);
    if (!confirm(`¿Eliminar la sesión del ${s?.played_on}? Se recalcula el bankroll.`)) return;
    try {
      await Db.deleteSession(id);
      state.sessions = state.sessions.filter((x) => x.id !== id);
      renderAll();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  }

  // ---- MANOS ----
  const POSITIONS = ['UTG','UTG+1','UTG+2','MP','MP+1','HJ','CO','BTN','SB','BB'];
  const PLAYER_TYPES = ['Desconocido','Fish agresivo','Fish pasivo','Regular agresivo','Regular pasivo','Nit','Maniac','LAG','TAG'];

  function renderManos() {
    const q = ($('#hand-flt-q')?.value || '').toLowerCase();
    const cl = $('#hand-clear');
    if (cl && !cl._b) { cl._b = true; cl.onclick = () => { $('#hand-flt-q').value = ''; renderManos(); }; }
    const hfq = $('#hand-flt-q');
    if (hfq && !hfq._b) { hfq._b = true; hfq.oninput = renderManos; }

    const rows = state.hands.filter(h => {
      if (!q) return true;
      return [h.hero_cards, h.hero_position, h.stakes, h.notes, h.preflop, h.result_notes,
        ...(h.players||[]).map(p => p.cards + ' ' + p.type)].join(' ').toLowerCase().includes(q);
    });

    $('#hands-empty').classList.toggle('hidden', rows.length > 0);
    $('#hands-list').innerHTML = rows.map(h => {
      const board = [h.flop_board, h.turn_card, h.river_card].filter(Boolean).join(' · ');
      const players = (h.players||[]).map(p =>
        `<span class="hand-player-tag">${esc(p.pos)}: <b>${esc(p.type||'?')}</b>${p.cards ? ` → ${esc(p.showed !== false ? p.cards : 'no mostró')}` : ''}</span>`
      ).join('');
      return `<div class="hand-card">
        <div class="hand-card-head">
          <div class="hand-card-meta">
            <span class="mono" style="font-size:12px;color:var(--muted)">${esc(h.played_on)}</span>
            ${h.stakes ? `<span class="pill online">${esc(h.stakes)}</span>` : ''}
            ${h.hero_position ? `<span style="font-size:12px;color:var(--muted)">Hero: <b style="color:var(--text)">${esc(h.hero_position)}</b></span>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="icon-btn" data-hedit="${esc(h.id)}">✎</button>
            <button class="icon-btn danger" data-hdel="${esc(h.id)}">🗑</button>
          </div>
        </div>
        <div class="hand-cards-row">
          ${h.hero_cards ? `<span class="hand-cards-hero">${esc(h.hero_cards)}</span>` : ''}
          ${board ? `<span class="hand-board-display">${esc(board)}</span>` : ''}
        </div>
        ${players ? `<div class="hand-players-row">${players}</div>` : ''}
        ${h.preflop ? `<div class="hand-street-preview"><span class="hand-street-lbl">Pre</span>${esc(h.preflop.slice(0,100))}${h.preflop.length>100?'…':''}</div>` : ''}
        ${h.notes ? `<div class="hand-notes-preview">📝 ${esc(h.notes.slice(0,120))}${h.notes.length>120?'…':''}</div>` : ''}
      </div>`;
    }).join('');

    $$('[data-hedit]').forEach(b => b.onclick = () => openHandModal(b.dataset.hedit));
    $$('[data-hdel]').forEach(b => b.onclick = () => removeHand(b.dataset.hdel));
  }

  async function removeHand(id) {
    if (!confirm('¿Eliminar esta mano?')) return;
    try {
      await Db.deleteHand(id);
      state.hands = state.hands.filter(x => x.id !== id);
      renderManos();
    } catch(err) { alert('Error: ' + err.message); }
  }

  function posOpts(sel) { return POSITIONS.map(p => `<option${p===sel?' selected':''}>${p}</option>`).join(''); }
  function typeOpts(sel) { return PLAYER_TYPES.map(t => `<option${t===sel?' selected':''}>${t}</option>`).join(''); }

  function playerRowHtml(p, i) {
    return `<div class="hand-player-row" data-pi="${i}">
      <select class="hp-pos">${posOpts(p.pos)}</select>
      <select class="hp-type">${typeOpts(p.type)}</select>
      <div style="display:flex;gap:4px;align-items:center">
        <input class="hp-cards card-input" value="${esc(p.cards||'')}" placeholder="AA" autocomplete="off" style="width:72px">
        <button type="button" class="btn btn-ghost btn-sm hp-card-btn" title="Seleccionar cartas">🃏</button>
      </div>
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);white-space:nowrap">
        <input type="checkbox" class="hp-showed"${p.showed!==false?' checked':''}> mostró
      </label>
      <button type="button" class="icon-btn danger hp-remove" title="Quitar">✕</button>
    </div>`;
  }

  function openHandModal(id) {
    const editing = state.hands.find(h => h.id === id);
    const h = editing || {
      played_on: new Date().toISOString().slice(0,10),
      stakes: state.cfg.usual_stake || '',
      hero_position: 'BTN', hero_cards: '',
      players: [],
      preflop:'', flop_board:'', flop_action:'',
      turn_card:'', turn_action:'', river_card:'', river_action:'',
      result_notes:'', notes:'',
    };

    const host = $('#modal-host');
    host.innerHTML = `<div class="modal-back"><div class="modal modal-lg">
      <h3>${editing ? '✎ Editar mano' : '🃏 Anotar mano'}
        <button class="icon-btn" id="m-close">✕</button>
      </h3>
      <div id="m-banner"></div>
      <form id="m-form">
        <div class="hand-section">
          <div class="hand-section-title">📋 Info básica</div>
          <div class="form-grid">
            <div class="field"><label>Fecha</label><input type="date" id="h-date" value="${h.played_on}" required></div>
            <div class="field"><label>Stakes</label><input id="h-stakes" list="stakes-suggestions" value="${esc(h.stakes)}" placeholder="NL100, 1-2, 3-3…" autocomplete="off"></div>
          </div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">🦸 Hero</div>
          <div class="form-grid">
            <div class="field"><label>Posición</label><select id="h-hero-pos">${posOpts(h.hero_position)}</select></div>
            <div class="field"><label>Cartas</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="h-hero-cards" class="card-input" value="${esc(h.hero_cards)}" placeholder="JcTc" autocomplete="off">
              <button type="button" class="btn btn-ghost btn-sm" id="h-hero-cards-btn">🃏</button>
            </div>
          </div>
          </div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title" style="display:flex;justify-content:space-between;align-items:center">
            👥 Rivales
            <button type="button" class="btn btn-ghost btn-sm" id="h-add-player">＋ Agregar rival</button>
          </div>
          <div id="h-players">${(h.players||[]).map(playerRowHtml).join('')}</div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">🎴 Preflop</div>
          <div class="field"><textarea id="h-preflop" rows="3" placeholder="Ej: Abro UTG $20 con JcTc, MP (fish agresivo) 3bet $80, BTN paga, yo pago.">${esc(h.preflop)}</textarea></div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">🃏 Flop</div>
          <div class="field"><label>Cartas del flop</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="h-flop-board" class="card-input" value="${esc(h.flop_board)}" placeholder="As 8c 9h" autocomplete="off">
              <button type="button" class="btn btn-ghost btn-sm" id="h-flop-btn">🃏</button>
            </div>
          </div>
          <div class="field" style="margin-top:10px"><textarea id="h-flop-action" rows="2" placeholder="Check, MP apuesta $150, BTN paga, yo all-in $500, todos pagan.">${esc(h.flop_action)}</textarea></div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">🃏 Turn</div>
          <div class="field"><label>Carta</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="h-turn-card" class="card-input" value="${esc(h.turn_card)}" placeholder="7h" autocomplete="off" style="max-width:100px">
              <button type="button" class="btn btn-ghost btn-sm" id="h-turn-btn">🃏</button>
            </div>
          </div>
          <div class="field" style="margin-top:10px"><textarea id="h-turn-action" rows="2" placeholder="Acción en el turn…">${esc(h.turn_action)}</textarea></div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">🃏 River</div>
          <div class="field"><label>Carta</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="h-river-card" class="card-input" value="${esc(h.river_card)}" placeholder="4h" autocomplete="off" style="max-width:100px">
              <button type="button" class="btn btn-ghost btn-sm" id="h-river-btn">🃏</button>
            </div>
          </div>
          <div class="field" style="margin-top:10px"><textarea id="h-river-action" rows="2" placeholder="Acción en el river…">${esc(h.river_action)}</textarea></div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">🏆 Resultado / Showdown</div>
          <div class="field"><textarea id="h-result" rows="2" placeholder="MP muestra AA, BTN no muestra, yo gano con escalera al nut.">${esc(h.result_notes)}</textarea></div>
        </div>
        <div class="hand-section">
          <div class="hand-section-title">📝 Notas de estudio</div>
          <div class="field"><textarea id="h-notes" rows="2" placeholder="¿Jugué bien? ¿Qué mejoraría? ¿Errores? ¿Puntos a revisar con solver?">${esc(h.notes)}</textarea></div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="m-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="m-save">${editing ? 'Guardar cambios' : 'Guardar mano'}</button>
        </div>
      </form>
    </div></div>`;

    // Card pickers fijos
    $('#h-hero-cards-btn').onclick = () => openCardPicker($('#h-hero-cards'), 2, 'concat');
    $('#h-flop-btn').onclick       = () => openCardPicker($('#h-flop-board'), 3, 'space');
    $('#h-turn-btn').onclick       = () => openCardPicker($('#h-turn-card'),  1, 'concat');
    $('#h-river-btn').onclick      = () => openCardPicker($('#h-river-card'), 1, 'concat');

    // Agregar rival
    $('#h-add-player').onclick = () => {
      const cont = $('#h-players');
      const i = cont.querySelectorAll('.hand-player-row').length;
      const div = document.createElement('div');
      div.innerHTML = playerRowHtml({ pos:'BB', type:'Desconocido', cards:'', showed:true }, i);
      cont.appendChild(div.firstElementChild);
      bindRemoveButtons();
    };
    bindRemoveButtons();

    const close = () => (host.innerHTML = '');
    $('#m-close').onclick = close;
    $('#m-cancel').onclick = close;
    $('.modal-back').onclick = (e) => { if (e.target.classList.contains('modal-back')) close(); };

    $('#m-form').onsubmit = async (e) => {
      e.preventDefault();
      const players = [...$$('.hand-player-row')].map(row => ({
        pos:    row.querySelector('.hp-pos').value,
        type:   row.querySelector('.hp-type').value,
        cards:  row.querySelector('.hp-cards').value.trim(),
        showed: row.querySelector('.hp-showed').checked,
      }));
      const payload = {
        played_on:    $('#h-date').value,
        stakes:       $('#h-stakes').value.trim(),
        hero_position:$('#h-hero-pos').value,
        hero_cards:   $('#h-hero-cards').value.trim(),
        players,
        preflop:      $('#h-preflop').value.trim(),
        flop_board:   $('#h-flop-board').value.trim(),
        flop_action:  $('#h-flop-action').value.trim(),
        turn_card:    $('#h-turn-card').value.trim(),
        turn_action:  $('#h-turn-action').value.trim(),
        river_card:   $('#h-river-card').value.trim(),
        river_action: $('#h-river-action').value.trim(),
        result_notes: $('#h-result').value.trim(),
        notes:        $('#h-notes').value.trim(),
      };
      const save = $('#m-save');
      save.disabled = true; save.textContent = 'Guardando…';
      try {
        if (editing) {
          const upd = await Db.updateHand(editing.id, payload);
          const i = state.hands.findIndex(x => x.id === editing.id);
          state.hands[i] = upd;
        } else {
          const created = await Db.addHand(state.user.id, payload);
          state.hands.unshift(created);
        }
        close(); renderManos();
      } catch(err) {
        $('#m-banner').innerHTML = `<div class="banner error">${esc(err.message)}</div>`;
        save.disabled = false; save.textContent = 'Reintentar';
      }
    };
  }

  function bindRemoveButtons() {
    $$('.hp-remove').forEach(b => { b.onclick = () => b.closest('.hand-player-row').remove(); });
    $$('.hp-card-btn').forEach(b => {
      b.onclick = () => openCardPicker(b.closest('.hand-player-row').querySelector('.hp-cards'), 2, 'concat');
    });
  }

  // ---- STUDY MODAL ----
  function openStudyModal() {
    const host = $('#modal-host');
    const today = new Date().toISOString().slice(0, 10);
    host.innerHTML = `<div class="modal-back"><div class="modal">
      <h3>📚 Sesión de estudio
        <button class="icon-btn" id="m-close">✕</button>
      </h3>
      <div id="m-banner"></div>
      <form id="m-form">
        <div class="form-grid">
          <div class="field"><label>Fecha</label><input type="date" id="m-date" value="${today}" required></div>
          <div class="field"><label>Horas de estudio</label><input type="number" step="0.25" min="0" id="m-study" placeholder="0" required></div>
          <div class="field"><label>Manos analizadas</label><input type="number" min="0" id="m-hands" placeholder="0"></div>
          <div class="field full"><label>Notas</label>
            <textarea id="m-notes" rows="2" placeholder="Qué estudiaste, recursos, conceptos…"></textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="m-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="m-save">Guardar estudio</button>
        </div>
      </form>
    </div></div>`;
    const close = () => (host.innerHTML = '');
    $('#m-close').onclick = close;
    $('#m-cancel').onclick = close;
    $('.modal-back').onclick = (e) => { if (e.target.classList.contains('modal-back')) close(); };
    $('#m-form').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        played_on: $('#m-date').value, mode: 'Estudio', site: '', stakes: '',
        hours: 0, buyin: 0, cashout: 0, mood: 3,
        study_hours: C.num($('#m-study').value),
        hands_analyzed: C.num($('#m-hands').value),
        notes: $('#m-notes').value.trim(),
      };
      const save = $('#m-save');
      save.disabled = true; save.textContent = 'Guardando…';
      try {
        const created = await Db.addSession(state.user.id, payload);
        state.sessions.push(created);
        close(); renderAll();
      } catch (err) {
        $('#m-banner').innerHTML = `<div class="banner error">${esc(err.message)}</div>`;
        save.disabled = false; save.textContent = 'Reintentar';
      }
    };
  }

  // ---- CSV ----
  function exportCSV() {
    const head = ['Fecha','Modalidad','Sitio','Stakes','Horas','Buy-in','Cash-out','Resultado','Bankroll','Mood','Estudio','Manos','Notas'];
    const rows = C.withBankroll(state.sessions, state.cfg.initial_bankroll).map((s) => [
      s.played_on, s.mode, s.site||'', s.stakes||'', C.num(s.hours),
      C.num(s.buyin), C.num(s.cashout), C.result(s), s.bankroll,
      s.mood||'', C.num(s.study_hours), C.num(s.hands_analyzed),
      `"${(s.notes||'').replace(/"/g,'""')}"`,
    ].join(','));
    const blob = new Blob([head.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poker-sesiones-${C.monthKey()}.csv`;
    a.click();
  }

  boot();
})();
