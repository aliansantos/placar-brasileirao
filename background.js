// Service worker: busca os placares na ESPN, desenha o ícone com o escudo + selo
// e manda notificações de gol, início, intervalo e fim. Todo o estado fica em chrome.storage.local.

importScripts('shared.js');

const ALARM = 'tick';
const BOARD_MIN_AGE = 10e3; // não busca o placar de novo se a última leitura tem menos de 10 s
const SCHEDULE_MAX_AGE = 6 * 3600e3;
const TEAMS_MAX_AGE = 7 * 24 * 3600e3;
const ERROR_BADGE_AFTER = 2 * 60e3;
const GOAL_FLASH = 60e3;

// ---------- utilidades ----------

let queue = Promise.resolve();
const serial = (fn) => {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
};

async function load() {
  const s = await chrome.storage.local.get(null);
  return {
    favorites: s.favorites || [],
    settings: { ...PB.DEFAULT_SETTINGS, ...(s.settings || {}) },
    teams: s.teams || null, // { fetchedAt, list }
    board: s.board || null, // { fetchedAt, games }
    schedules: s.schedules || {}, // { [teamId]: { fetchedAt, next, last } }
    flashUntil: s.flashUntil || {},
    error: s.error || null, // { at, message }
    lastOk: s.lastOk || 0,
  };
}

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN respondeu ${res.status}`);
  return res.json();
}

// ---------- atualização ----------

async function fetchSchedule(teamId) {
  const [next, past] = await Promise.all([
    getJSON(PB.urls.nextGames(teamId)),
    getJSON(PB.urls.pastGames(teamId)),
  ]);
  return { fetchedAt: Date.now(), ...PB.parseSchedule(next, past) };
}

function update({ force = false } = {}) {
  return serial(async () => {
    const st = await load();
    const now = Date.now();
    const patch = {};
    try {
      if (!st.teams || now - st.teams.fetchedAt > TEAMS_MAX_AGE || !st.teams.list.length) {
        patch.teams = { fetchedAt: now, list: PB.parseTeams(await getJSON(PB.urls.teams())) };
      }

      let games = st.board ? st.board.games : [];
      if (force || !st.board || now - st.board.fetchedAt > BOARD_MIN_AGE) {
        const fresh = PB.parseScoreboard(await getJSON(PB.urls.scoreboard()));
        const before = new Map(games.map((g) => [g.id, g]));
        const alerts = fresh.flatMap((g) => PB.diffGame(before.get(g.id), g, st.favorites, st.settings));
        const flash = { ...st.flashUntil };
        for (const id of Object.keys(flash)) if (flash[id] < now) delete flash[id];
        for (const g of fresh) {
          const old = before.get(g.id);
          const scored = old && (g.home.score ?? 0) + (g.away.score ?? 0) > (old.home.score ?? 0) + (old.away.score ?? 0);
          if (scored && st.favorites.some((id) => PB.involves(g, id))) flash[g.id] = now + GOAL_FLASH;
        }
        patch.flashUntil = flash;
        patch.board = { fetchedAt: now, games: fresh };
        games = fresh;
        for (const a of alerts) notify(a).catch(() => {});
      }

      // Agenda de cada favorito: quando falta, está velha, ou o "próximo jogo" já começou.
      const schedules = { ...st.schedules };
      let changed = false;
      for (const id of Object.keys(schedules)) {
        if (!st.favorites.includes(id)) {
          delete schedules[id];
          changed = true;
        }
      }
      for (const id of st.favorites) {
        const s = schedules[id];
        const stale =
          !s ||
          now - s.fetchedAt > SCHEDULE_MAX_AGE ||
          (s.next && Date.parse(s.next.date) < now && now - s.fetchedAt > 30 * 60e3);
        if (stale) {
          schedules[id] = await fetchSchedule(id);
          changed = true;
        }
      }
      if (changed) patch.schedules = schedules;

      patch.error = null;
      patch.lastOk = now;
    } catch (e) {
      patch.error = { at: now, message: String((e && e.message) || e) };
    }
    await chrome.storage.local.set(patch);
    await render();
    await scheduleNext();
  });
}

async function scheduleNext() {
  const st = await load();
  const games = PB.mergeGames(st.board ? st.board.games : [], st.schedules);
  const delay = PB.nextDelay({
    games,
    favorites: st.favorites,
    now: Date.now(),
    error: st.error,
    flashUntil: st.flashUntil,
  });
  await chrome.alarms.create(ALARM, { when: Date.now() + delay });
}

// ---------- ícone ----------

const crestCache = new Map(); // teamId -> { imageData: {16, 32}, dataUrl }

async function crest(teamId) {
  if (crestCache.has(teamId)) return crestCache.get(teamId);
  if (typeof OffscreenCanvas === 'undefined') return null;
  const blob = await (await fetch(PB.urls.logo(teamId, 96))).blob();
  const bmp = await createImageBitmap(blob);
  const imageData = {};
  for (const size of [16, 32]) {
    const c = new OffscreenCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, size, size);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  const big = new OffscreenCanvas(80, 80);
  big.getContext('2d').drawImage(bmp, 0, 0, 80, 80);
  const buf = new Uint8Array(await (await big.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const entry = { imageData, dataUrl: 'data:image/png;base64,' + btoa(bin) };
  crestCache.set(teamId, entry);
  return entry;
}

const DEFAULT_ICON = { 16: 'icons/icon16.png', 32: 'icons/icon32.png' };

async function render() {
  const st = await load();
  const now = Date.now();
  const games = PB.mergeGames(st.board ? st.board.games : [], st.schedules);
  const focus = PB.pickFocus({ favorites: st.favorites, games, settings: st.settings, now });
  let badge = PB.badgeFor(focus, { now, flashUntil: st.flashUntil, settings: st.settings });

  if (st.error && now - (st.lastOk || 0) > ERROR_BADGE_AFTER) {
    badge = {
      text: '!',
      color: PB.COLORS.error,
      textColor: '#FFFFFF',
      title: `Não consegui atualizar${st.lastOk ? ' desde ' + PB.clockLabel(st.lastOk) : ''}. ${badge.title}`,
    };
  }

  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: badge.textColor });
  await chrome.action.setTitle({ title: badge.title });

  const showCrest = focus && st.settings.showIcon && (focus.mode !== 'next' || st.settings.showNext);
  try {
    const c = showCrest ? await crest(focus.teamId) : null;
    if (c) await chrome.action.setIcon({ imageData: c.imageData });
    else await chrome.action.setIcon({ path: DEFAULT_ICON });
  } catch {
    await chrome.action.setIcon({ path: DEFAULT_ICON });
  }
}

// ---------- notificações ----------

async function notify(a) {
  let iconUrl = 'icons/icon128.png';
  try {
    const c = await crest(a.teamId);
    if (c) iconUrl = c.dataUrl;
  } catch {}
  await chrome.notifications.create(`pb|${a.eventId}|${a.type}|${Date.now()}`, {
    type: 'basic',
    iconUrl,
    title: a.title,
    message: a.message,
    contextMessage: 'Placar Brasileirão',
    priority: a.type === 'goal' ? 2 : 1,
  });
}

chrome.notifications.onClicked.addListener((id) => {
  const [tag, eventId] = id.split('|');
  if (tag === 'pb' && eventId && eventId !== 'teste') chrome.tabs.create({ url: PB.urls.match(eventId) });
  chrome.notifications.clear(id);
});

// ---------- eventos ----------

chrome.runtime.onInstalled.addListener(() => update({ force: true }));
chrome.runtime.onStartup.addListener(() => update({ force: true }));
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) update();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.favorites) update({ force: false });
  else if (changes.settings) serial(render);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'refresh') {
      await update({ force: !!msg.force });
      return { ok: true };
    }
    if (msg.type === 'testNotification') {
      const st = await load();
      await notify({
        eventId: 'teste',
        teamId: st.favorites[0] || '6273',
        type: 'goal',
        title: 'Teste: GOL!',
        message: 'É assim que os avisos de gol vão aparecer.',
      });
      return { ok: true };
    }
    return { error: 'mensagem desconhecida' };
  })()
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String((e && e.message) || e) }));
  return true;
});

// Garante que exista um alarme mesmo se o service worker acordar sem onStartup.
chrome.alarms.get(ALARM).then((a) => {
  if (!a) update();
});
