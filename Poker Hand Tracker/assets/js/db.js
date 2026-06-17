// ============================================================
//  db.js — capa de datos
//  · Modo REAL: Supabase (cuando config.js tiene credenciales válidas)
//  · Modo DEMO: localStorage (preview / sin Supabase configurado)
// ============================================================
(function (global) {
  'use strict';

  const cfg = global.PHT_CONFIG || {};
  const REAL = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT');

  const DEFAULT_CONFIG = {
    name: 'Jugador', currency: 'USD', initial_bankroll: 2000,
    goal_hours: 40, goal_sessions: 20, goal_study: 10, goal_hands: 200,
    usual_stake: '1/3',
    bb_sizes: { NL25: 0.25, NL50: 0.5, NL100: 1, NL200: 2, NL500: 5, '1/3': 3, '2/5': 5, '5/10': 10 },
  };

  // ============================================================
  //  MODO DEMO — localStorage
  // ============================================================
  const LS = {
    SESS:  'pht_demo_sessions',
    CFG:   'pht_demo_config',
    USER:  'pht_demo_user',
    HANDS: 'pht_demo_hands',
    uid:   'demo-user-0000-0000-0000-000000000000',
  };
  const DEMO_SESSIONS = [
    {id:'s01',played_on:'2026-05-03',mode:'Live',site:'Casino Buenos Aires',stakes:'1/3',hours:5.0,buyin:300,cashout:520,mood:4,study_hours:1.0,hands_analyzed:20,notes:'Buen día, value claro'},
    {id:'s02',played_on:'2026-05-06',mode:'Online',site:'PokerStars',stakes:'NL50',hours:2.5,buyin:100,cashout:38,mood:2,study_hours:0.5,hands_analyzed:40,notes:'Tilt leve tras bad beat'},
    {id:'s03',played_on:'2026-05-10',mode:'Live',site:'Casino Buenos Aires',stakes:'1/3',hours:6.0,buyin:300,cashout:180,mood:3,study_hours:0,hands_analyzed:0,notes:'Sesión floja, mazo seco'},
    {id:'s04',played_on:'2026-05-14',mode:'Online',site:'GGPoker',stakes:'NL100',hours:3.0,buyin:200,cashout:415,mood:5,study_hours:2.0,hands_analyzed:80,notes:'A-Game total, run + juego sólido'},
    {id:'s05',played_on:'2026-05-18',mode:'Live',site:'Club Privado',stakes:'2/5',hours:7.0,buyin:500,cashout:780,mood:4,study_hours:0.5,hands_analyzed:15,notes:'Mesa muy débil, presioné spots'},
    {id:'s06',played_on:'2026-05-22',mode:'Online',site:'PokerStars',stakes:'NL50',hours:2.0,buyin:100,cashout:86,mood:3,study_hours:1.0,hands_analyzed:50,notes:'Neutral, breakeven-ish'},
    {id:'s07',played_on:'2026-05-27',mode:'Live',site:'Casino Buenos Aires',stakes:'1/3',hours:4.5,buyin:300,cashout:140,mood:1,study_hours:0,hands_analyzed:0,notes:'No debí jugar, cansado'},
    {id:'s08',played_on:'2026-05-30',mode:'Online',site:'GGPoker',stakes:'NL100',hours:3.5,buyin:200,cashout:330,mood:4,study_hours:1.5,hands_analyzed:70,notes:'Foco alto, buenas decisiones'},
    {id:'s09',played_on:'2026-06-02',mode:'Live',site:'Casino Buenos Aires',stakes:'1/3',hours:5.5,buyin:300,cashout:640,mood:5,study_hours:1.0,hands_analyzed:25,notes:'A-Game, racha de coolers a favor'},
    {id:'s10',played_on:'2026-06-05',mode:'Online',site:'PokerStars',stakes:'NL50',hours:2.0,buyin:100,cashout:150,mood:4,study_hours:0.5,hands_analyzed:45,notes:'Sólido, buen run de showdowns'},
    {id:'s11',played_on:'2026-06-08',mode:'Live',site:'Club Privado',stakes:'2/5',hours:6.5,buyin:500,cashout:395,mood:2,study_hours:0,hands_analyzed:0,notes:'Frustrado, jugué pasivo'},
    {id:'s12',played_on:'2026-06-11',mode:'Online',site:'GGPoker',stakes:'NL100',hours:3.0,buyin:200,cashout:288,mood:3,study_hours:2.0,hands_analyzed:90,notes:'OK, sesión pareja'},
    {id:'s13',played_on:'2026-06-13',mode:'Live',site:'Casino Buenos Aires',stakes:'1/3',hours:4.0,buyin:300,cashout:560,mood:4,study_hours:1.0,hands_analyzed:20,notes:'Buen estado, value thin pagado'},
    {id:'s14',played_on:'2026-06-15',mode:'Online',site:'PokerStars',stakes:'NL200',hours:2.5,buyin:400,cashout:250,mood:1,study_hours:0.5,hands_analyzed:30,notes:'Tilt feo, perseguí pérdidas'},
  ].map(s => ({ ...s, user_id: LS.uid, created_at: s.played_on + 'T00:00:00Z', result: s.cashout - s.buyin }));

  function lsGet(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }

  const Demo = {
    _initSessions() {
      if (!localStorage.getItem(LS.SESS)) lsSet(LS.SESS, DEMO_SESSIONS);
    },
    signIn(_e, _p) {
      const u = { id: LS.uid, email: 'demo@poker.app', demo: true };
      lsSet(LS.USER, u); return Promise.resolve({ user: u });
    },
    signOut() { lsSet(LS.USER, null); return Promise.resolve(); },
    currentUser() { return Promise.resolve(lsGet(LS.USER, null)); },
    onAuth(cb) {
      const u = lsGet(LS.USER, null);
      setTimeout(() => cb(u), 0);
    },
    loadConfig(uid) {
      this._initSessions();
      return Promise.resolve({ ...DEFAULT_CONFIG, ...lsGet(LS.CFG, {}), user_id: uid });
    },
    saveConfig(uid, patch) {
      const c = { ...DEFAULT_CONFIG, ...lsGet(LS.CFG, {}), ...patch, user_id: uid };
      lsSet(LS.CFG, c); return Promise.resolve(c);
    },
    loadSessions(_uid) {
      this._initSessions();
      const rows = lsGet(LS.SESS, []);
      return Promise.resolve(rows.map(s => ({ ...s, result: s.cashout - s.buyin })));
    },
    addSession(uid, s) {
      const rows = lsGet(LS.SESS, []);
      const created = { ...s, id: uuid(), user_id: uid, created_at: new Date().toISOString(), result: s.cashout - s.buyin };
      lsSet(LS.SESS, [...rows, created]); return Promise.resolve(created);
    },
    updateSession(id, s) {
      const rows = lsGet(LS.SESS, []);
      const i = rows.findIndex(x => x.id === id);
      const upd = { ...rows[i], ...s, result: s.cashout - s.buyin };
      rows[i] = upd; lsSet(LS.SESS, rows); return Promise.resolve(upd);
    },
    deleteSession(id) {
      lsSet(LS.SESS, lsGet(LS.SESS, []).filter(x => x.id !== id));
      return Promise.resolve();
    },
    loadHands(_uid) {
      return Promise.resolve(lsGet(LS.HANDS, []));
    },
    addHand(uid, h) {
      const rows = lsGet(LS.HANDS, []);
      const created = { ...h, id: uuid(), user_id: uid, created_at: new Date().toISOString() };
      lsSet(LS.HANDS, [created, ...rows]); return Promise.resolve(created);
    },
    updateHand(id, h) {
      const rows = lsGet(LS.HANDS, []);
      const i = rows.findIndex(x => x.id === id);
      const upd = { ...rows[i], ...h }; rows[i] = upd;
      lsSet(LS.HANDS, rows); return Promise.resolve(upd);
    },
    deleteHand(id) {
      lsSet(LS.HANDS, lsGet(LS.HANDS, []).filter(x => x.id !== id));
      return Promise.resolve();
    },
  };

  // ============================================================
  //  MODO REAL — Supabase
  // ============================================================
  let sb = null;
  const Real = {};
  if (REAL && global.supabase) {
    sb = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const sanitize = (s) => { const { id, user_id, created_at, result, bankroll, _result, ...rest } = s; return rest; };
    Real.signUp = async (e, p) => { const { data, error } = await sb.auth.signUp({ email: e, password: p }); if (error) throw error; return data; };
    Real.signIn = async (e, p) => { const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p }); if (error) throw error; return data; };
    Real.signOut = async () => { await sb.auth.signOut(); };
    Real.currentUser = async () => { const { data } = await sb.auth.getUser(); return data?.user ?? null; };
    Real.onAuth = (cb) => { sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null)); };
    Real.loadConfig = async (uid) => {
      const { data, error } = await sb.from('configs').select('*').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const row = { user_id: uid, ...DEFAULT_CONFIG };
      const { data: c2, error: e2 } = await sb.from('configs').insert(row).select().single();
      if (e2) throw e2; return c2;
    };
    Real.saveConfig = async (uid, patch) => {
      const { data, error } = await sb.from('configs').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', uid).select().single();
      if (error) throw error; return data;
    };
    Real.loadSessions = async (uid) => {
      const { data, error } = await sb.from('sessions').select('*').eq('user_id', uid).order('played_on', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error; return data || [];
    };
    Real.addSession = async (uid, s) => { const { data, error } = await sb.from('sessions').insert({ ...sanitize(s), user_id: uid }).select().single(); if (error) throw error; return data; };
    Real.updateSession = async (id, s) => { const { data, error } = await sb.from('sessions').update(sanitize(s)).eq('id', id).select().single(); if (error) throw error; return data; };
    Real.deleteSession = async (id) => { const { error } = await sb.from('sessions').delete().eq('id', id); if (error) throw error; };
    Real.loadHands = async (uid) => { const { data, error } = await sb.from('hands').select('*').eq('user_id', uid).order('played_on', { ascending: false }).order('created_at', { ascending: false }); if (error) throw error; return data || []; };
    Real.addHand = async (uid, h) => { const { data, error } = await sb.from('hands').insert({ ...h, user_id: uid }).select().single(); if (error) throw error; return data; };
    Real.updateHand = async (id, h) => { const { data, error } = await sb.from('hands').update(h).eq('id', id).select().single(); if (error) throw error; return data; };
    Real.deleteHand = async (id) => { const { error } = await sb.from('hands').delete().eq('id', id); if (error) throw error; };
  }

  const impl = REAL ? Real : Demo;

  global.PHTDb = {
    ready: REAL,
    demo: !REAL,
    DEFAULT_CONFIG,
    signUp:         (...a) => impl.signIn?.(...a) ?? Demo.signIn(...a),  // demo doesn't distinguish
    signIn:         (...a) => impl.signIn(...a),
    signOut:        ()     => impl.signOut(),
    currentUser:    ()     => impl.currentUser(),
    onAuth:         (cb)   => impl.onAuth(cb),
    loadConfig:     (uid)  => impl.loadConfig(uid),
    saveConfig:     (uid, p) => impl.saveConfig(uid, p),
    loadSessions:   (uid)  => impl.loadSessions(uid),
    addSession:     (uid, s) => impl.addSession(uid, s),
    updateSession:  (id, s)  => impl.updateSession(id, s),
    deleteSession:  (id)     => impl.deleteSession(id),
    loadHands:      (uid)  => impl.loadHands(uid),
    addHand:        (uid, h) => impl.addHand(uid, h),
    updateHand:     (id, h)  => impl.updateHand(id, h),
    deleteHand:     (id)     => impl.deleteHand(id),
    REAL_signUp:    REAL ? ((...a) => Real.signUp(...a)) : null,
  };
})(window);
