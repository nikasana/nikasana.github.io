'use strict';
// ---------- voice acting: spoken lines in English or Russian (browser speech synthesis) ----------
const SPEAKERS = {
  Sidorovich: { ru: 'Сидорович', pitch: 0.55, rate: 0.9 }, Barkeep: { ru: 'Бармен', pitch: 0.75, rate: 0.95 }, Stalker: { ru: 'Сталкер', pitch: 1, rate: 1.05 },
  Scientist: { ru: 'Учёный', pitch: 1.25, rate: 1.05 }, Monolith: { ru: 'Монолит', pitch: 0.2, rate: 0.7 }, Announcer: { ru: 'Диктор', pitch: 0.85, rate: 0.95 },
  Guide: { ru: 'Проводник', pitch: 1, rate: 1 }, Military: { ru: 'Военный', pitch: 0.7, rate: 1.1 },
};
// event → [speaker, english, russian]
const VOICE_LINES = {
  start: [['Sidorovich', 'Alright rookie, get out there. Bring me artifacts and try not to die.', 'Ну что, салага, вперёд. Принеси мне артефакты и постарайся не сдохнуть.'], ['Sidorovich', 'Welcome to the Zone. Nobody here is going to hold your hand.', 'Добро пожаловать в Зону. Никто тут тебя за ручку водить не будет.'], ['Sidorovich', 'The Zone is hungry today. Do not feed it.', 'Зона сегодня голодная. Не корми её собой.']],
  night: [['Stalker', 'Night is falling. Keep your flashlight on and your back to a wall.', 'Темнеет. Фонарь не выключай и держись спиной к стене.'], ['Barkeep', 'Bloodsuckers love the dark. Watch the shadows.', 'Кровососы любят темноту. Следи за тенями.']],
  day: [['Stalker', 'Sun is up. Made it through another night.', 'Солнце встало. Ещё одну ночь пережили.'], ['Sidorovich', 'Morning. Still alive? Good, there is work.', 'Утро. Живой ещё? Хорошо, есть работа.']],
  rain: [['Stalker', 'Rain again. Electro anomalies go crazy in this weather.', 'Опять дождь. Электры в такую погоду бесятся.']],
  fog: [['Stalker', 'Fog is rolling in. Can not see a thing past twenty meters.', 'Туман накрывает. Дальше двадцати метров ничего не видно.']],
  storm: [['Scientist', 'Lightning storm! Stay away from open ground!', 'Гроза! Держитесь подальше от открытых мест!']],
  psi: [['Scientist', 'Psi storm detected. Expect headaches, and worse.', 'Пси-шторм! Готовьтесь к головной боли. И к худшему.'], ['Monolith', 'Come to us. The Monolith calls.', 'Иди к нам. Монолит зовёт.']],
  snow: [['Stalker', 'Snow in the Zone. Watch your step, it is slippery.', 'Снег в Зоне. Смотри под ноги, скользко.']],
  heat: [['Stalker', 'This heat is killing me. Drink some water, stalker.', 'Жара убивает. Попей воды, сталкер.']],
  radstorm: [['Scientist', 'Radiation storm! Get to a shelter or drink anti-rad!', 'Радиационный шторм! В укрытие или пей антирад!']],
  boss: [['Stalker', 'Something big is coming this way! Run!', 'Сюда идёт что-то огромное! Беги!'], ['Barkeep', 'Reports of a huge mutant near you. Good luck, friend.', 'Говорят, рядом с тобой огромный мутант. Удачи, друг.']],
  bossdead: [['Barkeep', 'You killed that? Drinks are on me.', 'Ты завалил эту тварь? Выпивка за мой счёт.'], ['Stalker', 'Now that is a stalker! Respect, brother.', 'Вот это сталкер! Уважаю, брат.']],
  emission: [['Scientist', 'Emission! Find cover immediately!', 'Выброс! Немедленно в укрытие!'], ['Sidorovich', 'Blowout coming! Get underground or get cooked!', 'Выброс идёт! Прячься под землю, или поджаришься!']],
  emissionEnd: [['Scientist', 'The emission is over. New artifacts are forming out there.', 'Выброс закончился. Там формируются новые артефакты.']],
  artifact: [['Sidorovich', 'An artifact! Now we are talking business.', 'Артефакт! Вот это другой разговор.'], ['Scientist', 'Fascinating specimen. Handle it carefully.', 'Потрясающий образец. Обращайся осторожно.']],
  lowhp: [['Stalker', 'You are bleeding out, man! Use a medkit!', 'Ты истекаешь кровью! Аптечку, быстро!'], ['Stalker', 'Get out of there, you are hurt!', 'Уходи оттуда, ты ранен!']],
  quest: [['Sidorovich', 'Got a job for you. Check your PDA.', 'Есть для тебя работа. Глянь в ПДА.'], ['Barkeep', 'New contract posted. Pays well.', 'Новый заказ. Платят хорошо.']],
  questDone: [['Sidorovich', 'Job done? Here is your money. Do not spend it on vodka.', 'Сделал? Держи деньги. Только не пропей.'], ['Barkeep', 'Nice work. The money is yours.', 'Хорошая работа. Деньги твои.']],
  lab: [['Scientist', 'You are inside an X lab. Be careful down there.', 'Ты в лаборатории Икс. Будь осторожен там, внизу.']],
  poi: [['Stalker', 'There is a stash here, but something is guarding it.', 'Тут тайник, но его что-то охраняет.']],
  elite: [['Stalker', 'That one looks different. Stronger. Careful!', 'Этот какой-то другой. Сильнее. Осторожно!']],
  evolution: [['Sidorovich', 'Where did you get that thing? Beautiful.', 'Где ты достал эту штуку? Красота.']],
  streak: [['Stalker', 'Cheeki breeki! Look at him go!', 'Чики-брики! Смотри, как даёт!'], ['Stalker', 'What a massacre! Keep it up, stalker!', 'Вот это бойня! Так держать, сталкер!']],
  levelup: [['Guide', 'You are getting stronger.', 'Ты становишься сильнее.'], ['Guide', 'Level up. Choose wisely.', 'Новый уровень. Выбирай с умом.']],
  event: [['Announcer', 'Attention, stalkers. {x}.', 'Внимание, сталкеры. {x}.']],
  bosscard: [['Announcer', 'Warning. {x} is hunting you.', 'Внимание. {x} охотится на тебя.']],
  train: [['Military', 'Train on the tracks! Clear the rails!', 'Поезд! Уйди с путей!']],
  avalanche: [['Stalker', 'Avalanche! Move sideways, now!', 'Лавина! Уходи в сторону, быстро!']],
  wildfire: [['Stalker', 'The forest is burning! Stay clear of the flames!', 'Лес горит! Держись подальше от огня!']],
  watcher: [['Monolith', 'We see you. We always see you.', 'Мы видим тебя. Мы всегда тебя видим.']],
  unlock: [['Sidorovich', 'A new part of the Zone is open. Go take a look.', 'Открылась новая часть Зоны. Сходи посмотри.']],
  downed: [['Stalker', 'Man down! Somebody help him!', 'Сталкер ранен! Помогите ему!']],
  revived: [['Stalker', 'You are back on your feet. Let us move.', 'Ты снова на ногах. Двигаем.']],
  watchtower: [['Guide', 'Good view from up here. The area is on your map.', 'Отличный вид отсюда. Местность теперь на карте.']],
  radiotower: [['Military', 'Radio tower online. Fast travel available.', 'Радиовышка работает. Быстрое перемещение доступно.']],
  vault: [['Sidorovich', 'You cracked the vault? Share with old Sidorovich.', 'Ты вскрыл хранилище? Поделись со стариком Сидоровичем.']],
  campfire: [['Stalker', 'Sit by the fire, brother. Rest a while.', 'Садись к костру, брат. Отдохни немного.']],
  victory: [['Sidorovich', 'You actually did it. The Zone will remember your name.', 'Ты действительно сделал это. Зона запомнит твоё имя.']],
  death: [['Sidorovich', 'Another one lost to the Zone. Next time, bring more medkits.', 'Ещё один сгинул в Зоне. В следующий раз бери больше аптечек.'], ['Barkeep', 'Rest in peace, stalker.', 'Покойся с миром, сталкер.']],
  tier: [['Monolith', 'The Zone grows stronger.', 'Зона становится сильнее.']],
};
const CAMPFIRE_RU = ['Говорят, Монолит исполняет любое желание... но никто не вернулся сказать спасибо.', 'Видел я кровососа однажды. Или он меня видел. Помню только дыхание.', 'Долг хочет сжечь Зону. А я просто хочу смотреть на закат над Припятью.', 'Каждый убитый мутант, это один мутант, который не дойдёт до Большой земли.', 'Аномалии двигаются после каждого выброса. Будто Зона... дышит.', 'Расслабься, я не на работе. Передай водку.', 'Кидай болт перед каждым шагом. Зона ничего не прощает.', 'Слышал про Стрелка? Три раза ходил в Зону. Два раза вернулся.'];
const TUT_RU = ['Двигайся клавишами WASD или проведи пальцем по экрану.', 'Рывок, пробел или кнопка рывка. Во время рывка ты неуязвим.', 'Оружие стреляет само. Убей пять зомби!', 'Собирай зелёные кристаллы, чтобы получить уровень, и выбери карту.', 'Рядом лежит артефакт. Детектор внизу слева указывает на него. Подбери!', 'Нажми Q, чтобы использовать силу артефакта.', 'Клавиши E, минус и плюс переключают артефакты. T бросает болт, он показывает скрытые аномалии.', 'Постой рядом с мотоциклом, и ты сядешь на него. Рывок, чтобы спрыгнуть.', 'Открой карту клавишей M и закрой её.', 'Выброс убивает всех снаружи. Зайди в зелёный круг укрытия.'];

const Voice = {
  voices: [], q: [], cool: {}, busyT: 0, last: 0,
  lang() { if (Save.set.voiceOn === false) return 'off'; const v = Save.set.voiceLang; return v === undefined ? (['ru', 'uk'].includes(Save.data && Save.data.lang) ? 'ru' : 'en') : v; },
  ok() { return 'speechSynthesis' in window && this.lang() !== 'off'; },
  load() { if (!('speechSynthesis' in window)) return; const f = () => { this.voices = speechSynthesis.getVoices(); }; f(); speechSynthesis.onvoiceschanged = f; },
  pickVoice(lang) {
    const vs = this.voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang));
    return vs.find((v) => /male|dmitri|pavel|yuri|david|daniel|google/i.test(v.name)) || vs[0] || null;
  },
  line(ev, x) {
    const L = VOICE_LINES[ev]; if (!L) return null;
    const [who, en, ru] = pick(L), ru2 = this.lang() === 'ru';
    return { who, name: ru2 ? (SPEAKERS[who] || {}).ru || who : who, txt: (ru2 ? ru : en).replace('{x}', x || '') };
  },
  // show the line in the chatter box (in the chosen language) and speak it
  say(ev, opt = {}) {
    if (!G || G.title) return false;
    const now = G.t || 0;
    if (!opt.force && this.cool[ev] !== undefined && now - this.cool[ev] < (opt.cd || 40)) return false;
    const l = opt.line || this.line(ev, opt.x); if (!l) return false;
    this.cool[ev] = now;
    if (opt.chatter !== false) { if (Radio.q.length > 2) Radio.q.shift(); Radio.q.push({ who: l.name, txt: l.txt, whoKey: l.who }); }
    this.speak(l.txt, l.who, opt.prio || 1);
    return true;
  },
  speak(txt, who, prio = 1) {
    if (!this.ok() || !txt) return;
    const vol = (Save.set.master ?? 0.8) * (Save.set.voice ?? 0.8); if (vol <= 0.01 || Sfx.muted) return;
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      if (prio >= 2) speechSynthesis.cancel(); // important lines cut in
      else if (this.q.length >= 1) return; // don't pile up chatter
    }
    const u = new SpeechSynthesisUtterance(txt.replace(/[🔥☢️⚠️💀👑🎯]/gu, '')), lang = this.lang(), S = SPEAKERS[who] || SPEAKERS.Stalker;
    u.lang = lang === 'ru' ? 'ru-RU' : 'en-US'; const v = this.pickVoice(lang); if (v) u.voice = v;
    u.pitch = S.pitch; u.rate = S.rate * (lang === 'ru' ? 1.05 : 1); u.volume = Math.min(1, vol * 1.1);
    this.q.push(u); u.onend = u.onerror = () => { this.q = this.q.filter((x) => x !== u); };
    try { speechSynthesis.speak(u); } catch (e) { /* speech unavailable */ }
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) { /* speech unavailable */ } this.q = []; },
};
Voice.load();

// ----- hooks -----
// radio chatter: every existing chatter event is voiced (and shown in the chosen language)
const _vRadio = Radio.say.bind(Radio);
Radio.say = function (ev, force) { if (Voice.lang() === 'off' || !VOICE_LINES[ev]) return _vRadio(ev, force); Voice.say(ev, { force, cd: 45, prio: ['emission', 'boss', 'lowhp'].includes(ev) ? 2 : 1 }); };
const _vReset = Radio.reset.bind(Radio);
Radio.reset = function () { _vReset(); Voice.cool = {}; Voice.stop(); };
// banners: many big moments already raise a banner; voice them by their title
const V_BANNERS = [[/^🚂/, 'train'], [/AVALANCHE/, 'avalanche'], [/WILDFIRE/, 'wildfire'], [/THE WATCHER/, 'watcher'], [/NEW STAGE UNLOCKED/, 'unlock'], [/^💀 DOWNED/, 'downed'], [/REVIVED/, 'revived'], [/WATCHTOWER/, 'watchtower'], [/RADIO TOWER ONLINE/, 'radiotower'], [/VAULT OPENED/, 'vault'], [/CAMPFIRE STORY/, 'campfire'], [/ZONE TIER/, 'tier'], [/SNOW/, 'snow'], [/HEAT/, 'heat'], [/RADIATION STORM/, 'radstorm']];
const _vBanner = banner;
banner = function (title, sub, dur, cls, prio) {
  _vBanner(title, sub, dur, cls, prio);
  if (Voice.lang() === 'off' || !G || G.title) return;
  const t = String((typeof BANNER_EN !== 'undefined' && BANNER_EN) || title || '');
  for (const [re, ev] of V_BANNERS) if (re.test(t)) { Voice.say(ev, { cd: 30, prio: ['train', 'avalanche', 'downed'].includes(ev) ? 2 : 1 }); return; }
};
// bosses and events are announced by name
const _vBoss = bossCard;
bossCard = function (e, o) { _vBoss(e, o); if (Voice.lang() !== 'off') Voice.say('bosscard', { x: e.name, force: true, prio: 2, chatter: false }); };
const _vEv = Events.start.bind(Events);
Events.start = function (id) { const before = Events.cur; _vEv(id); if (Events.cur && Events.cur !== before && Voice.lang() !== 'off') { const E = EVENTS[id]; Voice.say('event', { x: E.name, force: true, chatter: false, prio: 2 }); } };
// level ups (not every time)
const _vXp = addXp;
addXp = function (v) { const l = G.level; _vXp(v); if (G.level > l && G.level % 3 === 0 && Voice.lang() !== 'off') Voice.say('levelup', { cd: 60, chatter: false }); };
// campfire stories are read aloud
const _vCamp = Story.campfire.bind(Story);
Story.campfire = function () {
  const n = Radio.q.length; _vCamp();
  const item = Radio.q[n]; if (!item || Voice.lang() === 'off') return;
  const i = CAMPFIRE.findIndex((c) => c[1] === item.txt);
  if (Voice.lang() === 'ru' && i >= 0) { item.txt = CAMPFIRE_RU[i]; item.who = (SPEAKERS[item.who] || {}).ru || item.who; }
  Voice.speak(item.txt, CAMPFIRE[i] ? CAMPFIRE[i][0].split(' ').pop() : 'Stalker', 1);
};
// tutorial steps are spoken (and shown in Russian when chosen)
const _vTut = Tutorial.next.bind(Tutorial);
Tutorial.next = function () {
  _vTut();
  if (Voice.lang() === 'off') return;
  const s = TUT_STEPS[this.i]; if (!s) { Voice.speak(Voice.lang() === 'ru' ? 'Обучение завершено. Ты готов к Зоне.' : 'Training complete. You are ready for the Zone.', 'Guide', 2); return; }
  const txt = Voice.lang() === 'ru' ? TUT_RU[this.i] || s[0] : s[0];
  const b = $('tutBox') && $('tutBox').querySelector('b'); if (b && Voice.lang() === 'ru' && TUT_RU[this.i]) b.textContent = TUT_RU[this.i];
  Voice.speak(txt, 'Guide', 2);
};
addEventListener('DOMContentLoaded', () => {
  // run end
  const _er = endRun;
  endRun = function (kind, src) { const was = G && G.ended; _er(kind, src); if (!was && G && !G.tutorial && Voice.lang() !== 'off' && (kind === 'win' || kind === 'dead')) { Voice.cool = {}; Voice.say(kind === 'win' ? 'victory' : 'death', { force: true, chatter: false, prio: 2 }); } };
  // chatter box colours by speaker also work for translated names
  const _up = Radio.update.bind(Radio);
  Radio.update = function (dt) { const had = this.cur; _up(dt); if (this.cur && this.cur !== had && this.cur.whoKey) $('radio').className = 'show ' + this.cur.whoKey.toLowerCase(); };
  // settings: voice language
  const _bs = buildSettings;
  buildSettings = function () {
    _bs();
    const s = Save.set, cur = Voice.lang(), has = (l) => Voice.voices.some((v) => v.lang && v.lang.toLowerCase().startsWith(l));
    $('settingsBody').insertAdjacentHTML('afterbegin', `<label class="set"><span>🗣️ Voices</span><input type="checkbox" id="voiceOn" ${s.voiceOn !== false ? 'checked' : ''}></label><label class="set" id="voiceLangRow" style="${s.voiceOn === false ? 'opacity:0.45' : ''}"><span>Voice acting</span><select data-voice>${[['off', 'Off'], ['en', 'English'], ['ru', 'Русский']].map(([v, n]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${n}${v !== 'off' && Voice.voices.length && !has(v) ? ' (no voice installed)' : ''}</option>`).join('')}</select></label><button class="big ghost small" id="voiceTest">🔊 Test voice</button>`);
    document.querySelector('[data-voice]').onchange = (e) => { s.voiceLang = e.target.value; if (e.target.value !== 'off') s.voiceOn = true; else Voice.stop(); Save.save(); buildSettings(); };
    $('voiceOn').onchange = (e) => { s.voiceOn = e.target.checked; if (!s.voiceOn) Voice.stop(); else if (s.voiceLang === 'off') s.voiceLang = undefined; Save.save(); buildSettings(); };
    $('voiceTest').onclick = () => { Sfx.init(); const l = Voice.lang(); if (l === 'off') return; const L = VOICE_LINES.start[0]; Voice.speak(l === 'ru' ? L[2] : L[1], 'Sidorovich', 2); };
    applyLang && applyLang();
  };
  const _pause = togglePause;
  togglePause = function () { _pause(); if (G && G.state === 'pause') Voice.stop(); };
  const _menu = toMenu;
  toMenu = function () { Voice.stop(); _menu(); };
});
