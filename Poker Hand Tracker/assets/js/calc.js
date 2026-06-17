// ============================================================
//  calc.js — Lógica de cálculo (réplica de las fórmulas del Excel)
//  Funciones PURAS: reciben datos, devuelven datos. Sin DOM.
// ============================================================
(function (global) {
  'use strict';

  const STAKES = ['NL25', 'NL50', 'NL100', 'NL200', 'NL500', '1/3', '2/5', '5/10'];
  const HANDS_PER_HOUR = { Live: 25, Online: 75 }; // del Excel (CONFIG)

  const num = (v) => (isFinite(+v) ? +v : 0);
  const safeDiv = (a, b) => (b ? a / b : 0); // imita IFERROR(.../0 , 0)

  // Resultado de una sesión = cashout - buyin
  const result = (s) => num(s.cashout) - num(s.buyin);

  // Orden cronológico estable (fecha asc, luego creación)
  function sortChrono(sessions) {
    return [...sessions].sort((a, b) => {
      if (a.played_on !== b.played_on) return a.played_on < b.played_on ? -1 : 1;
      return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
    });
  }

  // Bankroll en cascada: inicial + acumulado de resultados
  function withBankroll(sessions, initial) {
    let run = num(initial);
    return sortChrono(sessions).map((s) => {
      run += result(s);
      return { ...s, _result: result(s), bankroll: run };
    });
  }

  // Mejor / peor racha monetaria (acumulada, se reinicia al cambiar de signo)
  function streaks(sessions) {
    let win = 0, lose = 0, best = 0, worst = 0;
    for (const s of sortChrono(sessions)) {
      const r = result(s);
      if (r > 0) { win += r; lose = 0; if (win > best) best = win; }
      else if (r < 0) { lose += r; win = 0; if (lose < worst) worst = lose; }
      else { win = 0; lose = 0; }
    }
    return { best, worst };
  }

  // Moda: stake más jugado
  function mostPlayedStake(sessions) {
    const freq = {};
    let top = '—', max = 0;
    for (const s of sessions) {
      if (!s.stakes) continue;
      freq[s.stakes] = (freq[s.stakes] || 0) + 1;
      if (freq[s.stakes] > max) { max = freq[s.stakes]; top = s.stakes; }
    }
    return top;
  }

  // ---- DASHBOARD GENERAL ----
  function dashboard(sessions, initial) {
    const n = sessions.length;
    const sumH = sessions.reduce((a, s) => a + result(s), 0);   // P&L total
    const sumHours = sessions.reduce((a, s) => a + num(s.hours), 0);
    const wins = sessions.filter((s) => result(s) > 0).length;

    const live = sessions.filter((s) => s.mode === 'Live');
    const online = sessions.filter((s) => s.mode === 'Online');
    const plLive = live.reduce((a, s) => a + result(s), 0);
    const plOnline = online.reduce((a, s) => a + result(s), 0);
    const hLive = live.reduce((a, s) => a + num(s.hours), 0);
    const hOnline = online.reduce((a, s) => a + num(s.hours), 0);

    const results = sessions.map(result);
    const best = n ? Math.max(...results) : 0;
    const minR = n ? Math.min(...results) : 0;

    const st = streaks(sessions);

    return {
      pl: sumH,
      perHour: safeDiv(sumH, sumHours),
      hours: sumHours,
      sessions: n,
      winPct: safeDiv(wins, n),
      best,
      worst: minR < 0 ? minR : 0,
      currentBankroll: num(initial) + sumH,
      plLive, plOnline,
      perHourLive: safeDiv(plLive, hLive),
      perHourOnline: safeDiv(plOnline, hOnline),
      bestStreak: st.best,
      worstStreak: st.worst,
      mostStake: mostPlayedStake(sessions),
    };
  }

  // ---- Filtro por mes "YYYY-MM" ----
  function inMonth(s, ym) {
    return typeof s.played_on === 'string' && s.played_on.slice(0, 7) === ym;
  }
  function monthKey(d = new Date()) {
    return d.toISOString().slice(0, 7);
  }

  // ---- ANÁLISIS MENSUAL ----
  function monthly(sessions, ym) {
    const ms = sessions.filter((s) => inMonth(s, ym));
    const n = ms.length;
    const pl = ms.reduce((a, s) => a + result(s), 0);
    const hours = ms.reduce((a, s) => a + num(s.hours), 0);
    const wins = ms.filter((s) => result(s) > 0).length;
    const results = ms.map(result);
    return {
      sessions: n,
      hours,
      pl,
      perHour: safeDiv(pl, hours),
      best: n ? Math.max(...results) : 0,
      worst: n ? Math.min(...results) : 0,
      winPct: safeDiv(wins, n),
      list: ms,
    };
  }

  // ---- OBJETIVOS (mes actual) ----
  function goals(sessions, cfg, ym = monthKey()) {
    const ms = sessions.filter((s) => inMonth(s, ym));
    const real = {
      hours: ms.reduce((a, s) => a + num(s.hours), 0),
      sessions: ms.length,
      study: ms.reduce((a, s) => a + num(s.study_hours), 0),
      hands: ms.reduce((a, s) => a + num(s.hands_analyzed), 0),
    };
    const meta = {
      hours: num(cfg.goal_hours),
      sessions: num(cfg.goal_sessions),
      study: num(cfg.goal_study),
      hands: num(cfg.goal_hands),
    };
    const row = (key, label) => ({
      key, label,
      meta: meta[key],
      real: real[key],
      delta: real[key] - meta[key],
      pct: meta[key] ? real[key] / meta[key] : 0,
    });
    return [
      row('hours', 'Horas jugadas'),
      row('sessions', 'Sesiones jugadas'),
      row('study', 'Horas de estudio'),
      row('hands', 'Manos analizadas'),
    ];
  }

  // ---- MENTAL GAME ----
  function mental(sessions) {
    const withMood = sessions.filter((s) => num(s.mood) > 0);
    const avg = (arr, f) => safeDiv(arr.reduce((a, s) => a + f(s), 0), arr.length);

    const moodAvg = avg(withMood, (s) => num(s.mood));
    const winners = sessions.filter((s) => result(s) > 0);
    const losers = sessions.filter((s) => result(s) < 0);
    const moodWin = avg(winners, (s) => num(s.mood));
    const moodLose = avg(losers, (s) => num(s.mood));

    const aGame = sessions.filter((s) => num(s.mood) >= 4);
    const tilt = sessions.filter((s) => num(s.mood) >= 1 && num(s.mood) <= 2);

    const plHigh = avg(aGame, result);           // P&L promedio mood >= 4
    const plLow = avg(tilt, result);             // P&L promedio mood <= 2
    const perHourHigh = safeDiv(
      aGame.reduce((a, s) => a + result(s), 0),
      aGame.reduce((a, s) => a + num(s.hours), 0)
    );
    const perHourLow = safeDiv(
      tilt.reduce((a, s) => a + result(s), 0),
      tilt.reduce((a, s) => a + num(s.hours), 0)
    );

    let insight;
    if (withMood.length < 5) {
      insight = 'Se necesitan más sesiones para obtener conclusiones confiables sobre tu estado mental y resultados.';
    } else if (plLow < plHigh && plLow < 0) {
      insight = 'Tus peores sesiones ocurren cuando tu estado mental es bajo. Considerá no jugar con Mood 1-2.';
    } else if (plHigh > plLow + 0.5) {
      insight = 'Tu rendimiento mejora significativamente con buen estado mental. Priorizá el proceso.';
    } else {
      insight = 'No hay correlación significativa entre mood y resultado en tus datos actuales.';
    }

    return {
      moodAvg, moodWin, moodLose,
      aGamePct: safeDiv(aGame.length, withMood.length),
      tiltPct: safeDiv(tilt.length, withMood.length),
      plHigh, plLow, perHourHigh, perHourLow,
      insight,
      enoughData: withMood.length >= 5,
    };
  }

  // ---- INICIO (mes actual) ----
  function home(sessions, cfg) {
    const ym = monthKey();
    const m = monthly(sessions, ym);
    const d = dashboard(sessions, cfg.initial_bankroll);
    return {
      bankroll: d.currentBankroll,
      monthPL: m.pl,
      monthPerHour: m.perHour,
      monthSessions: m.sessions,
      monthHours: m.hours,
      goalHoursPct: cfg.goal_hours ? m.hours / num(cfg.goal_hours) : 0,
      goalSessionsPct: cfg.goal_sessions ? m.sessions / num(cfg.goal_sessions) : 0,
    };
  }

  // ---- Mejoras: P&L por stake / distribución de mood ----
  function plByStake(sessions) {
    const map = {};
    STAKES.forEach((s) => (map[s] = 0));
    sessions.forEach((s) => {
      if (s.stakes != null && s.stakes in map) map[s.stakes] += result(s);
      else if (s.stakes) map[s.stakes] = (map[s.stakes] || 0) + result(s);
    });
    return map;
  }
  function moodDistribution(sessions) {
    const counts = [0, 0, 0, 0, 0]; // mood 1..5
    sessions.forEach((s) => {
      const m = num(s.mood);
      if (m >= 1 && m <= 5) counts[m - 1]++;
    });
    return counts;
  }

  // BB/100 (mejora sobre el Excel): usa BB size por stake y manos/hora
  function bb100(sessions, bbSizes) {
    let bbTotal = 0, hands = 0;
    sessions.forEach((s) => {
      const bb = num((bbSizes || {})[s.stakes]);
      if (!bb || !num(s.hours)) return;
      const h = num(s.hours) * (HANDS_PER_HOUR[s.mode] || 25);
      bbTotal += result(s) / bb;
      hands += h;
    });
    return safeDiv(bbTotal, hands) * 100;
  }

  global.PHTCalc = {
    STAKES, HANDS_PER_HOUR, result, sortChrono, withBankroll, streaks,
    mostPlayedStake, dashboard, monthly, monthKey, inMonth, goals,
    mental, home, plByStake, moodDistribution, bb100, safeDiv, num,
  };
})(window);
