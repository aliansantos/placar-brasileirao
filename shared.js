// Funções puras: leitura da API da ESPN, horários de Brasília, escolha do jogo em foco,
// selo do ícone e detecção de lances para notificação. Sem chrome.*: roda no service worker
// (importScripts), no popup e no Node (testes).

globalThis.PB = (() => {
  const TZ = 'America/Sao_Paulo';
  const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1';
  const STORE = 'https://chromewebstore.google.com/detail/ccnlhjamkopjfpdlkplkiimgecobccek';
  const HOUR = 3600e3;
  const DAY = 24 * HOUR;
  // Duração aproximada de um jogo, do apito inicial ao final (usada para "terminou há X horas").
  const MATCH_LENGTH = 2 * HOUR;

  const DEFAULT_SETTINGS = {
    notify: true,
    notifyGoals: true,
    notifyStart: true,
    notifyHalf: false,
    notifyEnd: true,
    showIcon: true,
    keepHours: 3,
    showNext: true,
  };

  const COLORS = {
    live: '#16A34A',
    goal: '#FACC15',
    half: '#EA580C',
    final: '#52525B',
    next: '#2563EB',
    error: '#DC2626',
  };

  const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  // ---------- URLs ----------

  const urls = {
    scoreboard: () => `${API}/scoreboard`,
    teams: () => `${API}/teams`,
    nextGames: (id) => `${API}/teams/${id}/schedule?fixture=true`,
    pastGames: (id) => `${API}/teams/${id}/schedule`,
    logo: (id, size = 64) =>
      `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=${size}&h=${size}`,
    match: (eventId) => `https://www.espn.com.br/futebol/partida/_/jogoId/${eventId}`,
    review: () => `${STORE}/reviews`,
    issues: () => 'https://github.com/aliansantos/placar-brasileirao/issues',
  };

  // ---------- leitura da API ----------

  function scoreOf(c) {
    const s = c && c.score;
    if (s === null || s === undefined || s === '') return null;
    if (typeof s === 'object') {
      const v = s.value !== undefined ? s.value : s.displayValue;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function side(c) {
    const t = (c && c.team) || {};
    const id = String(t.id || '');
    return {
      id,
      name: t.shortDisplayName || t.displayName || t.name || '?',
      abbr: t.abbreviation || '',
      score: scoreOf(c),
    };
  }

  function parseEvent(e) {
    const comp = (e.competitions && e.competitions[0]) || {};
    const st = comp.status || e.status || {};
    const type = st.type || {};
    const cs = comp.competitors || [];
    const home = cs.find((c) => c.homeAway === 'home') || cs[0];
    const away = cs.find((c) => c.homeAway === 'away') || cs[1];
    const plays = (comp.details || [])
      .filter((d) => d.scoringPlay || d.yellowCard || d.redCard)
      .map((d) => {
        const who = (d.athletesInvolved && d.athletesInvolved[0]) || {};
        return {
          kind: d.scoringPlay ? 'gol' : d.redCard ? 'vermelho' : 'amarelo',
          t: (d.clock && d.clock.value) || 0,
          min: (d.clock && d.clock.displayValue) || '',
          teamId: String((d.team && d.team.id) || ''),
          player: who.shortName || who.displayName || '',
          ownGoal: !!d.ownGoal,
          penalty: !!d.penaltyKick,
        };
      })
      .sort((a, b) => a.t - b.t);
    return {
      id: String(e.id),
      date: e.date,
      state: type.state || 'pre',
      status: type.name || '',
      completed: !!type.completed,
      clock: st.displayClock || '',
      period: st.period || 0,
      home: side(home),
      away: side(away),
      venue: (comp.venue && comp.venue.fullName) || '',
      plays,
    };
  }

  function parseScoreboard(json) {
    return ((json && json.events) || []).map(parseEvent).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  }

  function parseTeams(json) {
    const league = json && json.sports && json.sports[0] && json.sports[0].leagues && json.sports[0].leagues[0];
    return ((league && league.teams) || [])
      .map(({ team: t }) => ({
        id: String(t.id),
        name: t.shortDisplayName || t.displayName,
        abbr: t.abbreviation,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  // Lista de jogos do time (schedule). Devolve o próximo (não começou) e o último encerrado.
  function parseSchedule(nextJson, pastJson) {
    const all = [...((nextJson && nextJson.events) || []), ...((pastJson && pastJson.events) || [])].map(parseEvent);
    const byId = new Map(all.map((g) => [g.id, g]));
    const games = [...byId.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const next = games.find((g) => g.state === 'pre' && !isOff(g)) || null;
    const finished = games.filter((g) => g.state === 'post' && g.completed);
    const last = finished.length ? finished[finished.length - 1] : null;
    return { next, last };
  }

  // ---------- estados ----------

  const isOff = (g) => /POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED/.test(g.status);
  const isLive = (g) => g.state === 'in';
  const isHalf = (g) => g.status === 'STATUS_HALFTIME';
  const isFinal = (g) => g.state === 'post';
  const involves = (g, teamId) => g.home.id === teamId || g.away.id === teamId;
  const opponent = (g, teamId) => (g.home.id === teamId ? g.away : g.home);
  const scoreText = (g, sep = '-') => `${g.home.score ?? 0}${sep}${g.away.score ?? 0}`;
  const line = (g) => `${g.home.name} ${g.home.score ?? 0} x ${g.away.score ?? 0} ${g.away.name}`;

  // ---------- datas (sempre em horário de Brasília) ----------

  function parts(date) {
    const p = {};
    for (const { type, value } of new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(date)))
      p[type] = value;
    return p;
  }

  const dayNumber = (date) => {
    const p = parts(date);
    return Date.UTC(+p.year, +p.month - 1, +p.day) / DAY;
  };
  const daysUntil = (date, now) => dayNumber(date) - dayNumber(now);
  const weekday = (date) => WEEKDAYS[new Date(dayNumber(date) * DAY).getUTCDay()];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function hourLabel(date) {
    const p = parts(date);
    return p.minute === '00' ? `${+p.hour}h` : `${+p.hour}h${p.minute}`;
  }
  const clockLabel = (date) => {
    const p = parts(date);
    return `${p.hour}:${p.minute}`;
  };
  const dateShort = (date) => {
    const p = parts(date);
    return `${p.day}/${p.month}`;
  };

  // "Hoje · 21h30", "Amanhã · 16h", "Qua, 18/11 · 21h30"
  function whenLabel(date, now) {
    const d = daysUntil(date, now);
    if (d === 0) return `Hoje · ${hourLabel(date)}`;
    if (d === 1) return `Amanhã · ${hourLabel(date)}`;
    if (d === -1) return `Ontem · ${hourLabel(date)}`;
    return `${cap(weekday(date))}, ${dateShort(date)} · ${hourLabel(date)}`;
  }

  function dayLabel(date, now) {
    const d = daysUntil(date, now);
    if (d === 0) return 'Hoje';
    if (d === 1) return 'Amanhã';
    return `${cap(weekday(date))}, ${dateShort(date)}`;
  }

  function inDaysLabel(date, now) {
    const d = daysUntil(date, now);
    if (d <= 0) return 'hoje';
    if (d === 1) return 'amanhã';
    return `em ${d} dias`;
  }

  // ---------- textos de status ----------

  function periodLabel(g) {
    if (isHalf(g)) return 'Intervalo';
    if (g.status === 'STATUS_FIRST_HALF' || g.period === 1) return `1º tempo · ${g.clock}`;
    if (g.status === 'STATUS_SECOND_HALF' || g.period === 2) return `2º tempo · ${g.clock}`;
    return g.clock || 'Ao vivo';
  }

  // Status curto para as linhas da lista: 70' / INT / FIM / 21h30 / ADI
  function shortStatus(g) {
    if (isLive(g)) return isHalf(g) ? 'INT' : g.clock || 'AO VIVO';
    if (isFinal(g)) return isOff(g) ? 'SUSP' : 'FIM';
    if (/POSTPONED/.test(g.status)) return 'ADI';
    if (/CANCEL/.test(g.status)) return 'CANC';
    return hourLabel(g.date);
  }

  // ---------- foco: qual jogo vai para o ícone e para o card principal ----------
  // 1) primeiro favorito (na ordem) que estiver jogando;
  // 2) jogo de favorito que terminou há menos de keepHours;
  // 3) próximo jogo mais cedo entre os favoritos (empate: ordem dos favoritos).

  function mergeGames(boardGames, schedules) {
    const byId = new Map();
    for (const s of Object.values(schedules || {})) {
      for (const g of [s && s.next, s && s.last]) if (g) byId.set(g.id, g);
    }
    for (const g of boardGames || []) byId.set(g.id, g); // placar do dia é o mais novo
    return [...byId.values()];
  }

  function pickFocus({ favorites, games, settings, now }) {
    settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!favorites || !favorites.length) return null;

    for (const teamId of favorites) {
      const g = games.find((x) => involves(x, teamId) && isLive(x));
      if (g) return { teamId, game: g, mode: isHalf(g) ? 'half' : 'live' };
    }

    const keep = settings.keepHours * HOUR;
    for (const teamId of favorites) {
      const g = games
        .filter((x) => involves(x, teamId) && isFinal(x) && !isOff(x))
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
      if (g && now - (Date.parse(g.date) + MATCH_LENGTH) < keep && now >= Date.parse(g.date)) {
        return { teamId, game: g, mode: 'final' };
      }
    }

    let best = null;
    favorites.forEach((teamId, rank) => {
      const g = games
        .filter((x) => involves(x, teamId) && x.state === 'pre' && !isOff(x))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
      if (!g) return;
      const t = Date.parse(g.date);
      if (!best || t < best.t || (t === best.t && rank < best.rank)) best = { teamId, game: g, t, rank };
    });
    if (best) return { teamId: best.teamId, game: best.game, mode: 'next' };
    return null;
  }

  // Texto, cores e dica do selo do ícone.
  function badgeFor(focus, { now, flashUntil = {}, settings } = {}) {
    settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!focus || !settings.showIcon) return { text: '', color: COLORS.next, textColor: '#FFFFFF', title: 'Placar Brasileirão' };
    const g = focus.game;
    if (focus.mode === 'live' || focus.mode === 'half') {
      const flashing = (flashUntil[g.id] || 0) > now;
      return {
        text: flashing ? 'GOL' : scoreText(g),
        color: flashing ? COLORS.goal : focus.mode === 'half' ? COLORS.half : COLORS.live,
        textColor: flashing ? '#1A1A1A' : '#FFFFFF',
        title: `${line(g)} · ${periodLabel(g)}`,
      };
    }
    if (focus.mode === 'final') {
      return { text: scoreText(g), color: COLORS.final, textColor: '#FFFFFF', title: `Fim: ${line(g)}` };
    }
    if (!settings.showNext) return { text: '', color: COLORS.next, textColor: '#FFFFFF', title: 'Placar Brasileirão' };
    const d = daysUntil(g.date, now);
    const text = d <= 0 ? `${+parts(g.date).hour}h` : d <= 6 ? weekday(g.date).toUpperCase() : `${d}d`;
    return {
      text,
      color: COLORS.next,
      textColor: '#FFFFFF',
      title: `${whenLabel(g.date, now)}: ${g.home.name} x ${g.away.name}`,
    };
  }

  // ---------- notificações: compara a leitura anterior com a nova ----------

  function diffGame(prev, cur, favorites, settings) {
    settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!prev || !cur || !settings.notify) return [];
    const mine = (favorites || []).find((id) => involves(cur, id));
    if (!mine) return [];
    const out = [];
    const base = { eventId: cur.id, teamId: mine };

    if (prev.state === 'pre' && cur.state === 'in' && settings.notifyStart) {
      out.push({
        ...base,
        type: 'start',
        title: `Começou: ${cur.home.name} x ${cur.away.name}`,
        message: [cur.venue, 'Brasileirão Série A'].filter(Boolean).join(' · '),
      });
    }

    if (settings.notifyGoals) {
      for (const key of ['home', 'away']) {
        const before = prev[key].score ?? 0;
        const after = cur[key].score;
        if (after === null || after === undefined || after <= before) continue;
        const team = cur[key];
        // Lance mais recente marcado a favor desse time (gol contra pode vir com o outro time).
        const goals = cur.plays.filter((p) => p.kind === 'gol');
        const goal =
          goals.filter((p) => p.teamId === team.id).slice(-1)[0] || goals.slice(-1)[0] || null;
        const min = goal ? ` · ${goal.min}` : '';
        const isFav = (favorites || []).includes(team.id);
        const who = goal && goal.player ? ` · ${goal.player}${goal.ownGoal ? ' (contra)' : goal.penalty ? ' (pênalti)' : ''}` : '';
        out.push({
          ...base,
          teamId: team.id,
          type: 'goal',
          favoriteScored: isFav,
          title: isFav ? `GOL do ${team.name}!${goal ? ' ' + goal.min : ''}` : `Gol do ${team.name}${min}`,
          message: `${line(cur)}${who}`,
        });
      }
    }

    if (settings.notifyHalf && !isHalf(prev) && isHalf(cur)) {
      out.push({ ...base, type: 'half', title: `Intervalo: ${line(cur)}`, message: 'Fim do 1º tempo' });
    }

    if (prev.state !== 'post' && cur.state === 'post' && settings.notifyEnd) {
      const me = cur.home.id === mine ? cur.home : cur.away;
      const them = opponent(cur, mine);
      const result =
        (me.score ?? 0) > (them.score ?? 0)
          ? `Vitória do ${me.name}`
          : (me.score ?? 0) < (them.score ?? 0)
            ? `Derrota do ${me.name}`
            : 'Empate';
      out.push({ ...base, type: 'end', title: `Fim: ${line(cur)}`, message: result });
    }
    return out;
  }

  // ---------- quando atualizar de novo ----------

  function nextDelay({ games, favorites, now, error, flashUntil = {} }) {
    const SEC = 1000;
    const MIN = 60 * SEC;
    if (error) return MIN;
    const fav = (g) => (favorites || []).some((id) => involves(g, id));
    if (Object.values(flashUntil).some((t) => t > now)) return 30 * SEC;
    if (games.some((g) => fav(g) && isLive(g))) return 30 * SEC;
    const upcoming = games
      .filter((g) => fav(g) && g.state === 'pre' && !isOff(g))
      .map((g) => Date.parse(g.date))
      .filter((t) => t > now - 3 * HOUR) // atrasado ainda pode começar
      .sort((a, b) => a - b)[0];
    if (upcoming !== undefined) {
      if (upcoming - now <= 10 * MIN) return 30 * SEC;
      return Math.max(MIN, Math.min(15 * MIN, upcoming - 5 * MIN - now));
    }
    return 15 * MIN;
  }

  return {
    TZ,
    API,
    DEFAULT_SETTINGS,
    COLORS,
    urls,
    parseEvent,
    parseScoreboard,
    parseTeams,
    parseSchedule,
    isLive,
    isHalf,
    isFinal,
    isOff,
    involves,
    opponent,
    scoreText,
    line,
    daysUntil,
    hourLabel,
    clockLabel,
    whenLabel,
    dayLabel,
    inDaysLabel,
    periodLabel,
    shortStatus,
    mergeGames,
    pickFocus,
    badgeFor,
    diffGame,
    nextDelay,
  };
})();
