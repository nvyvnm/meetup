/* Meetup: логика приложения. Без сборки и без backend: состояние хранится в localStorage.
   Подбор вузов и финансы считаются правилами (прозрачно и проверяемо), без выдуманных процентов шанса. */
(function () {
'use strict';
const D = window.DATA;
const LS = 'meetup.v1', LSR = 'meetup.v1.rate';
const MAJ = D.MAJ, CN = D.CN;
const NUMF = ['ielts', 'sat', 'gpa', 'ach', 'aid', 'year', 'budget'];
const TIER = { dream: 'Dream', target: 'Target', safe: 'Safe' };
const TIERTXT = {
  dream: 'Амбициозный: профиль пока ниже типичного уровня, нужен сильный рывок',
  target: 'Реалистичный: профиль близок к типичному уровню',
  safe: 'Запасной: профиль выше типичного уровня'
};
const ACH = ['Пока нет', 'Школьный уровень', 'Региональный уровень', 'Республиканский уровень', 'Международный уровень'];
const EXTRAS = [['sport', 'Спорт'], ['arts', 'Творчество и искусство'], ['science', 'Научные проекты'], ['volunteer', 'Волонтёрство'], ['lead', 'Лидерство и клубы'], ['biz', 'Свой проект или бизнес']];
const DOCST = ['todo', 'doing', 'done'];
const DOCLBL = { todo: 'Не начато', doing: 'В работе', done: 'Готово' };

/* ---------- утилиты ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
const $ = s => document.querySelector(s);
const wc = t => (String(t || '').trim().match(/\S+/g) || []).length;
const flag = c => (CN[c] ? CN[c][1] : '🌐');
const cname = c => (CN[c] ? CN[c][0] : c);
const link = src => (src ? `<a href="https://${esc(src)}" target="_blank" rel="noopener">${esc(src)}</a>` : '<span class="muted">источник уточни у организатора</span>');

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/></svg>',
  uni: '<svg viewBox="0 0 24 24"><path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
  money: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/></svg>',
  route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>',
  logo: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#0C1B2A"/><path d="M7 23c5 0 4-7 9-7s4-7 9-7" fill="none" stroke="#FFC629" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="9" r="2.6" fill="#00A3C4"/></svg>'
};

/* ---------- состояние ---------- */
function defaults() {
  return {
    p: { name: '', grade: '11', cit: 'KZ', major: 'cs', countries: [], budget: 5000000, aid: 1, waiver: false, ielts: 0, sat: 0, gpa: 4.3, ach: 0, extras: [], year: 2027, done: false },
    liked: [], tasks: {}, docs: {}, acts: [], honors: [], essay: '',
    stress: { rate: 0, budget: 0, noAid: false },
    tab: { free: 'exam', olymp: 'KZ', asia: 'CN', schol: 'all', uni: 'all' },
    step: 0
  };
}
function load() {
  const d = defaults();
  try {
    const j = JSON.parse(lsGet(LS));
    if (j && typeof j === 'object') return Object.assign({}, d, j, { p: Object.assign({}, d.p, j.p || {}), stress: Object.assign({}, d.stress, j.stress || {}), tab: Object.assign({}, d.tab, j.tab || {}) });
  } catch (e) { /* пустое или битое хранилище */ }
  return d;
}
let S = load();
const save = () => lsSet(LS, JSON.stringify(S));
function setPath(path, v) {
  const k = path.split('.'); let o = S;
  for (let i = 0; i < k.length - 1; i++) { o = o[k[i]]; if (o == null) return; }
  o[k[k.length - 1]] = v;
}

/* ---------- курс валют и форматы ---------- */
let RATE = { v: D.fallbackRate, live: false };
const kzt = usd => usd * RATE.v * (1 + S.stress.rate / 100);
const money = t => {
  t = Math.round(t);
  if (t >= 1e6) return (t / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '') + ' млн ₸';
  return Math.round(t / 1000) + ' тыс ₸';
};
const usd = v => '$' + Math.round(v).toLocaleString('ru-RU');
async function loadRate() {
  try { const c = JSON.parse(lsGet(LSR)); if (c && Date.now() - c.t < 6 * 3600e3) { RATE = { v: c.v, live: true }; return; } } catch (e) { /* нет кэша */ }
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctl.signal }); clearTimeout(to);
    const j = await r.json(); const v = j && j.rates && j.rates.KZT;
    if (v > 100 && v < 2000) {
      RATE = { v, live: true }; lsSet(LSR, JSON.stringify({ v, t: Date.now() }));
      if (['home', 'unis', 'compare', 'money', 'report', 'profile'].includes(route())) render(true);
    }
  } catch (e) { /* остаёмся на оффлайн-значении */ }
}

/* ---------- оценка профиля и подбор ---------- */
function strength(p) {
  let s = Math.max(0, Math.min(1, (p.gpa - 3) / 2)) * 35;
  s += p.ielts >= 7.5 ? 20 : p.ielts >= 7 ? 17 : p.ielts >= 6.5 ? 13 : p.ielts >= 6 ? 9 : p.ielts >= 5.5 ? 5 : 0;
  s += p.sat >= 1500 ? 25 : p.sat >= 1400 ? 20 : p.sat >= 1300 ? 14 : p.sat >= 1200 ? 9 : p.sat >= 1000 ? 4 : 0;
  s += [0, 4, 8, 14, 20][p.ach] || 0;
  return Math.round(s);
}
const REQ = { 1: 32, 2: 46, 3: 58, 4: 72, 5: 86 };
function tierOf(u, s) { const d = s - REQ[u.sel]; return d >= 10 ? 'safe' : d >= -10 ? 'target' : 'dream'; }

function evalU(u) {
  const p = S.p, s = strength(p), strong = s >= 60;
  let cov = 0, kind = '';
  if (p.aid > 0 && u.need > 0) { cov = u.need; kind = 'need'; }
  if (strong && u.merit > cov) { cov = u.merit; kind = 'merit'; }
  if (S.stress.noAid) { cov = 0; kind = ''; }
  const netUSD = u.tuition * (1 - cov) + u.living;
  const net = kzt(netUSD);
  const budget = Math.max(1, p.budget * (1 + S.stress.budget / 100));
  const gap = Math.max(0, net - budget);
  const light = net <= budget ? 'green' : net <= budget * 1.5 ? 'amber' : 'red';
  const major = u.maj.includes(p.major);
  const cm = p.countries.length === 0 ? 0.5 : (p.countries.includes(u.c) ? 1 : 0);
  const bf = light === 'green' ? 1 : light === 'amber' ? 0.5 : 0;
  const eng = p.ielts > 0 ? (p.ielts >= u.ielts ? 1 : p.ielts >= u.ielts - 0.5 ? 0.6 : 0.2) : 0.3;
  const sat = u.sat ? (p.sat > 0 ? (p.sat >= u.sat ? 1 : p.sat >= u.sat - 100 ? 0.6 : 0.2) : 0.3) : 1;
  const rank = 100 * (0.3 * (major ? 1 : 0) + 0.2 * cm + 0.3 * bf + 0.2 * ((eng + sat) / 2));
  const fit = rank >= 72 ? 'высокое' : rank >= 50 ? 'среднее' : 'низкое';
  const why = [], gaps = [];
  if (major) why.push(`Есть направление «${MAJ[p.major]}»`); else gaps.push(`Направление «${MAJ[p.major]}» здесь представлено слабо: проверь список программ`);
  if (p.countries.length) { if (cm === 1) why.push(`Страна из твоего списка: ${cname(u.c)}`); else gaps.push(`${cname(u.c)} не входит в твой список стран`); }
  if (light === 'green') why.push(`Ориентировочно ${money(net)} в год после помощи: укладывается в бюджет ${money(budget)}`);
  else if (light === 'amber') gaps.push(`Ориентировочно ${money(net)} в год: не хватает ${money(gap)} в год, разрыв можно закрыть грантом`);
  else gaps.push(`Ориентировочно ${money(net)} в год: примерно в ${(net / budget).toFixed(1).replace('.', ',')} раза дороже бюджета`);
  if (cov > 0) why.push(`${kind === 'need' ? 'Есть помощь по финансовой нужде' : 'Есть стипендии за успехи'}: ориентир до ${Math.round(cov * 100)}% обучения`);
  else if (u.merit >= 0.5 && !strong && !S.stress.noAid) gaps.push('Крупную стипендию за успехи получить труднее: нужен более сильный профиль');
  if (p.aid === 2 && cov < 0.7) gaps.push('Ожидаемое покрытие меньше того, что тебе нужно');
  if (p.ielts === 0) gaps.push(`IELTS не сдан: нужен примерно ${u.ielts}`);
  else if (p.ielts >= u.ielts) why.push(`IELTS ${p.ielts}: не ниже ${u.ielts}`);
  else gaps.push(`IELTS: нужно ${u.ielts}, у тебя ${p.ielts} (не хватает ${(u.ielts - p.ielts).toFixed(1).replace('.', ',')})`);
  if (u.sat) { if (p.sat === 0) gaps.push(`SAT не сдан: ориентир ${u.sat}`); else if (p.sat >= u.sat) why.push(`SAT ${p.sat}: не ниже ${u.sat}`); else gaps.push(`SAT: ориентир ${u.sat}, у тебя ${p.sat}`); }
  else why.push('SAT для поступления обычно не нужен');
  if (u.cw) why.push('Есть Candidate Weekend: лучших кандидатов приглашают в кампус');
  if (p.waiver && u.fee > 0 && u.waiver) why.push(`Взнос ${usd(u.fee)} можно попробовать снять через fee waiver`);
  return { u, s, tier: tierOf(u, s), cov, kind, netUSD, net, budget, gap, light, rank, fit, why, gaps, strong };
}
const evalAll = () => D.unis.map(evalU).sort((a, b) => b.rank - a.rank);
function targetUnis() { const ev = evalAll(); const l = ev.filter(e => S.liked.includes(e.u.id)); return l.length ? l : ev.slice(0, 3); }

/* ---------- маршрут ---------- */
function TASKS() {
  const p = S.p, tg = targetUnis(), L = tg.map(e => e.u);
  const needI = Math.max(6, ...L.map(u => u.ielts || 0));
  const needS = Math.max(0, ...L.map(u => u.sat || 0));
  const anchor = new Date(p.year, 0, 1).getTime();
  const ev = evalAll(); const likedE = ev.filter(e => S.liked.includes(e.u.id));
  const likedT = new Set(likedE.map(e => e.tier));
  const acts = S.acts.filter(a => a.title && a.title.trim()).length, hon = S.honors.filter(a => a.title && a.title.trim()).length;
  const plats = [...new Set(L.map(u => u.plat).filter(x => /Common App|UCAS/.test(x)))];
  const anyCW = likedE.some(e => e.u.cw);
  const T = [];
  const add = (id, st, t, why, off, o) => { o = o || {}; T.push({ id, st, t, why, off, due: new Date(anchor - off * 864e5), cost: o.cost || 0, go: o.go || '', auto: !!o.auto }); };

  add('t_profile', 'profile', 'Заполнить профиль', 'Без него мы не можем подобрать вузы и посчитать бюджет.', 130, { auto: p.done, go: 'profile' });
  add('t_major', 'profile', 'Определиться со специальностью', `Сейчас выбрано «${MAJ[p.major]}». Проверь, что это тебе по-настоящему интересно, и запиши 1-2 запасных направления.`, 120, { go: 'profile' });
  add('t_like3', 'shortlist', 'Отметить сердечком минимум 3 вуза', 'Из избранного строятся сравнение и финансовый план.', 110, { auto: S.liked.length >= 3, go: 'unis' });
  add('t_list', 'shortlist', 'Собрать список из 6-10 вузов: Dream, Target и Safe', 'Нужны и амбициозные, и запасные варианты.', 95, { auto: S.liked.length >= 6 && ['dream', 'target', 'safe'].every(t => likedT.has(t)), go: 'unis' });
  add('t_free', 'exams', 'Проверить бесплатные и льготные способы сдать экзамены', 'Это можно сделать до оплаты. Смотри раздел «Бесплатный путь».', 100, { go: 'free' });
  add('t_ielts', 'exams', `IELTS: цель ${needI}, сейчас ${p.ielts || 'нет результата'}`, 'Языковой результат нужен почти всем вузам из списка. Запись на экзамен и результаты занимают недели.', 75, { auto: p.ielts >= needI, cost: D.costs.ielts, go: 'free' });
  if (needS > 0) add('t_sat', 'exams', `SAT: цель ${needS}, сейчас ${p.sat || 'нет результата'}`, 'Часть вузов из списка просит SAT. Оставь время на пересдачу.', 80, { auto: p.sat >= needS, cost: D.costs.sat, go: 'free' });
  add('t_scores', 'exams', 'Отправить официальные результаты в выбранные вузы', 'Вузы принимают только официальные отчёты от центра тестирования.', 30, { go: 'docs' });
  add('t_brain', 'essay', 'Выбрать 3 истории для Personal Statement', 'Для каждой запиши сцену, конфликт и что изменилось. Потом выбери одну.', 85, { go: 'essay' });
  add('t_ps1', 'essay', 'Написать первый черновик Personal Statement', 'Лимит Common App: 650 слов. Проверь черновик на странице «Эссе».', 65, { auto: wc(S.essay) >= 400, go: 'essay' });
  add('t_ps2', 'essay', 'Переписать: сильное начало и конкретика вместо общих слов', 'Замени выводы сценами, цифрами и именами.', 45, { go: 'essay' });
  add('t_supp', 'essay', `Дополнительные эссе для вузов из избранного (${likedE.length})`, 'Why Us, Why this major, сообщество. Каждое пиши под конкретный вуз.', 35, { go: 'essay' });
  add('t_acc', 'docs', plats.length ? `Создать аккаунт: ${plats.join(', ')}` : 'Создать аккаунты на порталах выбранных вузов', 'Личные данные, школа, предметы и оценки (Self-Reported Academic Record).', 70, { go: 'docs' });
  add('t_rec', 'docs', 'Попросить учителей о рекомендациях и привязать советника', 'Просить нужно минимум за 6 недель до дедлайна.', 60, { go: 'docs' });
  add('t_trans', 'docs', 'Заказать у школы транскрипт и School Profile', 'Уточни, нужен ли перевод и сколько времени займёт выдача.', 50, { go: 'docs' });
  add('t_acts', 'docs', 'Заполнить Activities List (5+) и Honors (1+)', 'Пиши роль, результат и цифры.', 40, { auto: acts >= 5 && hon >= 1, go: 'docs' });
  add('t_passport', 'docs', 'Проверить срок паспорта и сделать сканы документов', 'Паспорт понадобится дл�� подачи, визы и Candidate Week.', 90, {});
  if (p.waiver) add('t_waiver', 'money', 'Запросить Fee Waiver на взнос за подачу', 'Через школьного советника или платформу. Сохрани подтверждение.', 45, { go: 'docs' });
  if (p.aid > 0) add('t_fin', 'money', 'Заполнить CSS Profile / ISFAA, если этого требуют вузы', 'Помощь по нужде часто требует финансовую анкету и документы семьи.', 35, { go: 'docs' });
  if (p.aid > 0) add('t_cof', 'money', 'Подготовить Certification of Finances', 'Подтверждение средств нужно для иностранных студентов.', 30, { go: 'docs' });
  add('t_schol', 'money', 'Подать на внешние стипендии и гранты', 'Список смотри в разделе «Бесплатный путь». Дедлайны проверь у организаторов.', 40, { go: 'free' });
  add('t_review', 'submit', 'Финальная вычитка и проверка требований каждого вуза', 'Сверь список документов, тексты и дедлайны.', 7, { go: 'docs' });
  add('t_submit', 'submit', 'Подать заявки', 'Проверь дедлайны Early и Regular у каждого вуза.', 1, { cost: likedE.reduce((a, e) => a + (p.waiver && e.u.waiver ? 0 : e.u.fee), 0), go: 'money' });
  add('t_check', 'submit', 'Проверить порталы: все документы получены?', 'Рекомендации и транскрипты загружают другие люди. Проверь статусы.', -7, {});
  add('t_interview', 'cw', 'Подготовиться к интервью', '10 типовых вопросов на странице Candidate Week.', -14, { go: 'candidate' });
  if (anyCW) add('t_cw', 'cw', 'Если пригласили на Candidate Week: подтвердить участие и оформить поездку', 'Приглашение зависит от вуза и не гарантирует зачисление.', -45, { go: 'candidate' });
  add('t_mid', 'cw', 'Проверить, что школа отправила Mid-Year Report', 'Отчёт за первое полугодие выпускного класса.', -30, { go: 'docs' });
  add('t_offers', 'decision', 'Сравнить предложения и финансовую помощь', 'Смотри итоговую стоимость в тенге, а не только размер стипендии.', -90, { go: 'money' });
  add('t_deposit', 'decision', 'Подтвердить место и внести депозит', 'Сроки ответа указаны в письме вуза.', -120, {});
  add('t_final', 'decision', 'Отправить итоговый аттестат и оформить визу', 'Final Report после окончания школы, визовые документы и жильё.', -170, {});
  T.forEach(x => { x.done = !!(S.tasks[x.id] || x.auto); });
  return T;
}
function nextTask(T) { return T.filter(x => !x.done).sort((a, b) => (a.due - b.due) || (T.indexOf(a) - T.indexOf(b)))[0] || null; }
function progress(T) { const d = T.filter(x => x.done).length; return { done: d, total: T.length, pct: T.length ? Math.round(100 * d / T.length) : 0 }; }
function dueTxt(t) {
  const d = Math.ceil((t.due - Date.now()) / 864e5);
  const ds = t.due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  if (t.done) return 'Срок: ' + ds;
  if (d < 0) return `Срок был ${ds}: сделай сейчас`;
  if (d === 0) return 'Срок сегодня';
  return `До ${ds}, осталось ${d} дн.`;
}
const isLate = t => !t.done && t.due < Date.now();

/* ---------- маршрутизация ---------- */
const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
const go = r => { location.hash = '#/' + r; };

/* ---------- поля форм ---------- */
const seg = (f, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-a="set" data-f="${f}" data-v="${v}">${l}</button>`).join('')}</div>`;
const sel = (path, opts, cur) => `<select class="sel" data-in="${path}" data-num data-render="1">${opts.map(([v, l]) => `<option value="${v}" ${Number(cur) === Number(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const F = {
  name: () => `<input class="inp" data-in="p.name" value="${esc(S.p.name)}" placeholder="Например, Айгерим" autocomplete="given-name" maxlength="40">`,
  grade: () => seg('grade', [['9', '9 класс'], ['10', '10 класс'], ['11', '11 класс'], ['12', 'Выпускник']], S.p.grade),
  cit: () => seg('cit', [['KZ', 'Казахстан'], ['KG', 'Кыргызстан'], ['UZ', 'Узбекистан'], ['OTH', 'Другая страна']], S.p.cit),
  major: () => `<div class="grid2">${Object.entries(MAJ).map(([k, v]) => `<button class="opt ${S.p.major === k ? 'on' : ''}" data-a="set" data-f="major" data-v="${k}">${v}</button>`).join('')}</div>`,
  countries: () => `<div class="chips">${Object.keys(CN).map(k => `<button class="chip ${S.p.countries.includes(k) ? 'on' : ''}" data-a="tog" data-f="countries" data-v="${k}">${flag(k)} ${cname(k)}</button>`).join('')}</div>`,
  budget: () => `<div class="field"><div class="row between"><span class="lbl">Бюджет в год</span><b id="bl">${money(S.p.budget)}</b></div><input class="rng" type="range" min="0" max="20000000" step="250000" value="${S.p.budget}" data-in="p.budget" data-num data-render="1" data-refresh="prev" data-lbl="bl" data-fmt="money" aria-label="Бюджет в год"><span class="muted small">Сколько семья может платить за обучение и жизнь за один год.</span></div>`,
  aid: () => seg('aid', [[0, 'Смогу оплатить сам(а)'], [1, 'Нужна частичная помощь'], [2, 'Нужна помощь почти на всё']], S.p.aid),
  waiver: () => seg('waiver', [['0', 'Нет'], ['1', 'Да, нужна помощь с взносами']], S.p.waiver ? 1 : 0),
  ielts: () => `<div class="field"><span class="lbl">IELTS</span>${sel('p.ielts', [[0, 'Не сдавал(а)'], [5.5, '5,5'], [6, '6,0'], [6.5, '6,5'], [7, '7,0'], [7.5, '7,5'], [8, '8,0 и выше']], S.p.ielts)}</div>`,
  sat: () => `<div class="field"><span class="lbl">SAT</span>${sel('p.sat', [[0, 'Не сдавал(а)'], [1000, '1000-1099'], [1100, '1100-1199'], [1200, '1200-1299'], [1300, '1300-1399'], [1400, '1400-1499'], [1500, '1500 и выше']], S.p.sat)}</div>`,
  gpa: () => `<div class="field"><span class="lbl">Средний балл по 5-балльной шкале</span>${sel('p.gpa', Array.from({ length: 21 }, (_, i) => { const v = (3 + i * 0.1).toFixed(1); return [v, v.replace('.', ',')]; }), S.p.gpa)}</div>`,
  ach: () => `<div class="field"><span class="lbl">Лучшее достижение (олимпиады, конкурсы, проекты)</span>${seg('ach', ACH.map((l, i) => [i, l]), S.p.ach)}</div>`,
  extras: () => `<div class="chips">${EXTRAS.map(([k, l]) => `<button class="chip ${S.p.extras.includes(k) ? 'on' : ''}" data-a="tog" data-f="extras" data-v="${k}">${l}</button>`).join('')}</div>`,
  year: () => seg('year', [[2027, 'В этом сезоне: дедлайны до января 2027'], [2028, 'Через год: на 2028'], [2029, 'Через два года: на 2029']], S.p.year)
};
const WSTEPS = () => [
  { q: 'Как тебя зовут?', sub: 'Так мы будем обращаться к тебе в маршруте.', body: () => F.name() },
  { q: 'Где ты сейчас?', sub: 'Класс и гражданство влияют на олимпиады, стипендии и сроки.', body: () => `<div class="field"><span class="lbl">Класс</span>${F.grade()}</div><div class="field"><span class="lbl">Гражданство</span>${F.cit()}</div>` },
  { q: 'Что ты хочешь изучать?', sub: 'Выбери главное направление. Позже его можно поменять.', body: () => F.major() },
  { q: 'В каких странах готов(а) учиться?', sub: 'Можно выбрать несколько или пропустить.', body: () => F.countries() },
  { q: 'Сколько семья может платить в год?', sub: 'В тенге, обучение и жизнь вместе. Мы посчитаем расходы по каждому вузу.', body: () => F.budget() },
  { q: 'Нужна ли финансовая помощь?', sub: 'От этого зависят стипендии, анкеты и подсказки по деньгам.', body: () => `<div class="field"><span class="lbl">Помощь с обучением</span>${F.aid()}</div><div class="field"><span class="lbl">Помощь с взносами за подачу (fee waiver)</span>${F.waiver()}</div>` },
  { q: 'Какие у тебя экзамены?', sub: 'Если ещё не сдавал(а), так и отметь. Мы добавим это в план.', body: () => F.ielts() + F.sat() },
  { q: 'Оценки и достижения', sub: 'Достижения влияют на стипендии и на то, какие вузы для тебя амбициозные.', body: () => F.gpa() + F.ach() },
  { q: 'Чем ты ещё занимаешься?', sub: 'Выбери всё, что подходит. Это влияет на подсказки по стипендиям.', body: () => F.extras() },
  { q: 'Когда подаёшь документы?', sub: 'От этого зависят даты и срочность шагов.', body: () => F.year() }
];
const DEMO = { name: 'Айгерим', grade: '11', cit: 'KZ', major: 'cs', countries: ['KR', 'SG', 'KZ', 'DE'], budget: 3000000, aid: 1, waiver: true, ielts: 6.5, sat: 1350, gpa: 4.6, ach: 2, extras: ['science', 'volunteer'], year: 2027, done: true };

/* ---------- блоки страниц ---------- */
function routeHTML(T, now) {
  const cur = now ? now.st : null;
  return `<div class="route"><ol>${D.STAGES.map((st, i) => {
    const ts = T.filter(x => x.st === st.id); const done = ts.length && ts.every(x => x.done);
    const cls = st.id === cur ? 'now' : done ? 'done' : '';
    return `<li class="stop ${cls}"><span class="pin">${done && st.id !== cur ? ICON.check : i + 1}</span><span class="sn">${esc(st.n)}</span>${st.id === cur ? '<span class="here">Ты здесь</span>' : ''}</li>`;
  }).join('')}</ol></div>`;
}
const stageName = id => (D.STAGES.find(s => s.id === id) || {}).n || '';

function uniCard(e) {
  const u = e.u, liked = S.liked.includes(u.id);
  const R = (arr, cls) => arr.map(w => `<li class="${cls}">${w}</li>`).join('');
  return `<article class="card uni">
    <div class="uni-h"><div><h3>${flag(u.c)} ${esc(u.n)}</h3><div class="muted small">${esc(u.city)}, ${cname(u.c)}</div></div>
    <button class="like ${liked ? 'on' : ''}" data-a="like" data-v="${u.id}" aria-pressed="${liked}" aria-label="${liked ? 'Убрать из избранного' : 'В избранное'}">${ICON.heart}</button></div>
    <div class="row wrap"><span class="tier ${e.tier}">${TIER[e.tier]}</span><span class="dot ${e.light}" title="Светофор бюджета"></span><b>${money(e.net)} в год</b><span class="muted small">совпадение с профилем: ${e.fit}</span></div>
    <ul class="rs">${R(e.why.slice(0, 3), 'ok')}${R(e.gaps.slice(0, 2), e.light === 'red' ? 'bad' : 'warn')}</ul>
    <details><summary>Все причины, условия и источник</summary>
      <p class="muted small">${TIERTXT[e.tier]}.</p>
      <ul class="rs" style="margin:8px 0">${R(e.why, 'ok')}${R(e.gaps, 'warn')}</ul>
      <dl class="kv">
        <dt>Обучение</dt><dd>≈ ${usd(u.tuition)} в год</dd>
        <dt>Жизнь</dt><dd>≈ ${usd(u.living)} в год</dd>
        <dt>IELTS</dt><dd>от ${u.ielts}</dd>
        <dt>SAT</dt><dd>${u.sat ? 'ориентир ' + u.sat : 'обычно не нужен'}</dd>
        <dt>Платформа</dt><dd>${esc(u.plat)}</dd>
        <dt>Взнос</dt><dd>${u.fee ? usd(u.fee) + (u.waiver ? ', есть fee waiver' : '') : 'нет или уточни'}</dd>
        <dt>Сроки</dt><dd>${esc(u.dl)}</dd>
        <dt>Источник</dt><dd>${link(u.src)}</dd>
      </dl>
      <p class="small" style="margin-top:8px">${esc(u.note)}</p>
      <p style="margin-top:8px"><span class="badge">Демо-данные</span> <span class="muted small">Проверь условия на официальном сайте.</span></p>
    </details></article>`;
}
function prevHTML() {
  return evalAll().slice(0, 3).map(e => `<div class="mini"><span class="tier ${e.tier}">${TIER[e.tier]}</span><span class="grow">${flag(e.u.c)} ${esc(e.u.n)}</span><span class="dot ${e.light}"></span></div>`).join('');
}
const banner = () => '<div class="note">Демо-данные: суммы, требования и сроки округлены и служат ориентиром. Проверяй их на официальных сайтах.</div>';

/* ---------- страницы ---------- */
function landing() {
  const T = TASKS();
  return `<section class="lp">
    <div class="row" style="gap:10px"><span class="brand" style="pointer-events:none">${ICON.logo}Meetup</span></div>
    <h1 class="h1">Твой маршрут от анкеты до Candidate Week</h1>
    <p class="lead">Ответь на 10 коротких вопросов. Meetup подберёт вузы, объяснит почему, посчитает деньги в тенге и распишет шаги до подачи документов и дальше.</p>
    ${routeHTML(T, null)}
    <ul>
      <li><span class="mk"></span><div><b>Понятно, почему именно этот вуз</b><span class="muted">Причины и пробелы у каждого варианта, без выдуманных процентов шанса.</span></div></li>
      <li><span class="mk"></span><div><b>Видно, сколько это стоит</b><span class="muted">Светофор по твоему бюджету, разрыв и способы его закрыть.</span></div></li>
      <li><span class="mk"></span><div><b>Всегда ясно, что делать сегодня</b><span class="muted">Один следующий шаг и общий прогресс маршрута.</span></div></li>
    </ul>
    <div class="row wrap">
      <button class="btn p" data-a="begin">${S.p.done ? 'Пройти анкету заново' : 'Начать'}</button>
      ${S.p.done ? '<a class="btn s" href="#/home">Вернуться к маршруту</a>' : ''}
      <button class="btn g" data-a="demo">Заполнить пример</button>
    </div>
    ${banner()}
  </section>`;
}
function pStart() {
  const st = S.step;
  if (st === 0) return landing();
  const steps = WSTEPS(); const cur = steps[st - 1];
  return `<section class="wiz"><div class="wbar" role="progressbar" aria-valuenow="${st}" aria-valuemin="1" aria-valuemax="${steps.length}"><i style="width:${Math.round(st / steps.length * 100)}%"></i></div>
    <p class="muted small">Вопрос ${st} из ${steps.length}</p>
    <h1 class="h1">${cur.q}</h1><p class="muted">${cur.sub}</p>
    <div class="wbody">${cur.body()}</div>
    <div class="wnav"><button class="btn g" data-a="back">Назад</button><button class="btn p" data-a="next">${st === steps.length ? 'Показать мой маршрут' : 'Дальше'}</button></div></section>`;
}

function pHome() {
  const p = S.p, s = strength(p), T = TASKS(), nx = nextTask(T), pr = progress(T);
  const ev = evalAll(), top = ev.slice(0, 3);
  const strengths = [], limits = [];
  if (p.gpa >= 4.5) strengths.push(`Сильные оценки: средний балл ${String(p.gpa).replace('.', ',')}`);
  if (p.ielts >= 6.5) strengths.push(`Английский на уровне большинства программ: IELTS ${p.ielts}`);
  if (p.sat >= 1300) strengths.push(`Хороший SAT: ${p.sat}`);
  if (p.ach >= 2) strengths.push(`Есть достижения: ${ACH[p.ach].toLowerCase()}`);
  if (p.extras.length >= 2) strengths.push('Разносторонний профиль: ' + p.extras.map(k => (EXTRAS.find(x => x[0] === k) || [0, k])[1].toLowerCase()).join(', '));
  if (!strengths.length) strengths.push('Ты в начале пути: главный плюс в том, что время ещё есть');
  const tg = targetUnis(), needS = Math.max(0, ...tg.map(e => e.u.sat || 0));
  if (p.ielts === 0) limits.push('Нет результата IELTS: без него не подать в большинство вузов');
  if (needS > 0 && p.sat === 0) limits.push('Нет SAT, а часть вузов из списка его просит');
  if (top.filter(e => e.light === 'green').length < 2) limits.push('Бюджет ниже стоимости большинства подходящих вариантов: смотри раздел «Деньги»');
  const days = Math.ceil((new Date(p.year, 0, 1) - Date.now()) / 864e5);
  if (days < 120) limits.push(`До дедлайна около ${Math.max(days, 0)} дней: экзамены нужно планировать сразу`);
  if (!limits.length) limits.push('Серьёзных ограничений не видно. Следи за сроками');
  const label = s < 35 ? 'старт' : s < 55 ? 'набираешь скорость' : s < 75 ? 'сильный профиль' : 'очень сильный профиль';
  const goalCn = p.countries.length ? p.countries.map(cname).join(', ') : 'любые страны';
  const later = T.filter(x => !x.done && x !== nx).sort((a, b) => a.due - b.due).slice(0, 2);
  return `<div class="card next">
      <div class="muted small">Следующий шаг${nx ? ', этап «' + esc(stageName(nx.st)) + '»' : ''}</div>
      ${nx ? `<h2 class="h2">${esc(nx.t)}</h2><p>${esc(nx.why)}</p><div class="small">${esc(dueTxt(nx))}${nx.cost ? '. Ориентир расходов: ' + money(kzt(nx.cost)) : ''}</div>
      <div class="row wrap">${nx.auto ? '' : `<button class="btn p" data-a="task" data-v="${nx.id}">Готово</button>`}${nx.go ? `<a class="btn g" href="#/${nx.go}">Открыть раздел</a>` : ''}</div>` : '<h2 class="h2">Маршрут пройден. Поздравляем!</h2>'}
    </div>
    <div class="card"><div class="row between"><b>Маршрут пройден на ${pr.pct}%</b><span class="muted small">${pr.done} из ${pr.total} шагов</span></div><div class="bar"><i style="width:${pr.pct}%"></i></div>
      ${later.length ? `<div class="muted small">Дальше: ${later.map(x => esc(x.t)).join('; ')}</div>` : ''}</div>
    <div class="card"><h2 class="h2">${p.name ? esc(p.name) + ', вот' : 'Вот'} твоя диагностика</h2>
      <p><b>Цель:</b> поступить на «${MAJ[p.major]}», страны: ${esc(goalCn)}, бюджет до ${money(p.budget)} в год, подача на ${p.year}.</p>
      <p><b>Готовность профиля:</b> ${label}</p>
      <div><b>Сильные стороны</b><ul class="rs" style="margin-top:6px">${strengths.map(x => `<li class="ok">${x}</li>`).join('')}</ul></div>
      <div><b>Ограничения</b><ul class="rs" style="margin-top:6px">${limits.map(x => `<li class="warn">${x}</li>`).join('')}</ul></div>
      <a class="btn g sm" href="#/profile">Изменить ответы</a></div>
    <div class="row between"><h2 class="h2">Лучшие совпадения сейчас</h2><a href="#/unis">Все вузы</a></div>
    ${top.map(uniCard).join('')}`;
}

function pUnis() {
  const ev = evalAll(); const tab = S.tab.uni;
  const cnt = t => ev.filter(e => e.tier === t).length;
  const tabs = [['all', `Все (${ev.length})`], ['dream', `Dream (${cnt('dream')})`], ['target', `Target (${cnt('target')})`], ['safe', `Safe (${cnt('safe')})`], ['liked', `Избранные (${S.liked.length})`]];
  const list = ev.filter(e => tab === 'all' ? true : tab === 'liked' ? S.liked.includes(e.u.id) : e.tier === tab);
  return `<div><h1 class="h1">Вузы для тебя</h1><p class="muted">Список пересчитывается, когда меняешь бюджет, страны, экзамены или специальность. <a href="#/profile">Изменить ответы</a></p></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-f="uni" data-v="${k}">${l}</button>`).join('')}</div>
    ${list.length ? list.map(uniCard).join('') : `<div class="empty"><p>${tab === 'liked' ? 'Пока ничего не выбрано. Нажми сердечко на карточке вуза, и он появится здесь.' : 'В этой группе пока нет вузов при твоих ответах.'}</p><button class="btn p" data-a="tab" data-f="uni" data-v="all">Показать все вузы</button></div>`}
    ${banner()}`;
}

function pCompare() {
  const L = evalAll().filter(e => S.liked.includes(e.u.id));
  if (L.length < 2) return `<h1 class="h1">Сравнение</h1><div class="empty"><p>Отметь сердечком минимум 2 вуза, и мы сравним их по деньгам, экзаменам и требованиям.</p><a class="btn p" href="#/unis">Выбрать вузы</a></div>`;
  const minNet = Math.min(...L.map(e => e.net)), maxRank = Math.max(...L.map(e => e.rank));
  const p = S.p;
  const rows = [
    ['Группа', e => `<span class="tier ${e.tier}">${TIER[e.tier]}</span>`],
    ['Совпадение', e => e.fit, e => e.rank === maxRank],
    ['Расходы в год после помощи', e => `<span class="dot ${e.light}"></span> ${money(e.net)}`, e => e.net === minNet],
    ['Разрыв с бюджетом', e => e.gap > 0 ? money(e.gap) + ' в год' : 'нет'],
    ['Ориентир помощи', e => e.cov > 0 ? `до ${Math.round(e.cov * 100)}% обучения` : 'нет'],
    ['IELTS: нужно и у тебя', e => `${e.u.ielts} и ${p.ielts || 'нет'}`],
    ['SAT: нужно и у тебя', e => e.u.sat ? `${e.u.sat} и ${p.sat || 'нет'}` : 'не нужен'],
    ['Платформа подачи', e => esc(e.u.plat)],
    ['Взнос', e => e.u.fee ? usd(e.u.fee) + (e.u.waiver ? ' (есть waiver)' : '') : 'нет или уточни'],
    ['Candidate Week', e => e.u.cw ? 'есть' : 'нет данных'],
    ['Сроки (демо)', e => esc(e.u.dl)]
  ];
  const best = L.slice().sort((a, b) => b.rank - a.rank)[0], cheap = L.slice().sort((a, b) => a.net - b.net)[0];
  const has = t => L.some(e => e.tier === t);
  const adv = [];
  adv.push(`Лучшее совпадение с твоим профилем: ${esc(best.u.n)}.`);
  adv.push(`Самый доступный по деньгам: ${esc(cheap.u.n)}, около ${money(cheap.net)} в год.`);
  if (!has('safe')) adv.push('В избранном нет Safe: добавь хотя бы один запасной вариант.');
  if (!has('dream')) adv.push('Можно добавить один Dream, если есть желание и время.');
  return `<h1 class="h1">Сравнение вузов</h1>
    <div class="card"><b>Вывод</b><ul class="rs">${adv.map(x => `<li class="ok">${x}</li>`).join('')}</ul></div>
    <div class="tw"><table class="tbl"><thead><tr><th></th>${L.map(e => `<th>${flag(e.u.c)} ${esc(e.u.n)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(([n, f, b]) => `<tr><td>${n}</td>${L.map(e => `<td class="${b && b(e) ? 'best' : ''}">${f(e)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div><p class="muted small">Зелёным отмечены лучшие значения.</p>${banner()}`;
}

function moneyOut() {
  const ev = evalAll(); let L = ev.filter(e => S.liked.includes(e.u.id)); const fallback = !L.length; if (fallback) L = ev.slice(0, 5);
  const p = S.p;
  const cheap = ev.filter(e => e.light === 'green').sort((a, b) => b.rank - a.rank);
  const needI = Math.max(6, ...L.map(e => e.u.ielts)), needS = Math.max(0, ...L.map(e => e.u.sat || 0));
  const one = [];
  if (p.ielts < needI) one.push(['IELTS' + (p.ielts ? ' (пересдача)' : ''), D.costs.ielts]);
  if (needS > 0 && p.sat < needS) one.push(['SAT' + (p.sat ? ' (пересдача)' : ''), D.costs.sat]);
  const fees = L.reduce((a, e) => a + (p.waiver && e.u.waiver ? 0 : e.u.fee), 0);
  if (fees) one.push([`Взносы за подачу (${L.length} вуз.)` + (p.waiver ? ', минус вузы с waiver' : ''), fees]);
  const total = one.reduce((a, x) => a + x[1], 0);
  const sch = D.schol.filter(x => schFit(x)).slice(0, 3);
  return `<p class="muted small">Курс: 1 $ = ${Math.round(RATE.v * (1 + S.stress.rate / 100))} ₸ (${RATE.live ? 'живой курс с поправкой стресс-теста' : 'оффлайн-значение, живой курс не загрузился'}).</p>
    ${fallback ? '<div class="note sky">Пока ничего не выбрано, показываем 5 лучших совпадений. Отметь вузы сердечком, и здесь будет твой список.</div>' : ''}
    ${L.map(e => `<div class="card">
      <div class="lightbox ${e.light}"><span class="dot ${e.light}"></span><div><b>${flag(e.u.c)} ${esc(e.u.n)}</b><div class="small">${e.light === 'green' ? 'Укладываешься в бюджет' : e.light === 'amber' ? 'Есть разрыв, его можно закрыть' : 'Без полной стипендии не тянешь'}</div></div></div>
      <dl class="kv"><dt>В год</dt><dd><b>${money(e.net)}</b> из бюджета ${money(e.budget)}</dd><dt>За 4 года</dt><dd>${money(e.net * 4)}</dd><dt>Разрыв</dt><dd>${e.gap > 0 ? money(e.gap) + ' в год' : 'нет'}</dd><dt>Помощь</dt><dd>${e.cov > 0 ? 'ориентир до ' + Math.round(e.cov * 100) + '% обучения' : 'не учитывается'}</dd></dl>
      ${e.light !== 'green' ? `<div><b class="small">Как закрыть разрыв</b><ul class="rs" style="margin-top:6px">${D.schol.filter(x => schFit(x) && (x.cs.length === 0 || x.cs.includes(e.u.c))).slice(0, 2).map(x => `<li class="ok">${esc(x.n)}</li>`).join('') || '<li class="warn">Ищи внешние стипендии в разделе «Бесплатный путь»</li>'}${cheap.filter(c => c.u.id !== e.u.id)[0] ? `<li class="ok">Дешевле подходит: ${esc(cheap.filter(c => c.u.id !== e.u.id)[0].u.n)} (${money(cheap.filter(c => c.u.id !== e.u.id)[0].net)} в год)</li>` : ''}</ul></div>` : ''}
    </div>`).join('')}
    <div class="card"><h2 class="h2">Разовые расходы на подготовку</h2>
      ${one.length ? `<dl class="kv">${one.map(x => `<dt>${x[0]}</dt><dd>${usd(x[1])} ≈ ${money(kzt(x[1]))}</dd>`).join('')}<dt><b>Итого</b></dt><dd><b>${money(kzt(total))}</b></dd></dl>` : '<p class="muted">Разовых расходов не видно: экзамены закрыты, взносы можно снять.</p>'}
      <p class="muted small">Сначала проверь бесплатные способы в разделе «Бесплатный путь». Суммы ориентировочные.</p></div>
    ${sch.length ? `<div class="card"><h2 class="h2">Стипендии, которые стоит проверить</h2><ul class="rs">${sch.map(x => `<li class="ok">${esc(x.n)}</li>`).join('')}</ul><a href="#/free">Открыть все</a></div>` : ''}`;
}
function pMoney() {
  const st = S.stress;
  return `<div><h1 class="h1">Деньги</h1><p class="muted">Сколько стоит твой маршрут в тенге и что будет, если условия изменятся.</p></div>
    <div class="card stress"><h2 class="h2">Стресс-тест</h2>
      <div class="field"><div class="row between"><span class="lbl">Курс доллара</span><b id="sl1">${st.rate > 0 ? '+' : ''}${st.rate}%</b></div><input class="rng" type="range" min="-10" max="30" step="5" value="${st.rate}" data-in="stress.rate" data-num data-refresh="money" data-lbl="sl1" data-fmt="pct" aria-label="Изменение курса"></div>
      <div class="field"><div class="row between"><span class="lbl">Бюджет семьи</span><b id="sl2">${st.budget > 0 ? '+' : ''}${st.budget}%</b></div><input class="rng" type="range" min="-50" max="50" step="10" value="${st.budget}" data-in="stress.budget" data-num data-refresh="money" data-lbl="sl2" data-fmt="pct" aria-label="Изменение бюджета"></div>
      <div class="row wrap"><button class="btn sm ${st.noAid ? 'p' : 'g'}" data-a="noaid">${st.noAid ? 'Помощь отключена' : 'А если помощь не дадут?'}</button><button class="btn sm g" data-a="stressreset">Сбросить</button></div></div>
    <div id="money-out" class="main" style="padding:0">${moneyOut()}</div>${banner()}`;
}

/* --- бесплатный путь --- */
function schFit(x) {
  const p = S.p, s = strength(p);
  const f = x.for === 'all' ? true : x.for === 'aid' ? p.aid > 0 : x.for === 'sport' ? p.extras.includes('sport') : x.for === 'arts' ? p.extras.includes('arts') : x.for === 'merit' ? (s >= 60 || p.gpa >= 4.5) : true;
  return f && (x.cs.length === 0 || p.countries.length === 0 || x.cs.some(c => p.countries.includes(c)));
}
const olRow = a => `<div class="card sm"><b>${esc(a[0])}</b><div class="muted small">${esc(a[1])}, ${esc(a[2])}</div><div class="small">${a[3] ? 'Сайт: ' + link(a[3]) : 'Уточни организатора и правила участия'}</div></div>`;
function pFree() {
  const t = S.tab.free;
  const tabs = [['exam', 'Экзамены'], ['olymp', 'Олимпиады'], ['schol', 'Стипендии']];
  let body = '';
  if (t === 'exam') {
    body = `<div class="note sky">Способы сэкономить на экзаменах. Условия зависят от страны и года: сначала проверь у организатора.</div>${D.exams.map(x => `<div class="card sm"><b>${esc(x.n)}</b><p>${esc(x.how)}</p><div class="small">${x.src ? 'Проверь: ' + link(x.src) : 'Уточни у организатора'}</div></div>`).join('')}
      <div class="card sm"><b>Как использовать олимпиады</b><p>Призовые места идут в раздел Honors &amp; Awards заявки и иногда дают дополнительные возможности у организаторов и вузов. Условия смотри в положении конкурса.</p></div>`;
  } else if (t === 'olymp') {
    const o = S.tab.olymp; const tabs2 = [['KZ', '🇰🇿 Казахстан'], ['KG', '🇰🇬 Кыргызстан'], ['UZ', '🇺🇿 Узбекистан'], ['ASIA', 'Азия'], ['INT', 'Международные']];
    let list = '';
    if (o === 'ASIA') {
      const keys = Object.keys(D.olymp.ASIA); const a = D.olymp.ASIA[S.tab.asia] ? S.tab.asia : keys[0];
      list = `<div class="tabs">${keys.map(k => `<button class="${a === k ? 'on' : ''}" data-a="tab" data-f="asia" data-v="${k}">${D.olymp.ASIA[k][0]}</button>`).join('')}</div>${D.olymp.ASIA[a][1].map(olRow).join('')}`;
    } else list = D.olymp[o].map(olRow).join('');
    body = `<div class="tabs">${tabs2.map(([k, l]) => `<button class="${o === k ? 'on' : ''}" data-a="tab" data-f="olymp" data-v="${k}">${l}</button>`).join('')}</div>${list}<div class="note">Это демо-подборка. Полные списки, даты и правила смотри у Министерства образования и организаторов.</div>`;
  } else {
    const f = S.tab.schol; const types = [['all', 'Все'], ['gov', 'Государственные'], ['need', 'По нужде'], ['merit', 'За успехи'], ['sport', 'Спорт'], ['arts', 'Искусство'], ['uni', 'Вузовские']];
    const list = D.schol.filter(x => f === 'all' || x.type === f);
    body = `<div class="tabs">${types.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-a="tab" data-f="schol" data-v="${k}">${l}</button>`).join('')}</div>${list.map(x => `<div class="card sm"><div class="row between wrap"><b>${esc(x.n)}</b>${schFit(x) ? '<span class="tier safe">Подходит тебе</span>' : ''}</div><p>${esc(x.d)}</p><div class="small">${x.src ? 'Проверь: ' + link(x.src) : 'Ищи условия на сайтах вузов'}</div></div>`).join('')}<div class="note">Мы не гарантируем стипендию. Условия, размеры и сроки меняются, проверяй их у организатора.</div>`;
  }
  return `<div><h1 class="h1">Бесплатный путь</h1><p class="muted">Как сдать экзамены дешевле, какие олимпиады усилят заявку и где искать стипендии.</p></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-a="tab" data-f="free" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}

/* --- маршрут --- */
function pRoadmap() {
  const T = TASKS(), nx = nextTask(T), pr = progress(T);
  return `<div><h1 class="h1">Маршрут</h1><p class="muted">Все шаги от профиля до решения. Срок отсчитывается от 1 января ${S.p.year}.</p></div>
    <div class="card"><div class="row between"><b>Пройдено ${pr.pct}%</b><span class="muted small">${pr.done} из ${pr.total}</span></div><div class="bar"><i style="width:${pr.pct}%"></i></div></div>
    ${D.STAGES.map(st => {
      const ts = T.filter(x => x.st === st.id).sort((a, b) => a.due - b.due); const d = ts.filter(x => x.done).length;
      return `<section class="main" style="padding:0"><div class="row between"><h2 class="h2">${esc(st.n)}</h2><span class="muted small">${d} из ${ts.length}</span></div><div class="rd">${ts.map((x, i) => `<div class="item ${x.done ? 'done' : ''} ${isLate(x) ? 'late' : ''}"><button class="node" ${x.auto ? 'disabled' : `data-a="task" data-v="${x.id}"`} aria-label="${x.done ? 'Отметить как невыполненное' : 'Отметить как выполненное'}">${x.done ? ICON.check : i + 1}</button>
        <div class="body"><b>${esc(x.t)}${nx && nx.id === x.id ? ' <span class="badge sky">следующий шаг</span>' : ''}</b><p class="muted small">${esc(x.why)}</p><div class="due">${esc(dueTxt(x))}${x.cost ? '. Ориентир расходов: ' + money(kzt(x.cost)) : ''}</div>
        <div class="row wrap">${x.go ? `<a class="btn g sm" href="#/${x.go}">Открыть раздел</a>` : ''}${x.auto && x.done ? '<span class="muted small">Отмечено автоматически</span>' : ''}</div></div></div>`).join('')}</div></section>`;
    }).join('')}`;
}

/* --- документы --- */
function pDocs() {
  const all = D.docs.flatMap(g => g.items), done = all.filter(x => S.docs[x.id] === 'done').length;
  const inp = (path, val, ph) => `<input class="inp" data-in="${path}" value="${esc(val)}" placeholder="${ph}" maxlength="160">`;
  return `<div><h1 class="h1">Документы</h1><p class="muted">14 шагов подачи: от аккаунта на платформе до подтверждения средств. Нажимай на статус, чтобы менять его.</p></div>
    <div class="card"><div class="row between"><b>Готово ${done} из ${all.length}</b></div><div class="bar"><i style="width:${Math.round(100 * done / all.length)}%"></i></div></div>
    ${D.docs.map(g => `<section class="main" style="padding:0"><h2 class="h2">${esc(g.g)}</h2>${g.items.map(x => {
      const st = S.docs[x.id] || 'todo';
      return `<div class="card sm"><div class="row between wrap"><b>${esc(x.t)}</b><button class="btn sm ${st === 'done' ? 's' : 'g'}" data-a="doc" data-v="${x.id}">${DOCLBL[st]}</button></div>
        <p>${esc(x.d)}</p><div class="small muted">Отвечает: ${esc(x.w)}${x.aid && S.p.aid === 0 ? '. Нужно, только если запрашиваешь помощь' : ''}</div><div class="small">Совет: ${esc(x.tip)}</div></div>`;
    }).join('')}</section>`).join('')}
    <section class="main" style="padding:0"><div class="row between"><h2 class="h2">Activities List</h2><span class="muted small">${S.acts.length} из 10</span></div>
      ${S.acts.map((a, i) => `<div class="card sm"><div class="row between"><b class="small">Пункт ${i + 1}</b><button class="btn sm g" data-a="delact" data-v="${i}">Удалить</button></div>${inp(`acts.${i}.title`, a.title, 'Что это: олимпиада, проект, волонтёрство')}${inp(`acts.${i}.role`, a.role, 'Твоя роль')}${inp(`acts.${i}.result`, a.result, 'Результат и цифры')}</div>`).join('')}
      ${S.acts.length < 10 ? '<button class="btn g" data-a="addact">Добавить пункт</button>' : ''}</section>
    <section class="main" style="padding:0"><div class="row between"><h2 class="h2">Honors &amp; Awards</h2><span class="muted small">${S.honors.length} из 5</span></div>
      ${S.honors.map((a, i) => `<div class="card sm"><div class="row between"><b class="small">Награда ${i + 1}</b><button class="btn sm g" data-a="delhon" data-v="${i}">Удалить</button></div>${inp(`honors.${i}.title`, a.title, 'Название и уровень')}${inp(`honors.${i}.year`, a.year, 'Год')}</div>`).join('')}
      ${S.honors.length < 5 ? '<button class="btn g" data-a="addhon">Добавить награду</button>' : ''}</section>
    <div class="card"><h2 class="h2">Гайд по резюме без воды</h2><ul class="rs">
      <li class="ok">Начинай с самого сильного пункта, а не с самого раннего.</li>
      <li class="ok">Пиши глагол действия, роль и результат: «организовал», «вырос с 12 до 40 человек».</li>
      <li class="ok">Цифры и масштаб важнее прилагательных.</li>
      <li class="ok">Один пункт: одна строка смысла. Если нужен абзац, это эссе.</li>
      <li class="ok">Олимпиады и награды указывай с уровнем: школьный, региональный, республиканский, международный.</li></ul></div>`;
}

/* --- эссе --- */
function essayReport(t) {
  const w = wc(t);
  if (w < 20) return '<div class="note">Напиши хотя бы несколько предложений, чтобы было что проверять.</div>';
  const sents = (t.match(/[^.!?…\n]+[.!?…]*/g) || []).map(s => s.trim()).filter(Boolean);
  const first = sents[0] || '', fw = wc(first), items = [];
  items.push(w > 650 ? ['bad', `Длина ${w} слов: больше лимита Common App в 650. Сократи на ${w - 650}.`] : w < 350 ? ['warn', `Длина ${w} слов: коротковато. Обычно 500-650 слов дают место и для сцены, и для вывода.`] : ['ok', `Длина ${w} слов: в пределах лимита 650.`]);
  const badStart = /^(since|ever since|i have always|i've always|from a young age|as a child|in today|from childhood|с детства|с самого детства|я всегда|в современном мире|меня зовут)/i.test(first);
  if (badStart) items.push(['bad', 'Начало шаблонное: так начинают многие. Начни с одной конкретной сцены: место, время, действие.']);
  else if (fw > 30) items.push(['warn', 'Первое предложение длинное. Сократи, чтобы читателю захотелось узнать, что дальше.']);
  else items.push(['ok', 'Первое предложение короткое. Проверь: читатель хочет узнать, что дальше?']);
  const cl = [...new Set((t.match(/passion(ate)?|change the world|make a difference|life is a journey|hard work pays off|comfort zone|in today'?s world|thrive|с детства|изменить мир|сделать мир лучше|страсть к|зоны комфорта|в современном мире|путь к успеху/gi) || []).map(x => x.toLowerCase()))];
  items.push(cl.length ? ['warn', `Шаблонные фразы: ${cl.slice(0, 5).map(x => '«' + esc(x) + '»').join(', ')}. Замени их конкретным случаем.`] : ['ok', 'Явных шаблонных фраз не найдено.']);
  const nums = (t.match(/\d+/g) || []).length;
  const names = sents.reduce((a, s) => a + s.split(/\s+/).slice(1).filter(x => /^[A-ZА-ЯЁ][a-zа-яё]{2,}/.test(x)).length, 0);
  const dens = (nums + names) / w * 100;
  items.push(dens < 2 ? ['warn', 'Мало конкретики. Добавь цифры, имена, места и предметы, которые можно представить.'] : ['ok', 'Есть конкретика: цифры, имена или места.']);
  const lens = sents.map(wc), avg = lens.reduce((a, b) => a + b, 0) / (lens.length || 1), sd = Math.sqrt(lens.reduce((a, b) => a + (b - avg) * (b - avg), 0) / (lens.length || 1));
  const mono = w > 150 && sd < 4;
  if (mono) items.push(['warn', 'Ритм однообразный: предложения почти одной длины. Добавь короткие и длинные.']);
  const abs = (t.match(/passion|journey|impact|growth|leadership|resilien|challeng|opportunit|divers|страст|путь|развити|лидерств|вызов|возможност/gi) || []).length / w * 100;
  if (abs > 3) items.push(['warn', 'Слишком много абстрактных слов. Покажи это действием.']);
  const iShare = sents.filter(s => /^(i|я|my|мой|моя|мои)\b/i.test(s)).length / (sents.length || 1);
  if (iShare > 0.6) items.push(['warn', 'Больше 60% предложений начинаются с «Я». Варьируй начала.']);
  if (/in conclusion|to sum up|в заключение|подводя итог/i.test(sents[sents.length - 1] || '')) items.push(['warn', 'Концовка звучит как школьное сочинение. Закончи образом или действием.']);
  const pen = cl.length * 12 + Math.max(0, abs - 2) * 6 + (mono ? 10 : 0) + (badStart ? 10 : 0);
  const voice = pen < 12 ? 'Звучит как ты' : pen < 30 ? 'Смешанно: есть шаблонные места' : 'Похоже на шаблон';
  return `<div class="card"><div class="row between wrap"><b>Слов: ${w} из 650</b><span class="badge sky">${voice}</span></div><ul class="rs">${items.map(([c, m]) => `<li class="${c}">${m}</li>`).join('')}</ul></div>
    <div class="card"><b>Вопросы, которые стоит задать себе</b><ul class="rs">
      <li class="warn">Какая одна сцена (место, время, действие) лучше всего показывает, каков ты?</li>
      <li class="warn">Что изменилось в тебе после этой истории? Покажи это действием, а не словом «понял».</li>
      <li class="warn">Что здесь можно проверить фактом: цифра, имя, предмет, диалог?</li></ul>
      <p class="muted small">Мы не переписываем текст за тебя: проверка показывает слабые места, а голос остаётся твоим. Оценка по правилам, это подсказка, а не приговор.</p></div>`;
}
function pEssay() {
  const liked = evalAll().filter(e => S.liked.includes(e.u.id));
  return `<div><h1 class="h1">Эссе</h1><p class="muted">Personal Statement до 650 слов и дополнительные эссе для каждого вуза.</p></div>
    <div class="card"><label class="lbl" for="essay">Personal Statement</label><textarea id="essay" class="ta" data-in="essay" data-refresh="essay" placeholder="Вставь или пиши черновик здесь. Начни со сцены.">${esc(S.essay)}</textarea>
      <div class="row between"><span class="muted" id="wc">${wc(S.essay)} из 650 слов</span><button class="btn p" data-a="check">Проверить эссе</button></div></div>
    <div id="essay-out" class="essay-out">${wc(S.essay) >= 20 ? essayReport(S.essay) : ''}</div>
    <section class="main" style="padding:0"><h2 class="h2">Дополнительные эссе</h2>
      ${liked.length ? liked.map(e => `<div class="card sm"><b>${flag(e.u.c)} ${esc(e.u.n)}</b>${[['why', 'Why Us: почему именно этот вуз'], ['major', 'Why this major: почему эта специальность'], ['comm', 'Сообщество или лидерство']].map(([k, l]) => `<label class="row"><input type="checkbox" data-a="task" data-v="sup_${e.u.id}_${k}" ${S.tasks['sup_' + e.u.id + '_' + k] ? 'checked' : ''}> <span>${l}</span></label>`).join('')}<p class="muted small">Точные вопросы возьми на сайте вуза: ${link(e.u.src)}</p></div>`).join('') : '<div class="empty"><p>Отметь вузы сердечком, и здесь появится список дополнительных эссе.</p><a class="btn p" href="#/unis">Выбрать вузы</a></div>'}</section>`;
}

/* --- Candidate Week --- */
function pCandidate() {
  const cw = evalAll().filter(e => e.u.cw);
  return `<div><h1 class="h1">Интервью и Candidate Week</h1><p class="muted">Некоторые вузы приглашают лучших кандидатов на очное событие, где проходят интервью и командные задания. Приглашение не гарантирует зачисление, условия зависят от вуза.</p></div>
    <div class="card"><b>Вузы с Candidate Week в твоём списке</b>${cw.length ? `<ul class="rs">${cw.map(e => `<li class="${S.liked.includes(e.u.id) ? 'ok' : 'warn'}">${flag(e.u.c)} ${esc(e.u.n)}${S.liked.includes(e.u.id) ? '' : ' (не в избранном)'}</li>`).join('')}</ul>` : '<p class="muted">Пока нет.</p>'}<p class="muted small">Проверь на сайте вуза, как и когда он рассылает приглашения.</p></div>
    <div class="card"><b>Чек-лист, если пригласили</b>${D.cwSteps.map(([id, t]) => `<label class="row"><input type="checkbox" data-a="task" data-v="${id}" ${S.tasks[id] ? 'checked' : ''}> <span>${t}</span></label>`).join('')}</div>
    <div class="card"><b>10 типовых вопросов интервью</b><ul class="rs">${D.interview.map(q => `<li class="warn">${q}</li>`).join('')}</ul><p class="muted small">Отрепетируй ответы вслух с другом или учителем. Готовь истории, а не заученный текст.</p></div>`;
}

/* --- профиль, отчёт, меню --- */
function pProfile() {
  return `<div><h1 class="h1">Твои ответы</h1><p class="muted">Измени бюджет, страны, экзамен или специальность, и рекомендации, деньги и маршрут пересчитаются.</p></div>
    <div class="card"><div class="field"><span class="lbl">Имя</span>${F.name()}</div><div class="field"><span class="lbl">Класс</span>${F.grade()}</div><div class="field"><span class="lbl">Гражданство</span>${F.cit()}</div></div>
    <div class="card"><div class="field"><span class="lbl">Специальность</span>${F.major()}</div><div class="field"><span class="lbl">Страны</span>${F.countries()}</div></div>
    <div class="card">${F.budget()}<div class="field"><span class="lbl">Помощь с обучением</span>${F.aid()}</div><div class="field"><span class="lbl">Fee waiver</span>${F.waiver()}</div></div>
    <div class="card">${F.ielts()}${F.sat()}${F.gpa()}${F.ach()}</div>
    <div class="card"><div class="field"><span class="lbl">Чем ещё занимаешься</span>${F.extras()}</div><div class="field"><span class="lbl">Когда подаёшь документы</span>${F.year()}</div></div>
    <div class="card ink"><b>Топ-3 сейчас</b><div id="prev" class="main" style="padding:0;gap:6px">${prevHTML()}</div><a class="btn s" href="#/unis">Смотреть все вузы</a></div>`;
}
function pReport() {
  const p = S.p, T = TASKS(), pr = progress(T), L = targetUnis();
  const nx = T.filter(x => !x.done).sort((a, b) => a.due - b.due).slice(0, 3);
  return `<div class="row between noprint"><h1 class="h1">Отчёт для семьи</h1><button class="btn p" data-a="print">Печать или PDF</button></div>
    <div class="card"><h2 class="h2">Meetup: маршрут поступления${p.name ? ', ' + esc(p.name) : ''}</h2>
      <p>Специальность: ${MAJ[p.major]}. Страны: ${p.countries.length ? p.countries.map(cname).join(', ') : 'любые'}. Бюджет: ${money(p.budget)} в год. Подача на ${p.year}. Маршрут пройден на ${pr.pct}%.</p></div>
    <div class="card"><h2 class="h2">Вузы и расходы</h2><div class="tw"><table class="tbl"><thead><tr><th>Вуз</th><th>Группа</th><th>В год</th><th>Разрыв</th></tr></thead><tbody>${L.map(e => `<tr><td>${flag(e.u.c)} ${esc(e.u.n)}</td><td>${TIER[e.tier]}</td><td><span class="dot ${e.light}"></span> ${money(e.net)}</td><td>${e.gap > 0 ? money(e.gap) : 'нет'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Курс: 1 $ = ${Math.round(RATE.v)} ₸. Помощь и стипендии учтены как ориентир, не как обещание.</p></div>
    <div class="card"><h2 class="h2">Ближайшие шаги</h2><ul class="rs">${nx.map(x => `<li class="warn">${esc(x.t)}: ${esc(dueTxt(x))}</li>`).join('')}</ul></div>
    ${banner()}<p class="muted small">Meetup не гарантирует поступление и не даёт вероятностей. Проверяйте условия и сроки на официальных сайтах.</p>`;
}
function pMore() {
  const items = [['compare', 'Сравнение вузов', 'по деньгам и требованиям'], ['free', 'Бесплатный путь', 'экзамены, олимпиады, стипендии'], ['docs', 'Документы', '14 шагов подачи'], ['essay', 'Эссе', 'проверка Personal Statement'], ['candidate', 'Интервью и Candidate Week', 'чек-лист и вопросы'], ['report', 'Отчёт для семьи', 'для печати'], ['profile', 'Изменить ответы', 'бюджет, страны, экзамены']];
  return `<h1 class="h1">Ещё</h1><div class="menu">${items.map(([r, t, s]) => `<a href="#/${r}"><span>${t}<br><small>${s}</small></span><span>›</span></a>`).join('')}</div>
    <button class="btn g" data-a="reset">Сбросить все данные</button>${banner()}`;
}

/* ---------- отрисовка ---------- */
let lastRoute = null;
function render(keep) {
  const r = route();
  if (!S.p.done && r !== 'start') { go('start'); return; }
  const y = typeof window.scrollY === 'number' ? window.scrollY : 0;
  const pages = { home: pHome, unis: pUnis, compare: pCompare, money: pMoney, free: pFree, roadmap: pRoadmap, docs: pDocs, essay: pEssay, candidate: pCandidate, profile: pProfile, report: pReport, more: pMore, start: pStart };
  const fn = pages[r] || pHome;
  let head = '', nav = '';
  if (r !== 'start') {
    const T = TASKS(), nx = nextTask(T), pr = progress(T);
    head = `<header class="top"><div class="hd"><a class="brand" href="#/home">${ICON.logo}Meetup</a><a class="pct" href="#/roadmap" aria-label="Прогресс маршрута">${pr.pct}%</a></div>${routeHTML(T, nx)}<div class="hereline">${nx ? `Ты здесь: <b>${esc(stageName(nx.st))}</b>. Дальше: ${esc(nx.t)}` : 'Маршрут пройден'}</div></header>`;
    const more = ['more', 'compare', 'free', 'docs', 'essay', 'candidate', 'report', 'profile'];
    nav = `<nav class="nav" aria-label="Разделы"><div class="in">${[['home', 'Главная', ICON.home], ['unis', 'Вузы', ICON.uni], ['money', 'Деньги', ICON.money], ['roadmap', 'Маршрут', ICON.route], ['more', 'Ещё', ICON.more]].map(([k, l, ic]) => `<a href="#/${k}" class="${r === k || (k === 'more' && more.includes(r)) ? 'on' : ''}" ${r === k ? 'aria-current="page"' : ''}><span>${ic}</span>${l}</a>`).join('')}</div></nav>`;
  }
  let body;
  try { body = fn(); } catch (err) { console.error(err); body = '<div class="empty"><p>Что-то пошло не так при показе страницы. Обнови страницу или сбрось данные в разделе «Ещё».</p><a class="btn p" href="#/more">Открыть «Ещё»</a></div>'; }
  const app = $('#app'); if (!app) return;
  app.innerHTML = `<div class="shell">${head}<main class="main">${body}</main></div>${nav}`;
  if (typeof window.scrollTo === 'function') window.scrollTo(0, keep && lastRoute === r ? y : 0);
  lastRoute = r;
  document.title = 'Meetup: маршрут поступления';
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}

  /* ---------- AI admissions assistant ---------- */
  const CHAT_SUGGESTIONS = ['Какие вузы дают Full Ride?', 'Как заполнить CSS Profile?', 'Где получить Fee Waiver?'];
  const CHAT_SYSTEM = 'Ты — Meetup, эксперт по поступлению и финансовой помощи для школьников из Казахстана и Центральной Азии. Отвечай по-русски, понятно и практично. Знай: NYU Abu Dhabi заявляет need-blind помощь для всех студентов с покрытием обучения, жилья, перелётов и стипендией; Nazarbayev University — государственные гранты с обучением и стипендией; KAIST и UNIST — tuition waiver и ежемесячная стипендия; Bilkent и Koç — merit/need scholarships; HKU, HKUST и PolyU — merit scholarships с обучением и living allowance; Harvard, MIT, Princeton, Yale, Amherst, Dartmouth и Bowdoin покрывают 100% demonstrated financial need по своим правилам. Объясняй CSS Profile, ISFAA, Certification of Finances и Fee Waiver. Всегда напоминай проверять актуальные условия на официальном сайте: суммы и правила меняются.';
  let chatMessages = [{ role: 'assistant', text: 'Привет! Я помогу разобраться с вузами, Full Ride и финансовой помощью. С чего начнём?' }];
  let chatBusy = false;
  function chatMarkdown(text) {
    return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/^[-•] (.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>').replace(/\n/g, '<br>');
  }
  function chatHTML() {
    if (!document.getElementById('meetup-chat')) {
      document.body.insertAdjacentHTML('beforeend', `<section id="meetup-chat" class="chat-widget" aria-label="AI-помощник Meetup"><button class="chat-fab" data-chat="toggle" aria-label="Открыть AI-помощника"><span class="chat-fab-dot"></span><span class="chat-fab-icon">AI</span></button><div class="chat-panel" hidden><header class="chat-head"><div><strong>Meetup AI</strong><span>Приёмная и финансовая помощь</span></div><button class="chat-close" data-chat="toggle" aria-label="Закрыть чат">×</button></header><div class="chat-body"><div class="chat-messages" aria-live="polite"></div><div class="chat-suggestions">${CHAT_SUGGESTIONS.map(x => `<button data-chat="suggest" data-prompt="${esc(x)}">${esc(x)}</button>`).join('')}</div></div><form class="chat-form"><input class="chat-input" name="prompt" maxlength="800" autocomplete="off" placeholder="Спроси о поступлении..." aria-label="Сообщение помощнику"><button class="chat-send" type="submit" aria-label="Отправить">↑</button></form></div></section>`);
      document.querySelector('#meetup-chat .chat-form').addEventListener('submit', e => { e.preventDefault(); const input = e.currentTarget.prompt; sendChat(input.value); });
      document.querySelectorAll('[data-chat]').forEach(el => el.addEventListener('click', () => { const action = el.dataset.chat; if (action === 'toggle') { const panel = document.querySelector('.chat-panel'); panel.hidden = !panel.hidden; if (!panel.hidden) renderChat(); } if (action === 'suggest') sendChat(el.dataset.prompt); }));
      renderChat();
    }
  }
  function renderChat() { const box = document.querySelector('.chat-messages'); if (!box) return; box.innerHTML = chatMessages.map(m => `<div class="chat-message ${m.role}"><div class="chat-avatar">${m.role === 'assistant' ? 'AI' : 'Вы'}</div><div class="chat-bubble">${chatMarkdown(m.text)}</div></div>`).join('') + (chatBusy ? '<div class="chat-message assistant"><div class="chat-avatar">AI</div><div class="chat-bubble typing"><i></i><i></i><i></i></div></div>' : ''); box.scrollTop = box.scrollHeight; }
  async function sendChat(raw) { const prompt = String(raw || '').trim(); if (!prompt || chatBusy) return; chatMessages.push({ role: 'user', text: prompt }); chatBusy = true; const input = document.querySelector('.chat-input'); if (input) input.value = ''; renderChat(); try { const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, system: CHAT_SYSTEM }) }); if (!res.ok) throw new Error('chat unavailable'); const data = await res.json(); chatMessages.push({ role: 'assistant', text: data.text || data.message || 'Не удалось получить ответ.' }); } catch (e) { chatMessages.push({ role: 'assistant', text: 'Сейчас я работаю в демо-режиме. Попробуй спросить про Full Ride, CSS Profile или Fee Waiver — я дам ориентир и подскажу, что проверить на официальном сайте.' }); } finally { chatBusy = false; renderChat(); } }
  chatHTML();

  /* ---------- события ---------- */
  function refreshPrev() { const el = $('#prev'); if (el) el.innerHTML = prevHTML(); }
function refreshMoney() { const el = $('#money-out'); if (el) el.innerHTML = moneyOut(); }
function essayCount() { const el = $('#wc'); if (el) el.textContent = wc(S.essay) + ' из 650 слов'; }

document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  const act = a.dataset.a, v = a.dataset.v, f = a.dataset.f;
  let rerender = true;
  switch (act) {
    case 'begin': S.step = 1; break;
    case 'demo': S.p = Object.assign({}, defaults().p, DEMO); S.liked = ['nyuad', 'kaist', 'nu', 'kbtu']; S.tasks = {}; S.step = 0; save(); go('home'); return;
    case 'next': {
      const steps = WSTEPS();
      if (S.step === 1 && !S.p.name.trim()) { toast('Напиши имя, чтобы мы могли к тебе обращаться'); return; }
      if (S.step >= steps.length) { S.p.done = true; S.step = 0; save(); go('home'); return; }
      S.step++; break;
    }
    case 'back': S.step = Math.max(0, S.step - 1); break;
    case 'set': S.p[f] = f === 'waiver' ? v === '1' : (NUMF.includes(f) ? parseFloat(v) : v); break;
    case 'tog': { const arr = S.p[f], i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); break; }
    case 'like': { const i = S.liked.indexOf(v); if (i >= 0) S.liked.splice(i, 1); else S.liked.push(v); break; }
    case 'task': S.tasks[v] = !S.tasks[v]; if (a.type === 'checkbox') rerender = false; break;
    case 'doc': { const cur = S.docs[v] || 'todo'; S.docs[v] = DOCST[(DOCST.indexOf(cur) + 1) % 3]; break; }
    case 'tab': S.tab[f] = v; break;
    case 'noaid': S.stress.noAid = !S.stress.noAid; break;
    case 'stressreset': S.stress = { rate: 0, budget: 0, noAid: false }; break;
    case 'addact': if (S.acts.length < 10) S.acts.push({ title: '', role: '', result: '' }); break;
    case 'delact': S.acts.splice(+v, 1); break;
    case 'addhon': if (S.honors.length < 5) S.honors.push({ title: '', year: '' }); break;
    case 'delhon': S.honors.splice(+v, 1); break;
    case 'check': { const el = $('#essay-out'); if (el) el.innerHTML = essayReport(S.essay); rerender = false; break; }
    case 'print': if (window.print) window.print(); rerender = false; break;
    case 'reset': if (window.confirm && !window.confirm('Удалить все данные и начать заново?')) return; S = defaults(); save(); go('start'); render(); return;
    default: return;
  }
  save(); if (rerender) render(true);
});
document.addEventListener('input', e => {
  const t = e.target, path = t.dataset && t.dataset.in; if (!path) return;
  let v = t.value; if (t.dataset.num !== undefined) v = parseFloat(v);
  setPath(path, v); save();
  const r = t.dataset.refresh;
  if (r === 'money') refreshMoney(); else if (r === 'prev') refreshPrev(); else if (r === 'essay') essayCount();
  if (t.dataset.lbl) { const el = document.getElementById(t.dataset.lbl); if (el) el.textContent = t.dataset.fmt === 'money' ? money(v) : (v > 0 ? '+' : '') + v + '%'; }
});
document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.render) render(true); });
window.addEventListener('hashchange', () => render());

window.__meetup = { get S() { return S; }, set S(v) { S = v; }, render, evalAll, TASKS, essayReport, defaults, DEMO, route };
if (!location.hash) { location.hash = S.p.done ? '#/home' : '#/start'; } else render();
loadRate();
})();
