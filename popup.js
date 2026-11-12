// Popup com três abas: Jogos, Times e Config. Lê o estado salvo pelo background
// e pede atualização a cada 30 s enquanto está aberto.

const ICONS = {
  ball: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.3" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.6l3.3 2.4-1.26 3.9H9.96L8.7 10z" fill="currentColor"/><path d="M12 7.6V2.9M15.3 10l4.4-1.4M14.04 13.9l2.7 3.8M9.96 13.9l-2.7 3.8M8.7 10L4.3 8.6" stroke="currentColor" stroke-width="1.5"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  starOn:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/></svg>',
  starOff:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4l9 16H3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5M12 17.2v.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// ---------- utilidades ----------

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

function icon(name) {
  const s = document.createElement('span');
  s.className = 'ic';
  s.innerHTML = ICONS[name]; // SVG fixo deste arquivo
  return s;
}

const crest = (id, size) =>
  h('img', { class: 'crest', src: PB.urls.logo(id, size * 2), width: size, height: size, alt: '', loading: 'lazy' });

const openMatch = (g) => g && chrome.tabs.create({ url: PB.urls.match(g.id) });

async function send(msg) {
  const res = await chrome.runtime.sendMessage(msg);
  if (res && res.error) throw new Error(res.error);
  return res;
}

let toastTimer;
function toast(text, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = isError ? 'error' : '';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- estado ----------

let S = null;
let tab = 'jogos';
let query = '';

async function loadState() {
  const s = await chrome.storage.local.get(null);
  S = {
    favorites: s.favorites || [],
    settings: { ...PB.DEFAULT_SETTINGS, ...(s.settings || {}) },
    teams: (s.teams && s.teams.list) || [],
    board: s.board || null,
    schedules: s.schedules || {},
    error: s.error || null,
    lastOk: s.lastOk || 0,
  };
  if (s.popupTab) tab = s.popupTab;
}

function teamName(id) {
  const t = S.teams.find((x) => x.id === id);
  if (t) return t.name;
  for (const g of S.board ? S.board.games : []) {
    if (g.home.id === id) return g.home.name;
    if (g.away.id === id) return g.away.name;
  }
  return 'Time';
}

const allGames = () => PB.mergeGames(S.board ? S.board.games : [], S.schedules);

// Jogo mais relevante de um time: ao vivo > terminou há pouco > próximo.
function gameFor(teamId) {
  return PB.pickFocus({ favorites: [teamId], games: allGames(), settings: S.settings, now: Date.now() });
}

const saveFavorites = (list) => chrome.storage.local.set({ favorites: list });
const saveSettings = (patch) => chrome.storage.local.set({ settings: { ...S.settings, ...patch } });

// ---------- cabeçalho ----------

function renderHeader() {
  const el = document.getElementById('updated');
  const failing = S.error && (!S.board || S.error.at > S.lastOk);
  el.className = 'updated' + (failing ? ' error' : '');
  el.textContent = failing ? 'sem conexão' : S.board ? `atualizado ${PB.clockLabel(S.board.fetchedAt)}` : 'carregando…';
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
}

// ---------- aba Jogos ----------

const PILL = {
  live: ['live', 'AO VIVO', true],
  half: ['half', 'INTERVALO', false],
  final: ['final', 'ENCERRADO', false],
  next: ['next', 'PRÓXIMO JOGO', false],
};

function resultFor(g, teamId) {
  const me = g.home.id === teamId ? g.home : g.away;
  const them = PB.opponent(g, teamId);
  return (me.score ?? 0) > (them.score ?? 0) ? 'V' : (me.score ?? 0) < (them.score ?? 0) ? 'D' : 'E';
}

function relDay(date) {
  const d = PB.daysUntil(date, Date.now());
  if (d === 0) return 'hoje';
  if (d === -1) return 'ontem';
  return PB.dayLabel(date, Date.now());
}

function hero(focus) {
  const now = Date.now();
  const g = focus.game;
  if (!g) {
    return h(
      'section',
      { class: 'hero' },
      h('div', { class: 'scoreline' }, h('div', { class: 'team' }, crest(focus.teamId, 48), teamName(focus.teamId))),
      h('div', { class: 'note center' }, 'Sem jogos marcados no Brasileirão por enquanto.'),
    );
  }
  const [cls, label, dot] = PILL[focus.mode];
  const clock =
    focus.mode === 'live'
      ? PB.periodLabel(g)
      : focus.mode === 'half'
        ? 'Intervalo'
        : focus.mode === 'final'
          ? relDay(g.date) === 'hoje' ? 'Encerrado hoje' : `Encerrado · ${relDay(g.date)}`
          : PB.inDaysLabel(g.date, now);

  const center =
    focus.mode === 'next'
      ? h('div', { class: 'kickoff' }, h('b', {}, PB.hourLabel(g.date)), h('span', {}, PB.dayLabel(g.date, now)))
      : h('div', { class: 'big-score' }, PB.scoreText(g, ' – '));

  const plays = focus.mode !== 'next' && g.plays.length
    ? [
        h('div', { class: 'divider' }),
        h(
          'div',
          { class: 'plays' },
          g.plays.map((p) =>
            h(
              'div',
              { class: 'play ' + p.kind },
              p.kind === 'gol' ? icon('ball') : h('span', { class: 'card-mark' + (p.kind === 'vermelho' ? ' red' : '') }),
              h('span', { class: 'min' }, p.min),
              h('span', { class: 'who' }, p.player + (p.ownGoal ? ' (contra)' : p.penalty ? ' (pên.)' : '')),
              h('span', { class: 'side' }, p.teamId === g.home.id ? g.home.abbr : g.away.abbr),
            ),
          ),
        ),
      ]
    : null;

  let last = null;
  const sch = S.schedules[focus.teamId];
  if (focus.mode === 'next' && sch && sch.last && sch.last.id !== g.id) {
    const lg = sch.last;
    const r = resultFor(lg, focus.teamId);
    last = h(
      'button',
      { class: 'last', title: 'Ver na ESPN', onclick: () => openMatch(lg) },
      h('span', { class: 'res ' + r }, r),
      `Último: ${PB.line(lg)}`,
      h('span', { class: 'when' }, relDay(lg.date)),
    );
  }

  return h(
    'section',
    { class: 'hero' + (focus.mode === 'live' ? ' live' : '') },
    h(
      'div',
      { class: 'hero-top' },
      h('span', { class: 'pill ' + cls }, dot ? h('span', { class: 'dot' }) : null, label),
      h('span', { class: 'hero-clock' + (focus.mode === 'live' ? ' live' : '') }, clock),
    ),
    h(
      'div',
      { class: 'scoreline' },
      h('div', { class: 'team' }, crest(g.home.id, 48), g.home.name),
      center,
      h('div', { class: 'team' }, crest(g.away.id, 48), g.away.name),
    ),
    plays,
    last,
    h(
      'button',
      { class: 'hero-foot', title: 'Abrir o jogo na ESPN', onclick: () => openMatch(g) },
      [g.venue, 'Brasileirão Série A', 'ver na ESPN'].filter(Boolean).join(' · '),
    ),
  );
}

function favRow(teamId) {
  const f = gameFor(teamId);
  const now = Date.now();
  let info = 'Sem jogos marcados';
  let live = false;
  if (f && (f.mode === 'live' || f.mode === 'half')) {
    live = true;
    info = `Ao vivo: ${f.game.home.abbr} ${PB.scoreText(f.game, ' x ')} ${f.game.away.abbr} · ${PB.shortStatus(f.game)}`;
  } else if (f && f.mode === 'final') {
    info = `Fim: ${PB.line(f.game)}`;
  } else if (f && f.mode === 'next') {
    info = `Próximo: ${PB.whenLabel(f.game.date, now)} x ${PB.opponent(f.game, teamId).name}`;
  }
  return h(
    'button',
    { class: 'favrow', onclick: () => f && openMatch(f.game), title: f ? 'Ver na ESPN' : null },
    crest(teamId, 24),
    h('div', { class: 'txt' }, h('b', {}, teamName(teamId)), h('span', { class: live ? 'live' : '' }, info)),
    icon('chevron'),
  );
}

function matchRow(g) {
  const fav = S.favorites.some((id) => PB.involves(g, id));
  const stCls = PB.isLive(g) ? (PB.isHalf(g) ? 'half' : 'live') : '';
  const score = g.state === 'pre' ? 'x' : PB.scoreText(g, ' – ');
  return h(
    'button',
    { class: 'row' + (fav ? ' fav' : ''), title: 'Ver na ESPN', onclick: () => openMatch(g) },
    h('span', { class: 'h' }, g.home.name),
    crest(g.home.id, 20),
    h('span', { class: 'sc' }, score),
    crest(g.away.id, 20),
    h('span', { class: 'a' }, g.away.name),
    h('span', { class: 'st ' + stCls }, PB.shortStatus(g)),
  );
}

function viewJogos() {
  const out = [];
  const now = Date.now();
  const failing = S.error && (!S.board || S.error.at > S.lastOk);
  if (failing) {
    out.push(
      h(
        'div',
        { class: 'banner' },
        icon('warn'),
        h(
          'div',
          { class: 'txt' },
          h('b', {}, 'Não consegui atualizar'),
          h('span', {}, S.lastOk ? `Mostrando os dados de ${PB.clockLabel(S.lastOk)}. Tento de novo em 1 min.` : 'Verifique a internet. Tento de novo em 1 min.'),
        ),
        h('button', { class: 'btn', onclick: () => refresh(true) }, 'Tentar'),
      ),
    );
  }
  const body = [];

  if (!S.favorites.length) {
    body.push(
      h(
        'div',
        { class: 'empty' },
        h('div', { class: 'bubble' }, icon('starOn')),
        h('b', {}, 'Escolha seus times'),
        h('p', {}, 'Marque um ou mais clubes. O ícone vai mostrar o placar do primeiro que estiver jogando, e você recebe aviso de gol.'),
        h('button', { class: 'btn primary', onclick: () => setTab('times') }, 'Escolher times'),
      ),
    );
  } else {
    const focus =
      PB.pickFocus({ favorites: S.favorites, games: allGames(), settings: S.settings, now }) || {
        teamId: S.favorites[0],
        game: null,
      };
    body.push(hero(focus));
    const others = S.favorites.filter((id) => id !== focus.teamId);
    if (others.length) body.push(h('div', { class: 'label' }, 'Outros favoritos'), others.map(favRow));
  }

  if (!S.board) {
    body.push(h('div', { class: 'note center' }, 'Carregando jogos…'));
  } else {
    const games = S.board.games;
    const live = games.filter(PB.isLive);
    const pre = games.filter((g) => g.state === 'pre');
    const done = games.filter(PB.isFinal);
    const today = (g) => PB.daysUntil(g.date, now) === 0;
    if (live.length) body.push(h('div', { class: 'label' }, 'Ao vivo agora'), live.map(matchRow));
    if (pre.length) body.push(h('div', { class: 'label' }, pre.every(today) ? 'Ainda hoje' : 'Próximos jogos'), pre.map(matchRow));
    if (done.length) body.push(h('div', { class: 'label' }, done.every(today) ? 'Encerrados hoje' : 'Encerrados'), done.map(matchRow));
    if (!games.length) body.push(h('div', { class: 'note center' }, 'Nenhum jogo da Série A hoje.'));
  }
  body.push(h('div', { class: 'note center' }, 'Dados: ESPN · horários de Brasília'));

  if (failing && S.board) out.push(h('div', { class: 'stale', style: 'display:flex;flex-direction:column;gap:10px' }, body));
  else out.push(body);
  return out;
}

// ---------- aba Times ----------

function viewTimes() {
  const listBox = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
  const input = h('input', {
    type: 'search',
    placeholder: 'Buscar time…',
    value: query,
    oninput: (e) => {
      query = e.target.value;
      fillTimes(listBox);
    },
  });
  fillTimes(listBox);
  setTimeout(() => input.focus(), 0);
  return [h('label', { class: 'search' }, icon('search'), input), listBox];
}

function fillTimes(box) {
  box.replaceChildren();
  const favs = S.favorites;
  const now = Date.now();
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  const match = (id) => !q || norm(teamName(id)).includes(q);

  if (favs.length) {
    box.append(h('div', { class: 'label' }, 'Seus favoritos · ordem de prioridade'));
    const list = h('div', { class: 'list' });
    favs.forEach((id, i) => {
      if (!match(id)) return;
      const f = gameFor(id);
      const info =
        f && (f.mode === 'live' || f.mode === 'half')
          ? `Ao vivo: ${PB.scoreText(f.game, ' x ')} · ${PB.shortStatus(f.game)}`
          : f && f.mode === 'next'
            ? `Próximo: ${PB.whenLabel(f.game.date, now)}`
            : f && f.mode === 'final'
              ? `Fim: ${PB.line(f.game)}`
              : 'Sem jogos marcados';
      const move = (to) => {
        const next = favs.slice();
        [next[i], next[to]] = [next[to], next[i]];
        saveFavorites(next);
      };
      list.append(
        h(
          'div',
          { class: 'item' },
          h('span', { class: 'rank' }, String(i + 1)),
          crest(id, 24),
          h('div', { class: 'txt' }, h('b', {}, teamName(id)), h('span', {}, info)),
          h(
            'div',
            { class: 'arrows' },
            h('button', { title: 'Subir', disabled: i === 0, onclick: () => move(i - 1) }, icon('up')),
            h('button', { title: 'Descer', disabled: i === favs.length - 1, onclick: () => move(i + 1) }, icon('down')),
          ),
          h(
            'button',
            { class: 'star on', title: 'Tirar dos favoritos', onclick: () => saveFavorites(favs.filter((x) => x !== id)) },
            icon('starOn'),
          ),
        ),
      );
    });
    box.append(list);
    if (favs.length > 1 && !q) box.append(h('div', { class: 'note' }, 'O ícone mostra o 1º favorito que estiver jogando. Se dois jogarem ao mesmo tempo, vale esta ordem.'));
  }

  box.append(h('div', { class: 'label' }, 'Todos os times · Série A'));
  if (!S.teams.length) {
    box.append(h('div', { class: 'note center' }, S.error ? 'Não consegui carregar a lista de times.' : 'Carregando times…'));
    return;
  }
  const rest = S.teams.filter((t) => !favs.includes(t.id) && match(t.id));
  const list = h('div', { class: 'list' });
  for (const t of rest) {
    list.append(
      h(
        'div',
        { class: 'item' },
        crest(t.id, 20),
        h('span', { class: 'name' }, t.name),
        h('button', { class: 'star', title: 'Adicionar aos favoritos', onclick: () => saveFavorites([...favs, t.id]) }, icon('starOff')),
      ),
    );
  }
  if (!rest.length) list.append(h('div', { class: 'item' }, h('span', { class: 'note' }, 'Nenhum time encontrado.')));
  box.append(list);
}

// ---------- aba Config ----------

function toggle(key, disabled) {
  return h(
    'label',
    { class: 'switch' },
    h('input', {
      type: 'checkbox',
      checked: S.settings[key],
      disabled,
      onchange: (e) => saveSettings({ [key]: e.target.checked }),
    }),
    h('span'),
  );
}

function opt(title, sub, control, disabled) {
  return h(
    'div',
    { class: 'opt' + (disabled ? ' disabled' : '') },
    h('div', { class: 'txt' }, h('b', {}, title), sub ? h('span', {}, sub) : null),
    control,
  );
}

function viewConfig() {
  const s = S.settings;
  const offN = !s.notify;
  const offI = !s.showIcon;
  const keep = h(
    'select',
    { disabled: offI, onchange: (e) => saveSettings({ keepHours: Number(e.target.value) }) },
    [1, 2, 3, 6, 12].map((n) => h('option', { value: String(n), selected: n === s.keepHours }, `${n} ${n === 1 ? 'hora' : 'horas'}`)),
  );
  return [
    h('div', { class: 'label' }, 'Notificações do sistema'),
    h(
      'div',
      { class: 'list' },
      opt('Notificações', 'Só para os seus times favoritos', toggle('notify')),
      opt('Gols', 'Do seu time e do adversário', toggle('notifyGoals', offN), offN),
      opt('Início do jogo', null, toggle('notifyStart', offN), offN),
      opt('Intervalo', null, toggle('notifyHalf', offN), offN),
      opt('Fim de jogo', 'Com o placar final', toggle('notifyEnd', offN), offN),
    ),
    h('div', { class: 'label' }, 'Ícone na barra'),
    h(
      'div',
      { class: 'list' },
      opt('Placar no ícone', 'Escudo do time + placar no selo', toggle('showIcon')),
      opt('Depois do fim, manter placar por', null, keep, offI),
      opt('Sem jogo, mostrar o próximo', 'Hoje: hora · na semana: dia · depois: dias que faltam', toggle('showNext', offI), offI),
    ),
    h(
      'div',
      {},
      h(
        'button',
        {
          class: 'btn',
          onclick: async () => {
            try {
              await send({ type: 'testNotification' });
              toast('Notificação enviada. Não apareceu? Veja se o sistema está em "Não incomodar".');
            } catch (e) {
              toast(e.message, true);
            }
          },
        },
        'Testar notificação',
      ),
    ),
    h('div', { class: 'note' }, 'Atualiza a cada 30 s com jogo de favorito ao vivo e a cada 15 min sem jogo. Fonte: ESPN, sem conta nem chave.'),
    h(
      'div',
      { class: 'about' },
      h('span', {}, `Versão ${chrome.runtime.getManifest().version}`),
      h('button', { class: 'link', onclick: () => chrome.tabs.create({ url: PB.urls.issues() }) }, 'Relatar erro'),
      h('button', { class: 'link', onclick: () => chrome.tabs.create({ url: PB.urls.review() }) }, 'Avaliar na loja'),
    ),
  ];
}

// ---------- montagem ----------

function render() {
  renderHeader();
  const view = document.getElementById('view');
  const scroll = document.scrollingElement.scrollTop;
  view.replaceChildren(...[tab === 'times' ? viewTimes() : tab === 'config' ? viewConfig() : viewJogos()].flat(Infinity));
  document.scrollingElement.scrollTop = scroll;
}

function setTab(t) {
  tab = t;
  chrome.storage.local.set({ popupTab: t });
  document.scrollingElement.scrollTop = 0;
  render();
}

async function refresh(force) {
  const btn = document.getElementById('refresh');
  btn.classList.add('spin');
  try {
    await send({ type: 'refresh', force });
  } catch (e) {
    if (force) toast(e.message, true);
  } finally {
    btn.classList.remove('spin');
  }
}

document.getElementById('refresh').append(icon('refresh'));
document.getElementById('refresh').addEventListener('click', () => refresh(true));
for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  const keys = Object.keys(changes).filter((k) => k !== 'popupTab' && k !== 'flashUntil');
  if (!keys.length) return;
  await loadState();
  if (tab === 'times') {
    // Não recria o campo de busca (perderia o foco); só a lista.
    renderHeader();
    const box = document.querySelector('#view > div');
    if (box && (changes.favorites || changes.teams || changes.schedules)) fillTimes(box);
    return;
  }
  render();
});

(async () => {
  await loadState();
  render();
  refresh(false);
  setInterval(() => refresh(false), 30e3);
  setInterval(renderHeader, 10e3);
})();
