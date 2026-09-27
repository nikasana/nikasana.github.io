'use strict';
// ---------- full translation engine (Georgian, Russian, Ukrainian) ----------
const I18N_LANGS = ['ka', 'ru', 'uk'];
// the same traversal that produced the English lists; groups are paired with TRG[group][lang] by position
function i18nGroups() {
  const G2 = {}, add = (g, o, f, isFn) => { const v = isFn ? null : (o['_en_' + f] !== undefined ? o['_en_' + f] : o[f]); if (!isFn && !(typeof v === 'string' && v.trim() && /[a-z]/i.test(v))) return; (G2[g] = G2[g] || []).push({ o, f, isFn }); };
  for (const w of Object.values(WEAPONS)) { add('weapons', w, 'name'); add('wdesc', w, 'desc'); }
  for (const e of Object.values(EVOLUTIONS)) { add('weapons', e, 'name'); add('wdesc', e, 'desc'); }
  for (const k in PERKS) { add('perks', PERKS[k], 'name'); add('pdesc', PERKS[k], 'desc', true); }
  for (const k in INFINITE) add('perks', INFINITE[k], 'name');
  for (const a of Object.values(ARTIFACTS)) { add('arts', a, 'name'); add('adesc', a, 'desc'); }
  for (const a of Object.values(ACTIVES)) { add('acts', a, 'name'); add('actdesc', a, 'desc'); }
  for (const a of Object.values(ANOMALIES)) add('anoms', a, 'name');
  for (const e of Object.values(ENEMIES)) add('enemies', e, 'name');
  for (const e of Object.values(EVENTS)) { add('events', e, 'name'); add('evdesc', e, 'desc'); }
  for (const s of STAGES) { add('stages', s, 'name'); add('sdesc', s, 'desc'); add('stages', s.final, 'name'); }
  for (const k in STAGE_WORLD) { for (const r of STAGE_WORLD[k].regions) add('regions', r, 'name'); for (const s of STAGE_WORLD[k].spawns) { add('regions', s, 'name'); add('spdesc', s, 'desc'); } }
  for (const c of CHARACTERS) { add('chars', c, 'name'); add('cdesc', c, 'desc'); }
  for (const i of Object.values(ITEMS)) { add('items', i, 'name'); add('idesc', i, 'desc'); }
  for (const t of Object.values(TAGS)) { add('tags', t, 'name'); add('tagd', t, 'b3'); add('tagd', t, 'b6'); }
  for (const w of Object.values(WEATHER)) { add('weather', w, 'name'); add('weather', w, 'desc'); }
  for (const d of DIFFICULTIES) { add('diff', d, 'name'); add('diff', d, 'desc'); }
  for (const m of META) { add('meta', m, 'name'); add('meta', m, 'desc'); }
  for (const s of SUITS) { add('suits', s, 'name'); add('suits', s, 'desc'); }
  for (const m of MUTATIONS2) { add('muts', m, 'name'); add('muts', m, 'desc'); }
  for (const s of SKILLS) { add('skills', s, 'name'); add('skills', s, 'desc'); }
  for (const a of ACHIEVEMENTS) { add('ach', a, 'name'); add('ach', a, 'desc'); }
  for (const k in HINTS) add('hints', HINTS, k);
  for (const m of MUTATORS) { add('mut', m, 'name'); add('mut', m, 'desc'); }
  for (const m of MODES2) { add('modes', m, 2); add('modes', m, 3); }
  if (typeof TALENTS !== 'undefined') for (const t of Object.values(TALENTS)) { add('talents', t, 'name'); for (const n of t.nodes || []) { add('talents', n, 0); add('talents', n, 1); } }
  if (typeof ELITE_AFFIX !== 'undefined') for (const a of Object.values(ELITE_AFFIX)) add('affix', a, 'name');
  if (typeof MUTATIONS !== 'undefined') for (const a of Object.values(MUTATIONS)) add('mutations', a, 'name');
  return G2;
}
const numKey = (s) => String(s).replace(/\d+(\.\d+)?/g, '#');
const I18n = {
  cur: 'en', dict: null, norm: null, terms: null,
  // one dictionary for every language: english → {ka, ru, uk}
  build() {
    if (this.dict) return;
    const D = new Map(), N = new Map(), groups = i18nGroups();
    for (const g in groups) {
      const T = TRG[g]; if (!T) continue;
      const seen = []; // unique english strings in first-seen order, like the extraction
      for (const it of groups[g]) { const en = it.isFn ? (() => { try { return (it.o._enDesc || it.o.desc)(1); } catch (e) { return null; } })() : (it.o['_en_' + it.f] !== undefined ? it.o['_en_' + it.f] : it.o[it.f]); if (en && !seen.includes(en)) seen.push(en); }
      // lists are paired by position; content added later is appended, so a shorter list still pairs its prefix
      for (const L of I18N_LANGS) if (T[L] && T[L].length > seen.length) console.warn('[i18n] ' + g + '/' + L + ': ' + T[L].length + ' vs ' + seen.length);
      seen.forEach((en, i) => { const tr = {}; for (const L of I18N_LANGS) if (T[L] && T[L].length <= seen.length && i < T[L].length) tr[L] = T[L][i]; D.set(en, tr); N.set(numKey(en), { tr, en }); });
    }
    for (const [en, tr] of Object.entries(UI_TR)) { D.set(en, tr); N.set(numKey(en), { tr, en }); }
    this.upper = new Map(); for (const [en, tr] of D) { const u = en.toUpperCase(); if (u !== en && !D.has(u)) { const o = {}; for (const L of I18N_LANGS) if (tr[L]) o[L] = tr[L].toUpperCase(); this.upper.set(u, o); } }
    this.dict = D; this.norm = N;
    // names used inside longer texts (bosses, regions, artifacts...), longest first
    const T = []; for (const g of ['enemies', 'regions', 'arts', 'weapons', 'stages', 'anoms', 'events', 'items', 'chars']) for (const it of groups[g] || []) { const en = it.o[it.f]; if (en && en.length > 2 && D.get(en)) T.push(en); }
    this.terms = [...new Set(T)].sort((a, b) => b.length - a.length);
  },
  // translate one string: exact → same words with other numbers → names swapped inside
  t(s, L = this.cur) {
    if (!s || L === 'en' || typeof s !== 'string') return s;
    const d = this.dict.get(s); if (d && d[L]) return d[L];
    if (this.upper && /[A-Z]/.test(s) && s === s.toUpperCase()) { const u = this.upper.get(s); if (u && u[L]) return u[L]; }
    const n = this.norm.get(numKey(s));
    if (n && n.tr[L]) { const nums = s.match(/\d+(\.\d+)?/g) || []; let i = 0; return n.tr[L].replace(/\d+(\.\d+)?/g, (m) => (nums[i] !== undefined ? nums[i++] : m)); }
    const ep = s.match(/^[^\p{L}\p{N}]+/u); if (ep && ep[0].length < s.length) { const rest = s.slice(ep[0].length), r = this.t(rest, L); if (r !== rest && !/[A-Za-z]{3}/.test(r.replace(/\b[A-Z0-9-]{2,6}\b/g, ''))) return ep[0] + r; }
    for (const [re, tr] of UI_PATTERNS) { const m = s.match(re); if (m && tr[L]) return tr[L].replace(/\$(\d)/g, (_, k) => this.t(m[k] || '', L)); }
    const pre = s.match(/^[^\p{L}]+/u);
    if (pre && pre[0].length < s.length && !/\d$/.test(pre[0].trim())) return pre[0] + this.t(s.slice(pre[0].length), L);
    if (pre && /🔗\d\/\d\s$/u.test(pre[0])) return pre[0] + this.t(s.slice(pre[0].length), L);
    return this.names(s, L);
  },
  names(s, L) {
    if (!s || !this.terms) return s;
    let out = s;
    for (const en of this.terms) {
      const tr = this.dict.get(en)[L]; if (!tr) continue;
      if (out.includes(en)) out = out.split(en).join(tr);
      const up = en.toUpperCase(); if (up !== en && out.includes(up)) out = out.split(up).join(tr.toUpperCase());
    }
    return out;
  },
  apply(L) {
    this.build(); if (this.cache) this.cache.clear();
    L = I18N_LANGS.includes(L) ? L : 'en'; this.cur = L;
    const groups = i18nGroups();
    for (const g in groups) for (const it of groups[g]) {
      const o = it.o;
      if (it.isFn) { if (!o._enDesc) o._enDesc = o.desc; o.desc = L === 'en' ? o._enDesc : (m) => I18n.t(o._enDesc(m), L); continue; }
      const k = '_en_' + it.f; if (o[k] === undefined) Object.defineProperty(o, k, { value: o[it.f], enumerable: false, writable: true });
      o[it.f] = L === 'en' ? o[k] : this.t(o[k], L);
    }
    for (const m of META) if (typeof m.desc === 'function') { if (!m._enDesc) m._enDesc = m.desc; m.desc = L === 'en' ? m._enDesc : (...a) => I18n.t(m._enDesc(...a), L); }
    this.dom(document.body);
    if (typeof applyLang === 'function') try { applyLang(); } catch (e) { /* menus not built yet */ }
  },
  // translate visible UI text (keeps the English original on each text node)
  dom(root) {
    if (!root || !this.dict) return;
    const L = this.cur, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = w.nextNode())) {
      const raw = n.nodeValue, t = raw.trim(); if (!t || !/[a-z]/i.test(t) && n._en === undefined) continue;
      if (n._en !== undefined && n._tr !== raw) n._en = undefined; // the game rewrote this text
      if (n._en === undefined) { if (!/[a-z]/i.test(t)) continue; n._en = raw; }
      const src = n._en.trim(), out = L === 'en' ? src : this.t(src, L);
      const v = n._en.replace(src, out); if (v !== raw) n.nodeValue = v; n._tr = n.nodeValue;
    }
    for (const el of root.querySelectorAll ? [root, ...root.querySelectorAll('[title],[data-tip]')] : []) for (const a of ['title', 'data-tip']) { // tooltips
      const v = el.getAttribute(a); if (!v) continue; const key = 'en' + a.replace('-', ''); if (el.dataset[key] === undefined || (v !== el.dataset[key] && v !== el.dataset[key + 'T'])) el.dataset[key] = v;
      const out = L === 'en' ? el.dataset[key] : this.t(el.dataset[key], L); el.dataset[key + 'T'] = out; if (v !== out) el.setAttribute(a, out);
    }
    for (const el of root.querySelectorAll ? [root, ...root.querySelectorAll('[placeholder]')].filter((x) => x.hasAttribute && x.hasAttribute('placeholder')) : []) { // input hints too
      if (el.dataset.enPh === undefined) el.dataset.enPh = el.placeholder;
      const en = el.dataset.enPh, out = L === 'en' ? en : this.t(en, L); if (el.placeholder !== out) el.placeholder = out;
    }
  },
};
// ----- interface strings: [ka, ru, uk] -----
const U = (ka, ru, uk) => ({ ka, ru, uk });
const UI_TR = {
  'survived': U('გადარჩა', 'выжито', 'виживання'), 'level': U('დონე', 'уровень', 'рівень'), 'kills': U('მკვლელობა', 'убийств', 'вбивств'), 'artifacts': U('არტეფაქტები', 'артефакты', 'артефакти'), 'contracts': U('კონტრაქტები', 'заказы', 'замовлення'), 'best': U('რეკორდი', 'рекорд', 'рекорд'),
  'VICTORY': U('გამარჯვება', 'ПОБЕДА', 'ПЕРЕМОГА'), 'YOU DIED': U('შენ მოკვდი', 'ВЫ ПОГИБЛИ', 'ВИ ЗАГИНУЛИ'), 'RUN ABANDONED': U('თამაში მიტოვებულია', 'ЗАБЕГ ПРЕРВАН', 'ЗАБІГ ПЕРЕРВАНО'),
  'TRY AGAIN': U('თავიდან', 'ЕЩЁ РАЗ', 'ЩЕ РАЗ'), 'BUNKER / MENU': U('ბუნკერი / მენიუ', 'БУНКЕР / МЕНЮ', 'БУНКЕР / МЕНЮ'), '♾ KEEP GOING (ENDLESS)': U('♾ გაგრძელება (უსასრულო)', '♾ ПРОДОЛЖИТЬ (БЕСКОНЕЧНО)', '♾ ПРОДОВЖИТИ (НЕСКІНЧЕННО)'),
  'PAUSED': U('პაუზა', 'ПАУЗА', 'ПАУЗА'), 'RESUME': U('გაგრძელება', 'ПРОДОЛЖИТЬ', 'ПРОДОВЖИТИ'), 'SETTINGS': U('პარამეტრები', 'НАСТРОЙКИ', 'НАЛАШТУВАННЯ'), 'ABANDON RUN': U('თამაშის მიტოვება', 'ПРЕРВАТЬ ЗАБЕГ', 'ПЕРЕРВАТИ ЗАБІГ'), '💾 SAVE & QUIT': U('💾 შენახვა და გასვლა', '💾 СОХРАНИТЬ И ВЫЙТИ', '💾 ЗБЕРЕГТИ Й ВИЙТИ'), '🐞 REPORT BUG': U('🐞 შეცდომის შეტყობინება', '🐞 СООБЩИТЬ ОБ ОШИБКЕ', '🐞 ПОВІДОМИТИ ПРО ПОМИЛКУ'),
  'LEVEL UP!': U('ახალი დონე!', 'НОВЫЙ УРОВЕНЬ!', 'НОВИЙ РІВЕНЬ!'), 'Choose an upgrade': U('აირჩიე გაუმჯობესება', 'Выбери улучшение', 'Обери покращення'), 'REROLL': U('გადარჩევა', 'ПЕРЕБРАТЬ', 'ПЕРЕОБРАТИ'), 'NEW': U('ახალი', 'НОВОЕ', 'НОВЕ'), 'EVOLUTION': U('ევოლუცია', 'ЭВОЛЮЦИЯ', 'ЕВОЛЮЦІЯ'), 'MASTERY': U('ოსტატობა', 'МАСТЕРСТВО', 'МАЙСТЕРНІСТЬ'), 'Common': U('ჩვეულებრივი', 'Обычная', 'Звичайна'), 'Rare': U('იშვიათი', 'Редкая', 'Рідкісна'), 'Epic': U('ეპიკური', 'Эпическая', 'Епічна'), 'Legendary': U('ლეგენდარული', 'Легендарная', 'Легендарна'),
  'ECHO DETECTOR': U('ექო-დეტექტორი', 'ДЕТЕКТОР «ЭХО»', 'ДЕТЕКТОР «ЕХО»'), 'danger': U('საფრთხე', 'опасность', 'небезпека'), 'Find an artifact': U('იპოვე არტეფაქტი', 'Найди артефакт', 'Знайди артефакт'), 'READY': U('მზადაა', 'ГОТОВО', 'ГОТОВО'),
  'Dynamic Score': U('დინამიური მუსიკა', 'Динамическая музыка', 'Динамічна музика'), 'SHELTER': U('თავშესაფარი', 'УКРЫТИЕ', 'УКРИТТЯ'),
  'PERMANENT UPGRADES · EARN RUBLES FROM EVERY RUN': U('მუდმივი გაუმჯობესებები · მიიღე რუბლები ყოველი თამაშიდან', 'ПОСТОЯННЫЕ УЛУЧШЕНИЯ · РУБЛИ ЗА КАЖДЫЙ ЗАБЕГ', 'ПОСТІЙНІ ПОКРАЩЕННЯ · КАРБОВАНЦІ ЗА КОЖЕН ЗАБІГ'),
  'New stalkers can be bought on the PLAY screen.': U('ახალი სტალკერების ყიდვა შეგიძლია თამაშის ეკრანზე.', 'Новых сталкеров можно купить на экране ИГРАТЬ.', 'Нових сталкерів можна купити на екрані ГРАТИ.'),
  'SAVED RUNS': U('შენახული თამაშები', 'СОХРАНЁННЫЕ ЗАБЕГИ', 'ЗБЕРЕЖЕНІ ЗАБІГИ'), 'PROFILES': U('პროფილები', 'ПРОФИЛИ', 'ПРОФІЛІ'), 'CO-OP': U('თანამშრომლობა', 'КООПЕРАТИВ', 'КООПЕРАТИВ'), '👥 CO-OP': U('👥 თანამშრომლობა', '👥 КООПЕРАТИВ', '👥 КООПЕРАТИВ'),
  'Your name': U('შენი სახელი', 'Твоё имя', 'Твоє ім\'я'), 'Your stalker': U('შენი სტალკერი', 'Твой сталкер', 'Твій сталкер'), 'Stage': U('ეტაპი', 'Локация', 'Локація'), 'Start point': U('საწყისი წერტილი', 'Точка старта', 'Точка старту'), 'Difficulty': U('სირთულე', 'Сложность', 'Складність'), 'Crew': U('გუნდი', 'Отряд', 'Загін'),
  'HOST A ROOM': U('ოთახის შექმნა', 'СОЗДАТЬ КОМНАТУ', 'СТВОРИТИ КІМНАТУ'), 'JOIN A FRIEND': U('მეგობართან შეერთება', 'ПРИСОЕДИНИТЬСЯ К ДРУГУ', 'ПРИЄДНАТИСЯ ДО ДРУГА'), '🏠 CREATE ROOM': U('🏠 ოთახის შექმნა', '🏠 СОЗДАТЬ КОМНАТУ', '🏠 СТВОРИТИ КІМНАТУ'), '🔗 JOIN': U('🔗 შეერთება', '🔗 ВОЙТИ', '🔗 УВІЙТИ'), '📋 COPY LINK': U('📋 ბმულის კოპირება', '📋 КОПИРОВАТЬ ССЫЛКУ', '📋 КОПІЮВАТИ ПОСИЛАННЯ'), '🚪 LEAVE ROOM': U('🚪 ოთახის დატოვება', '🚪 ПОКИНУТЬ КОМНАТУ', '🚪 ПОКИНУТИ КІМНАТУ'), '👍 I\'M READY': U('👍 მზად ვარ', '👍 Я ГОТОВ', '👍 Я ГОТОВИЙ'),
  'Password (optional)': U('პაროლი (არასავალდებულო)', 'Пароль (необязательно)', 'Пароль (необов\'язково)'), '➕ NEW CREW': U('➕ ახალი გუნდი', '➕ НОВЫЙ ОТРЯД', '➕ НОВИЙ ЗАГІН'), '🏠 HOST': U('🏠 მასპინძლობა', '🏠 СОЗДАТЬ', '🏠 СТВОРИТИ'),
  'YOUR CREWS · co-op progress you share with your teammates': U('შენი გუნდები · პროგრესი, რომელსაც თანაგუნდელებთან იზიარებ', 'ТВОИ ОТРЯДЫ · общий прогресс с напарниками', 'ТВОЇ ЗАГОНИ · спільний прогрес із напарниками'),
  'Voice acting': U('გახმოვანება', 'Озвучка', 'Озвучення'), '🔊 Test voice': U('🔊 ხმის შემოწმება', '🔊 Проверить голос', '🔊 Перевірити голос'), 'Vibration (phones)': U('ვიბრაცია (ტელეფონი)', 'Вибрация (телефоны)', 'Вібрація (телефони)'), 'Compact phone HUD': U('კომპაქტური ინტერფეისი', 'Компактный интерфейс', 'Компактний інтерфейс'), 'Minimap arrows': U('ისრები მინი-რუკაზე', 'Стрелки на миникарте', 'Стрілки на мінімапі'), 'Night darkness': U('ღამის სიბნელე', 'Темнота ночью', 'Темрява вночі'), 'Main objective arrow': U('მთავარი მიზნის ისარი', 'Стрелка главной цели', 'Стрілка головної мети'),
  'CONTROLS · click a key to change it': U('მართვა · დააჭირე ღილაკს შესაცვლელად', 'УПРАВЛЕНИЕ · нажми на клавишу, чтобы сменить', 'КЕРУВАННЯ · натисни клавішу, щоб змінити'), 'Reset keys': U('ღილაკების აღდგენა', 'Сбросить клавиши', 'Скинути клавіші'), '⛶ Toggle fullscreen': U('⛶ სრული ეკრანი', '⛶ Полный экран', '⛶ Повний екран'), '🐞 Report a bug': U('🐞 შეცდომის შეტყობინება', '🐞 Сообщить об ошибке', '🐞 Повідомити про помилку'), 'Replay tutorial hints': U('მინიშნებების ხელახლა ჩვენება', 'Показать подсказки заново', 'Показати підказки знову'),
  'Move up': U('ზემოთ', 'Вверх', 'Вгору'), 'Move down': U('ქვემოთ', 'Вниз', 'Вниз'), 'Move left': U('მარცხნივ', 'Влево', 'Вліво'), 'Move right': U('მარჯვნივ', 'Вправо', 'Вправо'), 'Dash': U('ნახტომი', 'Рывок', 'Ривок'), 'Artifact power': U('არტეფაქტის ძალა', 'Сила артефакта', 'Сила артефакту'), 'Next artifact': U('შემდეგი არტეფაქტი', 'Следующий артефакт', 'Наступний артефакт'), 'Previous artifact': U('წინა არტეფაქტი', 'Предыдущий артефакт', 'Попередній артефакт'), 'Ride / get off': U('ჩაჯდომა / ჩამოსვლა', 'Сесть / слезть', 'Сісти / злізти'), 'Throw bolt': U('ჭანჭიკის სროლა', 'Бросить болт', 'Кинути болт'), 'Map': U('რუკა', 'Карта', 'Мапа'), 'Pause': U('პაუზა', 'Пауза', 'Пауза'), 'Next radio station': U('შემდეგი რადიოსადგური', 'Следующая радиостанция', 'Наступна радіостанція'), 'Previous radio station': U('წინა რადიოსადგური', 'Предыдущая радиостанция', 'Попередня радіостанція'),
  'TAP OR PRESS M TO CLOSE': U('შეეხე ან დააჭირე M-ს დასახურად', 'НАЖМИ ИЛИ M, ЧТОБЫ ЗАКРЫТЬ', 'ТОРКНИСЬ АБО M, ЩОБ ЗАКРИТИ'), 'You': U('შენ', 'Ты', 'Ти'), 'Shelter': U('თავშესაფარი', 'Укрытие', 'Укриття'), 'Lab': U('ლაბორატორია', 'Лаборатория', 'Лабораторія'), 'Contract': U('კონტრაქტი', 'Заказ', 'Замовлення'), 'Lair': U('ბუნაგი', 'Логово', 'Лігво'), 'Start': U('დასაწყისი', 'Старт', 'Старт'),
  'CONTRACT COMPLETE': U('კონტრაქტი შესრულდა', 'ЗАКАЗ ВЫПОЛНЕН', 'ЗАМОВЛЕННЯ ВИКОНАНО'), 'CONTRACT FAILED': U('კონტრაქტი ჩაიშალა', 'ЗАКАЗ ПРОВАЛЕН', 'ЗАМОВЛЕННЯ ПРОВАЛЕНО'), 'RUN RESTORED': U('თამაში აღდგენილია', 'ЗАБЕГ ВОССТАНОВЛЕН', 'ЗАБІГ ВІДНОВЛЕНО'), '🌙 NIGHT FALLS': U('🌙 ღამდება', '🌙 НАСТУПАЕТ НОЧЬ', '🌙 НАСТАЄ НІЧ'), 'More mutants roam in the dark.': U('სიბნელეში მეტი მუტანტი დაძრწის.', 'В темноте бродит больше мутантов.', 'У темряві блукає більше мутантів.'),
  'Retrieve an artifact': U('მოიპოვე არტეფაქტი', 'Добудь артефакт', 'Здобудь артефакт'), 'Kill 2 elite mutants': U('მოკალი 2 ელიტური მუტანტი', 'Убей 2 элитных мутантов', 'Вбий 2 елітних мутантів'), 'Rescue a wounded stalker': U('გადაარჩინე დაჭრილი სტალკერი', 'Спаси раненого сталкера', 'Врятуй пораненого сталкера'), 'Escort the scientist to the shelter': U('გააცილე მეცნიერი თავშესაფრამდე', 'Проводи учёного до укрытия', 'Проведи вченого до укриття'), 'Guard the scientist\'s measurement': U('დაიცავი მეცნიერის გაზომვა', 'Охраняй замеры учёного', 'Охороняй вимірювання вченого'), 'Find the missing stalker: follow the clues': U('იპოვე დაკარგული სტალკერი: მიჰყევი კვალს', 'Найди пропавшего сталкера: иди по следам', 'Знайди зниклого сталкера: іди за слідами'), 'Pick up the package': U('აიღე ამანათი', 'Забери посылку', 'Забери посилку'), 'Put out the fires at the camp': U('ჩააქრე ხანძრები ბანაკში', 'Потуши пожары в лагере', 'Загаси пожежі в таборі'), 'Restore power: flip 3 fuse boxes': U('აღადგინე დენი: ჩართე 3 მცველის ყუთი', 'Восстанови питание: включи 3 щитка', 'Віднови живлення: увімкни 3 щитки'), 'Repair 2 radio antennas for map intel': U('შეაკეთე 2 რადიოანტენა რუკის მონაცემებისთვის', 'Почини 2 антенны ради данных для карты', 'Полагодь 2 антени заради даних для мапи'), 'Download PDA data from 3 dead stalkers': U('ჩამოტვირთე PDA-ს მონაცემები 3 მკვდარი სტალკერისგან', 'Скачай данные ПДА с 3 мёртвых сталкеров', 'Завантаж дані ПДА з 3 мертвих сталкерів'), 'Climb the watchtower without taking damage': U('ადი საგუშაგო კოშკზე ზიანის გარეშე', 'Поднимись на вышку, не получив урона', 'Піднімись на вежу, не отримавши шкоди'), 'Clear the village overrun by zombies': U('გაწმინდე ზომბებით სავსე სოფელი', 'Зачисти деревню от зомби', 'Зачисть село від зомбі'), 'Race through 5 checkpoints': U('გაიარე 5 საკონტროლო წერტილი', 'Пробеги 5 контрольных точек', 'Пробіжи 5 контрольних точок'), 'Find the keycard and open the sealed vault': U('იპოვე საკვანძო ბარათი და გახსენი საცავი', 'Найди ключ-карту и открой хранилище', 'Знайди ключ-картку й відкрий сховище'), 'Repair the escape jeep: find 3 parts': U('შეაკეთე გასაქცევი ჯიპი: იპოვე 3 დეტალი', 'Почини джип для побега: найди 3 детали', 'Полагодь джип для втечі: знайди 3 деталі'), 'Bring the parts back to the jeep': U('მიიტანე დეტალები ჯიპთან', 'Принеси детали к джипу', 'Принеси деталі до джипа'),
};
Object.assign(UI_TR, {
  'COMMON': U('ჩვეულებრივი', 'ОБЫЧНАЯ', 'ЗВИЧАЙНА'), 'RARE': U('იშვიათი', 'РЕДКАЯ', 'РІДКІСНА'), 'EPIC': U('ეპიკური', 'ЭПИЧЕСКАЯ', 'ЕПІЧНА'), 'LEGENDARY': U('ლეგენდარული', 'ЛЕГЕНДАРНАЯ', 'ЛЕГЕНДАРНА'),
  'NEW WEAPON': U('ახალი იარაღი', 'НОВОЕ ОРУЖИЕ', 'НОВА ЗБРОЯ'), 'NEW PERK': U('ახალი უნარი', 'НОВЫЙ НАВЫК', 'НОВА НАВИЧКА'), 'LIMITLESS': U('უსასრულო', 'БЕЗ ПРЕДЕЛА', 'БЕЗ МЕЖІ'), 'SUPPLY': U('მარაგი', 'ПРИПАСЫ', 'ПРИПАСИ'),
  'CHOOSE AN UPGRADE': U('აირჩიე გაუმჯობესება', 'ВЫБЕРИ УЛУЧШЕНИЕ', 'ОБЕРИ ПОКРАЩЕННЯ'), 'LEVEL UP': U('ახალი დონე', 'НОВЫЙ УРОВЕНЬ', 'НОВИЙ РІВЕНЬ'), '🎲 REROLL': U('🎲 გადარჩევა', '🎲 ПЕРЕБРАТЬ', '🎲 ПЕРЕОБРАТИ'), 'TALENT POINT': U('ტალანტის ქულა', 'ОЧКО ТАЛАНТА', 'ОЧКО ТАЛАНТУ'),
  'Strelok\'s Trail': U('სტრელოკის კვალი', 'След Стрелка', 'Слід Стрільця'), 'The Dead City': U('მკვდარი ქალაქი', 'Мёртвый город', 'Мертве місто'), 'The Wish': U('სურვილი', 'Желание', 'Бажання'), 'Operation Fairway': U('ოპერაცია „ფარვატერი“', 'Операция «Фарватер»', 'Операція «Фарватер»'), 'Scorched Earth': U('დამწვარი მიწა', 'Выжженная земля', 'Випалена земля'), 'Into the Dark': U('სიბნელეში', 'Во тьму', 'У темряву'), 'Lights Out': U('შუქი ჩაქრა', 'Свет погас', 'Світло згасло'), 'Frostbite': U('მოყინვა', 'Обморожение', 'Обмороження'), 'The Last Climb': U('ბოლო ასვლა', 'Последнее восхождение', 'Останнє сходження'), 'Main quest': U('მთავარი დავალება', 'Главный квест', 'Головне завдання'),
  'Find your first artifact': U('იპოვე პირველი არტეფაქტი', 'Найди свой первый артефакт', 'Знайди свій перший артефакт'), 'Climb a watchtower or activate a radio tower': U('ადი საგუშაგო კოშკზე ან ჩართე რადიოანძა', 'Поднимись на вышку или включи радиовышку', 'Піднімись на вежу або ввімкни радіовежу'), 'Clear a point of interest': U('გაწმინდე საინტერესო ადგილი', 'Зачисти важную точку', 'Зачисть важливу точку'), 'Descend into a laboratory': U('ჩადი ლაბორატორიაში', 'Спустись в лабораторию', 'Спустись у лабораторію'), 'Defeat the stage\'s final boss': U('დაამარცხე ეტაპის ფინალური ბოსი', 'Победи финального босса локации', 'Перемож фінального боса локації'),
});
// weapon level-up lines and points of interest
Object.assign(UI_TR, {
  '+Damage': U('+ზიანი', '+Урон', '+Шкода'), 'Fires 2 bullets': U('ისვრის 2 ტყვიას', 'Стреляет 2 пулями', 'Стріляє 2 кулями'), 'Bullets pierce 1': U('ტყვიები ხვრეტს 1-ს', 'Пули пробивают 1 цель', 'Кулі пробивають 1 ціль'), 'Fires 3 bullets': U('ისვრის 3 ტყვიას', 'Стреляет 3 пулями', 'Стріляє 3 кулями'),
  'Rapid fire + damage': U('სწრაფი სროლა + ზიანი', 'Скорострельность + урон', 'Скорострільність + шкода'), '+Fire rate': U('+სროლის სიჩქარე', '+Скорострельность', '+Скорострільність'), 'Twin barrels': U('ორლულიანი', 'Два ствола', 'Два стволи'), 'Armor-piercing rounds': U('ჯავშანგამხვრეტი ტყვიები', 'Бронебойные патроны', 'Бронебійні набої'),
  '+2 pellets': U('+2 საფანტი', '+2 дробины', '+2 дробини'), 'Faster reload': U('სწრაფი გადატენვა', 'Быстрая перезарядка', 'Швидке перезаряджання'), '360° blast': U('360° აფეთქება', 'Залп на 360°', 'Залп на 360°'), '+Blast radius': U('+აფეთქების რადიუსი', '+Радиус взрыва', '+Радіус вибуху'),
  'Throw 2': U('ისვრის 2-ს', 'Бросок по 2', 'Кидок по 2'), 'Faster throws': U('სწრაფი სროლა', 'Быстрые броски', 'Швидкі кидки'), 'Throw 3': U('ისვრის 3-ს', 'Бросок по 3', 'Кидок по 3'), '+1 bounce': U('+1 ასხლეტა', '+1 рикошет', '+1 рикошет'),
  'Wider beam': U('ფართო სხივი', 'Шире луч', 'Ширший промінь'), 'Faster charge': U('სწრაფი დამუხტვა', 'Быстрый заряд', 'Швидкий заряд'), 'Double beam': U('ორმაგი სხივი', 'Двойной луч', 'Подвійний промінь'), '+Reach': U('+მანძილი', '+Досягаемость', '+Досяжність'),
  'Faster slashes': U('სწრაფი დარტყმები', 'Быстрые удары', 'Швидкі удари'), 'Whirlwind: full circle': U('გრიგალი: სრული წრე', 'Вихрь: полный круг', 'Вихор: повне коло'), 'Fires 2 bolts': U('ისვრის 2 ისარს', 'Стреляет 2 болтами', 'Стріляє 2 болтами'), 'Fires 3 bolts': U('ისვრის 3 ისარს', 'Стреляет 3 болтами', 'Стріляє 3 болтами'),
  '+Range': U('+მანძილი', '+Дальность', '+Дальність'), 'Wider cone': U('ფართო კონუსი', 'Шире конус', 'Ширший конус'), '+Burn': U('+წვა', '+Горение', '+Горіння'), 'Inferno': U('ჯოჯოხეთი', 'Инферно', 'Інферно'),
  '+Radius': U('+რადიუსი', '+Радиус', '+Радіус'), 'Plant 2': U('დგამს 2-ს', 'Ставит 2', 'Ставить 2'), 'Faster planting': U('სწრაფი დადგმა', 'Быстрая установка', 'Швидке встановлення'), 'Plant 3': U('დგამს 3-ს', 'Ставит 3', 'Ставить 3'),
  'Longer flight': U('გრძელი ფრენა', 'Дольше полёт', 'Довший політ'), '+Pierce': U('+გამხვრეტა', '+Пробивание', '+Пробиття'), 'Faster bolt action': U('სწრაფი საკეტი', 'Быстрый затвор', 'Швидкий затвор'), 'Headshots always crit': U('თავში სროლა ყოველთვის კრიტია', 'Выстрел в голову — всегда крит', 'Постріл у голову — завжди крит'),
  'Pierce 1': U('ხვრეტს 1-ს', 'Пробивает 1', 'Пробиває 1'), 'Four targets': U('ოთხი სამიზნე', 'Четыре цели', 'Чотири цілі'), '+Puddle size': U('+გუბის ზომა', '+Размер лужи', '+Розмір калюжі'), 'Fire 2': U('ისვრის 2-ს', 'Выстрел по 2', 'Постріл по 2'),
  'Longer puddles': U('გრძელი გუბეები', 'Дольше лужи', 'Довші калюжі'), 'Fire 3': U('ისვრის 3-ს', 'Выстрел по 3', 'Постріл по 3'), '+1 jump': U('+1 ნახტომი', '+1 прыжок', '+1 стрибок'), 'Overcharge': U('გადამუხტვა', 'Перегрузка', 'Перевантаження'),
  '+Pull': U('+მიზიდვა', '+Притяжение', '+Притягання'), 'Bigger core': U('დიდი ბირთვი', 'Больше ядро', 'Більше ядро'), 'Faster': U('უფრო სწრაფი', 'Быстрее', 'Швидше'), 'Twin orbs': U('ორი სფერო', 'Две сферы', 'Дві сфери'),
  'Faster swings': U('სწრაფი მოქნევა', 'Быстрые взмахи', 'Швидкі помахи'), 'Double spin': U('ორმაგი ბრუნვა', 'Двойное вращение', 'Подвійне обертання'), 'Second drone': U('მეორე დრონი', 'Второй дрон', 'Другий дрон'), 'Third drone': U('მესამე დრონი', 'Третий дрон', 'Третій дрон'),
  'Longer lifetime': U('გრძელი სიცოცხლე', 'Дольше живёт', 'Довше живе'), 'Two turrets': U('ორი ტურელი', 'Две турели', 'Дві турелі'), 'Rocket turret': U('სარაკეტო ტურელი', 'Ракетная турель', 'Ракетна турель'), '+Stun': U('+გაბრუება', '+Оглушение', '+Оглушення'),
  'Faster tolls': U('სწრაფი რეკვა', 'Быстрее звон', 'Швидший дзвін'), 'Echo toll': U('ექო რეკვა', 'Эхо звона', 'Відлуння дзвону'), 'Two rockets': U('ორი რაკეტა', 'Две ракеты', 'Дві ракети'), 'More traps': U('მეტი ხაფანგი', 'Больше ловушек', 'Більше пасток'),
  'Longer hold': U('გრძელი დაკავება', 'Дольше удержание', 'Довше утримання'), 'Explosive traps': U('ფეთქებადი ხაფანგები', 'Взрывные ловушки', 'Вибухові пастки'), '+Zone damage': U('+ზონის ზიანი', '+Урон зоны', '+Шкода зони'), '+Zone size': U('+ზონის ზომა', '+Размер зоны', '+Розмір зони'),
  'Longer zones': U('გრძელი ზონები', 'Дольше зоны', 'Довші зони'), 'Twin shots': U('ორმაგი გასროლა', 'Двойные выстрелы', 'Подвійні постріли'), '+Freeze time': U('+გაყინვის დრო', '+Время заморозки', '+Час заморожування'), 'Shatter: frozen take +50%': U('დამსხვრევა: გაყინულები +50%-ს იღებენ', 'Раскол: замороженные получают +50%', 'Розкол: заморожені отримують +50%'),
  '+Area': U('+არე', '+Площадь', '+Площа'), 'Longer burn': U('გრძელი წვა', 'Дольше горение', 'Довше горіння'), '+2 rockets': U('+2 რაკეტა', '+2 ракеты', '+2 ракети'), '+4 rockets': U('+4 რაკეტა', '+4 ракеты', '+4 ракети'),
  'Faster riffs': U('სწრაფი რიფები', 'Быстрые риффы', 'Швидкі рифи'), '+Knockback': U('+უკუგდება', '+Отбрасывание', '+Відкидання'), 'Encore: double chord': U('ბისი: ორმაგი აკორდი', 'На бис: двойной аккорд', 'На біс: подвійний акорд'),
  'Military Checkpoint': U('სამხედრო საგუშაგო', 'Военный блокпост', 'Військовий блокпост'), 'Crashed Helicopter': U('ჩამოვარდნილი ვერტმფრენი', 'Разбитый вертолёт', 'Розбитий гелікоптер'), 'Bandit Camp': U('ბანდიტების ბანაკი', 'Лагерь бандитов', 'Табір бандитів'), 'Mutant Nest': U('მუტანტების ბუდე', 'Гнездо мутантов', 'Гніздо мутантів'),
  'Abandoned Science Camp': U('მიტოვებული მეცნიერთა ბანაკი', 'Заброшенный лагерь учёных', 'Покинутий табір науковців'), 'Downed Mi-24': U('ჩამოგდებული Mi-24', 'Сбитый Ми-24', 'Збитий Мі-24'), 'Loner Hideout': U('მარტოხელების თავშესაფარი', 'Укрытие одиночек', 'Схованка одинаків'),
});
// stages added after the big translation pass (Volcanic, Flooded Pripyat, Duga, Noosphere, metro, seasons)
Object.assign(UI_TR, {
  'Flooded Pripyat': U('დატბორილი პრიპიატი', 'Затопленная Припять', 'Затоплена Прип\'ять'), 'The city is under water. Take a boat — mutants swim here.': U('ქალაქი წყლის ქვეშაა. აიღე ნავი — მუტანტები აქ ცურავენ.', 'Город под водой. Садись в лодку — мутанты здесь плавают.', 'Місто під водою. Сідай у човен — мутанти тут плавають.'),
  'Volcanic Zone': U('ვულკანური ზონა', 'Вулканическая Зона', 'Вулканічна Зона'), 'Lava rivers, erupting pools and falling volcanic bombs.': U('ლავის მდინარეები, ამოფრქვეული ტბორები და ვულკანური ბომბები.', 'Реки лавы, извергающиеся озёра и вулканические бомбы.', 'Річки лави, вивержні озера й вулканічні бомби.'),
  'Duga Radar': U('რადარი „დუგა“', 'Радар «Дуга»', 'Радар «Дуга»'), 'The giant radar. Descend its 3-floor bunker and silence it.': U('გიგანტური რადარი. ჩადი მის 3-სართულიან ბუნკერში და გააჩუმე.', 'Гигантский радар. Спустись в его 3-этажный бункер и заглуши его.', 'Гігантський радар. Спустись у його 3-поверховий бункер і заглуши його.'),
  'Noosphere': U('ნოოსფერო', 'Ноосфера', 'Ноосфера'), 'A dream beyond the Zone. Low gravity, stars and psi storms.': U('სიზმარი ზონის მიღმა. დაბალი გრავიტაცია, ვარსკვლავები და ფსი-ქარიშხლები.', 'Сон за пределами Зоны. Слабая гравитация, звёзды и пси-бури.', 'Сон за межами Зони. Слабка гравітація, зорі та псі-бурі.'),
  'THE DROWNED SERPENT': U('დამხრჩვალი გველი', 'УТОПЛЕННЫЙ ЗМЕЙ', 'УТОПЛЕНИЙ ЗМІЙ'), 'THE MAGMA BEHEMOTH': U('მაგმის ბეჰემოთი', 'МАГМОВЫЙ БЕГЕМОТ', 'МАГМОВИЙ БЕГЕМОТ'), 'THE DUGA BRAIN': U('დუგას ტვინი', 'МОЗГ ДУГИ', 'МОЗОК ДУГИ'), 'THE NOOSPHERE': U('ნოოსფერო', 'НООСФЕРА', 'НООСФЕРА'),
  'Rising Water': U('ამომავალი წყალი', 'Большая вода', 'Велика вода'), 'Trial by Fire': U('ცეცხლით გამოცდა', 'Испытание огнём', 'Випробування вогнем'), 'The Woodpecker': U('კოდალა', 'Русский дятел', 'Російський дятел'), 'Beyond the Dream': U('სიზმრის მიღმა', 'За гранью сна', 'За межею сну'),
  'Ash Fields': U('ფერფლის ველები', 'Пепельные поля', 'Попелясті поля'), 'Basalt Steps': U('ბაზალტის საფეხურები', 'Базальтовые уступы', 'Базальтові уступи'), 'Old Smelter': U('ძველი სადნობი', 'Старая плавильня', 'Стара плавильня'), 'The Caldera': U('კალდერა', 'Кальдера', 'Кальдера'), 'Obsidian Ridge': U('ობსიდიანის ქედი', 'Обсидиановый хребет', 'Обсидіановий хребет'), 'Sulfur Springs': U('გოგირდის წყაროები', 'Серные источники', 'Сірчані джерела'),
  'Ash Camp': U('ფერფლის ბანაკი', 'Пепельный лагерь', 'Попелястий табір'), 'Grey ash plains far from the lava. Easiest start.': U('ნაცრისფერი ველები ლავიდან შორს. ყველაზე მარტივი დასაწყისი.', 'Серые пепельные равнины вдали от лавы. Самый лёгкий старт.', 'Сірі попелясті рівнини далеко від лави. Найлегший старт.'),
  'Smelter Gate': U('სადნობის კარიბჭე', 'Ворота плавильни', 'Ворота плавильні'), 'Rusty furnaces. Burners everywhere.': U('დაჟანგული ღუმელები. ყველგან „სანთურებია“.', 'Ржавые печи. Кругом жарки.', 'Іржаві печі. Скрізь жарки.'),
  'Basalt Hut': U('ბაზალტის ქოხი', 'Базальтовая хижина', 'Базальтова хатина'), 'Black rock steps west of the lava river.': U('შავი კლდის საფეხურები ლავის მდინარის დასავლეთით.', 'Чёрные каменные уступы к западу от реки лавы.', 'Чорні кам\'яні уступи на захід від річки лави.'),
  'Embankment': U('სანაპირო', 'Набережная', 'Набережна'), 'Drowned Blocks': U('ჩაძირული კვარტლები', 'Затонувшие кварталы', 'Затоплені квартали'), 'River Port': U('მდინარის პორტი', 'Речной порт', 'Річковий порт'), 'Sunken Square': U('ჩაძირული მოედანი', 'Затонувшая площадь', 'Затоплена площа'), 'Glowing Lagoon': U('მანათობელი ლაგუნა', 'Светящаяся лагуна', 'Сяйна лагуна'), 'Pumping Station': U('სატუმბი სადგური', 'Насосная станция', 'Насосна станція'),
  'Embankment Camp': U('სანაპიროს ბანაკი', 'Лагерь на набережной', 'Табір на набережній'), 'Dry ground by the flood wall. Boats nearby.': U('მშრალი მიწა დამბასთან. ნავები ახლოსაა.', 'Сухая земля у дамбы. Лодки рядом.', 'Суха земля біля дамби. Човни поруч.'),
  'Port Pier': U('პორტის ნავმისადგომი', 'Портовый причал', 'Портовий причал'), 'A pier with a working boat. Water all around.': U('ნავმისადგომი მომუშავე ნავით. ირგვლივ წყალია.', 'Причал с рабочей лодкой. Кругом вода.', 'Причал із робочим човном. Навколо вода.'),
  'Rooftop': U('სახურავი', 'Крыша', 'Дах'), 'Above the drowned blocks. Mutants swim here.': U('ჩაძირული კვარტლების თავზე. მუტანტები აქ ცურავენ.', 'Над затонувшими кварталами. Мутанты здесь плавают.', 'Над затопленими кварталами. Мутанти тут плавають.'),
  'Red Pine Forest': U('წითელი ფიჭვნარი', 'Рыжий лес', 'Рудий ліс'), 'Antenna Array': U('ანტენების ველი', 'Антенное поле', 'Антенне поле'), 'Circle Barracks': U('წრიული ყაზარმები', 'Круговые казармы', 'Кругові казарми'), 'Pioneer Camp': U('პიონერთა ბანაკი', 'Пионерлагерь', 'Піонертабір'), 'Command Post': U('სამეთაურო პუნქტი', 'Командный пункт', 'Командний пункт'), 'Radar Bog': U('რადარის ჭაობი', 'Радарное болото', 'Радарне болото'),
  'Forest Road': U('ტყის გზა', 'Лесная дорога', 'Лісова дорога'), 'Quiet pines. The giant radar looms to the north.': U('მშვიდი ფიჭვები. ჩრდილოეთით გიგანტური რადარი მოჩანს.', 'Тихие сосны. На севере возвышается гигантский радар.', 'Тихі сосни. На півночі височіє гігантський радар.'),
  'Abandoned summer camp. Psi fields nearby.': U('მიტოვებული საზაფხულო ბანაკი. ახლოს ფსი-ველებია.', 'Заброшенный летний лагерь. Рядом пси-поля.', 'Покинутий літній табір. Поруч псі-поля.'),
  'Barracks': U('ყაზარმები', 'Казармы', 'Казарми'), 'Military barracks west of the array.': U('სამხედრო ყაზარმები ანტენების დასავლეთით.', 'Военные казармы к западу от антенн.', 'Військові казарми на захід від антен.'),
  'Shore of Dreams': U('სიზმრების ნაპირი', 'Берег снов', 'Берег снів'), 'Crystal Garden': U('ბროლის ბაღი', 'Хрустальный сад', 'Кришталевий сад'), 'Starfall Drift': U('ვარსკვლავცვენა', 'Звездопад', 'Зорепад'), 'Echo City': U('ექოს ქალაქი', 'Город-эхо', 'Місто-відлуння'), 'The Void': U('სიცარიელე', 'Пустота', 'Порожнеча'), 'Heart of the Zone': U('ზონის გული', 'Сердце Зоны', 'Серце Зони'),
  'Dream Shore': U('სიზმრის ნაპირი', 'Берег сна', 'Берег сну'), 'Where the dream begins. Everything floats a little.': U('აქ იწყება სიზმარი. ყველაფერი ოდნავ დაცურავს.', 'Здесь начинается сон. Всё немного парит.', 'Тут починається сон. Усе трохи ширяє.'),
  'Crystal Grove': U('ბროლის კორომი', 'Хрустальная роща', 'Кришталевий гай'), 'Glowing crystals and slippery cold.': U('მანათობელი კრისტალები და მოლიპული სიცივე.', 'Светящиеся кристаллы и скользкий холод.', 'Сяйні кристали й слизький холод.'),
  'Starfall': U('ვარსკვლავცვენა', 'Звездопад', 'Зорепад'), 'Falling stars light the way.': U('ჩამოვარდნილი ვარსკვლავები გზას ანათებენ.', 'Падающие звёзды освещают путь.', 'Падаючі зорі освітлюють шлях.'),
  'Boat': U('ნავი', 'Лодка', 'Човен'), 'BOAT': U('ნავი', 'ЛОДКА', 'ЧОВЕН'), 'Metro A': U('მეტრო A', 'Метро A', 'Метро A'), 'Metro B': U('მეტრო B', 'Метро B', 'Метро B'), 'METRO A': U('მეტრო A', 'МЕТРО A', 'МЕТРО A'), 'METRO B': U('მეტრო B', 'МЕТРО B', 'МЕТРО B'),
  'Metro Tunnels': U('მეტროს გვირაბები', 'Туннели метро', 'Тунелі метро'), 'Duga Bunker': U('დუგას ბუნკერი', 'Бункер Дуги', 'Бункер Дуги'), 'DUGA BUNKER': U('დუგას ბუნკერი', 'БУНКЕР ДУГИ', 'БУНКЕР ДУГИ'), 'Tunnel Lurker': U('გვირაბის მონადირე', 'Туннельный охотник', 'Тунельний мисливець'), 'Floor Guardian': U('სართულის მცველი', 'Страж этажа', 'Вартовий поверху'), 'Duga Brain Core': U('დუგას ტვინის ბირთვი', 'Ядро мозга Дуги', 'Ядро мозку Дуги'),
  'SUMMER': U('ზაფხული', 'ЛЕТО', 'ЛІТО'), 'AUTUMN': U('შემოდგომა', 'ОСЕНЬ', 'ОСІНЬ'), 'WINTER': U('ზამთარი', 'ЗИМА', 'ЗИМА'), 'SPRING': U('გაზაფხული', 'ВЕСНА', 'ВЕСНА'),
  'Summer': U('ზაფხული', 'Лето', 'Літо'), 'Autumn': U('შემოდგომა', 'Осень', 'Осінь'), 'Winter': U('ზამთარი', 'Зима', 'Зима'), 'Spring': U('გაზაფხული', 'Весна', 'Весна'),
  'Golden leaves, rain and fog.': U('ოქროსფერი ფოთლები, წვიმა და ნისლი.', 'Золотые листья, дождь и туман.', 'Золоте листя, дощ і туман.'), 'Snow covers the Zone. Stay warm.': U('ზონას თოვლი ფარავს. თბილად იყავი.', 'Снег покрыл Зону. Держись в тепле.', 'Сніг укрив Зону. Тримайся в теплі.'), 'Everything blooms. Even the anomalies.': U('ყველაფერი ყვავის. ანომალიებიც კი.', 'Всё цветёт. Даже аномалии.', 'Усе квітне. Навіть аномалії.'),
  'Cross the tunnel to come out at the other station — a shortcut across the map.': U('გადაკვეთე გვირაბი და ამოდი მეორე სადგურზე — მალსახმობი რუკაზე.', 'Пройди туннель и выйди на другой станции — короткий путь через карту.', 'Пройди тунель і вийди на іншій станції — короткий шлях через мапу.'),
  'The brain core is somewhere down here. Silence it!': U('ტვინის ბირთვი სადღაც აქაა. გააჩუმე!', 'Ядро мозга где-то здесь. Заглуши его!', 'Ядро мозку десь тут. Заглуши його!'), 'Deeper. Find the guardian to open the next stairs.': U('უფრო ღრმად. იპოვე მცველი, რომ შემდეგი კიბე გაიხსნას.', 'Глубже. Найди стража, чтобы открыть следующую лестницу.', 'Глибше. Знайди вартового, щоб відкрити наступні сходи.'),
  'Three floors down lies the brain core. Each guardian opens the next stairs.': U('სამი სართულის ქვემოთ ტვინის ბირთვია. ყოველი მცველი შემდეგ კიბეს ხსნის.', 'Тремя этажами ниже — ядро мозга. Каждый страж открывает следующую лестницу.', 'Трьома поверхами нижче — ядро мозку. Кожен вартовий відкриває наступні сходи.'),
  '⬇ STAIRS DOWN OPEN': U('⬇ ქვემოთ კიბე გაიხსნა', '⬇ ЛЕСТНИЦА ВНИЗ ОТКРЫТА', '⬇ СХОДИ ВНИЗ ВІДКРИТО'), '📡 DUGA SILENCED': U('📡 დუგა გაჩუმდა', '📡 ДУГА ЗАГЛУШЕНА', '📡 ДУГУ ЗАГЛУШЕНО'), 'The radar falls quiet. +600 rubles and the brain core\'s loot.': U('რადარი გაჩუმდა. +600 რუბლი და ბირთვის ნადავლი.', 'Радар затих. +600 рублей и добыча из ядра.', 'Радар затих. +600 рублів і здобич із ядра.'),
  'A psi wave will slow you briefly.': U('ფსი-ტალღა ცოტა ხნით შეგანელებს.', 'Пси-волна ненадолго замедлит тебя.', 'Псі-хвиля ненадовго сповільнить тебе.'), 'Step out of the red circles!': U('გამოდი წითელი წრეებიდან!', 'Уйди из красных кругов!', 'Вийди з червоних кіл!'), 'LAVA! GET OUT!': U('ლავა! გამოდი!', 'ЛАВА! ВЫБИРАЙСЯ!', 'ЛАВА! ВИБИРАЙСЯ!'),
  '🌋 VOLCANIC BOMBS': U('🌋 ვულკანური ბომბები', '🌋 ВУЛКАНИЧЕСКИЕ БОМБЫ', '🌋 ВУЛКАНІЧНІ БОМБИ'), '🚇 METRO TUNNELS': U('🚇 მეტროს გვირაბები', '🚇 ТУННЕЛИ МЕТРО', '🚇 ТУНЕЛІ МЕТРО'), '🚇 BACK ON THE SURFACE': U('🚇 ისევ ზედაპირზე', '🚇 СНОВА НА ПОВЕРХНОСТИ', '🚇 ЗНОВУ НА ПОВЕРХНІ'),
});
// content batch: legendary stalkers, horde defense, co-op roles
Object.assign(UI_TR, {
  'The Doctor': U('ექიმი', 'Доктор', 'Доктор'), 'Field surgeon: every 20 kills heals 12% HP, and one free revive per run.': U('საველე ქირურგი: ყოველი 20 მკვლელობა 12% სიცოცხლეს აღადგენს, ერთი უფასო აღდგომა თითო რბოლაზე.', 'Полевой хирург: каждые 20 убийств лечат 12% ОЗ, плюс одно бесплатное воскрешение за забег.', 'Польовий хірург: кожні 20 вбивств лікують 12% ОЗ, плюс одне безкоштовне воскресіння за забіг.'),
  'The Ghost': U('აჩრდილი', 'Призрак', 'Привид'), 'Every dash leaves you untouchable for 1 second. Dash recharges 30% faster.': U('ყოველი რივოკის შემდეგ 1 წამით ხელშეუხებელი ხარ. რივოკი 30%-ით სწრაფად იტენება.', 'После каждого рывка ты неуязвим 1 секунду. Рывок перезаряжается на 30% быстрее.', 'Після кожного ривка ти невразливий 1 секунду. Ривок перезаряджається на 30% швидше.'),
  'Chimera Hunter': U('ქიმერის მონადირე', 'Охотник на химер', 'Мисливець на химер'), 'Every 12th kill releases a shockwave around you. +15 HP.': U('ყოველი მე-12 მკვლელობა დარტყმით ტალღას აფრქვევს. +15 სიცოცხლე.', 'Каждое 12-е убийство выпускает ударную волну вокруг тебя. +15 ОЗ.', 'Кожне 12-те вбивство випускає ударну хвилю навколо тебе. +15 ОЗ.'),
  'Monolith Prophet': U('მონოლითის წინასწარმეტყველი', 'Пророк Монолита', 'Пророк Моноліту'), 'Immune to psi. Starts every run with two random artifacts.': U('ფსი-იმუნიტეტი. ყოველ რბოლას ორი შემთხვევითი არტეფაქტით იწყებს.', 'Иммунитет к пси. Начинает каждый забег с двумя случайными артефактами.', 'Імунітет до псі. Починає кожен забіг із двома випадковими артефактами.'),
  'Complete 30 contracts (total)': U('შეასრულე 30 კონტრაქტი (სულ)', 'Выполни 30 контрактов (всего)', 'Виконай 30 контрактів (загалом)'), 'Kill 10 bosses (total)': U('მოკალი 10 ბოსი (სულ)', 'Убей 10 боссов (всего)', 'Вбий 10 босів (загалом)'), 'Kill 3,000 mutants (total)': U('მოკალი 3000 მუტანტი (სულ)', 'Убей 3000 мутантов (всего)', 'Вбий 3000 мутантів (загалом)'), 'Unlock 10 stages': U('გახსენი 10 ეტაპი', 'Открой 10 локаций', 'Відкрий 10 локацій'),
  'Horde Defense': U('ურდოსგან დაცვა', 'Оборона от орды', 'Оборона від орди'), 'Defend a generator through 10 waves. Stay close to it! ×1.4 rubles.': U('დაიცავი გენერატორი 10 ტალღის განმავლობაში. იყავი ახლოს! ×1.4 რუბლი.', 'Защищай генератор 10 волн. Держись рядом с ним! ×1.4 рубля.', 'Захищай генератор 10 хвиль. Тримайся поруч! ×1.4 рубля.'),
  'GENERATOR': U('გენერატორი', 'ГЕНЕРАТОР', 'ГЕНЕРАТОР'), '🏰 HORDE DEFENSE': U('🏰 ურდოსგან დაცვა', '🏰 ОБОРОНА ОТ ОРДЫ', '🏰 ОБОРОНА ВІД ОРДИ'), 'Get back to the generator!': U('დაბრუნდი გენერატორთან!', 'Вернись к генератору!', 'Повернися до генератора!'), 'Return to the generator!': U('დაბრუნდი გენერატორთან!', 'Вернись к генератору!', 'Повернися до генератора!'),
  'Hold the line!': U('გაუძელი!', 'Держим оборону!', 'Тримаємо оборону!'), 'The last wave! Hold on!': U('ბოლო ტალღა! გაუძელი!', 'Последняя волна! Держись!', 'Остання хвиля! Тримайся!'), 'HORDE CHAMPION': U('ურდოს ჩემპიონი', 'ЧЕМПИОН ОРДЫ', 'ЧЕМПІОН ОРДИ'), 'The generator held. All 10 waves repelled!': U('გენერატორმა გაუძლო. 10-ვე ტალღა მოგერიებულია!', 'Генератор выстоял. Все 10 волн отбиты!', 'Генератор вистояв. Усі 10 хвиль відбито!'),
  'Your role': U('შენი როლი', 'Твоя роль', 'Твоя роль'), 'No role': U('როლის გარეშე', 'Без роли', 'Без ролі'), 'Medic': U('მედიკოსი', 'Медик', 'Медик'), 'Engineer': U('ინჟინერი', 'Инженер', 'Інженер'), 'Scout': U('მზვერავი', 'Разведчик', 'Розвідник'), 'Tank': U('ტანკი', 'Танк', 'Танк'),
  'Every 20s heals you and nearby teammates. Revives twice as fast.': U('ყოველ 20 წამში გკურნავს შენ და ახლომდებარე თანაგუნდელებს. ორჯერ სწრაფად აცოცხლებს.', 'Каждые 20с лечит тебя и союзников рядом. Поднимает вдвое быстрее.', 'Кожні 20с лікує тебе й союзників поруч. Піднімає вдвічі швидше.'),
  'Every 30s drops a sentry gun for 12s.': U('ყოველ 30 წამში 12 წამით ავტომატურ ტურელს დგამს.', 'Каждые 30с ставит турель на 12с.', 'Кожні 30с ставить турель на 12с.'),
  '+15% speed, detector ×2. Every 25s marks artifacts on the map.': U('+15% სიჩქარე, დეტექტორი ×2. ყოველ 25 წამში არტეფაქტებს რუკაზე ნიშნავს.', '+15% скорости, детектор ×2. Каждые 25с отмечает артефакты на карте.', '+15% швидкості, детектор ×2. Кожні 25с позначає артефакти на мапі.'),
  '+60 HP, -15% damage taken. Every 25s a shield and a shockwave.': U('+60 სიცოცხლე, -15% მიღებული ზიანი. ყოველ 25 წამში ფარი და დარტყმითი ტალღა.', '+60 ОЗ, -15% получаемого урона. Каждые 25с щит и ударная волна.', '+60 ОЗ, -15% отриманої шкоди. Кожні 25с щит і ударна хвиля.'),
  'Pick a role to get a special ability.': U('აირჩიე როლი განსაკუთრებული უნარისთვის.', 'Выбери роль, чтобы получить особую способность.', 'Обери роль, щоб отримати особливу здібність.'),
  '🏆 LEGENDARY STALKER': U('🏆 ლეგენდარული სტალკერი', '🏆 ЛЕГЕНДАРНЫЙ СТАЛКЕР', '🏆 ЛЕГЕНДАРНИЙ СТАЛКЕР'),
});
// replayability: omens and records
Object.assign(UI_TR, {
  'Red Sky': U('წითელი ცა', 'Красное небо', 'Червоне небо'), 'More mutants roam. Rubles ×1.3.': U('მეტი მუტანტი დაძრწის. რუბლი ×1.3.', 'Мутантов больше. Рубли ×1.3.', 'Мутантів більше. Рублі ×1.3.'),
  'Quiet Day': U('მშვიდი დღე', 'Тихий день', 'Тихий день'), 'Fewer mutants early on. Take a breath.': U('დასაწყისში ნაკლები მუტანტი. ამოისუნთქე.', 'Поначалу мутантов меньше. Переведи дух.', 'Спочатку мутантів менше. Перепочинь.'),
  'Gold Rush': U('ოქროს ციებ-ცხელება', 'Золотая лихорадка', 'Золота лихоманка'), 'Rubles ×1.5, but mutants are a bit more numerous.': U('რუბლი ×1.5, მაგრამ მუტანტები ცოტა მეტია.', 'Рубли ×1.5, но мутантов чуть больше.', 'Рублі ×1.5, але мутантів трохи більше.'),
  'Artifact Storm': U('არტეფაქტების ქარიშხალი', 'Артефактная буря', 'Артефактна буря'), 'Detector reaches 50% further. +1 luck.': U('დეტექტორი 50%-ით შორს წვდება. +1 იღბალი.', 'Детектор бьёт на 50% дальше. +1 удача.', 'Детектор б\'є на 50% далі. +1 удача.'),
  'Adrenaline': U('ადრენალინი', 'Адреналин', 'Адреналін'), '+12% speed, but you take 8% more damage.': U('+12% სიჩქარე, მაგრამ 8%-ით მეტ ზიანს იღებ.', '+12% скорости, но получаешь на 8% больше урона.', '+12% швидкості, але отримуєш на 8% більше шкоди.'),
  'Sharp Blades': U('ბასრი პირები', 'Острые клинки', 'Гострі клинки'), '+20% damage, -15 max HP.': U('+20% ზიანი, -15 მაქს. სიცოცხლე.', '+20% урона, -15 к макс. ОЗ.', '+20% шкоди, -15 до макс. ОЗ.'),
  'Clean Air': U('სუფთა ჰაერი', 'Чистый воздух', 'Чисте повітря'), '+0.6 HP regeneration per second.': U('+0.6 სიცოცხლის აღდგენა წამში.', '+0.6 регенерации ОЗ в секунду.', '+0.6 регенерації ОЗ за секунду.'),
  'Endless Fog': U('დაუსრულებელი ნისლი', 'Бесконечный туман', 'Нескінченний туман'), 'Fog rolls in often. +1 luck for the trouble.': U('ნისლი ხშირად დგება. +1 იღბალი სანაცვლოდ.', 'Туман приходит часто. +1 удача за хлопоты.', 'Туман приходить часто. +1 удача за клопіт.'),
  'Fast Learner': U('სწრაფად სწავლობს', 'Быстро учится', 'Швидко вчиться'), '+25% experience.': U('+25% გამოცდილება.', '+25% опыта.', '+25% досвіду.'),
  'Scavenger': U('მაძიებელი', 'Барахольщик', 'Збирач'), 'Mutants drop medkits and items 60% more often.': U('მუტანტები 60%-ით ხშირად აგდებენ აფთიაქებს და ნივთებს.', 'Мутанты на 60% чаще роняют аптечки и предметы.', 'Мутанти на 60% частіше кидають аптечки й предмети.'),
  'Veteran\'s Start': U('ვეტერანის დასაწყისი', 'Старт ветерана', 'Старт ветерана'), 'Begin the run with one extra upgrade.': U('დაიწყე რბოლა ერთი დამატებითი გაუმჯობესებით.', 'Начни забег с одним дополнительным улучшением.', 'Почни забіг з одним додатковим покращенням.'),
  'Storm Season': U('ქარიშხლების სეზონი', 'Сезон гроз', 'Сезон гроз'), 'Storms and psi weather are common. +15% experience.': U('ქარიშხლები და ფსი-ამინდი ხშირია. +15% გამოცდილება.', 'Грозы и пси-погода — обычное дело. +15% опыта.', 'Грози та псі-погода — звична справа. +15% досвіду.'),
  'Zone omens (a random twist each run)': U('ზონის ნიშნები (შემთხვევითი ცვლილება ყოველ რბოლაზე)', 'Знамения Зоны (случайный поворот в каждом забеге)', 'Знамення Зони (випадковий поворот у кожному забігу)'),
});
// crews: fixed rooms and shared maps
Object.assign(UI_TR, {
  '🗣️ Voices': U('🗣️ ხმები', '🗣️ Голоса', '🗣️ Голоси'),
  '🔗 JOIN': U('🔗 შესვლა', '🔗 ВОЙТИ', '🔗 УВІЙТИ'), '🏠 HOST': U('🏠 ჰოსტი', '🏠 ХОСТ', '🏠 ХОСТ'),
  'Saved on every teammate\'s device. Next time: one of you presses 🏠 HOST on the crew, the others press 🔗 JOIN.': U('შენახულია ყველა თანაგუნდელის მოწყობილობაზე. შემდეგ ჯერზე: ერთი დააჭერს 🏠 ჰოსტს, დანარჩენები — 🔗 შესვლას.', 'Сохранено у каждого участника. В следующий раз: один жмёт 🏠 СОЗДАТЬ у отряда, остальные — 🔗 ВОЙТИ.', 'Збережено в кожного учасника. Наступного разу: один тисне 🏠 СТВОРИТИ, решта — 🔗 УВІЙТИ.'),
});
// co-op screen, lobby and statuses
Object.assign(UI_TR, {
  'Stalker name': U('სტალკერის სახელი', 'Имя сталкера', 'Ім\'я сталкера'), 'New crew name': U('ახალი რაზმის სახელი', 'Название нового отряда', 'Назва нового загону'), 'leave empty for none': U('ცარიელი — პაროლის გარეშე', 'пусто — без пароля', 'порожньо — без пароля'),
  'ROOM CODE': U('ოთახის კოდი', 'КОД КОМНАТЫ', 'КОД КІМНАТИ'), 'password (if any)': U('პაროლი (თუ არის)', 'пароль (если есть)', 'пароль (якщо є)'),
  'You left the room.': U('ოთახი დატოვე.', 'Ты вышел из комнаты.', 'Ти вийшов з кімнати.'), 'Enter the 5-letter room code.': U('შეიყვანე 5-ასოიანი ოთახის კოდი.', 'Введи 5-значный код комнаты.', 'Введи 5-значний код кімнати.'),
  '⏳ Creating room…': U('⏳ ოთახი იქმნება…', '⏳ Создаю комнату…', '⏳ Створюю кімнату…'), '⚠️ Lost the connection to the host. Press JOIN to try again.': U('⚠️ ჰოსტთან კავშირი გაწყდა. დააჭირე შესვლას ხელახლა.', '⚠️ Связь с хостом потеряна. Нажми ВОЙТИ ещё раз.', '⚠️ Зв\'язок із хостом втрачено. Натисни УВІЙТИ ще раз.'),
  '📋 Link copied! Send it to your friends.': U('📋 ბმული დაკოპირდა! გაუგზავნე მეგობრებს.', '📋 Ссылка скопирована! Отправь её друзьям.', '📋 Посилання скопійовано! Надішли його друзям.'), '📋 Link copied!': U('📋 ბმული დაკოპირდა!', '📋 Ссылка скопирована!', '📋 Посилання скопійовано!'),
  'Co-op uses a free public connection service (PeerJS) to introduce the browsers, then plays directly between them. Some strict networks can block it.': U('კოოპი იყენებს უფასო საჯარო სერვისს (PeerJS) ბრაუზერების დასაკავშირებლად, შემდეგ თამაში პირდაპირ მიდის. ზოგიერთმა მკაცრმა ქსელმა შეიძლება დაბლოკოს.', 'Кооператив использует бесплатный публичный сервис (PeerJS), чтобы познакомить браузеры, дальше игра идёт напрямую. Некоторые строгие сети могут это блокировать.', 'Кооператив використовує безкоштовний публічний сервіс (PeerJS), щоб познайомити браузери, далі гра йде напряму. Деякі суворі мережі можуть це блокувати.'),
  'Your name': U('შენი სახელი', 'Твоё имя', 'Твоє ім\'я'), 'Your stalker': U('შენი სტალკერი', 'Твой сталкер', 'Твій сталкер'), 'Password (optional)': U('პაროლი (არასავალდებულო)', 'Пароль (необязательно)', 'Пароль (необов\'язково)'), 'Stage': U('ეტაპი', 'Локация', 'Локація'), 'Start point': U('საწყისი წერტილი', 'Точка старта', 'Точка старту'), 'Difficulty': U('სირთულე', 'Сложность', 'Складність'), 'Crew': U('რაზმი', 'Отряд', 'Загін'),
  'HOST A ROOM': U('ოთახის შექმნა', 'СОЗДАТЬ КОМНАТУ', 'СТВОРИТИ КІМНАТУ'), 'JOIN A FRIEND': U('მეგობართან შესვლა', 'ПРИСОЕДИНИТЬСЯ К ДРУГУ', 'ПРИЄДНАТИСЯ ДО ДРУГА'), '🏠 CREATE ROOM': U('🏠 ოთახის შექმნა', '🏠 СОЗДАТЬ КОМНАТУ', '🏠 СТВОРИТИ КІМНАТУ'), '📋 COPY LINK': U('📋 ბმულის კოპირება', '📋 КОПИРОВАТЬ ССЫЛКУ', '📋 КОПІЮВАТИ ПОСИЛАННЯ'), '🚪 LEAVE ROOM': U('🚪 ოთახიდან გასვლა', '🚪 ВЫЙТИ ИЗ КОМНАТЫ', '🚪 ВИЙТИ З КІМНАТИ'),
  '👍 I\'M READY': U('👍 მზად ვარ', '👍 Я ГОТОВ', '👍 Я ГОТОВИЙ'), '✅ READY (tap to cancel)': U('✅ მზად (დააჭირე გასაუქმებლად)', '✅ ГОТОВ (нажми, чтобы отменить)', '✅ ГОТОВИЙ (натисни, щоб скасувати)'), '✅ READY': U('✅ მზად', '✅ ГОТОВ', '✅ ГОТОВИЙ'),
  '⏳ WAITING FOR PLAYERS…': U('⏳ მოთამაშეებს ველოდებით…', '⏳ ЖДЁМ ИГРОКОВ…', '⏳ ЧЕКАЄМО ГРАВЦІВ…'), '⏳ WAITING FOR EVERYONE TO BE READY': U('⏳ ველოდებით, სანამ ყველა მზად იქნება', '⏳ ЖДЁМ ГОТОВНОСТИ ВСЕХ', '⏳ ЧЕКАЄМО ГОТОВНОСТІ ВСІХ'),
  'Pick your stalker, then press READY.': U('აირჩიე სტალკერი და დააჭირე „მზად ვარ“.', 'Выбери сталкера и нажми «Я ГОТОВ».', 'Обери сталкера й натисни «Я ГОТОВИЙ».'), 'Waiting for the host to start…': U('ველოდებით ჰოსტს დასაწყებად…', 'Ждём, пока хост начнёт…', 'Чекаємо, поки хост почне…'),
  'Open slot': U('თავისუფალი ადგილი', 'Свободное место', 'Вільне місце'), 'send the link to a friend': U('გაუგზავნე ბმული მეგობარს', 'отправь ссылку другу', 'надішли посилання другу'), 'Wrong password.': U('არასწორი პაროლი.', 'Неверный пароль.', 'Невірний пароль.'),
  'Reconnecting to the new host…': U('ახალ ჰოსტთან ხელახლა დაკავშირება…', 'Переподключаюсь к новому хосту…', 'Перепідключаюся до нового хоста…'), 'The host left. The run continues with you in charge.': U('ჰოსტი წავიდა. რბოლა შენი ხელმძღვანელობით გრძელდება.', 'Хост ушёл. Забег продолжается, теперь главный ты.', 'Хост пішов. Забіг триває, тепер головний ти.'),
  '⚡ Quick match (no crew)': U('⚡ სწრაფი თამაში (რაზმის გარეშე)', '⚡ Быстрая игра (без отряда)', '⚡ Швидка гра (без загону)'), '⚡ Quick match: no crew progress is saved': U('⚡ სწრაფი თამაში: რაზმის პროგრესი არ ინახება', '⚡ Быстрая игра: прогресс отряда не сохраняется', '⚡ Швидка гра: прогрес загону не зберігається'),
  '⏳ not ready': U('⏳ არ არის მზად', '⏳ не готов', '⏳ не готовий'), '(you)': U('(შენ)', '(ты)', '(ти)'),
  '➕ NEW CREW': U('➕ ახალი რაზმი', '➕ НОВЫЙ ОТРЯД', '➕ НОВИЙ ЗАГІН'), '🔄 A new version of the game is out — it installs when you return to the menu.': U('🔄 თამაშის ახალი ვერსია გამოვიდა — დაყენდება მენიუში დაბრუნებისას.', '🔄 Вышла новая версия игры — она установится, когда вернёшься в меню.', '🔄 Вийшла нова версія гри — вона встановиться, коли повернешся в меню.'),
});
// crew HQ
Object.assign(UI_TR, {
  '🗺️ MAPS': U('🗺️ რუკები', '🗺️ КАРТЫ', '🗺️ МАПИ'), '⭐ UPGRADES': U('⭐ გაუმჯობესებები', '⭐ УЛУЧШЕНИЯ', '⭐ ПОКРАЩЕННЯ'), '📊 STATS': U('📊 სტატისტიკა', '📊 СТАТИСТИКА', '📊 СТАТИСТИКА'), '⭐ HQ': U('⭐ შტაბი', '⭐ ШТАБ', '⭐ ШТАБ'),
  'MEMBERS': U('წევრები', 'УЧАСТНИКИ', 'УЧАСНИКИ'), 'RECENT RUNS': U('ბოლო რბოლები', 'ПОСЛЕДНИЕ ЗАБЕГИ', 'ОСТАННІ ЗАБІГИ'), 'No crew runs yet.': U('რაზმს ჯერ არ უთამაშია.', 'Отряд ещё не играл.', 'Загін ще не грав.'), 'MAXED': U('მაქსიმუმი', 'МАКСИМУМ', 'МАКСИМУМ'),
  'runs': U('რბოლა', 'забегов', 'забігів'), 'wins': U('მოგება', 'побед', 'перемог'), 'kills': U('მკვლელობა', 'убийств', 'вбивств'), 'maps': U('რუკა', 'карт', 'мап'),
  'Win a map together (or survive 15:00 on it) to open the next ones for the whole crew.': U('მოიგეთ რუკა ერთად (ან გაძელით 15:00), რომ შემდეგი რუკები მთელ რაზმს გაეხსნას.', 'Выиграйте карту вместе (или продержитесь 15:00), чтобы открыть следующие для всего отряда.', 'Виграйте мапу разом (або протримайтеся 15:00), щоб відкрити наступні для всього загону.'),
  'Crew points: 1 to start, +1 per crew level, +2 per win. Upgrades help everyone in this crew\'s runs.': U('რაზმის ქულები: 1 თავიდან, +1 ყოველ დონეზე, +2 ყოველ მოგებაზე. გაუმჯობესებები ყველას ეხმარება ამ რაზმის რბოლებში.', 'Очки отряда: 1 на старте, +1 за уровень отряда, +2 за победу. Улучшения помогают всем в забегах отряда.', 'Очки загону: 1 на старті, +1 за рівень загону, +2 за перемогу. Покращення допомагають усім у забігах загону.'),
  'Tough Crew': U('გამძლე რაზმი', 'Крепкий отряд', 'Міцний загін'), '+10 max HP for everyone per level.': U('+10 მაქს. სიცოცხლე ყველას, თითო დონეზე.', '+10 к макс. ОЗ всем за уровень.', '+10 до макс. ОЗ усім за рівень.'),
  'Drilled': U('გაწვრთნილი', 'Слаженность', 'Злагодженість'), '+5% damage for everyone per level.': U('+5% ზიანი ყველას, თითო დონეზე.', '+5% урона всем за уровень.', '+5% шкоди всім за рівень.'),
  'Study Group': U('სასწავლო ჯგუფი', 'Учебная группа', 'Навчальна група'), '+8% experience per level.': U('+8% გამოცდილება თითო დონეზე.', '+8% опыта за уровень.', '+8% досвіду за рівень.'),
  'Shared Stash': U('საერთო სამალავი', 'Общий схрон', 'Спільна схованка'), '+10% rubles from crew runs per level.': U('+10% რუბლი რაზმის რბოლებიდან, თითო დონეზე.', '+10% рублей с забегов отряда за уровень.', '+10% рублів із забігів загону за рівень.'),
  'Field Kit': U('საველე აფთიაქი', 'Полевая аптечка', 'Польова аптечка'), '+0.3 HP regeneration per second per level.': U('+0.3 სიცოცხლის აღდგენა წამში, თითო დონეზე.', '+0.3 регенерации ОЗ в секунду за уровень.', '+0.3 регенерації ОЗ за секунду за рівень.'),
  'Brothers in Arms': U('საბრძოლო ძმები', 'Братья по оружию', 'Брати по зброї'), 'Teammates revive you 30% faster per level.': U('თანაგუნდელები 30%-ით სწრაფად გაცოცხლებენ, თითო დონეზე.', 'Товарищи поднимают тебя на 30% быстрее за уровень.', 'Товариші піднімають тебе на 30% швидше за рівень.'),
  'Head Start': U('სწრაფი სტარტი', 'Фора', 'Фора'), 'Everyone begins crew runs with one extra upgrade per level.': U('ყველა იწყებს რაზმის რბოლას ერთი დამატებითი გაუმჯობესებით, თითო დონეზე.', 'Все начинают забеги отряда с одним доп. улучшением за уровень.', 'Усі починають забіги загону з одним дод. покращенням за рівень.'),
});
// variety batch
Object.assign(UI_TR, {
  '🤖 Auto-pick upgrades on level up (no pause)': U('🤖 გაუმჯობესებების ავტო-არჩევა (პაუზის გარეშე)', '🤖 Автовыбор улучшений (без паузы)', '🤖 Автовибір покращень (без паузи)'), '🤖 Auto-pick upgrades: ON': U('🤖 ავტო-არჩევა: ჩართ.', '🤖 Автовыбор: ВКЛ', '🤖 Автовибір: УВІМК'), '🤖 Auto-pick upgrades: OFF': U('🤖 ავტო-არჩევა: გამორთ.', '🤖 Автовыбор: ВЫКЛ', '🤖 Автовибір: ВИМК'),
  '🤖 Auto-pick from now on (no pause)': U('🤖 ავტო-არჩევა ამიერიდან (პაუზის გარეშე)', '🤖 Автовыбор дальше (без паузы)', '🤖 Автовибір далі (без паузи)'),
  'Meteor Shower': U('მეტეორული წვიმა', 'Метеоритный дождь', 'Метеоритний дощ'),
  'Rocks fall from the sky. Watch the red circles!': U('ციდან ქვები ცვივა. უყურე წითელ წრეებს!', 'С неба падают камни. Следи за красными кругами!', 'З неба падає каміння. Стеж за червоними колами!'),
  'Gold Rain': U('ოქროს წვიმა', 'Золотой дождь', 'Золотий дощ'),
  'Every kill pays +3 ₽ extra for a while!': U('ყოველი მკვლელობა ცოტა ხნით +3 ₽ იხდის!', 'Каждое убийство какое-то время даёт +3 ₽!', 'Кожне вбивство якийсь час дає +3 ₽!'),
  'Fog of Whispers': U('ჩურჩულის ნისლი', 'Туман шёпота', 'Туман шепоту'),
  'Thick fog and voices. Mutants are harder to see.': U('სქელი ნისლი და ხმები. მუტანტები ძნელად ჩანს.', 'Густой туман и голоса. Мутантов плохо видно.', 'Густий туман і голоси. Мутантів погано видно.'),
  'Trader Caravan': U('ვაჭრების ქარავანი', 'Караван торговцев', 'Караван торговців'),
  'A caravan drops supplies nearby. Grab them!': U('ქარავანმა ახლოს მარაგი დატოვა. აიღე!', 'Караван сбросил припасы рядом. Хватай!', 'Караван скинув припаси поруч. Хапай!'),
  'Rat Swarm': U('ვირთხების ურდო', 'Крысиный рой', 'Щурячий рій'),
  'A tide of rats pours out of the ground.': U('ვირთხების ტალღა მიწიდან ამოდის.', 'Из-под земли хлынула волна крыс.', 'З-під землі ринула хвиля щурів.'),
  '⚡ LIGHTNING STORM': U('⚡ ელვის ქარიშხალი', '⚡ ГРОЗА С МОЛНИЯМИ', '⚡ ГРОЗА З БЛИСКАВКАМИ'),
  'Lightning strikes the mutants around you.': U('ელვა ურტყამს მუტანტებს შენ გარშემო.', 'Молнии бьют по мутантам вокруг тебя.', 'Блискавки бʼють по мутантах навколо тебе.'),
  '🌨️ BLIZZARD': U('🌨️ ქარბუქი', '🌨️ МЕТЕЛЬ', '🌨️ ХУРТОВИНА'),
  'Mutants are slowed by the cold.': U('სიცივე მუტანტებს ანელებს.', 'Холод замедляет мутантов.', 'Холод сповільнює мутантів.'),
  '👻 WHISPERING FOG': U('👻 ჩურჩულა ნისლი', '👻 ШЕПЧУЩИЙ ТУМАН', '👻 ШЕПОТЛИВИЙ ТУМАН'),
  'A faint psi hum in the fog.': U('ნისლში სუსტი ფსი-გუგუნია.', 'В тумане слабый пси-гул.', 'У тумані слабкий псі-гул.'),
  '🔥 WILDFIRES': U('🔥 ხანძრები', '🔥 ПОЖАРЫ', '🔥 ПОЖЕЖІ'),
  'Fires start in the dry grass.': U('მშრალ ბალახში ხანძრები ჩნდება.', 'В сухой траве вспыхивают пожары.', 'У сухій траві спалахують пожежі.'),
  '☢️ ACID RAIN': U('☢️ მჟავა წვიმა', '☢️ КИСЛОТНЫЙ ДОЖДЬ', '☢️ КИСЛОТНИЙ ДОЩ'),
  'Radiation in the rain: stay near shelters. Artifacts glow brighter.': U('წვიმაში რადიაციაა: იყავი თავშესაფრებთან.', 'В дожде радиация: держись у укрытий.', 'У дощі радіація: тримайся біля укриттів.'),
  'Blood Shrine': U('სისხლის სალოცავი', 'Кровавое святилище', 'Криваве святилище'),
  'Give 25% of your health for +15% damage.': U('გაიღე 25% სიცოცხლე +15% ზიანისთვის.', 'Отдай 25% здоровья за +15% урона.', 'Віддай 25% здоровʼя за +15% шкоди.'),
  'Gambler\'s Shrine': U('მოთამაშის სალოცავი', 'Святилище игрока', 'Святилище гравця'),
  'Either +300 ₽ or -100 ₽.': U('ან +300 ₽, ან -100 ₽.', 'Либо +300 ₽, либо -100 ₽.', 'Або +300 ₽, або -100 ₽.'),
  'Shrine of Luck': U('იღბლის სალოცავი', 'Святилище удачи', 'Святилище удачі'),
  'Give 20% of your health for +1 luck.': U('გაიღე 20% სიცოცხლე +1 იღბლისთვის.', 'Отдай 20% здоровья за +1 удачи.', 'Віддай 20% здоровʼя за +1 удачі.'),
  'Sage\'s Shrine': U('ბრძენის სალოცავი', 'Святилище мудреца', 'Святилище мудреця'),
  '+2 rerolls for your upgrade cards.': U('+2 გადარჩევა გაუმჯობესებებისთვის.', '+2 переброса карт улучшений.', '+2 перекидання карт покращень.'),
  '🧍 A STALKER NEARBY': U('🧍 ახლოს სტალკერია', '🧍 РЯДОМ СТАЛКЕР', '🧍 ПОРУЧ СТАЛКЕР'),
  'Walk up to them and stay a moment.': U('მიდი და ცოტა ხანს დადექი.', 'Подойди и постой рядом.', 'Підійди й постій поруч.'),
  '🗺️ TREASURE MAP': U('🗺️ განძის რუკა', '🗺️ КАРТА СОКРОВИЩ', '🗺️ МАПА СКАРБІВ'),
  'A mutant carried a stalker\'s map. Dig at the ✖ (see the map).': U('მუტანტს სტალკერის რუკა ჰქონდა. გათხარე ✖-ზე (ნახე რუკა).', 'У мутанта была карта сталкера. Копай у ✖ (смотри карту).', 'У мутанта була мапа сталкера. Копай біля ✖ (дивись мапу).'),
  '💎 TREASURE FOUND': U('💎 განძი ნაპოვნია', '💎 СОКРОВИЩЕ НАЙДЕНО', '💎 СКАРБ ЗНАЙДЕНО'),
  '✨ GOLDEN MUTANT': U('✨ ოქროს მუტანტი', '✨ ЗОЛОТОЙ МУТАНТ', '✨ ЗОЛОТИЙ МУТАНТ'),
  '+400 ₽ and an artifact!': U('+400 ₽ და არტეფაქტი!', '+400 ₽ и артефакт!', '+400 ₽ і артефакт!'),
  '🐕 DOG NIGHT': U('🐕 ძაღლების ღამე', '🐕 СОБАЧЬЯ НОЧЬ', '🐕 СОБАЧА НІЧ'),
  '🧟 ZOMBIE PARADE': U('🧟 ზომბების აღლუმი', '🧟 ПАРАД ЗОМБИ', '🧟 ПАРАД ЗОМБІ'),
  '🦵 SNORK SEASON': U('🦵 სნორკების სეზონი', '🦵 СЕЗОН СНОРКОВ', '🦵 СЕЗОН СНОРКІВ'),
  '🐖 FLESH FEAST': U('🐖 ფლეშების ნადიმი', '🐖 ПИР ПЛОТИ', '🐖 БЕНКЕТ ПЛОТІ'),
  'Auto-pick upgrades on level up (no pause)': U('გაუმჯობესებების ავტო-არჩევა (პაუზის გარეშე)', 'Автовыбор улучшений при уровне (без паузы)', 'Автовибір покращень на рівні (без паузи)'),
  'Armored': U('ჯავშნიანი', 'Бронированный', 'Броньований'),
  'Swift': U('სწრაფი', 'Быстрый', 'Швидкий'),
  'Giant': U('გიგანტი', 'Гигантский', 'Гігантський'),
  'Tiny': U('პაწაწინა', 'Крошечный', 'Крихітний'),
  'Golden': U('ოქროს', 'Золотой', 'Золотий'),
});
// pace + forecast
Object.assign(UI_TR, {
  'PACE · how fast the Zone gets harder': U('ტემპი · რამდენად სწრაფად რთულდება ზონა', 'ТЕМП · как быстро Зона становится сложнее', 'ТЕМП · як швидко Зона стає складнішою'),
  'Classic': U('კლასიკური', 'Классика', 'Класика'),
  'Normal': U('ნორმალური', 'Обычный', 'Звичайний'),
  'Steady climb': U('მუდმივი ზრდა', 'Ровный подъём', 'Рівний підйом'),
  'Fast': U('სწრაფი', 'Быстрый', 'Швидкий'),
  'Brutal': U('სასტიკი', 'Беспощадный', 'Нещадний'),
  'The old gentle ramp. Strong builds become almost unkillable after ~10 min.': U('ძველი რბილი ზრდა. ძლიერი ბილდი ~10 წუთის შემდეგ თითქმის უკვდავია.', 'Старый мягкий рост. Сильные сборки почти бессмертны после ~10 мин.', 'Старий мʼякий ріст. Сильні збірки майже безсмертні після ~10 хв.'),
  '+40% mutant HP and damage every 10 minutes. The recommended pace.': U('+40% მუტანტის სიცოცხლე და ზიანი ყოველ 10 წუთში. რეკომენდებული ტემპი.', '+40% к ОЗ и урону мутантов каждые 10 минут. Рекомендуемый темп.', '+40% до ОЗ і шкоди мутантів кожні 10 хвилин. Рекомендований темп.'),
  '+70% every 10 minutes. You need a real build to see 20:00.': U('+70% ყოველ 10 წუთში. 20:00-მდე მისასვლელად კარგი ბილდი გჭირდება.', '+70% каждые 10 минут. Чтобы дожить до 20:00, нужна сильная сборка.', '+70% кожні 10 хвилин. Щоб дожити до 20:00, потрібна сильна збірка.'),
  '+120% every 10 minutes. Late game gets rough.': U('+120% ყოველ 10 წუთში. თამაშის ბოლო მძიმეა.', '+120% каждые 10 минут. Поздняя игра будет жёсткой.', '+120% кожні 10 хвилин. Пізня гра буде жорсткою.'),
  '+200% every 10 minutes. Few survive 15:00.': U('+200% ყოველ 10 წუთში. 15:00-მდე ცოტა თუ აღწევს.', '+200% каждые 10 минут. До 15:00 доживают единицы.', '+200% кожні 10 хвилин. До 15:00 доживають одиниці.'),
  '📈 Survival forecast': U('📈 გადარჩენის პროგნოზი', '📈 Прогноз выживания', '📈 Прогноз виживання'),
  'typical run ends around': U('ჩვეულებრივი რბოლა მთავრდება დაახლოებით', 'обычный забег заканчивается около', 'звичайний забіг закінчується близько'),
  '(estimate)': U('(შეფასება)', '(оценка)', '(оцінка)'),
  'Chance to fall before': U('დაღუპვის შანსი მანამდე:', 'Шанс погибнуть до', 'Шанс загинути до'),
});
// completeness pass: every screen, tooltip and canvas label
Object.assign(UI_TR, {
  'Rostok': U('Როსტოკი', 'Росток', 'Росток'),
  'Brain Scorcher': U('ტვინის გამომწველი', 'Выжигатель мозгов', 'Випалювач мізків'),
  'Garbage': U('ნაგავსაყრელი', 'Свалка', 'Звалище'),
  'Palace of Culture': U('კულტურის სასახლე', 'Дворец культуры', 'Палац культури'),
  'Ferris Wheel': U('ეშმაკის ბორბალი', 'Колесо обозрения', 'Оглядове колесо'),
  'Hospital': U('საავადმყოფო', 'Больница', 'Лікарня'),
  'Hospital Basement': U('საავადმყოფოს სარდაფი', 'Подвал больницы', 'Підвал лікарні'),
  'Sarcophagus': U('სარკოფაგი', 'Саркофаг', 'Саркофаг'),
  'Cooling Towers': U('გამაგრილებელი კოშკები', 'Градирни', 'Градирні'),
  'DUGA': U('დუგა', 'ДУГА', 'ДУГА'),
  'Duty': U('მოვალეობა', 'Долг', 'Обовʼязок'),
  'Freedom': U('თავისუფლება', 'Свобода', 'Свобода'),
  'Neutral': U('ნეიტრალური', 'Нейтрально', 'Нейтрально'),
  'Friendly': U('მეგობრული', 'Дружба', 'Дружба'),
  'Ally': U('მოკავშირე', 'Союзник', 'Союзник'),
  'Hero': U('გმირი', 'Герой', 'Герой'),
  'Default': U('სტანდარტული', 'Обычный', 'Звичайний'),
  'Duty Red': U('მოვალეობის წითელი', 'Красный Долга', 'Червоний Обовʼязку'),
  'Freedom Green': U('თავისუფლების მწვანე', 'Зелёный Свободы', 'Зелений Свободи'),
  'Monolith Grey': U('მონოლითის ნაცრისფერი', 'Серый Монолита', 'Сірий Моноліту'),
  'Clear Sky Blue': U('სუფთა ცის ლურჯი', 'Синий Чистого Неба', 'Синій Чистого Неба'),
  'Legend Gold': U('ლეგენდის ოქრო', 'Золото легенды', 'Золото легенди'),
  'Ghost White': U('აჩრდილის თეთრი', 'Белый призрак', 'Білий привид'),
  'Night Ops': U('ღამის ოპერაცია', 'Ночная операция', 'Нічна операція'),
  'Mercenary': U('დაქირავებული', 'Наёмник', 'Найманець'),
  'Tons of mutated flesh. The ground shakes when it walks.': U('ტონობით მუტირებული ხორცი. მიწა ზანზარებს მისი ნაბიჯებისგან.', 'Тонны мутировавшей плоти. Земля дрожит под её шагами.', 'Тонни мутованої плоті. Земля тремтить під її кроками.'),
  'Two heads, one hunger. Leaps from the shadows.': U('ორი თავი, ერთი შიმშილი. ჩრდილიდან ხტება.', 'Две головы, один голод. Прыгает из тени.', 'Дві голови, один голод. Стрибає з тіні.'),
  'Mother of the pack. Her young are never far.': U('ხროვის დედა. მისი ნაშიერები ყოველთვის ახლოსაა.', 'Мать стаи. Её детёныши всегда рядом.', 'Мати зграї. Її малята завжди поруч.'),
  'The swarm obeys her. Kill her and they scatter.': U('ურდო მას ემორჩილება. მოკალი და გაიფანტებიან.', 'Рой подчиняется ей. Убей её — и они разбегутся.', 'Рій кориться їй. Вбий її — і вони розбіжаться.'),
  'Telekinetic dwarf. Hurls anything that isn\'t nailed down.': U('ტელეკინეტიკური ჯუჯა. ისვრის ყველაფერს, რაც არ არის მიმაგრებული.', 'Карлик-телекинетик. Швыряет всё, что не прибито.', 'Карлик-телекінетик. Жбурляє все, що не прибито.'),
  'A storm of invisible hands.': U('უხილავი ხელების ქარიშხალი.', 'Буря невидимых рук.', 'Буря невидимих рук.'),
  'The biggest dog of them all.': U('ყველაზე დიდი ძაღლი.', 'Самый большой пёс из всех.', 'Найбільший пес з усіх.'),
  'The first controller. Your mind is not your own.': U('პირველი კონტროლიორი. შენი გონება შენი აღარ არის.', 'Первый контролёр. Твой разум тебе не принадлежит.', 'Перший контролер. Твій розум тобі не належить.'),
  'Twisted limbs, unnatural reach.': U('დაგრეხილი კიდურები, არაბუნებრივი სიგრძე.', 'Искривлённые конечности, неестественный размах.', 'Викривлені кінцівки, неприродний розмах.'),
  'Armored hide. Aim for the weak spots.': U('ჯავშნიანი ტყავი. დაუმიზნე სუსტ ადგილებს.', 'Бронированная шкура. Целься в слабые места.', 'Броньована шкура. Цілься в слабкі місця.'),
  'Rises from the water without warning.': U('წყლიდან უეცრად ამოდის.', 'Поднимается из воды без предупреждения.', 'Підіймається з води без попередження.'),
  'Military gunship. Take cover and shoot back.': U('სამხედრო საბრძოლო ვერტმფრენი. დაიმალე და უპასუხე.', 'Военный вертолёт. Укройся и отстреливайся.', 'Військовий гелікоптер. Сховайся й відстрілюйся.'),
  'Is it even real? Only one of them is.': U('ნამდვილია კი? მხოლოდ ერთია ნამდვილი.', 'Он вообще настоящий? Настоящий только один.', 'Він узагалі справжній? Справжній лише один.'),
  'The heart of the Zone. It calls to you.': U('ზონის გული. ის გიხმობს.', 'Сердце Зоны. Оно зовёт тебя.', 'Серце Зони. Воно кличе тебе.'),
  'Kill 5 mutants': U('მოკალი 5 მუტანტი', 'Убей 5 мутантов', 'Вбий 5 мутантів'),
  'Collect 5 artifacts': U('შეაგროვე 5 არტეფაქტი', 'Собери 5 артефактов', 'Збери 5 артефактів'),
  'Kill 5 bosses': U('მოკალი 5 ბოსი', 'Убей 5 боссов', 'Вбий 5 босів'),
  'Complete 5 contracts': U('შეასრულე 5 კონტრაქტი', 'Выполни 5 контрактов', 'Виконай 5 контрактів'),
  'Survive 5 minutes (total)': U('გადარჩი 5 წუთი (სულ)', 'Продержись 5 минут (всего)', 'Протримайся 5 хвилин (загалом)'),
  'Win 5 stage': U('მოიგე 5 ეტაპი', 'Выиграй локаций: 5', 'Виграй локацій: 5'),
  'Standard': U('სტანდარტული', 'Стандарт', 'Стандарт'),
  'Endless': U('უსასრულო', 'Бесконечный', 'Нескінченний'),
  'Boss Rush': U('ბოსების ნაკადი', 'Босс-раш', 'Бос-раш'),
  'Daily Run': U('დღის რბოლა', 'Ежедневный забег', 'Щоденний забіг'),
  '15 minutes, 6 bosses, then the final boss. Win to unlock the next stage.': U('15 წუთი, 6 ბოსი, შემდეგ ფინალური ბოსი. მოიგე შემდეგი ეტაპის გასახსნელად.', '15 минут, 6 боссов, затем финальный босс. Победи, чтобы открыть следующую локацию.', '15 хвилин, 6 босів, потім фінальний бос. Переможи, щоб відкрити наступну локацію.'),
  'Bosses forever. Every 15 minutes the Zone grows a tier stronger. Play for hours.': U('ბოსები სამუდამოდ. ყოველ 15 წუთში ზონა ძლიერდება. ითამაშე საათობით.', 'Боссы без конца. Каждые 15 минут Зона становится сильнее. Играй часами.', 'Боси без кінця. Кожні 15 хвилин Зона стає сильнішою. Грай годинами.'),
  'A new boss every minute. How many can you beat?': U('ახალი ბოსი ყოველ წუთს. რამდენს დაამარცხებ?', 'Новый босс каждую минуту. Скольких одолеешь?', 'Новий бос щохвилини. Скількох здолаєш?'),
  'Today\'s seed: the same map and loot for everyone. Changes every day.': U('დღევანდელი სიდი: ერთი რუკა და ნადავლი ყველასთვის. ყოველდღე იცვლება.', 'Сид дня: одна карта и добыча для всех. Меняется каждый день.', 'Сід дня: одна мапа й здобич для всіх. Змінюється щодня.'),
  'ENTER THE ZONE': U('ზონაში შესვლა', 'ВОЙТИ В ЗОНУ', 'УВІЙТИ В ЗОНУ'),
  'EQUIPPED': U('აღჭურვილია', 'НАДЕТО', 'ВДЯГНЕНО'),
  'Space': U('Space', 'Пробел', 'Пробіл'),
  'Minus': U('მინუსი', 'Минус', 'Мінус'),
  'Off': U('გამორთ.', 'Выкл', 'Вимк'),
  'High': U('მაღალი', 'Высокое', 'Високе'),
  'Low (faster)': U('დაბალი (სწრაფი)', 'Низкое (быстрее)', 'Низьке (швидше)'),
  'Auto': U('ავტო', 'Авто', 'Авто'),
  'BOSS': U('ბოსი', 'БОСС', 'БОС'),
  'DESCENDING…': U('ჩასვლა…', 'СПУСК…', 'СПУСК…'),
  'CLIMBING UP…': U('ამოსვლა…', 'ПОДЪЁМ…', 'ПІДЙОМ…'),
  'LAIR DESTROYED': U('ბუნაგი განადგურებულია', 'ЛОГОВО УНИЧТОЖЕНО', 'ЛІГВО ЗНИЩЕНО'),
  'New attack patterns incoming.': U('მოდის ახალი შეტევები.', 'Жди новых атак.', 'Чекай нових атак.'),
  'Fullscreen': U('სრული ეკრანი', 'Полный экран', 'Повний екран'),
  'Pause (Esc)': U('პაუზა (Esc)', 'Пауза (Esc)', 'Пауза (Esc)'),
  'Map (M)': U('რუკა (M)', 'Карта (M)', 'Мапа (M)'),
  'Sound': U('ხმა', 'Звук', 'Звук'),
  'Radio (N / B to switch)': U('რადიო (N / B გადასართავად)', 'Радио (N / B — переключить)', 'Радіо (N / B — перемкнути)'),
  'Previous artifact (wheel)': U('წინა არტეფაქტი (ბორბალი)', 'Предыдущий артефакт (колесо)', 'Попередній артефакт (коліщатко)'),
  'Use artifact power (Q)': U('არტეფაქტის ძალის გამოყენება (Q)', 'Сила артефакта (Q)', 'Сила артефакту (Q)'),
  'Next artifact (E / wheel)': U('შემდეგი არტეფაქტი (E / ბორბალი)', 'Следующий артефакт (E / колесо)', 'Наступний артефакт (E / коліщатко)'),
  'GUIDE · open the map (M) to travel': U('გიდი · გახსენი რუკა (M) სამოგზაუროდ', 'ПРОВОДНИК · открой карту (M), чтобы переместиться', 'ПРОВІДНИК · відкрий мапу (M), щоб переміститися'),
  'STALKER': U('სტალკერი', 'СТАЛКЕР', 'СТАЛКЕР'),
  'No saved runs yet. Use 💾 SAVE & QUIT in the pause menu to keep a run for later.': U('შენახული რბოლები ჯერ არ არის. გამოიყენე 💾 შენახვა და გასვლა პაუზის მენიუში.', 'Сохранённых забегов пока нет. Используй 💾 СОХРАНИТЬ И ВЫЙТИ в меню паузы.', 'Збережених забігів поки немає. Використай 💾 ЗБЕРЕГТИ Й ВИЙТИ в меню паузи.'),
  'stage rating': U('ეტაპის შეფასება', 'оценка локации', 'оцінка локації'),
  'not met yet': U('ჯერ არ შეხვედრია', 'ещё не встречен', 'ще не зустрінутий'),
  'not found yet': U('ჯერ ნაპოვნი არ არის', 'ещё не найден', 'ще не знайдений'),
  'needs research': U('საჭიროებს კვლევას', 'нужно исследование', 'потрібне дослідження'),
  'research the node above': U('გამოიკვლიე ზედა კვანძი', 'исследуй узел выше', 'досліди вузол вище'),
  'DAILY CHALLENGES · new ones every day': U('დღის გამოწვევები · ახალი ყოველდღე', 'ЕЖЕДНЕВНЫЕ ИСПЫТАНИЯ · новые каждый день', 'ЩОДЕННІ ВИПРОБУВАННЯ · нові щодня'),
  'WEEKLY CHALLENGE': U('კვირის გამოწვევა', 'ЕЖЕНЕДЕЛЬНОЕ ИСПЫТАНИЕ', 'ЩОТИЖНЕВЕ ВИПРОБУВАННЯ'),
  'LOOKS · tap to wear': U('გარეგნობა · დააჭირე ჩასაცმელად', 'ОБЛИК · нажми, чтобы надеть', 'ВИГЛЯД · натисни, щоб вдягнути'),
  'REPUTATION · complete contracts for a faction to earn it': U('რეპუტაცია · შეასრულე კონტრაქტები დაჯგუფებისთვის', 'РЕПУТАЦИЯ · выполняй контракты группировки', 'РЕПУТАЦІЯ · виконуй контракти угруповання'),
  'SUITS · sold at faction bases': U('კოსტიუმები · იყიდება ბაზებზე', 'КОСТЮМЫ · продаются на базах группировок', 'КОСТЮМИ · продаються на базах угруповань'),
  'RESEARCH TREE · each node unlocks rarer artifacts in anomaly fields': U('კვლევის ხე · ყოველი კვანძი იშვიათ არტეფაქტებს ხსნის', 'ДЕРЕВО ИССЛЕДОВАНИЙ · каждый узел открывает более редкие артефакты', 'ДЕРЕВО ДОСЛІДЖЕНЬ · кожен вузол відкриває рідкісніші артефакти'),
  'MUTATION BRANCH · become part mutant (equip up to 2)': U('მუტაციის შტო · გახდი ნახევრად მუტანტი (მაქს. 2)', 'ВЕТКА МУТАЦИЙ · стань отчасти мутантом (до 2)', 'ГІЛКА МУТАЦІЙ · стань частково мутантом (до 2)'),
  'STASH BOX · unused consumables are stored after every run, and you take up to 2 of each into the next run': U('სამალავი · გამოუყენებელი ნივთები ინახება; შემდეგ რბოლაში თითოეულიდან 2-მდე წაიღებ', 'ТАЙНИК · неиспользованные расходники хранятся, в следующий забег берёшь до 2 каждого', 'СХОВАНКА · невикористані витратні зберігаються, у наступний забіг береш до 2 кожного'),
  'ZONE ROULETTE · the Zone gives, the Zone takes': U('ზონის რულეტკა · ზონა აძლევს, ზონა ართმევს', 'РУЛЕТКА ЗОНЫ · Зона даёт, Зона забирает', 'РУЛЕТКА ЗОНИ · Зона дає, Зона забирає'),
  'Radiation dose: builds up in hot spots and radiation storms. Above 60% healing is halved, at 100% you get sick. Anti-rad clears it.': U('რადიაციის დოზა: გროვდება ცხელ წერტილებში და ქარიშხლებში. 60%-ზე მეტზე მკურნალობა ნახევრდება, 100%-ზე ავად ხდები. ანტირადი ასუფთავებს.', 'Доза радиации: копится в горячих точках и радиобурях. Выше 60% лечение вдвое слабее, на 100% ты заболеваешь. Антирад выводит её.', 'Доза радіації: накопичується в гарячих точках і радіобурях. Понад 60% лікування вдвічі слабше, на 100% ти хворієш. Антирад виводить її.'),
  'ON': U('ჩართ.', 'ВКЛ', 'УВІМК'), 'ENRAGED': U('გაცოფებული', 'ЯРОСТНЫЙ', 'ЛЮТИЙ'), 'SHIELDED': U('დაფარული', 'ЩИТОНОСНЫЙ', 'ЩИТОВИЙ'), 'SUMMONER': U('გამომძახებელი', 'ПРИЗЫВАТЕЛЬ', 'ЗАКЛИНАЧ'), 'SPLITTING': U('გამყოფი', 'РАСКАЛЫВАЮЩИЙСЯ', 'РОЗКОЛЮВАНИЙ'), 'TWIN': U('ტყუპი', 'БЛИЗНЕЦ', 'БЛИЗНЮК'), 'ALPHA': U('ალფა', 'АЛЬФА', 'АЛЬФА'), 'HORDE': U('ურდოს', 'ОРДЫ', 'ОРДИ'), 'Evolved': U('განვითარებული', 'Эволюционировавший', 'Еволюціонований'), 'OFF': U('გამორთ.', 'ВЫКЛ', 'ВИМК'),
});
// radio chatter, news and the last leftovers
Object.assign(UI_TR, {
  'Alright rookie, get out there. Bring me artifacts and try not to die.': U('კარგი, ახალბედა, წადი. არტეფაქტები მომიტანე და ეცადე არ მოკვდე.', 'Ну что, салага, вперёд. Принеси мне артефакты и постарайся не сдохнуть.', 'Ну що, салаго, вперед. Принеси мені артефакти й постарайся не здохнути.'),
  'Welcome to the Zone. Nobody here is going to hold your hand.': U('კეთილი იყოს შენი მობრძანება ზონაში. აქ ხელს არავინ მოგკიდებს.', 'Добро пожаловать в Зону. Никто тут тебя за ручку водить не будет.', 'Ласкаво просимо до Зони. Ніхто тут тебе за ручку водити не буде.'),
  'Night is falling. Keep your flashlight on and your back to a wall.': U('ბნელდება. ფანარი არ გამორთო და ზურგი კედელს მიაყრდენი.', 'Темнеет. Фонарь не выключай и держись спиной к стене.', 'Темніє. Ліхтар не вимикай і тримайся спиною до стіни.'),
  'Sun is up. Made it through another night.': U('მზე ამოვიდა. კიდევ ერთი ღამე გადავიტანეთ.', 'Солнце встало. Ещё одну ночь пережили.', 'Сонце зійшло. Ще одну ніч пережили.'),
  'Morning. Still alive? Good, there is work.': U('დილაა. ჯერ ცოცხალი ხარ? კარგი, საქმე გვაქვს.', 'Утро. Живой ещё? Хорошо, есть работа.', 'Ранок. Ще живий? Добре, є робота.'),
  'Fog is rolling in. Can not see a thing past twenty meters.': U('ნისლი დგება. ოც მეტრზე შორს ვერაფერს ხედავ.', 'Туман накрывает. Дальше двадцати метров ничего не видно.', 'Туман накриває. Далі двадцяти метрів нічого не видно.'),
  'Lightning storm! Stay away from open ground!': U('ელვა! ღია ადგილებს მოერიდე!', 'Гроза! Держитесь подальше от открытых мест!', 'Гроза! Тримайтеся подалі від відкритих місць!'),
  'Psi storm detected. Expect headaches, and worse.': U('ფსი-ქარიშხალი! მოემზადე თავის ტკივილისთვის. და უარესისთვის.', 'Пси-шторм! Готовьтесь к головной боли. И к худшему.', 'Псі-шторм! Готуйтеся до головного болю. І до гіршого.'),
  'Come to us. The Monolith calls.': U('მოდი ჩვენთან. მონოლითი გიხმობს.', 'Иди к нам. Монолит зовёт.', 'Іди до нас. Моноліт кличе.'),
  'Snow in the Zone. Watch your step, it is slippery.': U('ზონაში თოვს. ფეხს უყურე, მოლიპულია.', 'Снег в Зоне. Смотри под ноги, скользко.', 'Сніг у Зоні. Дивись під ноги, слизько.'),
  'This heat is killing me. Drink some water, stalker.': U('ეს სიცხე მკლავს. წყალი დალიე, სტალკერო.', 'Жара убивает. Попей воды, сталкер.', 'Спека вбиває. Випий води, сталкере.'),
  'Radiation storm! Get to a shelter or drink anti-rad!': U('რადიაციული ქარიშხალი! თავშესაფარში ან ანტირადი დალიე!', 'Радиационный шторм! В укрытие или пей антирад!', 'Радіаційний шторм! В укриття або пий антирад!'),
  'Something big is coming this way! Run!': U('რაღაც უზარმაზარი მოდის! გაიქეცი!', 'Сюда идёт что-то огромное! Беги!', 'Сюди йде щось величезне! Тікай!'),
  'Reports of a huge mutant near you. Good luck, friend.': U('ამბობენ, შენთან ახლოს უზარმაზარი მუტანტია. წარმატებები, მეგობარო.', 'Говорят, рядом с тобой огромный мутант. Удачи, друг.', 'Кажуть, поруч із тобою величезний мутант. Удачі, друже.'),
  'You killed that? Drinks are on me.': U('ის შენ მოკალი? სასმელი ჩემზეა.', 'Ты завалил эту тварь? Выпивка за мой счёт.', 'Ти завалив цю тварюку? Випивка за мій рахунок.'),
  'Now that is a stalker! Respect, brother.': U('აი ეს არის სტალკერი! პატივისცემა, ძმაო.', 'Вот это сталкер! Уважаю, брат.', 'Оце сталкер! Поважаю, брате.'),
  'Emission! Find cover immediately!': U('გამოფრქვევა! სასწრაფოდ თავშესაფარში!', 'Выброс! Немедленно в укрытие!', 'Викид! Негайно в укриття!'),
  'Blowout coming! Get underground or get cooked!': U('გამოფრქვევა მოდის! მიწის ქვეშ ჩადი, თორემ შეიწვები!', 'Выброс идёт! Прячься под землю, или поджаришься!', 'Викид іде! Ховайся під землю, або засмажишся!'),
  'The emission is over. New artifacts are forming out there.': U('გამოფრქვევა დასრულდა. იქ ახალი არტეფაქტები იქმნება.', 'Выброс закончился. Там формируются новые артефакты.', 'Викид скінчився. Там формуються нові артефакти.'),
  'An artifact! Now we are talking business.': U('არტეფაქტი! აი ეს უკვე საქმეა.', 'Артефакт! Вот это другой разговор.', 'Артефакт! Оце вже інша розмова.'),
  'Fascinating specimen. Handle it carefully.': U('საოცარი ნიმუშია. ფრთხილად მოეპყარი.', 'Потрясающий образец. Обращайся осторожно.', 'Дивовижний зразок. Поводься обережно.'),
  'You are bleeding out, man! Use a medkit!': U('სისხლისგან იცლები! აფთიაქი გამოიყენე!', 'Ты истекаешь кровью! Аптечку, быстро!', 'Ти стікаєш кровʼю! Аптечку, швидко!'),
  'Get out of there, you are hurt!': U('იქიდან წადი, დაჭრილი ხარ!', 'Уходи оттуда, ты ранен!', 'Іди звідти, ти поранений!'),
  'Got a job for you. Check your PDA.': U('საქმე მაქვს შენთვის. PDA შეამოწმე.', 'Есть для тебя работа. Глянь в ПДА.', 'Є для тебе робота. Глянь у ПДА.'),
  'New contract posted. Pays well.': U('ახალი შეკვეთაა. კარგად იხდიან.', 'Новый заказ. Платят хорошо.', 'Нове замовлення. Платять добре.'),
  'Job done? Here is your money. Do not spend it on vodka.': U('გააკეთე? აი შენი ფული. არაყში არ გაფლანგო.', 'Сделал? Держи деньги. Только не пропей.', 'Зробив? Тримай гроші. Тільки не пропий.'),
  'Nice work. The money is yours.': U('კარგი ნამუშევარია. ფული შენია.', 'Хорошая работа. Деньги твои.', 'Гарна робота. Гроші твої.'),
  'You are inside an X lab. Be careful down there.': U('X ლაბორატორიაში ხარ. ფრთხილად იყავი ქვემოთ.', 'Ты в лаборатории Икс. Будь осторожен там, внизу.', 'Ти в лабораторії Ікс. Будь обережний там, унизу.'),
  'There is a stash here, but something is guarding it.': U('აქ სამალავია, მაგრამ რაღაც იცავს.', 'Тут тайник, но его что-то охраняет.', 'Тут схованка, але її щось охороняє.'),
  'That one looks different. Stronger. Careful!': U('ეს სხვანაირია. უფრო ძლიერი. ფრთხილად!', 'Этот какой-то другой. Сильнее. Осторожно!', 'Цей якийсь інший. Сильніший. Обережно!'),
  'Where did you get that thing? Beautiful.': U('საიდან იშოვე ეს ნივთი? ლამაზია.', 'Где ты достал эту штуку? Красота.', 'Де ти дістав цю штуку? Краса.'),
  'Cheeki breeki! Look at him go!': U('ჩიკი-ბრიკი! შეხედე, როგორ მიდის!', 'Чики-брики! Смотри, как даёт!', 'Чікі-брікі! Дивись, як дає!'),
  'What a massacre! Keep it up, stalker!': U('რა ხოცვა-ჟლეტაა! ასე გააგრძელე, სტალკერო!', 'Вот это бойня! Так держать, сталкер!', 'Оце бійня! Так тримати, сталкере!'),
  'You are getting stronger.': U('ძლიერდები.', 'Ты становишься сильнее.', 'Ти стаєш сильнішим.'),
  'Level up. Choose wisely.': U('ახალი დონე. გონივრულად აირჩიე.', 'Новый уровень. Выбирай с умом.', 'Новий рівень. Обирай з розумом.'),
  'Train on the tracks! Clear the rails!': U('მატარებელი! ლიანდაგიდან გადადი!', 'Поезд! Уйди с путей!', 'Потяг! Зійди з колії!'),
  'Avalanche! Move sideways, now!': U('ზვავი! გვერდზე გადი, სწრაფად!', 'Лавина! Уходи в сторону, быстро!', 'Лавина! Відходь убік, швидко!'),
  'The forest is burning! Stay clear of the flames!': U('ტყე იწვის! ცეცხლს მოერიდე!', 'Лес горит! Держись подальше от огня!', 'Ліс горить! Тримайся подалі від вогню!'),
  'We see you. We always see you.': U('ჩვენ გხედავთ. ყოველთვის გხედავთ.', 'Мы видим тебя. Мы всегда тебя видим.', 'Ми бачимо тебе. Ми завжди тебе бачимо.'),
  'A new part of the Zone is open. Go take a look.': U('ზონის ახალი ნაწილი გაიხსნა. წადი, ნახე.', 'Открылась новая часть Зоны. Сходи посмотри.', 'Відкрилася нова частина Зони. Сходи подивися.'),
  'Man down! Somebody help him!': U('სტალკერი დაიჭრა! ვინმე დაეხმარეთ!', 'Сталкер ранен! Помогите ему!', 'Сталкер поранений! Допоможіть йому!'),
  'You are back on your feet. Let us move.': U('ისევ ფეხზე ხარ. წავედით.', 'Ты снова на ногах. Двигаем.', 'Ти знову на ногах. Рушаймо.'),
  'Good view from up here. The area is on your map.': U('აქედან კარგი ხედია. ტერიტორია ახლა რუკაზეა.', 'Отличный вид отсюда. Местность теперь на карте.', 'Чудовий вид звідси. Місцевість тепер на мапі.'),
  'Radio tower online. Fast travel available.': U('რადიოანძა ჩაირთო. სწრაფი გადაადგილება ხელმისაწვდომია.', 'Радиовышка работает. Быстрое перемещение доступно.', 'Радіовежа працює. Швидке переміщення доступне.'),
  'You cracked the vault? Share with old Sidorovich.': U('საცავი გატეხე? ბებერ სიდოროვიჩს გაუყავი.', 'Ты вскрыл хранилище? Поделись со стариком Сидоровичем.', 'Ти зламав сховище? Поділися зі старим Сидоровичем.'),
  'Sit by the fire, brother. Rest a while.': U('ცეცხლთან დაჯექი, ძმაო. ცოტა დაისვენე.', 'Садись к костру, брат. Отдохни немного.', 'Сідай до вогнища, брате. Відпочинь трохи.'),
  'Another one lost to the Zone. Next time, bring more medkits.': U('კიდევ ერთი დაიკარგა ზონაში. შემდეგ ჯერზე მეტი აფთიაქი წაიღე.', 'Ещё один сгинул в Зоне. В следующий раз бери больше аптечек.', 'Ще один зник у Зоні. Наступного разу бери більше аптечок.'),
  'Rest in peace, stalker.': U('განისვენე მშვიდად, სტალკერო.', 'Покойся с миром, сталкер.', 'Спочивай з миром, сталкере.'),
  'Night is falling... keep your flashlight on and your back to a wall.': U('ბნელდება. ფანარი არ გამორთო და ზურგი კედელს მიაყრდენი.', 'Темнеет. Фонарь не выключай и держись спиной к стене.', 'Темніє. Ліхтар не вимикай і тримайся спиною до стіни.'),
  'Fog\'s rolling in... can\'t see a thing past twenty meters.': U('ნისლი დგება. ოც მეტრზე შორს ვერაფერს ხედავ.', 'Туман накрывает. Дальше двадцати метров ничего не видно.', 'Туман накриває. Далі двадцяти метрів нічого не видно.'),
  'Psi-storm detected. Expect headaches... and worse.': U('ფსი-ქარიშხალი! მოემზადე თავის ტკივილისთვის. და უარესისთვის.', 'Пси-шторм! Готовьтесь к головной боли. И к худшему.', 'Псі-шторм! Готуйтеся до головного болю. І до гіршого.'),
  'Come to us... the Monolith calls...': U('მოდი ჩვენთან. მონოლითი გიხმობს.', 'Иди к нам. Монолит зовёт.', 'Іди до нас. Моноліт кличе.'),
  'Something big is coming this way! RUN!': U('რაღაც უზარმაზარი მოდის! გაიქეცი!', 'Сюда идёт что-то огромное! Беги!', 'Сюди йде щось величезне! Тікай!'),
  'We\'ve got reports of a huge mutant near you. Good luck, friend.': U('ამბობენ, შენთან ახლოს უზარმაზარი მუტანტია. წარმატებები, მეგობარო.', 'Говорят, рядом с тобой огромный мутант. Удачи, друг.', 'Кажуть, поруч із тобою величезний мутант. Удачі, друже.'),
  'You killed THAT? Drinks are on me.': U('ის შენ მოკალი? სასმელი ჩემზეა.', 'Ты завалил эту тварь? Выпивка за мой счёт.', 'Ти завалив цю тварюку? Випивка за мій рахунок.'),
  'Now that\'s a stalker! Respect, brother.': U('აი ეს არის სტალკერი! პატივისცემა, ძმაო.', 'Вот это сталкер! Уважаю, брат.', 'Оце сталкер! Поважаю, брате.'),
  'EMISSION! Find cover immediately!': U('გამოფრქვევა! სასწრაფოდ თავშესაფარში!', 'Выброс! Немедленно в укрытие!', 'Викид! Негайно в укриття!'),
  'An artifact! Now we\'re talking business.': U('არტეფაქტი! აი ეს უკვე საქმეა.', 'Артефакт! Вот это другой разговор.', 'Артефакт! Оце вже інша розмова.'),
  'You\'re bleeding out, man! Use a medkit!': U('სისხლისგან იცლები! აფთიაქი გამოიყენე!', 'Ты истекаешь кровью! Аптечку, быстро!', 'Ти стікаєш кровʼю! Аптечку, швидко!'),
  'Get out of there, you\'re hurt!': U('იქიდან წადი, დაჭრილი ხარ!', 'Уходи оттуда, ты ранен!', 'Іди звідти, ти поранений!'),
  'Job done? Here\'s your money. Don\'t spend it on vodka.': U('გააკეთე? აი შენი ფული. არაყში არ გაფლანგო.', 'Сделал? Держи деньги. Только не пропей.', 'Зробив? Тримай гроші. Тільки не пропий.'),
  'You\'re inside an X-lab. The Monolith\'s people guard these places... be careful.': U('X ლაბორატორიაში ხარ. ამ ადგილებს მონოლითის ხალხი იცავს... ფრთხილად.', 'Ты в лаборатории Икс. Эти места охраняют люди Монолита... осторожнее.', 'Ти в лабораторії Ікс. Ці місця охороняють люди Моноліту... обережно.'),
  'There\'s a stash here, but something is guarding it.': U('აქ სამალავია, მაგრამ რაღაც იცავს.', 'Тут тайник, но его что-то охраняет.', 'Тут схованка, але її щось охороняє.'),
  'That one looks different... stronger. Careful!': U('ეს სხვანაირია. უფრო ძლიერი. ფრთხილად!', 'Этот какой-то другой. Сильнее. Осторожно!', 'Цей якийсь інший. Сильніший. Обережно!'),
  'Hah! Where did you get THAT thing? Beautiful.': U('საიდან იშოვე ეს ნივთი? ლამაზია.', 'Где ты достал эту штуку? Красота.', 'Де ти дістав цю штуку? Краса.'),
  'Get down, stalker! ...never mind, he\'s got this.': U('დაწექი, სტალკერო! ...არა უშავს, ის თავს ართმევს.', 'Ложись, сталкер! ...хотя нет, он справляется.', 'Лягай, сталкере! ...хоча ні, він справляється.'),
  'Sidorovich': U('სიდოროვიჩი', 'Сидорович', 'Сидорович'),
  'Barkeep': U('ბარმენი', 'Бармен', 'Бармен'),
  'Stalker': U('სტალკერი', 'Сталкер', 'Сталкер'),
  'Scientist': U('მეცნიერი', 'Учёный', 'Науковець'),
  'Monolith': U('მონოლითი', 'Монолит', 'Моноліт'),
  'Announcer': U('დიქტორი', 'Диктор', 'Диктор'),
  'Guide': U('გიდი', 'Проводник', 'Провідник'),
  'Military': U('სამხედრო', 'Военный', 'Військовий'),
  'Still no artifacts? Throw a bolt, listen to the detector. They are out there.': U('ჯერ არცერთი არტეფაქტი? ჭანჭიკი ისროლე, დეტექტორს მოუსმინე. ისინი იქ არიან.', 'До сих пор ни одного артефакта? Кинь болт, слушай детектор. Они там есть.', 'Досі жодного артефакту? Кинь болт, слухай детектор. Вони там є.'),
  'The Zone is getting angrier. Veterans say they have never seen it like this.': U('ზონა სულ უფრო ბრაზდება. ვეტერანები ამბობენ, ასეთი არასდროს უნახავთ.', 'Зона всё злее. Ветераны говорят, такого ещё не было.', 'Зона дедалі зліша. Ветерани кажуть, такого ще не було.'),
  'Duty and Freedom traded fire near the old factory again. Nobody won, as usual.': U('მოვალეობა და თავისუფლება ისევ ესროდნენ ერთმანეთს ძველ ქარხანასთან. ჩვეულებრივ, არავინ მოიგო.', 'Долг и Свобода опять постреляли у старого завода. Как всегда, никто не победил.', 'Обовʼязок і Свобода знову постріляли біля старого заводу. Як завжди, ніхто не переміг.'),
  'Trader news: I pay good money for contracts done right. Check the board.': U('ვაჭრის ამბები: კარგად ვიხდი სწორად შესრულებულ კონტრაქტებში. დაფას შეხედე.', 'Новости торговца: хорошо плачу за чисто сделанные контракты. Загляни на доску.', 'Новини торговця: добре плачу за чисто виконані контракти. Зазирни на дошку.'),
  'Bar tonight: warm vodka, cold stew, and stories you will not believe.': U('ბარში ამაღამ: თბილი არაყი, ცივი წვნიანი და ამბები, რომლებიც არ დაგიჯერდება.', 'Сегодня в баре: тёплая водка, холодная похлёбка и истории, в которые не поверишь.', 'Сьогодні в барі: тепла горілка, холодна юшка й історії, у які не повіриш.'),
  'GOLDEN MUTANT!': U('ოქროს მუტანტი!', 'ЗОЛОТОЙ МУТАНТ!', 'ЗОЛОТИЙ МУТАНТ!'),
  'It got away…': U('გაიქცა…', 'Он сбежал…', 'Він утік…'),
  '✦ TALENT ✦': U('✦ ტალანტი ✦', '✦ ТАЛАНТ ✦', '✦ ТАЛАНТ ✦'),
  'Exit to surface': U('ზედაპირზე გასვლა', 'Выход на поверхность', 'Вихід на поверхню'),
  'Weapons': U('იარაღი', 'Оружие', 'Зброя'),
  'Synergies': U('სინერგიები', 'Синергии', 'Синергії'),
  'Artifacts': U('არტეფაქტები', 'Артефакты', 'Артефакти'),
  'None yet. Look inside anomaly fields (colored circles on the minimap).': U('ჯერ არაფერი. მოძებნე ანომალიების ველებში (ფერადი წრეები მინირუკაზე).', 'Пока нет. Ищи в аномальных полях (цветные круги на миникарте).', 'Поки немає. Шукай в аномальних полях (кольорові кола на мінімапі).'),
  'Treasure': U('განძი', 'Сокровище', 'Скарб'),
  'Dug up': U('ამოთხრილია', 'Выкопано', 'Викопано'),
  'Explored': U('გამოკვლეულია', 'Исследовано', 'Досліджено'),
  'Activate 📡 radio towers or talk to a 🧭 guide at a start point to fast-travel.': U('სწრაფი გადაადგილებისთვის ჩართე 📡 რადიოანძები ან ესაუბრე 🧭 გიდს საწყის წერტილში.', 'Включай 📡 радиовышки или поговори с 🧭 проводником у точки старта для быстрого перемещения.', 'Вмикай 📡 радіовежі або поговори з 🧭 провідником біля точки старту для швидкого переміщення.'),
});
// completeness pass 2: floating texts and banners
Object.assign(UI_TR, {
  '"Take this, you look like you need it." +60 ₽': U('„აიღე, როგორც ჩანს გჭირდება.“ +60 ₽', '«Держи, тебе, похоже, нужнее.» +60 ₽', '«Тримай, тобі, схоже, потрібніше.» +60 ₽'),
  '+1 luck for this run.': U('+1 იღბალი ამ რბოლაში.', '+1 удачи на этот забег.', '+1 удачі на цей забіг.'),
  '+15% damage for this run.': U('+15% ზიანი ამ რბოლაში.', '+15% урона на этот забег.', '+15% шкоди на цей забіг.'),
  '+150 ₽ and 2 artifacts.': U('+150 ₽ და 2 არტეფაქტი.', '+150 ₽ и 2 артефакта.', '+150 ₽ і 2 артефакти.'),
  '+2 levels, +100 ₽': U('+2 დონე, +100 ₽', '+2 уровня, +100 ₽', '+2 рівні, +100 ₽'),
  '+220 ₽ from the stalker.': U('+220 ₽ სტალკერისგან.', '+220 ₽ от сталкера.', '+220 ₽ від сталкера.'),
  '+250 ₽, an artifact and supplies!': U('+250 ₽, არტეფაქტი და მარაგი!', '+250 ₽, артефакт и припасы!', '+250 ₽, артефакт і припаси!'),
  '+40 ₽ and loot': U('+40 ₽ და ნადავლი', '+40 ₽ и добыча', '+40 ₽ і здобич'),
  '3 seconds of invulnerability!': U('3 წამი უკვდავება!', '3 секунды неуязвимости!', '3 секунди невразливості!'),
  'A clue! Next one marked.': U('მინიშნება! შემდეგი მონიშნულია.', 'Зацепка! Следующая отмечена.', 'Зачіпка! Наступна позначена.'),
  'ATTIC STASH': U('სხვენის სამალავი', 'ТАЙНИК НА ЧЕРДАКЕ', 'СХОВАНКА НА ГОРИЩІ'),
  'All XP pulled in!': U('მთელი გამოცდილება მოიზიდა!', 'Весь опыт притянут!', 'Увесь досвід притягнуто!'),
  'BACK ON THE SURFACE': U('ისევ ზედაპირზე', 'СНОВА НА ПОВЕРХНОСТИ', 'ЗНОВУ НА ПОВЕРХНІ'),
  'BLOCK': U('ბლოკი', 'БЛОК', 'БЛОК'),
  'Back in the fight!': U('ისევ ბრძოლაში!', 'Снова в бою!', 'Знову в бою!'),
  'COLLAPSE!': U('ჩამოინგრა!', 'ОБВАЛ!', 'ОБВАЛ!'),
  'Co-op runs cannot be saved.': U('კოოპ რბოლა ვერ შეინახება.', 'Кооп-забеги нельзя сохранить.', 'Кооп-забіги не можна зберегти.'),
  'Come back with 100 ₽.': U('დაბრუნდი 100 ₽-ით.', 'Возвращайся со 100 ₽.', 'Повертайся зі 100 ₽.'),
  'DISMOUNTED': U('ჩამოხვედი', 'СПЕШИЛСЯ', 'ЗІСКОЧИВ'),
  'DODGE': U('აცილება', 'УКЛОН', 'УХИЛ'),
  'DOUBLE!': U('ორმაგი!', 'ДВОЙНОЙ!', 'ПОДВІЙНИЙ!'),
  'EMISSION!': U('გამოფრქვევა!', 'ВЫБРОС!', 'ВИКИД!'),
  'Endless mode: bosses keep coming, stronger each tier.': U('უსასრულო რეჟიმი: ბოსები მოდიან, ყოველ დონეზე უფრო ძლიერები.', 'Бесконечный режим: боссы идут и идут, всё сильнее с каждым уровнем.', 'Нескінченний режим: боси йдуть і йдуть, дедалі сильніші з кожним рівнем.'),
  'FUEL CAN': U('საწვავის კანისტრა', 'КАНИСТРА', 'КАНІСТРА'),
  'Find a fuel can (supply crates).': U('იპოვე საწვავი (მარაგის ყუთებში).', 'Найди канистру (в ящиках снабжения).', 'Знайди каністру (у ящиках постачання).'),
  'Find the 3 missing parts first (contract).': U('ჯერ იპოვე 3 დაკარგული ნაწილი (კონტრაქტი).', 'Сначала найди 3 недостающие детали (контракт).', 'Спершу знайди 3 відсутні деталі (контракт).'),
  'Found him alive!': U('ცოცხალი ვიპოვეთ!', 'Нашли живым!', 'Знайшли живим!'),
  'It opens the sealed vault somewhere in this lab.': U('ის ხსნის დალუქულ საცავს სადღაც ამ ლაბორატორიაში.', 'Он открывает запечатанное хранилище где-то в этой лаборатории.', 'Він відчиняє запечатане сховище десь у цій лабораторії.'),
  'Kill 25 mutants within 60 seconds for 220 ₽.': U('მოკალი 25 მუტანტი 60 წამში 220 ₽-ისთვის.', 'Убей 25 мутантов за 60 секунд — 220 ₽.', 'Вбий 25 мутантів за 60 секунд — 220 ₽.'),
  'LOOT RECOVERED': U('ნადავლი დაბრუნებულია', 'ДОБЫЧА ВОЗВРАЩЕНА', 'ЗДОБИЧ ПОВЕРНУТО'),
  'MAGNET': U('მაგნიტი', 'МАГНИТ', 'МАГНІТ'),
  'MIRROR ANOMALY': U('სარკის ანომალია', 'ЗЕРКАЛЬНАЯ АНОМАЛИЯ', 'ДЗЕРКАЛЬНА АНОМАЛІЯ'),
  'MUTANT RUSH!': U('მუტანტების შემოტევა!', 'НАТИСК МУТАНТОВ!', 'НАВАЛА МУТАНТІВ!'),
  'NOT ENOUGH RUBLES': U('რუბლი არ გყოფნის', 'НЕ ХВАТАЕТ РУБЛЕЙ', 'НЕ ВИСТАЧАЄ РУБЛІВ'),
  'NOT IN CO-OP': U('კოოპში არა', 'НЕ В КООПЕ', 'НЕ В КООПІ'),
  'NOT NOW': U('ახლა არა', 'НЕ СЕЙЧАС', 'НЕ ЗАРАЗ'),
  'NOTHING!': U('არაფერი!', 'НИЧЕГО!', 'НІЧОГО!'),
  'New artifacts have been born inside the anomalies.': U('ანომალიებში ახალი არტეფაქტები გაჩნდა.', 'В аномалиях родились новые артефакты.', 'В аномаліях народилися нові артефакти.'),
  'OUT OF FUEL': U('საწვავი დამთავრდა', 'КОНЧИЛОСЬ ТОПЛИВО', 'СКІНЧИЛОСЯ ПАЛЬНЕ'),
  'Open the map (M) to fast-travel between active towers.': U('გახსენი რუკა (M) აქტიურ კოშკებს შორის სწრაფად გადასაადგილებლად.', 'Открой карту (M), чтобы перемещаться между активными вышками.', 'Відкрий мапу (M), щоб переміщатися між активними вежами.'),
  'Package! Run to the shelter!': U('ამანათი! გაიქეცი თავშესაფარში!', 'Посылка! Беги в укрытие!', 'Посилка! Біжи в укриття!'),
  'Points of interest and lairs are revealed on your map.': U('საინტერესო ადგილები და ბუნაგები რუკაზე გამოჩნდა.', 'Важные точки и логова открыты на карте.', 'Важливі точки й лігва відкрито на мапі.'),
  'Ride the jeep (F) to the edge of the map to escape with all your loot.': U('ჯიპით (F) რუკის კიდემდე მიდი, რომ მთელი ნადავლით გაიქცე.', 'Доедь на джипе (F) до края карты, чтобы уйти со всей добычей.', 'Доїдь джипом (F) до краю мапи, щоб піти з усією здобиччю.'),
  'SINKING! MOVE!': U('იძირები! იმოძრავე!', 'ТОНЕШЬ! ДВИГАЙСЯ!', 'ТОНЕШ! РУХАЙСЯ!'),
  'STASH UNLOCKED': U('სამალავი გაიხსნა', 'ТАЙНИК ОТКРЫТ', 'СХОВАНКУ ВІДКРИТО'),
  'Sample taken': U('ნიმუში აღებულია', 'Образец взят', 'Зразок взято'),
  'Snow is sliding down the slope. Move sideways!': U('თოვლი ფერდობზე სრიალებს. გვერდზე გადი!', 'Снег сходит со склона. Уходи в сторону!', 'Сніг сходить зі схилу. Відходь убік!'),
  'Someone hid supplies up here.': U('ვიღაცამ აქ მარაგი დამალა.', 'Кто-то спрятал здесь припасы.', 'Хтось сховав тут припаси.'),
  'Something follows you. Keep moving.': U('რაღაც მოგყვება. იმოძრავე.', 'Что-то идёт за тобой. Не останавливайся.', 'Щось іде за тобою. Не зупиняйся.'),
  'THE BANDIT GOT AWAY': U('ბანდიტი გაიქცა', 'БАНДИТ УШЁЛ', 'БАНДИТ УТІК'),
  'THE EMISSION IS OVER': U('გამოფრქვევა დასრულდა', 'ВЫБРОС ЗАКОНЧИЛСЯ', 'ВИКИД СКІНЧИВСЯ'),
  'THE GHOST IS AT PEACE': U('აჩრდილმა მოსვენება ჰპოვა', 'ПРИЗРАК УПОКОЕН', 'ПРИВИД ЗАСПОКОЄНО'),
  'That crate was hungry.': U('ეს ყუთი მშიერი იყო.', 'Этот ящик был голоден.', 'Ця скриня була голодна.'),
  'The Red Forest is burning. Stay clear of the flames!': U('წითელი ტყე იწვის. ცეცხლს მოერიდე!', 'Рыжий лес горит. Держись подальше от огня!', 'Рудий ліс горить. Тримайся подалі від вогню!'),
  'The area is revealed on your map. Artifacts are marked for 45s.': U('ტერიტორია რუკაზე გამოჩნდა. არტეფაქტები 45 წამით მონიშნულია.', 'Местность открыта на карте. Артефакты отмечены на 45с.', 'Місцевість відкрито на мапі. Артефакти позначено на 45с.'),
  'The lab lights flicker on.': U('ლაბორატორიაში შუქი აინთო.', 'В лаборатории зажёгся свет.', 'У лабораторії засвітилося світло.'),
  'The stalker left.': U('სტალკერი წავიდა.', 'Сталкер ушёл.', 'Сталкер пішов.'),
  'The team goes down together when everyone is here.': U('გუნდი ერთად ჩადის, როცა ყველა აქ იქნება.', 'Команда спускается вместе, когда все на месте.', 'Команда спускається разом, коли всі на місці.'),
  'They are coming from every direction.': U('ყველა მხრიდან მოდიან.', 'Они идут со всех сторон.', 'Вони йдуть з усіх боків.'),
  'Wait for the emission to pass.': U('დაელოდე გამოფრქვევის დასრულებას.', 'Дождись конца выброса.', 'Дочекайся кінця викиду.'),
  'Walk to a teammate to be revived, or wait 15s.': U('მიდი თანაგუნდელთან, რომ გაგაცოცხლოს, ან დაელოდე 15 წამს.', 'Подойди к товарищу, чтобы тебя подняли, или жди 15с.', 'Підійди до товариша, щоб тебе підняли, або чекай 15с.'),
  'You can\'t travel during a boss fight.': U('ბოსთან ბრძოლისას ვერ იმოგზაურებ.', 'Нельзя перемещаться во время боя с боссом.', 'Не можна переміщатися під час бою з босом.'),
  'You continue alone.': U('მარტო აგრძელებ.', 'Ты продолжаешь один.', 'Ти продовжуєш сам.'),
  'You continue alone. Open the link again to rejoin.': U('მარტო აგრძელებ. დასაბრუნებლად ბმული ხელახლა გახსენი.', 'Ты продолжаешь один. Открой ссылку снова, чтобы вернуться.', 'Ти продовжуєш сам. Відкрий посилання знову, щоб повернутися.'),
  'You dug up a hidden stash.': U('დამალული სამალავი ამოთხარე.', 'Ты выкопал тайник.', 'Ти викопав схованку.'),
  'You paid 100 ₽ for supplies.': U('მარაგში 100 ₽ გადაიხადე.', 'Ты заплатил 100 ₽ за припасы.', 'Ти заплатив 100 ₽ за припаси.'),
  'You were rewound 3 seconds.': U('3 წამით უკან დაგაბრუნა.', 'Тебя отмотало на 3 секунды назад.', 'Тебе відмотало на 3 секунди назад.'),
  'Your reflections are hunting you!': U('შენი ანარეკლები შენზე ნადირობენ!', 'Твои отражения охотятся на тебя!', 'Твої відображення полюють на тебе!'),
  '☢ EMISSION IMMINENT ☢': U('☢ გამოფრქვევა ახლოვდება ☢', '☢ СКОРО ВЫБРОС ☢', '☢ СКОРО ВИКИД ☢'),
  '✅ Already in the room.': U('✅ უკვე ოთახში ხარ.', '✅ Ты уже в комнате.', '✅ Ти вже в кімнаті.'),
  'CHALK STASH': U('ცარცის სამალავი', 'ТАЙНИК С МЕЛОМ', 'СХОВАНКА З КРЕЙДОЮ'),
  'CHALLENGE COMPLETE': U('გამოწვევა შესრულდა', 'ИСПЫТАНИЕ ВЫПОЛНЕНО', 'ВИПРОБУВАННЯ ВИКОНАНО'),
  'AVALANCHE!': U('ზვავი!', 'ЛАВИНА!', 'ЛАВИНА!'),
  'THE WATCHER': U('დამკვირვებელი', 'НАБЛЮДАТЕЛЬ', 'СПОСТЕРІГАЧ'),
  'YOU ARE THE HOST NOW': U('ახლა შენ ხარ ჰოსტი', 'ТЕПЕРЬ ТЫ ХОСТ', 'ТЕПЕР ТИ ХОСТ'),
  'DOWNED': U('დაეცი', 'СБИТ С НОГ', 'ЗБИТИЙ З НІГ'),
  'HEAL': U('მკურნალობა', 'ЛЕЧЕНИЕ', 'ЛІКУВАННЯ'),
  'REVIVED': U('გაცოცხლდი', 'ПОДНЯТ', 'ПІДНЯТИЙ'),
  'POWER RESTORED': U('ელექტრობა აღდგა', 'ПИТАНИЕ ВОССТАНОВЛЕНО', 'ЖИВЛЕННЯ ВІДНОВЛЕНО'),
  'COULD NOT RE-HOST': U('ხელახლა ჰოსტინგი ვერ მოხერხდა', 'НЕ УДАЛОСЬ ПЕРЕСОЗДАТЬ', 'НЕ ВДАЛОСЯ ПЕРЕСТВОРИТИ'),
  'COULD NOT RECONNECT': U('ხელახლა დაკავშირება ვერ მოხერხდა', 'НЕ УДАЛОСЬ ПЕРЕПОДКЛЮЧИТЬСЯ', 'НЕ ВДАЛОСЯ ПЕРЕПІДКЛЮЧИТИСЯ'),
  'HOST DISCONNECTED': U('ჰოსტი გაითიშა', 'ХОСТ ОТКЛЮЧИЛСЯ', 'ХОСТ ВІДКЛЮЧИВСЯ'),
  'HOST LEFT': U('ჰოსტი წავიდა', 'ХОСТ УШЁЛ', 'ХОСТ ПІШОВ'),
  'MAP INTEL': U('რუკის მონაცემები', 'РАЗВЕДДАННЫЕ', 'РОЗВІДДАНІ'),
  'RADIO TOWER ONLINE': U('რადიოანძა ჩაირთო', 'РАДИОВЫШКА РАБОТАЕТ', 'РАДІОВЕЖА ПРАЦЮЄ'),
  'VAULT OPENED': U('საცავი გაიხსნა', 'ХРАНИЛИЩЕ ОТКРЫТО', 'СХОВИЩЕ ВІДЧИНЕНО'),
  'CAMPFIRE STORY': U('ცეცხლთან ამბავი', 'ИСТОРИЯ У КОСТРА', 'ІСТОРІЯ БІЛЯ ВОГНИЩА'),
  'WILDFIRE': U('ხანძარი', 'ПОЖАР', 'ПОЖЕЖА'),
  'BROKEN DOWN': U('გაფუჭდა', 'СЛОМАЛСЯ', 'ЗЛАМАВСЯ'),
  'SENTRY': U('ტურელი', 'ТУРЕЛЬ', 'ТУРЕЛЬ'),
  'ARTIFACTS MARKED': U('არტეფაქტები მონიშნულია', 'АРТЕФАКТЫ ОТМЕЧЕНЫ', 'АРТЕФАКТИ ПОЗНАЧЕНО'),
  'GATHER AT THE HATCH': U('შეიკრიბეთ ლუკთან', 'СОБИРАЙТЕСЬ У ЛЮКА', 'ЗБИРАЙТЕСЯ БІЛЯ ЛЮКА'),
  'WAITING FOR THE TEAM': U('გუნდს ველოდებით', 'ЖДЁМ КОМАНДУ', 'ЧЕКАЄМО КОМАНДУ'),
  'KEYCARD': U('გასაღები-ბარათი', 'КЛЮЧ-КАРТА', 'КЛЮЧ-КАРТКА'),
  'WATCHTOWER': U('საგუშაგო კოშკი', 'ВЫШКА', 'ВЕЖА'),
  'ESCAPE READY': U('გაქცევისთვის მზადაა', 'ПОБЕГ ГОТОВ', 'ВТЕЧА ГОТОВА'),
  'SHIELD': U('ფარი', 'ЩИТ', 'ЩИТ'),
  'A GIFT': U('საჩუქარი', 'ПОДАРОК', 'ПОДАРУНОК'),
  'A JOB': U('სამუშაო', 'РАБОТА', 'РОБОТА'),
  'IT\'S A TRAP!': U('ეს ხაფანგია!', 'ЭТО ЛОВУШКА!', 'ЦЕ ПАСТКА!'),
  'JOB DONE': U('სამუშაო შესრულდა', 'РАБОТА ВЫПОЛНЕНА', 'РОБОТУ ВИКОНАНО'),
  'JOB FAILED': U('სამუშაო ჩავარდა', 'РАБОТА ПРОВАЛЕНА', 'РОБОТУ ПРОВАЛЕНО'),
  'NO MONEY': U('ფული არ არის', 'НЕТ ДЕНЕГ', 'НЕМАЄ ГРОШЕЙ'),
  'TRADE': U('ვაჭრობა', 'ТОРГОВЛЯ', 'ТОРГІВЛЯ'),
  'The Zone is hungry today. Do not feed it.': U('ზონა დღეს მშიერია. ნუ აჭმევ.', 'Зона сегодня голодная. Не корми её собой.', 'Зона сьогодні голодна. Не годуй її собою.'),
  'Bloodsuckers love the dark. Watch the shadows.': U('სისხლისმწოველებს სიბნელე უყვართ. ჩრდილებს უყურე.', 'Кровососы любят темноту. Следи за тенями.', 'Кровососи люблять темряву. Стеж за тінями.'),
  'Rain again. Electro anomalies go crazy in this weather.': U('ისევ წვიმს. ელექტრო ანომალიები ასეთ ამინდში გიჟდებიან.', 'Опять дождь. Электры в такую погоду бесятся.', 'Знову дощ. Електри в таку погоду шаленіють.'),
  'Rain again. Electro anomalies are going crazy in this weather.': U('ისევ წვიმს. ელექტრო ანომალიები ასეთ ამინდში გიჟდებიან.', 'Опять дождь. Электры в такую погоду бесятся.', 'Знову дощ. Електри в таку погоду шаленіють.'),
  'You actually did it. The Zone will remember your name.': U('შენ ეს მართლა გააკეთე. ზონა შენს სახელს დაიმახსოვრებს.', 'Ты правда это сделал. Зона запомнит твоё имя.', 'Ти справді це зробив. Зона запамʼятає твоє імʼя.'),
  'The Zone grows stronger.': U('ზონა ძლიერდება.', 'Зона крепнет.', 'Зона міцніє.'),
  'The Zone grows stronger. So do its rewards.': U('ზონა ძლიერდება. მისი ჯილდოებიც.', 'Зона крепнет. Как и её награды.', 'Зона міцніє. Як і її нагороди.'),
  'It dropped a stash. Grab it!': U('სამალავი დააგდო. აიღე!', 'Он оставил тайник. Хватай!', 'Він залишив схованку. Хапай!'),
  'Same seed for everyone today.': U('დღეს ყველასთვის ერთი სიდია.', 'Сегодня у всех один сид.', 'Сьогодні в усіх один сід.'),
  'ACTIVATE': U('ჩართვა', 'ВКЛЮЧИТЬ', 'УВІМКНУТИ'), 'CLIMB': U('ასვლა', 'ПОДНЯТЬСЯ', 'ПІДНЯТИСЯ'), 'ESCAPE JEEP': U('გაქცევის ჯიპი', 'ДЖИП ДЛЯ ПОБЕГА', 'ДЖИП ДЛЯ ВТЕЧІ'), 'SHELTER': U('თავშესაფარი', 'УКРЫТИЕ', 'УКРИТТЯ'), 'STAND HERE TO REVIVE': U('დადექი აქ გასაცოცხლებლად', 'ВСТАНЬ СЮДА, ЧТОБЫ ПОДНЯТЬ', 'СТАНЬ СЮДИ, ЩОБ ПІДНЯТИ'),
  '[Space] jump off': U('[Space] ჩამოხტომა', '[Пробел] спрыгнуть', '[Пробіл] зістрибнути'), 'Dash to jump off': U('რივოკი — ჩამოხტომა', 'Рывок — спрыгнуть', 'Ривок — зістрибнути'), '+15 max HP, heal fully': U('+15 მაქს. სიცოცხლე, სრული მკურნალობა', '+15 к макс. ОЗ, полное лечение', '+15 до макс. ОЗ, повне лікування'), 'Get off the tracks!': U('ლიანდაგიდან გადადი!', 'Уйди с путей!', 'Зійди з колії!'),
  'Auto-pick ON': U('ავტო-არჩევა ჩართ.', 'Автовыбор ВКЛ', 'Автовибір УВІМК'),
  'Auto-pick OFF': U('ავტო-არჩევა გამორთ.', 'Автовыбор ВЫКЛ', 'Автовибір ВИМК'),
});
// top difficulties and paces
Object.assign(UI_TR, {
  'Nightmare': U('კოშმარი', 'Кошмар', 'Кошмар'),
  'Mutants hit like trucks. Your damage reduction is capped at 60%. ×2.5 rubles.': U('მუტანტები სატვირთოსავით ურტყამენ. ზიანის შემცირება მაქს. 60%. ×2.5 რუბლი.', 'Мутанты бьют как грузовики. Снижение урона не больше 60%. ×2.5 рубля.', 'Мутанти бʼють як вантажівки. Зниження шкоди не більше 60%. ×2.5 рубля.'),
  'Hell': U('ჯოჯოხეთი', 'Ад', 'Пекло'),
  'Endless hordes. Damage reduction capped at 50%, healing −30%. ×3 rubles.': U('დაუსრულებელი ურდოები. ზიანის შემცირება მაქს. 50%, მკურნალობა −30%. ×3 რუბლი.', 'Бесконечные орды. Снижение урона не больше 50%, лечение −30%. ×3 рубля.', 'Нескінченні орди. Зниження шкоди не більше 50%, лікування −30%. ×3 рубля.'),
  'Apocalypse': U('აპოკალიფსი', 'Апокалипсис', 'Апокаліпсис'),
  'The Zone ends here. Reduction capped at 40%, healing −45%. ×3.6 rubles.': U('ზონა აქ მთავრდება. შემცირება მაქს. 40%, მკურნალობა −45%. ×3.6 რუბლი.', 'Здесь Зона заканчивается. Снижение не больше 40%, лечение −45%. ×3.6 рубля.', 'Тут Зона закінчується. Зниження не більше 40%, лікування −45%. ×3.6 рубля.'),
  'Oblivion': U('დავიწყება', 'Забвение', 'Забуття'),
  'Almost nothing survives. Reduction capped at 30%, healing halved. ×4.3 rubles.': U('თითქმის არაფერი გადარჩება. შემცირება მაქს. 30%, მკურნალობა ორჯერ ნაკლები. ×4.3 რუბლი.', 'Почти никто не выживает. Снижение не больше 30%, лечение вдвое слабее. ×4.3 рубля.', 'Майже ніхто не виживає. Зниження не більше 30%, лікування вдвічі слабше. ×4.3 рубля.'),
  'Impossible': U('შეუძლებელი', 'Невозможно', 'Неможливо'),
  'The absolute maximum. Reduction capped at 20%, healing −60%, no mercy. ×5 rubles.': U('აბსოლუტური მაქსიმუმი. შემცირება მაქს. 20%, მკურნალობა −60%, წყალობის გარეშე. ×5 რუბლი.', 'Абсолютный максимум. Снижение не больше 20%, лечение −60%, без пощады. ×5 рублей.', 'Абсолютний максимум. Зниження не більше 20%, лікування −60%, без пощади. ×5 рублів.'),
  'Savage': U('სასტიკი II', 'Свирепый', 'Лютий'),
  'Merciless': U('უწყალო', 'Безжалостный', 'Безжальний'),
  'Hellish': U('ჯოჯოხეთური', 'Адский', 'Пекельний'),
  'Cataclysm': U('კატაკლიზმი', 'Катаклизм', 'Катаклізм'),
  'Absolute': U('აბსოლუტური', 'Абсолютный', 'Абсолютний'),
  '+1300% every 10 minutes. The absolute maximum.': U('+1300% ყოველ 10 წუთში. აბსოლუტური მაქსიმუმი.', '+1300% каждые 10 минут. Абсолютный максимум.', '+1300% кожні 10 хвилин. Абсолютний максимум.'),
  '✨ Suggested: play a run first': U('✨ რეკომენდაცია: ჯერ ითამაშე', '✨ Совет: сначала сыграй забег', '✨ Порада: спершу зіграй забіг'), 'Based on your last 3 runs': U('შენი ბოლო 3 რბოლის მიხედვით', 'По твоим последним 3 забегам', 'За твоїми останніми 3 забігами'), 'Difficulty & pace': U('სირთულე და ტემპი', 'Сложность и темп', 'Складність і темп'),
  'harder': U('უფრო რთული', 'сложнее', 'складніше'), 'easier': U('უფრო მარტივი', 'легче', 'легше'), 'keep': U('დატოვე', 'оставить', 'залишити'),
  'move': U('სიარული', 'движение', 'рух'), 'dash': U('რივოკი', 'рывок', 'ривок'), 'ability': U('უნარი', 'способность', 'здібність'), 'artifact': U('არტეფაქტი', 'артефакт', 'артефакт'), 'ride': U('ტრანსპორტი', 'транспорт', 'транспорт'), 'bolt': U('ჭანჭიკი', 'болт', 'болт'), 'radio': U('რადიო', 'радио', 'радіо'), 'map': U('რუკა', 'карта', 'мапа'), 'pause': U('პაუზა', 'пауза', 'пауза'),
  '⏱️ Crew runs: time survived': U('⏱️ რაზმის რბოლები: გადარჩენის დრო', '⏱️ Забеги отряда: время выживания', '⏱️ Забіги загону: час виживання'), '💀 Crew runs: kills': U('💀 რაზმის რბოლები: მკვლელობები', '💀 Забеги отряда: убийства', '💀 Забіги загону: вбивства'),
  'Pace': U('ტემპი', 'Темп', 'Темп'),
  'Difficulty': U('სირთულე', 'Сложность', 'Складність'),
});
// mastery, ascension, apex, charts
Object.assign(UI_TR, {
  'Firepower': U('ცეცხლის ძალა', 'Огневая мощь', 'Вогнева міць'),
  '+1% damage per rank': U('+1% ზიანი თითო რანგზე', '+1% урона за ранг', '+1% шкоди за ранг'),
  'Vitality': U('სიცოცხლისუნარიანობა', 'Живучесть', 'Живучість'),
  '+1% max HP per rank': U('+1% მაქს. სიცოცხლე თითო რანგზე', '+1% к макс. ОЗ за ранг', '+1% до макс. ОЗ за ранг'),
  'Stride': U('ნაბიჯი', 'Шаг', 'Крок'),
  '+0.5% speed per rank': U('+0.5% სიჩქარე თითო რანგზე', '+0.5% скорости за ранг', '+0.5% швидкості за ранг'),
  'Insight': U('გამჭრიახობა', 'Прозорливость', 'Прозорливість'),
  '+1% experience per rank': U('+1% გამოცდილება თითო რანგზე', '+1% опыта за ранг', '+1% досвіду за ранг'),
  'Greed': U('სიხარბე', 'Жадность', 'Жадібність'),
  '+1% rubles per rank': U('+1% რუბლი თითო რანგზე', '+1% рублей за ранг', '+1% рублів за ранг'),
  'Reach': U('სიშორე', 'Размах', 'Розмах'),
  '+0.5% area of effect per rank': U('+0.5% მოქმედების არე თითო რანგზე', '+0.5% площади за ранг', '+0.5% площі за ранг'),
  'Fortune': U('ბედი', 'Фортуна', 'Фортуна'),
  '+1 luck every 10 ranks': U('+1 იღბალი ყოველ 10 რანგზე', '+1 удачи каждые 10 рангов', '+1 удачі кожні 10 рангів'),
  '🌟 Mastery': U('🌟 ოსტატობა', '🌟 Мастерство', '🌟 Майстерність'),
  '📈 Stats': U('📈 სტატისტიკა', '📈 Статистика', '📈 Статистика'),
  'MASTERY · endless upgrades from every run': U('ოსტატობა · უსასრულო გაუმჯობესებები ყოველი რბოლიდან', 'МАСТЕРСТВО · бесконечные улучшения за каждый забег', 'МАЙСТЕРНІСТЬ · нескінченні покращення за кожен забіг'),
  '❤️ Health over time': U('❤️ სიცოცხლე დროში', '❤️ Здоровье по времени', '❤️ Здоровʼя за часом'),
  '💀 Kills over time': U('💀 მკვლელობები დროში', '💀 Убийства по времени', '💀 Вбивства за часом'),
  '⭐ Level over time': U('⭐ დონე დროში', '⭐ Уровень по времени', '⭐ Рівень за часом'),
  '⏱️ Time survived': U('⏱️ გადარჩენის დრო', '⏱️ Время выживания', '⏱️ Час виживання'),
  '❤️ Average health': U('❤️ საშუალო სიცოცხლე', '❤️ Среднее здоровье', '❤️ Середнє здоровʼя'),
  '🔥 Challenge (aim 55%)': U('🔥 სირთულე (მიზანი 55%)', '🔥 Нагрузка (цель 55%)', '🔥 Навантаження (мета 55%)'),
  'not enough data yet': U('ჯერ მონაცემები არ კმარა', 'пока мало данных', 'поки мало даних'),
  'LIFETIME': U('სულ', 'ЗА ВСЁ ВРЕМЯ', 'ЗА ВЕСЬ ЧАС'),
  'YOUR LAST RUN': U('შენი ბოლო რბოლა', 'ТВОЙ ПОСЛЕДНИЙ ЗАБЕГ', 'ТВІЙ ОСТАННІЙ ЗАБІГ'),
  'Play a run to see its charts.': U('ითამაშე რბოლა, რომ გრაფიკები ნახო.', 'Сыграй забег, чтобы увидеть графики.', 'Зіграй забіг, щоб побачити графіки.'),
  'mastery': U('ოსტატობა', 'мастерство', 'майстерність'),
  'Ascension': U('ამაღლება', 'Вознесение', 'Вознесіння'),
  'Endless extra difficulty on top of everything': U('უსასრულო დამატებითი სირთულე ყველაფრის თავზე', 'Бесконечная доп. сложность поверх всего', 'Нескінченна дод. складність понад усе'),
  '👑 APEX SLAIN': U('👑 აპექსი მოკლულია', '👑 АПЕКС УБИТ', '👑 АПЕКС ВБИТО'),
  '+300 ₽ and an artifact.': U('+300 ₽ და არტეფაქტი.', '+300 ₽ и артефакт.', '+300 ₽ і артефакт.'),
  'An Apex mutant hunts you. Big reward if you bring it down.': U('აპექს-მუტანტი შენზე ნადირობს. დიდი ჯილდო, თუ მოკლავ.', 'Апекс-мутант охотится на тебя. Большая награда, если убьёшь.', 'Апекс-мутант полює на тебе. Велика нагорода, якщо вбʼєш.'),
});
// extra difficulties and paces
Object.assign(UI_TR, {
  'Doom': U('განწირულება', 'Рок', 'Приреченість'),
  'Reduction capped at 15%, healing −65%. ×6 rubles.': U('შემცირება მაქს. 15%, მკურნალობა −65%. ×6 რუბლი.', 'Снижение не больше 15%, лечение −65%. ×6 рублей.', 'Зниження не більше 15%, лікування −65%. ×6 рублів.'),
  'Annihilation': U('განადგურება', 'Аннигиляция', 'Анігіляція'),
  'Reduction capped at 10%, healing −70%. ×7 rubles.': U('შემცირება მაქს. 10%, მკურნალობა −70%. ×7 რუბლი.', 'Снижение не больше 10%, лечение −70%. ×7 рублей.', 'Зниження не більше 10%, лікування −70%. ×7 рублів.'),
  'Eternal Night': U('მარადიული ღამე', 'Вечная ночь', 'Вічна ніч'),
  'Reduction capped at 8%, healing −75%. ×8.5 rubles.': U('შემცირება მაქს. 8%, მკურნალობა −75%. ×8.5 რუბლი.', 'Снижение не больше 8%, лечение −75%. ×8.5 рубля.', 'Зниження не більше 8%, лікування −75%. ×8.5 рубля.'),
  'Zone God': U('ზონის ღმერთი', 'Бог Зоны', 'Бог Зони'),
  'Reduction capped at 5%, healing −80%. ×10 rubles.': U('შემცირება მაქს. 5%, მკურნალობა −80%. ×10 რუბლი.', 'Снижение не больше 5%, лечение −80%. ×10 рублей.', 'Зниження не більше 5%, лікування −80%. ×10 рублів.'),
  'Singularity': U('სინგულარობა', 'Сингулярность', 'Сингулярність'),
  'No damage reduction, healing −85%. The true end. ×12 rubles.': U('ზიანის შემცირების გარეშე, მკურნალობა −85%. ნამდვილი დასასრული. ×12 რუბლი.', 'Без снижения урона, лечение −85%. Настоящий конец. ×12 рублей.', 'Без зниження шкоди, лікування −85%. Справжній кінець. ×12 рублів.'),
  'Relentless': U('შეუჩერებელი', 'Неумолимый', 'Невблаганний'),
  'Doomsday': U('განკითხვის დღე', 'Судный день', 'Судний день'),
  'Extinction': U('გადაშენება', 'Вымирание', 'Вимирання'),
  'Event Horizon': U('მოვლენათა ჰორიზონტი', 'Горизонт событий', 'Горизонт подій'),
  'Beyond': U('მიღმა', 'За гранью', 'За межею'),
  '+7000% every 10 minutes. Nothing is faster.': U('+7000% ყოველ 10 წუთში. ამაზე სწრაფი არაფერია.', '+7000% каждые 10 минут. Быстрее не бывает.', '+7000% кожні 10 хвилин. Швидше не буває.'),
  'Applies from your next run.': U('მოქმედებს შემდეგი რბოლიდან.', 'Действует со следующего забега.', 'Діє з наступного забігу.'),
});
// casino, tiers, infographics
Object.assign(UI_TR, {
  '🎰 SLOTS · three of a kind pays big': U('🎰 სლოტები · სამი ერთნაირი დიდად იხდის', '🎰 СЛОТЫ · три одинаковых платят много', '🎰 СЛОТИ · три однакових платять багато'),
  '🪙 DOUBLE OR NOTHING · climb the ladder, cash out any time': U('🪙 ორმაგი ან არაფერი · ადი კიბეზე, ფული ნებისმიერ დროს აიღე', '🪙 ВСЁ ИЛИ НИЧЕГО · поднимайся по лестнице, забирай когда угодно', '🪙 ВСЕ АБО НІЧОГО · піднімайся драбиною, забирай будь-коли'),
  '📈 CRASH · cash out before it crashes': U('📈 კრაში · აიღე ფული ჩამოვარდნამდე', '📈 КРАШ · забери деньги до обвала', '📈 КРАШ · забери гроші до обвалу'),
  '🌟 MASTERY EXCHANGE · turn rubles into Mastery XP (2 ₽ = 1 XP)': U('🌟 ოსტატობის გაცვლა · რუბლი ოსტატობის XP-ში (2 ₽ = 1 XP)', '🌟 ОБМЕН МАСТЕРСТВА · рубли в опыт мастерства (2 ₽ = 1 XP)', '🌟 ОБМІН МАЙСТЕРНОСТІ · рублі в досвід майстерності (2 ₽ = 1 XP)'),
  'Pick a bet to start.': U('აირჩიე ფსონი დასაწყებად.', 'Выбери ставку, чтобы начать.', 'Обери ставку, щоб почати.'),
  '🪙 FLIP (×2)': U('🪙 აგდება (×2)', '🪙 БРОСОК (×2)', '🪙 КИДОК (×2)'),
  '💰 CASH OUT': U('💰 ფულის აღება', '💰 ЗАБРАТЬ', '💰 ЗАБРАТИ'),
  'No luck.': U('არ გაგიმართლა.', 'Не повезло.', 'Не пощастило.'),
  'Tails. You lost it all.': U('საფეხური. ყველაფერი წააგე.', 'Решка. Ты всё проиграл.', 'Решка. Ти все програв.'),
  'No rubles to bet.': U('ფსონისთვის რუბლი არ გაქვს.', 'Нет рублей для ставки.', 'Немає рублів для ставки.'),
  '📖 Codex': U('📖 კოდექსი', '📖 Кодекс', '📖 Кодекс'),
  '🏆 Achievements': U('🏆 მიღწევები', '🏆 Достижения', '🏆 Досягнення'),
  '🗺️ Maps': U('🗺️ რუკები', '🗺️ Карты', '🗺️ Мапи'),
  '👑 Apex': U('👑 აპექსი', '👑 Апекс', '👑 Апекс'),
  '💰 Rubles after each run': U('💰 რუბლი ყოველი რბოლის შემდეგ', '💰 Рубли после каждого забега', '💰 Рублі після кожного забігу'),
  'COMPLETION': U('დასრულება', 'ПРОГРЕСС', 'ПРОГРЕС'),
  'ALL IN': U('ყველაფერი', 'ВА-БАНК', 'ВА-БАНК'),
  '🧬 Cyberware': U('🧬 კიბერიმპლანტები', '🧬 Киберимпланты', '🧬 Кіберімпланти'),
  '🛒 Market': U('🛒 ბაზარი', '🛒 Рынок', '🛒 Ринок'),
  '🎰 Casino': U('🎰 კაზინო', '🎰 Казино', '🎰 Казино'),
  'BODY': U('სხეული', 'ТЕЛО', 'ТІЛО'), 'REFLEXES': U('რეფლექსები', 'РЕФЛЕКСЫ', 'РЕФЛЕКСИ'), 'TECH': U('ტექნიკა', 'ТЕХНИКА', 'ТЕХНІКА'), 'INTELLIGENCE': U('ინტელექტი', 'ИНТЕЛЛЕКТ', 'ІНТЕЛЕКТ'), 'COOL': U('სიმშვიდე', 'ХЛАДНОКРОВИЕ', 'ХОЛОДНОКРОВНІСТЬ'),
  'MAX': U('მაქს', 'МАКС', 'МАКС'),
  'Each row of perks needs a higher attribute level (3 per row).': U('ყოველ რიგს უფრო მაღალი ატრიბუტის დონე სჭირდება (3 თითო რიგზე).', 'Каждый ряд перков требует более высокого уровня атрибута (3 за ряд).', 'Кожен ряд перків потребує вищого рівня атрибута (3 за ряд).'),
  'Tap a perk to see it. Glowing links show which perks feed which.': U('შეეხე პერკს სანახავად. მანათობელი ხაზები აჩვენებს, რომელი პერკი რომელს კვებავს.', 'Нажми на перк, чтобы увидеть его. Светящиеся линии показывают связи перков.', 'Натисни на перк, щоб побачити його. Світні лінії показують звʼязки перків.'),
  'INSTALLED': U('დაყენებულია', 'УСТАНОВЛЕНО', 'ВСТАНОВЛЕНО'),
  'Smart Link': U('სმარტ-ლინკი', 'Смарт-линк', 'Смарт-лінк'), 'Subdermal Armor': U('კანქვეშა ჯავშანი', 'Подкожная броня', 'Підшкірна броня'), 'Reinforced Tendons': U('გამაგრებული მყესები', 'Усиленные сухожилия', 'Посилені сухожилля'), 'Synaptic Accelerator': U('სინაფსური ამაჩქარებელი', 'Синаптический ускоритель', 'Синаптичний прискорювач'), 'Blast Coprocessor': U('აფეთქების კოპროცესორი', 'Взрывной сопроцессор', 'Вибуховий співпроцесор'), 'Neural Processor': U('ნეირო-პროცესორი', 'Нейропроцессор', 'Нейропроцесор'), 'Kiroshi Optics': U('კიროში ოპტიკა', 'Оптика Kiroshi', 'Оптика Kiroshi'), 'Biomonitor': U('ბიომონიტორი', 'Биомонитор', 'Біомонітор'), 'Titanium Bones': U('ტიტანის ძვლები', 'Титановые кости', 'Титанові кістки'), 'Mag Implant': U('მაგნიტური იმპლანტი', 'Маг-имплант', 'Маг-імплант'), 'Fortune Chip': U('იღბლის ჩიპი', 'Чип удачи', 'Чип удачі'), 'Fixer Link': U('ფიქსერის კავშირი', 'Связь с фиксером', 'Звʼязок із фіксером'), 'Kerenzikov': U('კერენზიკოვი', 'Керензиков', 'Керензиков'), 'Blood Pump': U('სისხლის ტუმბო', 'Кровяной насос', 'Кровʼяний насос'), 'Pain Editor': U('ტკივილის რედაქტორი', 'Редактор боли', 'Редактор болю'), 'Sandevistan': U('სანდევისტანი', 'Сандевистан', 'Сандевістан'), 'Second Heart': U('მეორე გული', 'Второе сердце', 'Друге серце'),
  'damage': U('ზიანი', 'урона', 'шкоди'), 'max HP': U('მაქს. HP', 'макс. HP', 'макс. HP'), 'speed': U('სიჩქარე', 'скорости', 'швидкості'), 'fire rate': U('სროლის სიჩქარე', 'скорострельности', 'скорострільності'), 'area': U('არეალი', 'площади', 'площі'), 'experience': U('გამოცდილება', 'опыта', 'досвіду'), 'crit chance': U('კრიტის შანსი', 'шанса крита', 'шансу криту'), 'HP/s regen': U('HP/წმ აღდგენა', 'HP/с регенерации', 'HP/с регенерації'), 'damage resist': U('ზიანის წინააღმდეგობა', 'сопротивления урону', 'опору шкоді'), 'pickup range': U('აკრეფის რადიუსი', 'радиуса подбора', 'радіуса підбору'), 'luck': U('იღბალი', 'удачи', 'удачі'), 'rubles': U('რუბლი', 'рублей', 'рублів'), 'dash': U('ნახტომი', 'рывка', 'ривка'), 'lifesteal': U('სიცოცხლის მოპარვა', 'вампиризма', 'вампіризму'), 'thorns': U('ეკლები', 'шипов', 'шипів'), 'crit damage': U('კრიტის ზიანი', 'крит. урона', 'крит. шкоди'), '+1 revive': U('+1 აღდგომა', '+1 воскрешение', '+1 воскресіння'),
  'BLACK MARKET · supplies are used up on your next run (stack up to 5)': U('შავი ბაზარი · მარაგი შემდეგ რბოლაზე იხარჯება (მაქს. 5)', 'ЧЁРНЫЙ РЫНОК · припасы тратятся в следующем забеге (до 5)', 'ЧОРНИЙ РИНОК · припаси витрачаються в наступному забігу (до 5)'),
  'Combat Stims': U('საბრძოლო სტიმულატორი', 'Боевые стимуляторы', 'Бойові стимулятори'), 'Ceramic Plates': U('კერამიკული ფირფიტები', 'Керамические пластины', 'Керамічні пластини'), 'Learning Chip': U('სასწავლო ჩიპი', 'Обучающий чип', 'Навчальний чип'), 'Sprint Boots': U('სპრინტის ჩექმები', 'Спринтерские ботинки', 'Спринтерські черевики'), 'Lucky Charm': U('იღბლის ამულეტი', 'Талисман удачи', 'Талісман удачі'), 'Spare Life': U('სათადარიგო სიცოცხლე', 'Запасная жизнь', 'Запасне життя'), 'Fixer Contract': U('ფიქსერის კონტრაქტი', 'Контракт фиксера', 'Контракт фіксера'), 'Medkit Crate': U('აფთიაქების ყუთი', 'Ящик аптечек', 'Ящик аптечок'),
  '+25% damage for the next run': U('+25% ზიანი შემდეგ რბოლაზე', '+25% урона на следующий забег', '+25% шкоди на наступний забіг'), '+40% max HP for the next run': U('+40% მაქს. HP შემდეგ რბოლაზე', '+40% макс. HP на следующий забег', '+40% макс. HP на наступний забіг'), '+40% experience for the next run': U('+40% გამოცდილება შემდეგ რბოლაზე', '+40% опыта на следующий забег', '+40% досвіду на наступний забіг'), '+15% speed for the next run': U('+15% სიჩქარე შემდეგ რბოლაზე', '+15% скорости на следующий забег', '+15% швидкості на наступний забіг'), '+3 luck for the next run': U('+3 იღბალი შემდეგ რბოლაზე', '+3 удачи на следующий забег', '+3 удачі на наступний забіг'), '+1 revive for the next run': U('+1 აღდგომა შემდეგ რბოლაზე', '+1 воскрешение на следующий забег', '+1 воскресіння на наступний забіг'), '+50% rubles for the next run': U('+50% რუბლი შემდეგ რბოლაზე', '+50% рублей на следующий забег', '+50% рублів на наступний забіг'), '+3 medkits for the next run': U('+3 აფთიაქი შემდეგ რბოლაზე', '+3 аптечки на следующий забег', '+3 аптечки на наступний забіг'),
  'FULL': U('სავსეა', 'ПОЛНО', 'ПОВНО'), 'OWNED': U('გაქვს', 'ЕСТЬ', 'Є'), '🛒 SUPPLIES USED': U('🛒 მარაგი გამოყენებულია', '🛒 ПРИПАСЫ ИСПОЛЬЗОВАНЫ', '🛒 ПРИПАСИ ВИКОРИСТАНО'),
  'Tushonka Can': U('ტუშონკის ქილა', 'Банка тушёнки', 'Банка тушонки'), 'Old Flashlight': U('ძველი ფანარი', 'Старый фонарик', 'Старий ліхтарик'), 'Army Radio': U('სამხედრო რაცია', 'Армейская рация', 'Армійська рація'), 'Campfire Guitar': U('კოცონის გიტარა', 'Гитара у костра', 'Гітара біля багаття'), 'Pripyat Teddy': U('პრიპიატის დათუნია', 'Мишка из Припяти', 'Ведмедик із Припʼяті'), 'Matryoshka': U('მატრიოშკა', 'Матрёшка', 'Матрьошка'), 'Cuckoo Clock': U('გუგულიანი საათი', 'Часы с кукушкой', 'Годинник із зозулею'), 'Monolith Shard': U('მონოლითის ნატეხი', 'Осколок Монолита', 'Уламок Моноліту'), 'Hero Medal': U('გმირის მედალი', 'Медаль героя', 'Медаль героя'), 'Ural Motorcycle': U('მოტოციკლი „ურალი“', 'Мотоцикл «Урал»', 'Мотоцикл «Урал»'), 'Fallen Satellite': U('ჩამოვარდნილი თანამგზავრი', 'Упавший спутник', 'Впалий супутник'), 'Mi-24 Wreck': U('Mi-24-ის ნამსხვრევები', 'Обломки Ми-24', 'Уламки Мі-24'), 'Golden Samovar': U('ოქროს სამოვარი', 'Золотой самовар', 'Золотий самовар'), 'Heart of the Zone': U('ზონის გული', 'Сердце Зоны', 'Серце Зони'), 'Crown of the Wish Granter': U('სურვილების ამსრულებლის გვირგვინი', 'Корона Исполнителя желаний', 'Корона Виконавця бажань'),
  '★ ZONE CASINO ★': U('★ ზონის კაზინო ★', '★ КАЗИНО ЗОНЫ ★', '★ КАЗИНО ЗОНИ ★'), '₽ chips': U('₽ ფიშკები', '₽ фишки', '₽ фішки'), 'VIP': U('VIP', 'VIP', 'VIP'), '☢️ jackpot': U('☢️ ჯეკპოტი', '☢️ джекпот', '☢️ джекпот'), 'biggest win': U('უდიდესი მოგება', 'крупнейший выигрыш', 'найбільший виграш'), 'wagered': U('დადებული', 'поставлено', 'поставлено'),
  'Rookie': U('ახალბედა', 'Новичок', 'Новачок'), 'Bronze': U('ბრინჯაო', 'Бронза', 'Бронза'), 'Silver': U('ვერცხლი', 'Серебро', 'Срібло'), 'Gold': U('ოქრო', 'Золото', 'Золото'), 'Platinum': U('პლატინა', 'Платина', 'Платина'), 'Diamond': U('ბრილიანტი', 'Бриллиант', 'Діамант'),
  'Roulette': U('რულეტკა', 'Рулетка', 'Рулетка'), 'Slots': U('სლოტები', 'Слоты', 'Слоти'), 'Blackjack': U('ბლექჯეკი', 'Блэкджек', 'Блекджек'), 'Plinko': U('პლინკო', 'Плинко', 'Плінко'), 'Crash': U('კრაში', 'Краш', 'Краш'), 'Dice': U('კამათელი', 'Кости', 'Кості'), 'Coin Ladder': U('მონეტის კიბე', 'Лестница монет', 'Драбина монет'), 'Zone Wheel': U('ზონის ბორბალი', 'Колесо Зоны', 'Колесо Зони'), 'Exchange': U('გაცვლა', 'Обмен', 'Обмін'),
  'BET': U('ფსონი', 'СТАВКА', 'СТАВКА'), '1st 12': U('1-ლი 12', '1-я 12', '1-а 12'), '2nd 12': U('მე-2 12', '2-я 12', '2-а 12'), '3rd 12': U('მე-3 12', '3-я 12', '3-я 12'), 'EVEN': U('ლუწი', 'ЧЁТ', 'ПАРНЕ'), 'ODD': U('კენტი', 'НЕЧЕТ', 'НЕПАРНЕ'), '🔴 RED': U('🔴 წითელი', '🔴 КРАСНОЕ', '🔴 ЧЕРВОНЕ'), '⚫ BLACK': U('⚫ შავი', '⚫ ЧЁРНОЕ', '⚫ ЧОРНЕ'),
  '🎡 SPIN': U('🎡 დატრიალება', '🎡 КРУТИТЬ', '🎡 КРУТИТИ'), 'CLEAR BETS': U('ფსონების მოხსნა', 'СНЯТЬ СТАВКИ', 'ЗНЯТИ СТАВКИ'), '↺ REBET': U('↺ გამეორება', '↺ ПОВТОРИТЬ', '↺ ПОВТОРИТИ'), 'Tap the table to place chips.': U('შეეხე მაგიდას ფიშკების დასადებად.', 'Нажимай на стол, чтобы ставить фишки.', 'Натискай на стіл, щоб ставити фішки.'), 'No more bets…': U('ფსონები აღარ მიიღება…', 'Ставки больше не принимаются…', 'Ставки більше не приймаються…'),
  'SPINNING…': U('ტრიალებს…', 'КРУТИТСЯ…', 'КРУТИТЬСЯ…'), 'PLACE BETS': U('დადე ფსონები', 'ДЕЛАЙТЕ СТАВКИ', 'РОБІТЬ СТАВКИ'), 'number pays ×36 · color ×2 · dozen ×3': U('რიცხვი ×36 · ფერი ×2 · ათეული ×3', 'число ×36 · цвет ×2 · дюжина ×3', 'число ×36 · колір ×2 · дюжина ×3'),
  '🎰 SPIN': U('🎰 დატრიალება', '🎰 КРУТИТЬ', '🎰 КРУТИТИ'), 'AUTO ×10': U('ავტო ×10', 'АВТО ×10', 'АВТО ×10'), 'Spinning…': U('ტრიალებს…', 'Крутится…', 'Крутиться…'), 'No luck this time.': U('ამჯერად არ გაგიმართლა.', 'В этот раз не повезло.', 'Цього разу не пощастило.'), 'JACKPOT': U('ჯეკპოტი', 'ДЖЕКПОТ', 'ДЖЕКПОТ'),
  'DEALER': U('დილერი', 'ДИЛЕР', 'ДИЛЕР'), 'YOU': U('შენ', 'ТЫ', 'ТИ'), 'HIT': U('კიდევ', 'ЕЩЁ', 'ЩЕ'), 'STAND': U('გაჩერება', 'ХВАТИТ', 'ДОСИТЬ'), 'DOUBLE': U('გაორმაგება', 'УДВОИТЬ', 'ПОДВОЇТИ'), '🃏 DEAL': U('🃏 დარიგება', '🃏 РАЗДАТЬ', '🃏 РОЗДАТИ'), 'Push · bet returned': U('ფრე · ფსონი დაბრუნდა', 'Ничья · ставка возвращена', 'Нічия · ставку повернено'),
  '🔴 DROP': U('🔴 ჩაგდება', '🔴 БРОСИТЬ', '🔴 КИНУТИ'), 'DROP ×10': U('ჩაგდება ×10', 'БРОСИТЬ ×10', 'КИНУТИ ×10'), '🚀 LAUNCH': U('🚀 გაშვება', '🚀 ЗАПУСК', '🚀 ЗАПУСК'), 'auto cash-out ×': U('ავტო-აღება ×', 'авто-вывод ×', 'авто-вивід ×'), 'off': U('გამორთ.', 'выкл', 'вимк'), 'Climbing…': U('მიიწევს მაღლა…', 'Растёт…', 'Росте…'),
  'Roll under': U('ნაკლები ვიდრე', 'Меньше чем', 'Менше ніж'), '🎲 ROLL': U('🎲 გაგორება', '🎲 БРОСОК', '🎲 КИДОК'), 'Heads ☢️ doubles it, tails 💀 loses it all.': U('☢️ აორმაგებს, 💀 ყველაფერს აგებინებს.', '☢️ удваивает, 💀 забирает всё.', '☢️ подвоює, 💀 забирає все.'),
  '🎡 SPIN · bet': U('🎡 დატრიალება · ფსონი', '🎡 КРУТИТЬ · ставка', '🎡 КРУТИТИ · ставка'), '💀 ×0 · the Zone takes it': U('💀 ×0 · ზონამ წაიღო', '💀 ×0 · Зона забирает', '💀 ×0 · Зона забирає'),
  'Turn rubles into Mastery XP: 2 ₽ = 1 XP. Mastery levels give points for endless upgrades.': U('გადაცვალე რუბლი ოსტატობის XP-ში: 2 ₽ = 1 XP. ოსტატობის დონეები უსასრულო გაუმჯობესების ქულებს იძლევა.', 'Меняй рубли на опыт мастерства: 2 ₽ = 1 XP. Уровни мастерства дают очки для бесконечных улучшений.', 'Міняй рублі на досвід майстерності: 2 ₽ = 1 XP. Рівні майстерності дають очки для нескінченних покращень.'), '🌟 EXCHANGE THE BET': U('🌟 ფსონის გაცვლა', '🌟 ОБМЕНЯТЬ СТАВКУ', '🌟 ОБМІНЯТИ СТАВКУ'),
  '↩ UNDO': U('↩ გაუქმება', '↩ ОТМЕНИТЬ', '↩ СКАСУВАТИ'),
  '📋 Missions': U('📋 მისიები', '📋 Миссии', '📋 Місії'), '📋 MISSIONS & BONUSES': U('📋 მისიები და ბონუსები', '📋 МИССИИ И БОНУСЫ', '📋 МІСІЇ ТА БОНУСИ'),
  'Daily Missions': U('დღიური მისიები', 'Ежедневные миссии', 'Щоденні місії'), 'Weekly Missions': U('კვირის მისიები', 'Еженедельные миссии', 'Щотижневі місії'), 'Daily Bonus': U('დღიური ბონუსი', 'Ежедневный бонус', 'Щоденний бонус'), 'Zone Pass': U('ზონის საშვი', 'Пропуск Зоны', 'Перепустка Зони'), 'Containers': U('კონტეინერები', 'Контейнеры', 'Контейнери'), 'Happy Hours': U('ბედნიერი საათები', 'Счастливые часы', 'Щасливі години'),
  'Kill {n} mutants': U('მოკალი {n} მუტანტი', 'Убей {n} мутантов', 'Вбий {n} мутантів'),
  'CLAIM': U('აღება', 'ЗАБРАТЬ', 'ЗАБРАТИ'), '✅ CLAIMED': U('✅ აღებულია', '✅ ПОЛУЧЕНО', '✅ ОТРИМАНО'), '🔄 FREE': U('🔄 უფასოდ', '🔄 БЕСПЛАТНО', '🔄 БЕЗКОШТОВНО'), 'CLAIM ALL': U('ყველას აღება', 'ЗАБРАТЬ ВСЁ', 'ЗАБРАТИ ВСЕ'), 'OPEN': U('გახსნა', 'ОТКРЫТЬ', 'ВІДКРИТИ'),
  'WEEKLY MISSIONS · bigger goals, every one gives a Rare Container': U('კვირის მისიები · დიდი მიზნები, თითოეული იშვიათ კონტეინერს იძლევა', 'ЕЖЕНЕДЕЛЬНЫЕ МИССИИ · большие цели, каждая даёт Редкий контейнер', 'ЩОТИЖНЕВІ МІСІЇ · великі цілі, кожна дає Рідкісний контейнер'),
  "🎁 CLAIM TODAY'S BONUS": U('🎁 დღევანდელი ბონუსის აღება', '🎁 ЗАБРАТЬ БОНУС ДНЯ', '🎁 ЗАБРАТИ БОНУС ДНЯ'),
  '👑 ELITE PASS': U('👑 ელიტური საშვი', '👑 ЭЛИТНЫЙ ПРОПУСК', '👑 ЕЛІТНА ПЕРЕПУСТКА'),
  'CONTAINERS · open them for rubles, supplies, Mastery XP, skill points and rare trophies': U('კონტეინერები · გახსენი რუბლის, მარაგის, ოსტატობის XP-ის, უნარის ქულებისა და იშვიათი ტროფეებისთვის', 'КОНТЕЙНЕРЫ · открывай ради рублей, припасов, опыта мастерства, очков навыков и редких трофеев', 'КОНТЕЙНЕРИ · відкривай заради рублів, припасів, досвіду майстерності, очок навичок і рідкісних трофеїв'),
  'Common Container': U('ჩვეულებრივი კონტეინერი', 'Обычный контейнер', 'Звичайний контейнер'), 'Rare Container': U('იშვიათი კონტეინერი', 'Редкий контейнер', 'Рідкісний контейнер'), 'Epic Container': U('ეპიკური კონტეინერი', 'Эпический контейнер', 'Епічний контейнер'), 'Legendary Container': U('ლეგენდარული კონტეინერი', 'Легендарный контейнер', 'Легендарний контейнер'),
  'Morning Shift': U('დილის ცვლა', 'Утренняя смена', 'Ранкова зміна'), 'Lunch Break': U('სადილის შესვენება', 'Обеденный перерыв', 'Обідня перерва'), 'Prime Time': U('პრაიმ-თაიმი', 'Прайм-тайм', 'Прайм-тайм'), 'Night Owl': U('ღამის ბუ', 'Ночная сова', 'Нічна сова'), 'Weekend Bonus': U('შაბათ-კვირის ბონუსი', 'Бонус выходных', 'Бонус вихідних'),
  '+25% experience': U('+25% გამოცდილება', '+25% опыта', '+25% досвіду'), '+50% rubles': U('+50% რუბლი', '+50% рублей', '+50% рублів'), '+25% rubles and +15% damage': U('+25% რუბლი და +15% ზიანი', '+25% рублей и +15% урона', '+25% рублів і +15% шкоди'), '+2 luck and +20% experience': U('+2 იღბალი და +20% გამოცდილება', '+2 удачи и +20% опыта', '+2 удачі і +20% досвіду'), '+25% rubles': U('+25% რუბლი', '+25% рублей', '+25% рублів'),
  'Saturday and Sunday · +25% rubles': U('შაბათი და კვირა · +25% რუბლი', 'Суббота и воскресенье · +25% рублей', 'Субота і неділя · +25% рублів'),
  'No happy hour right now': U('ახლა ბედნიერი საათი არ არის', 'Сейчас нет счастливого часа', 'Зараз немає щасливої години'),
  'WORLD CLOCK · the Zone never sleeps': U('მსოფლიო საათი · ზონას არასდროს სძინავს', 'МИРОВОЕ ВРЕМЯ · Зона никогда не спит', 'СВІТОВИЙ ЧАС · Зона ніколи не спить'),
  'Tbilisi': U('თბილისი', 'Тбилиси', 'Тбілісі'), 'Kyiv': U('კიევი', 'Киев', 'Київ'), 'Moscow': U('მოსკოვი', 'Москва', 'Москва'), 'London': U('ლონდონი', 'Лондон', 'Лондон'), 'New York': U('ნიუ-იორკი', 'Нью-Йорк', 'Нью-Йорк'), 'Tokyo': U('ტოკიო', 'Токио', 'Токіо'),
  '📋 MISSION COMPLETE': U('📋 მისია შესრულდა', '📋 МИССИЯ ВЫПОЛНЕНА', '📋 МІСІЮ ВИКОНАНО'), '🎓 1 skill point': U('🎓 1 უნარის ქულა', '🎓 1 очко навыка', '🎓 1 очко навички'),
  '② Tap a glowing perk': U('② შეეხე მანათობელ პერკს', '② Нажми на светящийся перк', '② Натисни на світний перк'),
  '③ Tap INSTALL (or tap the perk again)': U('③ დააჭირე „დაყენებას“ (ან კიდევ შეეხე პერკს)', '③ Нажми УСТАНОВИТЬ (или ещё раз на перк)', '③ Натисни ВСТАНОВИТИ (або ще раз на перк)'),
  'All rows are open.': U('ყველა რიგი გახსნილია.', 'Все ряды открыты.', 'Усі ряди відкриті.'), '✅ INSTALLED': U('✅ დაყენებულია', '✅ УСТАНОВЛЕНО', '✅ ВСТАНОВЛЕНО'),
  '✅ MAX': U('✅ მაქს', '✅ МАКС', '✅ МАКС'),
  '🔥 Heatmap': U('🔥 სითბური რუკა', '🔥 Тепловая карта', '🔥 Теплова карта'), '🔥 SURVIVAL HEATMAP': U('🔥 გადარჩენის სითბური რუკა', '🔥 КАРТА ВЫЖИВАНИЯ', '🔥 КАРТА ВИЖИВАННЯ'),
  '🔥 SURVIVAL HEATMAP · every difficulty × pace': U('🔥 გადარჩენის სითბური რუკა · ყველა სირთულე × ტემპი', '🔥 КАРТА ВЫЖИВАНИЯ · все сложности × темпы', '🔥 КАРТА ВИЖИВАННЯ · усі складності × темпи'),
  '⬇ Difficulty · Pace ➡': U('⬇ სირთულე · ტემპი ➡', '⬇ Сложность · Темп ➡', '⬇ Складність · Темп ➡'),
  'Chance to survive 15:00 · uses your own runs when you have 5+ on a combo · tap a cell to pick it': U('15:00-მდე გადარჩენის შანსი · იყენებს შენს რბოლებს, თუ კომბინაციაზე 5+ გაქვს · შეეხე უჯრას ასარჩევად', 'Шанс дожить до 15:00 · учитывает твои забеги, если их 5+ на комбинации · нажми на клетку, чтобы выбрать', 'Шанс дожити до 15:00 · враховує твої забіги, якщо їх 5+ на комбінації · натисни клітинку, щоб обрати'),
  'Scratch Cards': U('სკრეჩ ბარათები', 'Скретч-карты', 'Скретч-картки'), '🎫 ZONE SCRATCH': U('🎫 ზონის სკრეჩი', '🎫 СКРЕТЧ ЗОНЫ', '🎫 СКРЕТЧ ЗОНИ'), 'Match 3 symbols to win': U('3 ერთნაირი სიმბოლო იგებს', 'Собери 3 одинаковых символа', 'Збери 3 однакові символи'),
  '🎫 BUY CARD': U('🎫 ბარათის ყიდვა', '🎫 КУПИТЬ КАРТУ', '🎫 КУПИТИ КАРТКУ'), '✨ REVEAL ALL': U('✨ ყველას გახსნა', '✨ ОТКРЫТЬ ВСЁ', '✨ ВІДКРИТИ ВСЕ'), 'No match this time.': U('ამჯერად არ დაემთხვა.', 'В этот раз без совпадений.', 'Цього разу без збігів.'),
  'Scratch the card! (or REVEAL ALL)': U('გაფხეკე ბარათი! (ან „ყველას გახსნა“)', 'Сотри покрытие! (или ОТКРЫТЬ ВСЁ)', 'Зітри покриття! (або ВІДКРИТИ ВСЕ)'), 'SCRATCH HERE': U('გაფხეკე აქ', 'СОТРИ ЗДЕСЬ', 'ЗІТРИ ТУТ'),
  '← BACK': U('← უკან', '← НАЗАД', '← НАЗАД'),
  '🏁 Records': U('🏁 რეკორდები', '🏁 Рекорды', '🏁 Рекорди'), '🏁 PERSONAL RECORDS · beat them to see NEW RECORD after a run': U('🏁 პირადი რეკორდები · გააუმჯობესე და რბოლის შემდეგ ნახავ „ახალ რეკორდს“', '🏁 ЛИЧНЫЕ РЕКОРДЫ · побей их, чтобы увидеть НОВЫЙ РЕКОРД после забега', '🏁 ОСОБИСТІ РЕКОРДИ · побий їх, щоб побачити НОВИЙ РЕКОРД після забігу'),
  'Longest survival': U('ყველაზე ხანგრძლივი გადარჩენა', 'Дольше всего выжил', 'Найдовше вижив'), 'Most kills in a run': U('ყველაზე მეტი მკვლელობა', 'Больше всего убийств', 'Найбільше вбивств'), 'Highest level': U('უმაღლესი დონე', 'Высший уровень', 'Найвищий рівень'), 'Most rubles in a run': U('ყველაზე მეტი რუბლი', 'Больше всего рублей', 'Найбільше рублів'), 'Most artifacts in a run': U('ყველაზე მეტი არტეფაქტი', 'Больше всего артефактов', 'Найбільше артефактів'), 'Hardest difficulty beaten (15:00)': U('ყველაზე რთული დაძლეული სირთულე (15:00)', 'Сложнейшая пройденная сложность (15:00)', 'Найважча пройдена складність (15:00)'), 'Fastest pace beaten (15:00)': U('ყველაზე სწრაფი დაძლეული ტემპი (15:00)', 'Быстрейший пройденный темп (15:00)', 'Найшвидший пройдений темп (15:00)'), 'Kills per minute': U('მკვლელობა წუთში', 'Убийств в минуту', 'Вбивств за хвилину'),
  'Wins': U('მოგებები', 'Победы', 'Перемоги'), 'Runs played': U('ნათამაშები რბოლები', 'Сыграно забегов', 'Зіграно забігів'), 'Biggest casino win': U('კაზინოს უდიდესი მოგება', 'Крупнейший выигрыш в казино', 'Найбільший виграш у казино'), 'Cyberware perks': U('კიბერპერკები', 'Киберперки', 'Кіберперки'), 'Mastery level': U('ოსტატობის დონე', 'Уровень мастерства', 'Рівень майстерності'), 'Achievements': U('მიღწევები', 'Достижения', 'Досягнення'),
  'BEST PER STAGE': U('საუკეთესო ეტაპების მიხედვით', 'ЛУЧШЕЕ ПО ЭТАПАМ', 'НАЙКРАЩЕ ЗА ЕТАПАМИ'), 'Stage': U('ეტაპი', 'Этап', 'Етап'), '⏱️ Best time': U('⏱️ საუკეთესო დრო', '⏱️ Лучшее время', '⏱️ Найкращий час'), '☠️ Best kills': U('☠️ საუკეთესო მკვლელობები', '☠️ Лучшие убийства', '☠️ Найкращі вбивства'), '🏃 Runs': U('🏃 რბოლები', '🏃 Забеги', '🏃 Забіги'),
  'Zone Classic': U('ზონის კლასიკა', 'Классика Зоны', 'Класика Зони'), 'Monolith': U('მონოლითი', 'Монолит', 'Моноліт'), 'Freedom': U('თავისუფლება', 'Свобода', 'Свобода'), 'Duty': U('მოვალეობა', 'Долг', 'Обовʼязок'), 'Bandit Den': U('ბანდიტების ბუნაგი', 'Логово бандитов', 'Лігво бандитів'),
  'No runs yet · showing an average stalker': U('რბოლები ჯერ არ გაქვს · ნაჩვენებია საშუალო სტალკერი', 'Забегов пока нет · показан средний сталкер', 'Забігів поки немає · показано середнього сталкера'),
  'Chance to survive 15:00 · tap a cell to pick it': U('15:00-მდე გადარჩენის შანსი · შეეხე უჯრას ასარჩევად', 'Шанс дожить до 15:00 · нажми на клетку, чтобы выбрать', 'Шанс дожити до 15:00 · натисни клітинку, щоб обрати'),
  'Comfortable': U('კომფორტული', 'Комфортно', 'Комфортно'), 'Balanced': U('დაბალანსებული', 'Сбалансированно', 'Збалансовано'), 'Challenge': U('გამოწვევა', 'Вызов', 'Виклик'),
  '✨ Suggested for a new stalker · play runs to personalize': U('✨ რჩევა ახალი სტალკერისთვის · ითამაშე, რომ მოერგოს შენ', '✨ Совет для нового сталкера · играй, чтобы подстроить под себя', '✨ Порада для нового сталкера · грай, щоб підлаштувати під себе'),
  '😱 SO CLOSE! One more symbol…': U('😱 ძალიან ახლოს! კიდევ ერთი სიმბოლო…', '😱 ТАК БЛИЗКО! Ещё один символ…', '😱 ТАК БЛИЗЬКО! Ще один символ…'),
  "💸 Cashback: 10% of today's losses": U('💸 ქეშბექი: დღევანდელი წაგების 10%', '💸 Кэшбэк: 10% сегодняшних проигрышей', '💸 Кешбек: 10% сьогоднішніх програшів'),
  '⏰ OPEN FREE CHEST': U('⏰ უფასო ზარდახშის გახსნა', '⏰ ОТКРЫТЬ БЕСПЛАТНЫЙ СУНДУК', '⏰ ВІДКРИТИ БЕЗКОШТОВНУ СКРИНЮ'), '🎊 First bet today pays ×2': U('🎊 დღის პირველი ფსონი ×2', '🎊 Первая ставка дня платит ×2', '🎊 Перша ставка дня платить ×2'), '🎊 First bet of the day · WIN ×2!': U('🎊 დღის პირველი ფსონი · მოგება ×2!', '🎊 Первая ставка дня · ВЫИГРЫШ ×2!', '🎊 Перша ставка дня · ВИГРАШ ×2!'),
  'Mutant Racing': U('მუტანტების რბოლა', 'Гонки мутантов', 'Перегони мутантів'), 'Pick-a-Box': U('აირჩიე ყუთი', 'Выбери коробку', 'Обери коробку'), 'Monty Hall': U('მონტი ჰოლი', 'Монти Холл', 'Монті Голл'), 'Vault': U('სეიფი', 'Сейф', 'Сейф'), 'Points Shop': U('ქულების მაღაზია', 'Магазин очков', 'Магазин очок'),
  'Spend loyalty points — 1 point per 100 ₽ wagered.': U('დახარჯე ლოიალობის ქულები — 1 ქულა ყოველ 100 ₽ ფსონზე.', 'Трать очки лояльности — 1 очко за каждые 100 ₽ ставок.', 'Витрачай бали лояльності — 1 бал за кожні 100 ₽ ставок.'),
  '🔐 CRACK THE VAULT': U('🔐 სეიფის გატეხვა', '🔐 ВЗЛОМАТЬ СЕЙФ', '🔐 ЗЛАМАТИ СЕЙФ'),
  "Every bet you place cracks the vault's lock a little more. Fill it to 100% to crack it open for a big reward.": U('ყოველი ფსონი ცოტათი ხსნის სეიფის საკეტს. აავსე 100%-მდე დიდი ჯილდოსთვის.', 'Каждая ставка немного расшатывает замок сейфа. Заполни до 100%, чтобы вскрыть его ради крупной награды.', 'Кожна ставка трохи розхитує замок сейфа. Заповни до 100%, щоб зламати його заради великої нагороди.'),
  'Pick a box — one holds a ×10 jackpot, most hold small prizes, one is empty.': U('აირჩიე ყუთი — ერთში ×10 ჯეკპოტია, უმეტესში მცირე პრიზი, ერთი ცარიელია.', 'Выбери коробку — в одной джекпот ×10, в большинстве — небольшой приз, одна пустая.', 'Обери коробку — в одній джекпот ×10, у більшості — невеликий приз, одна порожня.'),
  '🗝️ NEW ROUND': U('🗝️ ახალი რაუნდი', '🗝️ НОВЫЙ РАУНД', '🗝️ НОВИЙ РАУНД'), 'Pick a box!': U('აირჩიე ყუთი!', 'Выбери коробку!', 'Обери коробку!'),
  'One door hides ×3 your bet. Pick a door — the host will open a losing one, then you can switch.': U('ერთი კარი მალავს ×3 შენს ფსონს. აირჩიე კარი — წამყვანი გახსნის წაგებულს, შემდეგ შეგეძლება შეცვლა.', 'За одной дверью ×3 твоей ставки. Выбери дверь — ведущий откроет проигрышную, затем сможешь сменить выбор.', 'За одними дверима ×3 твоєї ставки. Обери двері — ведучий відкриє програшні, потім зможеш змінити вибір.'),
  'STAY': U('დარჩენა', 'ОСТАТЬСЯ', 'ЗАЛИШИТИСЬ'), 'SWITCH': U('შეცვლა', 'СМЕНИТЬ', 'ЗМІНИТИ'), '🚪 NEW ROUND': U('🚪 ახალი რაუნდი', '🚪 НОВЫЙ РАУНД', '🚪 НОВИЙ РАУНД'), '🐎 RACE': U('🐎 რბოლა', '🐎 СТАРТ', '🐎 СТАРТ'), "They're off!": U('დაიწყო!', 'Понеслись!', 'Понеслися!'),
  "🌤️ You've been in the casino a while — maybe take a short break?": U('🌤️ დიდხანს ხარ კაზინოში — იქნებ პატარა შესვენება აიღო?', '🌤️ Ты давно в казино — может, стоит немного передохнуть?', '🌤️ Ти давно в казино — може, варто трохи перепочити?'),
  '🔐 The vault is ready to crack!': U('🔐 სეიფი მზადაა გასატეხად!', '🔐 Сейф готов к взлому!', '🔐 Сейф готовий до зламу!'), '🔐 VAULT READY!': U('🔐 სეიფი მზადაა!', '🔐 СЕЙФ ГОТОВ!', '🔐 СЕЙФ ГОТОВИЙ!'),
  'loyalty pts': U('ლოიალობის ქულა', 'очков лояльности', 'балів лояльності'),
  '5,000 ₽': U('5,000 ₽', '5 000 ₽', '5 000 ₽'), '30,000 ₽': U('30,000 ₽', '30 000 ₽', '30 000 ₽'), 'Free Play Token': U('უფასო თამაშის ჟეტონი', 'Жетон бесплатной игры', 'Жетон безкоштовної гри'), '+25% Vault Fill': U('+25% სეიფის შევსება', '+25% заполнения сейфа', '+25% заповнення сейфа'), '+2,000 Jackpot': U('+2,000 ჯეკპოტი', '+2 000 к джекпоту', '+2 000 до джекпоту'), 'Lucky Charm · 10 min': U('იღბლის ამულეტი · 10 წთ', 'Амулет удачи · 10 мин', 'Амулет удачі · 10 хв'),
  'Snorks': U('სნორკები', 'Снорки', 'Снорки'), 'Boar': U('ტახი', 'Кабан', 'Кабан'), 'Bloodsucker': U('სისხლისმწოველი', 'Кровосос', 'Кровосос'), 'Controller': U('კონტროლერი', 'Контролёр', 'Контролер'), 'Chimera': U('ქიმერა', 'Химера', 'Химера'), 'Poltergeist': U('პოლტერგეისტი', 'Полтергейст', 'Полтергейст'),
  'Auto (recommended)': U('ავტო (რეკომენდებული)', 'Авто (рекомендуется)', 'Авто (рекомендовано)'),
  'Lowest (smoothest)': U('მინიმალური (ყველაზე გლუვი)', 'Минимальное (плавнее всего)', 'Мінімальна (найплавніше)'),
  '⚙ Graphics lowered for smoother FPS': U('⚙ გრაფიკა შემცირდა უფრო გლუვი FPS-ისთვის', '⚙ Графика снижена для плавного FPS', '⚙ Графіку знижено для плавного FPS'),
  'Game zoom': U('თამაშის მასშტაბი', 'Масштаб игры', 'Масштаб гри'),
  'MEGA WIN': U('მეგა მოგება', 'МЕГА ВЫИГРЫШ', 'МЕГА ВИГРАШ'), 'HUGE WIN': U('უზარმაზარი მოგება', 'ОГРОМНЫЙ ВЫИГРЫШ', 'ВЕЛИЧЕЗНИЙ ВИГРАШ'), 'BIG WIN': U('დიდი მოგება', 'КРУПНЫЙ ВЫИГРЫШ', 'ВЕЛИКИЙ ВИГРАШ'),
  'GREEN': U('მწვანე', 'ЗЕЛЁНОЕ', 'ЗЕЛЕНЕ'), 'RED': U('წითელი', 'КРАСНОЕ', 'ЧЕРВОНЕ'), 'BLACK': U('შავი', 'ЧЁРНОЕ', 'ЧОРНЕ'),
});
const UI_PATTERNS = [
  [/^(10%|50%|ALL IN) · (\d+) ₽$/, U('$1 · $2 ₽', '$1 · $2 ₽', '$1 · $2 ₽')],
  [/^WIN (\d+) ₽ \(×([\d.]+)\)$/, U('მოგება $1 ₽ (×$2)', 'ВЫИГРЫШ $1 ₽ (×$2)', 'ВИГРАШ $1 ₽ (×$2)')],
  [/^On the table: (\d+) ₽$/, U('მაგიდაზე: $1 ₽', 'На столе: $1 ₽', 'На столі: $1 ₽')],
  [/^Heads! On the table: (\d+) ₽$/, U('ბორჯღალო! მაგიდაზე: $1 ₽', 'Орёл! На столе: $1 ₽', 'Орел! На столі: $1 ₽')],
  [/^Cashed out (\d+) ₽$/, U('აღებულია $1 ₽', 'Забрано $1 ₽', 'Забрано $1 ₽')],
  [/^Cashed out (\d+) ₽ at ×([\d.]+)$/, U('აღებულია $1 ₽ ×$2-ზე', 'Забрано $1 ₽ на ×$2', 'Забрано $1 ₽ на ×$2')],
  [/^💥 CRASHED at ×([\d.]+)$/, U('💥 ჩამოვარდა ×$1-ზე', '💥 ОБВАЛ на ×$1', '💥 ОБВАЛ на ×$1')],
  [/^\+(\d+) Mastery XP(.*)$/, U('+$1 ოსტატობის XP$2', '+$1 опыта мастерства$2', '+$1 досвіду майстерності$2')],
  [/^⬆ TIER (\S+)$/, U('⬆ დონე $1', '⬆ УРОВЕНЬ $1', '⬆ РІВЕНЬ $1')],
  [/^⬆ TIER (\S+) · (\d+) ₽$/, U('⬆ დონე $1 · $2 ₽', '⬆ УРОВЕНЬ $1 · $2 ₽', '⬆ РІВЕНЬ $1 · $2 ₽')],
  [/^LV (\d+) ·$/, U('დონე $1 ·', 'УР $1 ·', 'РІВ $1 ·')],
  [/^Based on your last (\d+) runs \(typical: (\d+:\d\d)\) → (harder|easier|keep)$/, U('შენი ბოლო $1 რბოლის მიხედვით (ჩვეულებრივ: $2) → $3', 'По твоим последним $1 забегам (обычно: $2) → $3', 'За твоїми останніми $1 забігами (зазвичай: $2) → $3')],
  [/^([a-z]+) ·$/, U('$1 ·', '$1 ·', '$1 ·')],
  [/^Your skill ×([\d.]+) vs a typical stalker \((\d+) runs\)\. (\d+)% chance to survive 15:00 · typical run ~(\d+:\d\d)$/, U('შენი უნარი ×$1 ჩვეულებრივ სტალკერთან შედარებით ($2 რბოლა). 15:00-მდე გადარჩენის შანსი $3% · ჩვეულებრივი რბოლა ~$4', 'Твой навык ×$1 от обычного сталкера ($2 забегов). Шанс дожить до 15:00: $3% · обычный забег ~$4', 'Твоя навичка ×$1 від звичайного сталкера ($2 забігів). Шанс дожити до 15:00: $3% · звичайний забіг ~$4')],
  [/^Your skill ×([\d.]+) vs a typical stalker \(best time\)\. (\d+)% chance to survive 15:00 · typical run ~(\d+:\d\d)$/, U('შენი უნარი ×$1 (საუკეთესო დრო). 15:00-მდე გადარჩენის შანსი $2% · ჩვეულებრივი რბოლა ~$3', 'Твой навык ×$1 (по лучшему времени). Шанс дожить до 15:00: $2% · обычный забег ~$3', 'Твоя навичка ×$1 (за найкращим часом). Шанс дожити до 15:00: $2% · звичайний забіг ~$3')],
  [/^✨ Suggested: (.+) – (.+) – Ascension (\d+)$/, U('✨ რეკომენდაცია: $1 – $2 – ამაღლება $3', '✨ Совет: $1 – $2 – Вознесение $3', '✨ Порада: $1 – $2 – Вознесіння $3')],
  [/^APEX BOSSES · kill (\d+) of a mutant to unlock its Apex$/, U('აპექს-ბოსები · მოკალი $1 მუტანტი მისი აპექსის გასახსნელად', 'АПЕКС-БОССЫ · убей $1 мутантов вида, чтобы открыть его Апекса', 'АПЕКС-БОСИ · вбий $1 мутантів виду, щоб відкрити його Апекса')],
  [/^TRENDS · last (\d+) runs$/, U('ტენდენციები · ბოლო $1 რბოლა', 'ТЕНДЕНЦИИ · последние $1 забегов', 'ТЕНДЕНЦІЇ · останні $1 забігів')],
  [/^unlocked · slain (\d+)$/, U('გახსნილია · მოკლულია $1', 'открыт · убит $1', 'відкрито · вбито $1')],
  [/^📈 \+(\d+) Mastery XP( · MASTERY LEVEL UP! \((\d+)\))?$/, U('📈 +$1 ოსტატობის XP', '📈 +$1 опыта мастерства', '📈 +$1 досвіду майстерності')],
  [/^👑 New Apex boss unlocked: (.+)$/, U('👑 ახალი აპექს-ბოსი გაიხსნა: $1', '👑 Открыт новый Апекс-босс: $1', '👑 Відкрито нового Апекс-боса: $1')],
  [/^APEX (.+)$/, U('აპექსი $1', 'АПЕКС $1', 'АПЕКС $1')],
  [/^(.+) · (\d+)$/, U('$1 · $2', '$1 · $2', '$1 · $2')],
  [/^\+(\d+)% mutant HP, \+(\d+)% damage, \+(\d+)% rubles$/, U('+$1% მუტანტის HP, +$2% ზიანი, +$3% რუბლი', '+$1% ОЗ мутантов, +$2% урона, +$3% рублей', '+$1% ОЗ мутантів, +$2% шкоди, +$3% рублів')],
  [/^Avg health (\d+)%, in danger (\d+)% of the time\. Challenge (\d+)% \(aim (\d+)%\) → (harder|easier|keep)$/, U('საშ. სიცოცხლე $1%, საფრთხეში $2% დროის. სირთულე $3% (მიზანი $4%) → $5', 'Среднее здоровье $1%, в опасности $2% времени. Нагрузка $3% (цель $4%) → $5', 'Середнє здоровʼя $1%, у небезпеці $2% часу. Навантаження $3% (мета $4%) → $5')],
  [/^Challenge (\d+)% \(aim (\d+)%\) → (harder|easier|keep)$/, U('სირთულე $1% (მიზანი $2%) → $3', 'Нагрузка $1% (цель $2%) → $3', 'Навантаження $1% (мета $2%) → $3')],
  [/^✨ Suggested: (.+) – (.+)$/, U('✨ რეკომენდაცია: $1 – $2', '✨ Совет: $1 – $2', '✨ Порада: $1 – $2')],
  [/^\+(\d+)% every 10 minutes\.$/, U('+$1% ყოველ 10 წუთში.', '+$1% каждые 10 минут.', '+$1% кожні 10 хвилин.')],
  [/^✅ Joined the room of (.+)\.$/, U('✅ შეხვედი $1-ის ოთახში.', '✅ Ты в комнате игрока $1.', '✅ Ти в кімнаті гравця $1.')],
  [/^(.+) SLAIN$/, U('$1 მოკლულია', '$1 УБИТ', '$1 ВБИТО')],
  [/^A BANDIT STOLE (\d+) ₽!$/, U('ბანდიტმა მოიპარა $1 ₽!', 'БАНДИТ УКРАЛ $1 ₽!', 'БАНДИТ ВКРАВ $1 ₽!')],
  [/^EVOLUTION: (.+)$/, U('ევოლუცია: $1', 'ЭВОЛЮЦИЯ: $1', 'ЕВОЛЮЦІЯ: $1')],
  [/^LEGENDARY (.+)$/, U('ლეგენდარული $1', 'ЛЕГЕНДАРНЫЙ $1', 'ЛЕГЕНДАРНИЙ $1')],
  [/^☢ ZONE TIER (\d+) ☢$/, U('☢ ზონის დონე $1 ☢', '☢ УРОВЕНЬ ЗОНЫ $1 ☢', '☢ РІВЕНЬ ЗОНИ $1 ☢')],
  [/^You cling to life! Revives left: (\d+)$/, U('სიცოცხლეს ებღაუჭები! დარჩენილი აღდგომა: $1', 'Ты цепляешься за жизнь! Осталось воскрешений: $1', 'Ти чіпляєшся за життя! Залишилось воскресінь: $1')],
  [/^DAILY RUN (.+)$/, U('დღის რბოლა $1', 'ЕЖЕДНЕВНЫЙ ЗАБЕГ $1', 'ЩОДЕННИЙ ЗАБІГ $1')],
  [/^☢ THE ZONE DEEPENS · TIER (\d+) ☢$/, U('☢ ზონა ღრმავდება · დონე $1 ☢', '☢ ЗОНА УГЛУБЛЯЕТСЯ · УРОВЕНЬ $1 ☢', '☢ ЗОНА ПОГЛИБЛЮЄТЬСЯ · РІВЕНЬ $1 ☢')],
  [/^Attention, stalkers\. (.+)\.$/, U('ყურადღება, სტალკერებო. $1.', 'Внимание, сталкеры. $1.', 'Увага, сталкери. $1.')],
  [/^Warning\. (.+) is hunting you\.$/, U('ყურადღება. $1 შენზე ნადირობს.', 'Внимание. $1 охотится на тебя.', 'Увага. $1 полює на тебе.')],
  [/^Scientists expect an emission in about (\d+) minutes\. Know where your shelter is\.$/, U('მეცნიერები გამოფრქვევას დაახლოებით $1 წუთში ელიან. იცოდე, სადაა შენი თავშესაფარი.', 'Учёные ожидают выброс примерно через $1 мин. Знай, где твоё укрытие.', 'Науковці очікують викид приблизно за $1 хв. Знай, де твоє укриття.')],
  [/^Word at the bar: someone has put down (\d+) mutants already\. That's you, isn't it\?$/, U('ბარში ამბობენ: ვიღაცამ უკვე $1 მუტანტი მოკლა. შენ ხარ, არა?', 'В баре говорят: кто-то уже положил $1 мутантов. Это ведь ты?', 'У барі кажуть: хтось уже поклав $1 мутантів. Це ж ти?')],
  [/^Mutant packs spotted moving through (.+)\. Watch your back\.$/, U('მუტანტების ხროვები შენიშნეს აქ: $1. ზურგს უყურე.', 'Стаи мутантов замечены в районе «$1». Береги спину.', 'Зграї мутантів помічено в районі «$1». Бережи спину.')],
  [/^(\d+) artifacts already\? Keep this up and I will retire rich\.$/, U('უკვე $1 არტეფაქტი? ასე თუ გააგრძელე, მდიდარი გავალ პენსიაზე.', 'Уже $1 артефакта? Так держать — я уйду на пенсию богатым.', 'Уже $1 артефакти? Так тримати — я піду на пенсію багатим.')],
  [/^Weather report: (.+) over the area\. Adjust your route\.$/, U('ამინდის ცნობა: რაიონში $1. შეცვალე მარშრუტი.', 'Сводка погоды: над районом $1. Меняй маршрут.', 'Зведення погоди: над районом $1. Змінюй маршрут.')],
  [/^(.+) · TIER (\d)\/(\d)$/, U('$1 · დონე $2/$3', '$1 · УРОВЕНЬ $2/$3', '$1 · РІВЕНЬ $2/$3')],
  [/^(X-\d+) LABORATORY$/, U('$1 ლაბორატორია', 'ЛАБОРАТОРИЯ $1', 'ЛАБОРАТОРІЯ $1')],
  [/^(.+) Lab$/, U('$1 ლაბორატორია', 'Лаборатория $1', 'Лабораторія $1')],
  [/^Evolutions: (\S+) max \+$/, U('ევოლუციები: $1 მაქს. +', 'Эволюции: $1 макс. +', 'Еволюції: $1 макс. +')],
  [/^→ (.+?) · (\S+) max \+$/, U('→ $1 · $2 მაქს. +', '→ $1 · $2 макс. +', '→ $1 · $2 макс. +')],
  [/^(\d+)\/(\d+) towers climbed · (\S+) (\d+)\/(\d+) radio towers · (\S+) (\d+)\/(\d+) chalk stashes$/, U('$1/$2 კოშკი · $3 $4/$5 რადიოანძა · $6 $7/$8 ცარცის სამალავი', '$1/$2 вышек · $3 $4/$5 радиовышек · $6 $7/$8 тайников с мелом', '$1/$2 веж · $3 $4/$5 радіовеж · $6 $7/$8 схованок із крейдою')],
  [/^(X-\d+) Laboratory$/, U('$1 ლაბორატორია', 'Лаборатория $1', 'Лабораторія $1')],
  [/^Difficulty: (.+?)\s+▸ change$/, U('სირთულე: $1 ▸ შეცვლა', 'Сложность: $1 ▸ изменить', 'Складність: $1 ▸ змінити')],
  [/^(\d+) daily challenges? open · Bunker → Challenges$/, U('$1 დღის გამოწვევა · ბუნკერი → გამოწვევები', 'Открыто ежедневных испытаний: $1 · Бункер → Испытания', 'Відкрито щоденних випробувань: $1 · Бункер → Випробування')],
  [/^Profile (\d+) ▸$/, U('პროფილი $1 ▸', 'Профиль $1 ▸', 'Профіль $1 ▸')],
  [/^enemy HP ×([\d.]+) · damage taken ×([\d.]+) · rubles ×([\d.]+)$/, U('მტრის HP ×$1 · მიღებული ზიანი ×$2 · რუბლი ×$3', 'ОЗ врагов ×$1 · получаемый урон ×$2 · рубли ×$3', 'ОЗ ворогів ×$1 · отримана шкода ×$2 · рублі ×$3')],
  [/^enemy HP ×([\d.]+) · damage taken ×([\d.]+)$/, U('მტრის HP ×$1 · მიღებული ზიანი ×$2', 'ОЗ врагов ×$1 · получаемый урон ×$2', 'ОЗ ворогів ×$1 · отримана шкода ×$2')],
  [/^Beat (.+) in Standard, or survive 15:00 there in Endless\.$/, U('მოიგე $1 სტანდარტში, ან გაძელი 15:00 უსასრულოში.', 'Победи $1 в Стандарте или продержись там 15:00 в Бесконечном.', 'Переможи $1 у Стандарті або протримайся там 15:00 у Нескінченному.')],
  [/^(.+?)s? (Friendly|Ally|Hero)$/, U('$1: $2', '$1: $2', '$1: $2')],
  [/^(Neutral|Friendly|Ally|Hero) · (\d+) rep · next at (\d+)$/, U('$1 · $2 რეპ. · შემდეგი $3-ზე', '$1 · $2 реп. · дальше на $3', '$1 · $2 реп. · далі на $3')],
  [/^(.+) per level$/, U('$1 თითო დონეზე', '$1 за уровень', '$1 за рівень')],
  [/^([●○]+) · (\d+) points?$/, U('$1 · $2 ქულა', '$1 · $2 оч.', '$1 · $2 оч.')],
  [/^SKILL POINTS: (\d+) · earn them by surviving 5 and 10 minutes, winning and killing bosses$/, U('უნარის ქულები: $1 · მიიღე 5 და 10 წუთის გადარჩენით, მოგებით და ბოსების მოკვლით', 'ОЧКИ НАВЫКОВ: $1 · даются за 5 и 10 минут выживания, победы и убийство боссов', 'ОЧКИ НАВИЧОК: $1 · даються за 5 і 10 хвилин виживання, перемоги та вбивство босів')],
  [/^BET (\d+) ₽$/, U('ფსონი $1 ₽', 'СТАВКА $1 ₽', 'СТАВКА $1 ₽')],
  [/^MUTANTS (\d+)\/(\d+)$/, U('მუტანტები $1/$2', 'МУТАНТЫ $1/$2', 'МУТАНТИ $1/$2')],
  [/^ARTIFACTS (\d+)\/(\d+)$/, U('არტეფაქტები $1/$2', 'АРТЕФАКТЫ $1/$2', 'АРТЕФАКТИ $1/$2')],
  [/^ACHIEVEMENTS (\d+)\/(\d+)$/, U('მიღწევები $1/$2', 'ДОСТИЖЕНИЯ $1/$2', 'ДОСЯГНЕННЯ $1/$2')],
  [/^ENDINGS (\d+)\/(\d+) · reach 15:00 in Endless on every stage for the true ending$/, U('დასასრულები $1/$2 · მიაღწიე 15:00-ს უსასრულოში ყველა ეტაპზე', 'КОНЦОВКИ $1/$2 · дойди до 15:00 в Бесконечном на каждой локации ради истинной концовки', 'КІНЦІВКИ $1/$2 · дійди до 15:00 у Нескінченному на кожній локації заради справжньої кінцівки')],
  [/^Unlocks look: (.+)$/, U('ხსნის გარეგნობას: $1', 'Открывает облик: $1', 'Відкриває вигляд: $1')],
  [/^(\d+)\/(\d+) · reward (\d+) ₽$/, U('$1/$2 · ჯილდო $3 ₽', '$1/$2 · награда $3 ₽', '$1/$2 · нагорода $3 ₽')],
  [/^(.+): (.+) \(key (\d)\)$/, U('$1: $2 (ღილაკი $3)', '$1: $2 (клавиша $3)', '$1: $2 (клавіша $3)')],
  [/^(Armored|Swift|Giant|Tiny|Golden|Evolved|ENRAGED|SHIELDED|SUMMONER|SPLITTING|TWIN|ALPHA|HORDE) (.+)$/, U('$1 $2', '$1 $2', '$1 $2')],
  [/^(.+) IS ENRAGED!$/, U('$1 გაცოფდა!', '$1 В ЯРОСТИ!', '$1 ЛЮТУЄ!')],
  [/^(.+) · pulse in (\d+)s · (\d+:\d\d)$/, U('$1 · იმპულსი $2 წამში · $3', '$1 · импульс через $2с · $3', '$1 · імпульс через $2с · $3')],
  [/^(.+) · truck (\d+)% · (\d+:\d\d)$/, U('$1 · მანქანა $2% · $3', '$1 · грузовик $2% · $3', '$1 · вантажівка $2% · $3')],
  [/^Killed by (.+)\. The Zone claims another stalker\.( Tip: pick an easier difficulty in PLAY, or buy Bunker upgrades\.)?$/, U('მოკლა: $1. ზონამ კიდევ ერთი სტალკერი წაიღო.', 'Убит: $1. Зона забрала ещё одного сталкера.', 'Вбив: $1. Зона забрала ще одного сталкера.')],
  [/^run loot (\d+) · time bonus (\d+)(?: · victory (\d+))? · (.+) ×([\d.]+)\s+•\s+total (\d+) ₽$/, U('ნადავლი $1 · დროის ბონუსი $2 · $4 ×$5 • სულ $6 ₽', 'добыча $1 · бонус за время $2 · $4 ×$5 • всего $6 ₽', 'здобич $1 · бонус за час $2 · $4 ×$5 • усього $6 ₽')],
  [/^(\d+) items? moved to your stash$/, U('$1 ნივთი გადავიდა სამალავში', '$1 предм. перенесено в тайник', '$1 предм. перенесено до схованки')],
  [/^(.+) · unlocked look: (.+)$/, U('$1 · გაიხსნა გარეგნობა: $2', '$1 · открыт облик: $2', '$1 · відкрито вигляд: $2')],
  [/^(.+) LAIR$/, U('ბუნაგი: $1', 'ЛОГОВО: $1', 'ЛІГВО: $1')],
  [/^Auto-pick upgrades: (ON|OFF)$/, U('ავტო-არჩევა: $1', 'Автовыбор: $1', 'Автовибір: $1')],
  [/^(ON|OFF)$/, U('$1', '$1', '$1')],
  [/^\(from your last (\d+) runs\)$/, U('(შენი ბოლო $1 რბოლიდან)', '(по твоим последним $1 забегам)', '(за твоїми останніми $1 забігами)')],
  [/^⭐ (\d+) crew points$/, U('⭐ $1 რაზმის ქულა', '⭐ $1 очков отряда', '⭐ $1 очок загону')],
  [/^⭐ CREW HQ · (\d+) pts$/, U('⭐ რაზმის შტაბი · $1 ქ.', '⭐ ШТАБ ОТРЯДА · $1 оч.', '⭐ ШТАБ ЗАГОНУ · $1 оч.')],
  [/^Beat (.+) together, or survive 15:00 there\.$/, U('მოიგეთ $1 ერთად, ან გაძელით იქ 15:00.', 'Выиграйте $1 вместе или продержитесь там 15:00.', 'Виграйте $1 разом або протримайтеся там 15:00.')],
  [/^(.+) (\d)\/(\d)$/, U('$1 $2/$3', '$1 $2/$3', '$1 $2/$3')],
  [/^(.+) \(you\)$/, U('$1 (შენ)', '$1 (ты)', '$1 (ти)')],
  [/^🛡️ Crew (.+) · level (\d+) · \+(\d+)% damage & XP bonus · 🗺️ (\d+)\/(\d+) maps unlocked together · room (\w+)$/, U('🛡️ რაზმი $1 · დონე $2 · +$3% ზიანი და გამოცდილება · 🗺️ $4/$5 რუკა ერთად · ოთახი $6', '🛡️ Отряд $1 · уровень $2 · +$3% к урону и опыту · 🗺️ $4/$5 карт открыто вместе · комната $6', '🛡️ Загін $1 · рівень $2 · +$3% до шкоди й досвіду · 🗺️ $4/$5 мап відкрито разом · кімната $6')],
  [/^ROOM (\w+)$/, U('ოთახი $1', 'КОМНАТА $1', 'КІМНАТА $1')],
  [/^▶ START \((\d+) players\)$/, U('▶ დაწყება ($1 მოთამაშე)', '▶ СТАРТ ($1 игрока)', '▶ СТАРТ ($1 гравці)')],
  [/^(\d+)\/(\d+) in the room\. Everyone presses READY, then you START\.$/, U('ოთახში $1/$2. ყველა აჭერს „მზად ვარ“, შემდეგ შენ იწყებ.', 'В комнате $1/$2. Все жмут «ГОТОВ», потом ты жмёшь СТАРТ.', 'У кімнаті $1/$2. Усі тиснуть «ГОТОВИЙ», потім ти тиснеш СТАРТ.')],
  [/^Send the link to your friends\. Up to (\d+) players\.$/, U('გაუგზავნე ბმული მეგობრებს. მაქსიმუმ $1 მოთამაშე.', 'Отправь ссылку друзьям. До $1 игроков.', 'Надішли посилання друзям. До $1 гравців.')],
  [/^⚠️ Room (\w+) not found\. Is the host still waiting\?$/, U('⚠️ ოთახი $1 ვერ მოიძებნა. ჰოსტი ჯერ კიდევ ელოდება?', '⚠️ Комната $1 не найдена. Хост ещё ждёт?', '⚠️ Кімнату $1 не знайдено. Хост ще чекає?')],
  [/^⚠️ Could not reach room (\w+)\. .*$/, U('⚠️ ოთახთან $1 დაკავშირება ვერ მოხერხდა. შეამოწმე კოდი და სცადე ხელახლა.', '⚠️ Не удалось связаться с комнатой $1. Проверь код и попробуй снова.', '⚠️ Не вдалося зв\'язатися з кімнатою $1. Перевір код і спробуй знову.')],
  [/^⛔ The room is full \((\d+)\/(\d+)\)\.$/, U('⛔ ოთახი სავსეა ($1/$2).', '⛔ Комната заполнена ($1/$2).', '⛔ Кімната заповнена ($1/$2).')],
  [/^⛔ Different game versions: you have (.+), the host has (v\d+)\. .*$/, U('⛔ თამაშის სხვადასხვა ვერსია: შენ — $1, ჰოსტს — $2. ორივემ განაახლეთ გვერდი და ხელახლა შედით.', '⛔ Разные версии игры: у тебя $1, у хоста $2. Обновите страницу оба и зайдите снова.', '⛔ Різні версії гри: у тебе $1, у хоста $2. Оновіть сторінку обидва й зайдіть знову.')],
  [/^⛔ Wrong password\.$/, U('⛔ არასწორი პაროლი.', '⛔ Неверный пароль.', '⛔ Невірний пароль.')],
  [/^(.+) · ☠ (.+) in (\d+:\d\d)$/, U('$1 · ☠ $2 $3-ში', '$1 · ☠ $2 через $3', '$1 · ☠ $2 через $3')],
  [/^⏳ Connecting to room (\w+)… \(try (\d+)\)$/, U('⏳ ოთახთან დაკავშირება $1… (ცდა $2)', '⏳ Подключение к комнате $1… (попытка $2)', '⏳ Підключення до кімнати $1… (спроба $2)')],
  [/^⏳ Connecting to the server… \(try (\d+)\/5\)$/, U('⏳ სერვერთან დაკავშირება… (ცდა $1/5)', '⏳ Подключение к серверу… (попытка $1/5)', '⏳ Підключення до сервера… (спроба $1/5)')],
  [/^⏳ Opening the room of crew (.+)…$/, U('⏳ იხსნება რაზმის ოთახი: $1…', '⏳ Открываю комнату отряда $1…', '⏳ Відкриваю кімнату загону $1…')],
  [/^⏳ Looking for crew (.+)…$/, U('⏳ ვეძებ რაზმს: $1…', '⏳ Ищу отряд $1…', '⏳ Шукаю загін $1…')],
  [/^👥 A teammate is already hosting (.+) — joining them…$/, U('👥 თანაგუნდელი უკვე მასპინძლობს: $1 — ვუერთდებით…', '👥 Товарищ уже открыл $1 — подключаюсь…', '👥 Товариш уже відкрив $1 — підключаюся…')],
  [/^Nobody is hosting (.+) yet\. Press 🏠 HOST to open the crew room — teammates then press 🔗 JOIN\.$/, U('$1-ს ჯერ არავინ მასპინძლობს. დააჭირე 🏠 ჰოსტს — თანაგუნდელები დააჭერენ 🔗 შესვლას.', 'Отряд $1 ещё никто не открыл. Нажми 🏠 СОЗДАТЬ — товарищи нажмут 🔗 ВОЙТИ.', 'Загін $1 ще ніхто не відкрив. Натисни 🏠 СТВОРИТИ — товариші натиснуть 🔗 УВІЙТИ.')],
  [/^Omen of this run: (.+)$/, U('ამ რბოლის ნიშანი: $1', 'Знамение забега: $1', 'Знамення забігу: $1')],
  [/^Omen: (.+)$/, U('ნიშანი: $1', 'Знамение: $1', 'Знамення: $1')],
  [/^🏅 New record: (\d+) kills$/, U('🏅 ახალი რეკორდი: $1 მკვლელობა', '🏅 Новый рекорд: $1 убийств', '🏅 Новий рекорд: $1 вбивств')],
  [/^🏅 New record: (\d+) level$/, U('🏅 ახალი რეკორდი: დონე $1', '🏅 Новый рекорд: уровень $1', '🏅 Новий рекорд: рівень $1')],
  [/^🏅 New record: (\d+) artifacts$/, U('🏅 ახალი რეკორდი: $1 არტეფაქტი', '🏅 Новый рекорд: $1 артефактов', '🏅 Новий рекорд: $1 артефактів')],
  [/^🏅 New best time here: (.+)$/, U('🏅 საუკეთესო დრო აქ: $1', '🏅 Лучшее время здесь: $1', '🏅 Найкращий час тут: $1')],
  [/^🏰 WAVE (\d+) \/ (\d+)$/, U('🏰 ტალღა $1 / $2', '🏰 ВОЛНА $1 / $2', '🏰 ХВИЛЯ $1 / $2')],
  [/^⚠ WAVE (\d+) INCOMING$/, U('⚠ მოდის ტალღა $1', '⚠ НАДВИГАЕТСЯ ВОЛНА $1', '⚠ НАСУВАЄТЬСЯ ХВИЛЯ $1')],
  [/^Protect the generator for (\d+) waves\. The first wave comes in (\d+) seconds\.$/, U('დაიცავი გენერატორი $1 ტალღის განმავლობაში. პირველი ტალღა $2 წამში მოვა.', 'Защищай генератор $1 волн. Первая волна через $2 секунд.', 'Захищай генератор $1 хвиль. Перша хвиля за $2 секунд.')],
  [/^(.+) joins you!$/, U('$1 შემოგიერთდა!', '$1 с тобой!', '$1 з тобою!')],
  [/^BUY (\d+) ₽$/, U('ყიდვა $1 ₽', 'КУПИТЬ $1 ₽', 'КУПИТИ $1 ₽')],
  [/^Enemy HP ×([\d.]+)(.*)$/, U('მტრის სიცოცხლე ×$1$2', 'ОЗ врагов ×$1$2', 'ОЗ ворогів ×$1$2')],
  [/^📡 DUGA · FLOOR (\d)$/, U('📡 დუგა · სართული $1', '📡 ДУГА · ЭТАЖ $1', '📡 ДУГА · ПОВЕРХ $1')],
  [/^DUGA FLOOR (\d)$/, U('დუგა · სართული $1', 'ДУГА · ЭТАЖ $1', 'ДУГА · ПОВЕРХ $1')],
  [/^Duga Bunker · Floor (\d)$/, U('დუგას ბუნკერი · სართული $1', 'Бункер Дуги · этаж $1', 'Бункер Дуги · поверх $1')],
  [/^Stairs down · Floor (\d)$/, U('კიბე ქვემოთ · სართული $1', 'Лестница вниз · этаж $1', 'Сходи вниз · поверх $1')],
  [/^Floor (\d) awaits below\.$/, U('ქვემოთ სართული $1 გელოდება.', 'Внизу ждёт этаж $1.', 'Унизу чекає поверх $1.')],
  [/^Stairs up · ([AB])$/, U('კიბე ზემოთ · $1', 'Лестница наверх · $1', 'Сходи нагору · $1')],
  [/^📡 DUGA PULSE IN (\d+)s$/, U('📡 დუგას იმპულსი $1 წამში', '📡 ИМПУЛЬС ДУГИ ЧЕРЕЗ $1с', '📡 ІМПУЛЬС ДУГИ ЧЕРЕЗ $1с')],
  [/^\+(\d+)% weapon damage$/, U('+$1% იარაღის ზიანი', '+$1% к урону оружия', '+$1% до шкоди зброї')],
  [/^(.+) Mastery$/, U('$1: ოსტატობა', '$1: мастерство', '$1: майстерність')],
  [/^(.+) \(stay close · (\d+)% hp\)$/, U('$1 (იყავი ახლოს · $2% სიც.)', '$1 (держись рядом · $2% ОЗ)', '$1 (тримайся поруч · $2% ОЗ)')],
  [/^(.+) \((\d+)% hp\)$/, U('$1 ($2% სიც.)', '$1 ($2% ОЗ)', '$1 ($2% ОЗ)')],
  [/^(.+) \((\d+)s\)$/, U('$1 ($2წმ)', '$1 ($2с)', '$1 ($2с)')],
  [/^(.+) \((\d+)\/(\d+)\)$/, U('$1 ($2/$3)', '$1 ($2/$3)', '$1 ($2/$3)')],
  [/^LEVEL (\d+)$/, U('დონე $1', 'УРОВЕНЬ $1', 'РІВЕНЬ $1')],
  [/^LEVEL (\d+) · CHOOSE A BRANCH$/, U('დონე $1 · აირჩიე შტო', 'УРОВЕНЬ $1 · ВЫБЕРИ ВЕТКУ', 'РІВЕНЬ $1 · ОБЕРИ ГІЛКУ')],
  [/^LV (\d+) → (\d+)$/, U('დონე $1 → $2', 'УР $1 → $2', 'РІВ $1 → $2')],
  [/^MASTERY (\d+)$/, U('ოსტატობა $1', 'МАСТЕРСТВО $1', 'МАЙСТЕРНІСТЬ $1')],
  [/^(.+) · TIER (\d+)\/5$/, U('$1 · დონე $2/5', '$1 · СТУПЕНЬ $2/5', '$1 · СТУПІНЬ $2/5')],
  [/^(.+) (\d)\/5$/, U('$1 $2/5', '$1 $2/5', '$1 $2/5')],
  [/^ARTIFACT: (.+)$/, U('არტეფაქტი: $1', 'АРТЕФАКТ: $1', 'АРТЕФАКТ: $1')],
  [/^Hunt (\d+) (.+?)s?$/, U('მოკალი $1 $2', 'Убей: $2 ×$1', 'Вбий: $2 ×$1')],
  [/^Clear the (.+)$/, U('გაწმინდე: $1', 'Зачисти: $1', 'Зачисть: $1')],
  [/^Descend into (.+)$/, U('ჩადი: $1', 'Спустись в: $1', 'Спустись у: $1')],
  [/^Destroy the (.+) lair$/, U('გაანადგურე ბუნაგი: $1', 'Уничтожь логово: $1', 'Знищ лігво: $1')],
  [/^Hold out in (.+) for (\d+)s$/, U('გაძელი $2 წამი: $1', 'Продержись $2с: $1', 'Протримайся $2с: $1')],
  [/^Kill (\d+) mutants with the (.+)$/, U('მოკალი $1 მუტანტი: $2', 'Убей $1 мутантов оружием: $2', 'Вбий $1 мутантів зброєю: $2')],
  [/^Collect 3 (.+) samples \(stand at the edge\)$/, U('შეაგროვე 3 ნიმუში: $1', 'Собери 3 образца: $1', 'Збери 3 зразки: $1')],
  [/^Photograph a (.+) \(get close\)$/, U('გადაუღე ფოტო: $1', 'Сфотографируй: $1', 'Сфотографуй: $1')],
  [/^Track the legendary (.+)$/, U('მიჰყევი ლეგენდარულ: $1', 'Выследи легендарного: $1', 'Вистеж легендарного: $1')],
  [/^Double or nothing: kill (\d+) in time$/, U('ყველაფერი ან არაფერი: მოკალი $1 დროულად', 'Всё или ничего: убей $1 вовремя', 'Все або нічого: вбий $1 вчасно')],
  [/^Deliver it to the shelter \((\d+)s\)$/, U('მიიტანე თავშესაფარში ($1 წმ)', 'Доставь в укрытие ($1с)', 'Доправ до укриття ($1с)')],
  [/^☢ ZONE TIER (\d+) ☢$/, U('☢ ზონის დონე $1 ☢', '☢ УРОВЕНЬ ЗОНЫ $1 ☢', '☢ РІВЕНЬ ЗОНИ $1 ☢')],
  [/^⚠ (.+) ⚠$/, U('⚠ $1 ⚠', '⚠ $1 ⚠', '⚠ $1 ⚠')],
  [/^Survive 15:00\. Hunt artifacts\. Destroy (.+)\.$/, U('გადარჩი 15:00. მოძებნე არტეფაქტები. გაანადგურე $1.', 'Выживи 15:00. Ищи артефакты. Уничтожь: $1.', 'Виживи 15:00. Шукай артефакти. Знищ: $1.')],
  [/^Wave (\d+)(.*)$/, U('ტალღა $1$2', 'Волна $1$2', 'Хвиля $1$2')],
  [/^CYBERWARE · (\d+)\/(\d+) perks installed · (\d+) ₽ invested$/, U('კიბერიმპლანტები · $1/$2 პერკი · $3 ₽ ჩადებული', 'КИБЕРИМПЛАНТЫ · $1/$2 перков · вложено $3 ₽', 'КІБЕРІМПЛАНТИ · $1/$2 перків · вкладено $3 ₽')],
  [/^LV (\d+)$/, U('დონე $1', 'УР $1', 'РІВ $1')],
  [/^(\S+) (\S+) · LV (\d+)\/(\d+)$/, U('$1 $2 · დონე $3/$4', '$1 $2 · УР $3/$4', '$1 $2 · РІВ $3/$4')],
  [/^⬆ LEVEL UP · (\d+) ₽$/, U('⬆ დონის აწევა · $1 ₽', '⬆ ПОВЫСИТЬ · $1 ₽', '⬆ ПІДВИЩИТИ · $1 ₽')],
  [/^INSTALL · (\d+) ₽$/, U('დაყენება · $1 ₽', 'УСТАНОВИТЬ · $1 ₽', 'ВСТАНОВИТИ · $1 ₽')],
  [/^🔒 needs (\S+) LV (\d+) and a linked perk above$/, U('🔒 საჭიროა $1 დონე $2 და დაკავშირებული პერკი ზემოთ', '🔒 нужно $1 УР $2 и связанный перк выше', '🔒 потрібно $1 РІВ $2 і повʼязаний перк вище')],
  [/^(.+) (I|II|III|IV|V|VI|VII|VIII)$/, U('$1 $2', '$1 $2', '$1 $2')],
  [/^\+([\d.]+)(%?) ([a-zA-Z/ ]+)$/, U('+$1$2 $3', '+$1$2 $3', '+$1$2 $3')],
  [/^(.+) · rank (\d+)\/(\d+) · next: (.+)$/, U('$1 · რანგი $2/$3 · შემდეგი: $4', '$1 · ранг $2/$3 · далее: $4', '$1 · ранг $2/$3 · далі: $4')],
  [/^(.+) · rank (\d+)\/(\d+)$/, U('$1 · რანგი $2/$3', '$1 · ранг $2/$3', '$1 · ранг $2/$3')],
  [/^(.+) × (\d+)$/, U('$1 × $2', '$1 × $2', '$1 × $2')],
  [/^TROPHY HALL · (\d+)\/(\d+) · worth (\d+) ₽$/, U('ტროფეების დარბაზი · $1/$2 · ღირს $3 ₽', 'ЗАЛ ТРОФЕЕВ · $1/$2 · стоимость $3 ₽', 'ЗАЛ ТРОФЕЇВ · $1/$2 · вартість $3 ₽')],
  [/^Supplies used: (.+)$/, U('გამოყენებული მარაგი: $1', 'Использованы припасы: $1', 'Використано припаси: $1')],
  [/^VIP · (\d+)%$/, U('VIP · $1%', 'VIP · $1%', 'VIP · $1%')],
  [/^(\d+) (GREEN|RED|BLACK) · you win (\d+) ₽$/, U('$1 $2 · მოიგე $3 ₽', '$1 $2 · выигрыш $3 ₽', '$1 $2 · виграш $3 ₽')],
  [/^(\d+) (GREEN|RED|BLACK) · the house takes (\d+) ₽$/, U('$1 $2 · კაზინომ წაიღო $3 ₽', '$1 $2 · казино забирает $3 ₽', '$1 $2 · казино забирає $3 ₽')],
  [/^On the table: (\d+) ₽$/, U('მაგიდაზე: $1 ₽', 'На столе: $1 ₽', 'На столі: $1 ₽')],
  [/^(.+) ×([\d.]+) · ×4 ([\d.]+) · ×5 (.+)$/, U('$1 ×$2 · ×4 $3 · ×5 $4', '$1 ×$2 · ×4 $3 · ×5 $4', '$1 ×$2 · ×4 $3 · ×5 $4')],
  [/^☢️ JACKPOT (\d+) ₽ · BET (\d+) ₽$/, U('☢️ ჯეკპოტი $1 ₽ · ფსონი $2 ₽', '☢️ ДЖЕКПОТ $1 ₽ · СТАВКА $2 ₽', '☢️ ДЖЕКПОТ $1 ₽ · СТАВКА $2 ₽')],
  [/^WIN (\d+) ₽ on (\d+) lines?$/, U('მოგება $1 ₽ ($2 ხაზი)', 'ВЫИГРЫШ $1 ₽ (линий: $2)', 'ВИГРАШ $1 ₽ (ліній: $2)')],
  [/^☢️☢️☢️☢️☢️ JACKPOT! \+(\d+) ₽$/, U('☢️☢️☢️☢️☢️ ჯეკპოტი! +$1 ₽', '☢️☢️☢️☢️☢️ ДЖЕКПОТ! +$1 ₽', '☢️☢️☢️☢️☢️ ДЖЕКПОТ! +$1 ₽')],
  [/^DEALER · (.+)$/, U('დილერი · $1', 'ДИЛЕР · $1', 'ДИЛЕР · $1')],
  [/^YOU · (\d+)$/, U('შენ · $1', 'ТЫ · $1', 'ТИ · $1')],
  [/^BUST · you lose (\d+) ₽$/, U('გადაჭარბება · წააგე $1 ₽', 'ПЕРЕБОР · проигрыш $1 ₽', 'ПЕРЕБІР · програш $1 ₽')],
  [/^BLACKJACK! \+(\d+) ₽$/, U('ბლექჯეკი! +$1 ₽', 'БЛЭКДЖЕК! +$1 ₽', 'БЛЕКДЖЕК! +$1 ₽')],
  [/^Dealer busts! \+(\d+) ₽$/, U('დილერმა გადააჭარბა! +$1 ₽', 'У дилера перебор! +$1 ₽', 'У дилера перебір! +$1 ₽')],
  [/^You win! \+(\d+) ₽$/, U('მოიგე! +$1 ₽', 'Ты выиграл! +$1 ₽', 'Ти виграв! +$1 ₽')],
  [/^Dealer wins · you lose (\d+) ₽$/, U('დილერმა მოიგო · წააგე $1 ₽', 'Дилер выиграл · проигрыш $1 ₽', 'Дилер виграв · програш $1 ₽')],
  [/^Cashed out at ×([\d.]+) · \+(\d+) ₽$/, U('აღებულია ×$1-ზე · +$2 ₽', 'Забрано на ×$1 · +$2 ₽', 'Забрано на ×$1 · +$2 ₽')],
  [/^💥 CRASHED at ×([\d.]+) · lost (\d+) ₽$/, U('💥 ჩამოვარდა ×$1-ზე · დაკარგე $2 ₽', '💥 ОБВАЛ на ×$1 · потеряно $2 ₽', '💥 ОБВАЛ на ×$1 · втрачено $2 ₽')],
  [/^cashed at ×([\d.]+)$/, U('აღებულია ×$1-ზე', 'забрано на ×$1', 'забрано на ×$1')],
  [/^win chance (\d+)% · pays ×([\d.]+)$/, U('მოგების შანსი $1% · იხდის ×$2', 'шанс $1% · выплата ×$2', 'шанс $1% · виплата ×$2')],
  [/^(\d+) < (\d+) · \+(\d+) ₽$/, U('$1 < $2 · +$3 ₽', '$1 < $2 · +$3 ₽', '$1 < $2 · +$3 ₽')],
  [/^(\d+) ≥ (\d+) · lost (\d+) ₽$/, U('$1 ≥ $2 · დაკარგე $3 ₽', '$1 ≥ $2 · потеряно $3 ₽', '$1 ≥ $2 · втрачено $3 ₽')],
  [/^🪙 FLIP · (\d+) ₽$/, U('🪙 აგდება · $1 ₽', '🪙 ПОДБРОСИТЬ · $1 ₽', '🪙 ПІДКИНУТИ · $1 ₽')],
  [/^🪙 START · (\d+) ₽$/, U('🪙 დაწყება · $1 ₽', '🪙 НАЧАТЬ · $1 ₽', '🪙 ПОЧАТИ · $1 ₽')],
  [/^💀 Tails · lost (\d+) ₽$/, U('💀 წააგე $1 ₽', '💀 Решка · потеряно $1 ₽', '💀 Решка · втрачено $1 ₽')],
  [/^🎁 FREE DAILY SPIN · (\d+) ₽$/, U('🎁 უფასო დღიური დატრიალება · $1 ₽', '🎁 БЕСПЛАТНОЕ ВРАЩЕНИЕ ДНЯ · $1 ₽', '🎁 БЕЗКОШТОВНЕ ОБЕРТАННЯ ДНЯ · $1 ₽')],
  [/^ · \+(\d+) Mastery levels?!$/, U(' · +$1 ოსტატობის დონე!', ' · +$1 ур. мастерства!', ' · +$1 рів. майстерності!')],
  [/^Spent (.+)$/, U('დაიხარჯა $1', 'Потрачено $1', 'Витрачено $1')],
  [/^Kill (\d+) mutants$/, U('მოკალი $1 მუტანტი', 'Убей $1 мутантов', 'Вбий $1 мутантів')],
  [/^Collect (\d+) artifacts$/, U('შეაგროვე $1 არტეფაქტი', 'Собери $1 артефактов', 'Збери $1 артефактів')],
  [/^Kill (\d+) bosses$/, U('მოკალი $1 ბოსი', 'Убей $1 боссов', 'Вбий $1 босів')],
  [/^Complete (\d+) contracts$/, U('შეასრულე $1 კონტრაქტი', 'Выполни $1 контрактов', 'Виконай $1 контрактів')],
  [/^Survive (\d+) minutes in total$/, U('გადარჩი სულ $1 წუთი', 'Выживи в сумме $1 минут', 'Виживи загалом $1 хвилин')],
  [/^Win (\d+) stage$/, U('მოიგე $1 ეტაპი', 'Победи на $1 этапе', 'Переможи на $1 етапі')],
  [/^Play (\d+) runs$/, U('ითამაშე $1 რბოლა', 'Сыграй $1 забегов', 'Зіграй $1 забігів')],
  [/^Play (\d+) casino games$/, U('ითამაშე $1 კაზინოს თამაში', 'Сыграй $1 игр в казино', 'Зіграй $1 ігор у казино')],
  [/^DAILY MISSIONS · new ones in (\d+)h (\d+)m · one free change a day$/, U('დღიური მისიები · ახლები $1სთ $2წთ-ში · ერთი უფასო შეცვლა დღეში', 'ЕЖЕДНЕВНЫЕ МИССИИ · новые через $1ч $2м · одна бесплатная замена в день', 'ЩОДЕННІ МІСІЇ · нові через $1год $2хв · одна безкоштовна заміна на день')],
  [/^(.+) · claim it in Missions$/, U('$1 · აიღე მისიებში', '$1 · забери в Миссиях', '$1 · забери в Місіях')],
  [/^🔄 (\d+) ₽$/, U('🔄 $1 ₽', '🔄 $1 ₽', '🔄 $1 ₽')],
  [/^DAILY BONUS · log in every day, the 7th day gives an Epic Container · streak (\d+)$/, U('დღიური ბონუსი · შემოდი ყოველდღე, მე-7 დღე ეპიკურ კონტეინერს იძლევა · სერია $1', 'ЕЖЕДНЕВНЫЙ БОНУС · заходи каждый день, 7-й день даёт Эпический контейнер · серия $1', 'ЩОДЕННИЙ БОНУС · заходь щодня, 7-й день дає Епічний контейнер · серія $1')],
  [/^DAY (\d+)$/, U('დღე $1', 'ДЕНЬ $1', 'ДЕНЬ $1')],
  [/^Come back in (\d+)h (\d+)m$/, U('დაბრუნდი $1სთ $2წთ-ში', 'Возвращайся через $1ч $2м', 'Повертайся через $1год $2хв')],
  [/^THIS MONTH · (\d+)\/(\d+) days · every 7 days in a month gives a Legendary chance$/, U('ეს თვე · $1/$2 დღე · თვეში ყოველი 7 დღე ლეგენდარულის შანსს იძლევა', 'ЭТОТ МЕСЯЦ · $1/$2 дней · каждые 7 дней в месяце дают шанс на Легендарный', 'ЦЕЙ МІСЯЦЬ · $1/$2 днів · кожні 7 днів на місяць дають шанс на Легендарний')],
  [/^ZONE PASS · season ends in (\d+) days · earn ⭐ from missions \(10 ⭐ per tier\)$/, U('ზონის საშვი · სეზონი მთავრდება $1 დღეში · მოიპოვე ⭐ მისიებით (10 ⭐ ერთ საფეხურზე)', 'ПРОПУСК ЗОНЫ · сезон закончится через $1 дн. · получай ⭐ за миссии (10 ⭐ за уровень)', 'ПЕРЕПУСТКА ЗОНИ · сезон завершиться через $1 дн. · отримуй ⭐ за місії (10 ⭐ за рівень)')],
  [/^TIER (\d+)\/(\d+)$/, U('საფეხური $1/$2', 'УРОВЕНЬ $1/$2', 'РІВЕНЬ $1/$2')],
  [/^👑 ELITE PASS · (\d+) ₽$/, U('👑 ელიტური საშვი · $1 ₽', '👑 ЭЛИТНЫЙ ПРОПУСК · $1 ₽', '👑 ЕЛІТНА ПЕРЕПУСТКА · $1 ₽')],
  [/^\+1 TIER · (\d+) ₽$/, U('+1 საფეხური · $1 ₽', '+1 УРОВЕНЬ · $1 ₽', '+1 РІВЕНЬ · $1 ₽')],
  [/^⭐ (\d+) rewards claimed$/, U('⭐ აღებულია $1 ჯილდო', '⭐ получено наград: $1', '⭐ отримано нагород: $1')],
  [/^HAPPY HOURS · your timezone: (\S+) \(UTC([+-]?[\d.]+)\) · runs started during a happy hour get its bonus$/, U('ბედნიერი საათები · შენი სასაათო სარტყელი: $1 (UTC$2) · ბედნიერ საათში დაწყებული რბოლა ბონუსს იღებს', 'СЧАСТЛИВЫЕ ЧАСЫ · твой часовой пояс: $1 (UTC$2) · забеги, начатые в счастливый час, получают бонус', 'ЩАСЛИВІ ГОДИНИ · твій часовий пояс: $1 (UTC$2) · забіги, розпочаті у щасливу годину, отримують бонус')],
  [/^✅ ACTIVE NOW: (.+)$/, U('✅ ახლა მოქმედებს: $1', '✅ СЕЙЧАС АКТИВНО: $1', '✅ ЗАРАЗ АКТИВНО: $1')],
  [/^(\d\d):00 – (\d\d):00 · (.+)$/, U('$1:00 – $2:00 · $3', '$1:00 – $2:00 · $3', '$1:00 – $2:00 · $3')],
  [/^(\S+) (Morning Shift|Lunch Break|Prime Time|Night Owl|Weekend Bonus)$/, U('$1 $2', '$1 $2', '$1 $2')],
  [/^(🌅|🍲|🔥|🦉|🎉) (.+), (.+)$/, U('$1 $2, $3', '$1 $2, $3', '$1 $2, $3')],
  [/^\+(\d+) ₽ · ⭐ (\d+)(.*)$/, U('+$1 ₽ · ⭐ $2$3', '+$1 ₽ · ⭐ $2$3', '+$1 ₽ · ⭐ $2$3')],
  [/^🌟 (\d+) Mastery XP$/, U('🌟 $1 ოსტატობის XP', '🌟 $1 опыта мастерства', '🌟 $1 досвіду майстерності')],
  [/^① ⬆ Level up (\S+)$/, U('① ⬆ აწიე $1-ის დონე', '① ⬆ Повысь $1', '① ⬆ Підвищ $1')],
  [/^Next row of perks opens at LV (\d+)\.$/, U('პერკების შემდეგი რიგი იხსნება $1 დონეზე.', 'Следующий ряд перков откроется на УР $1.', 'Наступний ряд перків відкриється на РІВ $1.')],
  [/^🔒 LV (\d+)$/, U('🔒 დონე $1', '🔒 УР $1', '🔒 РІВ $1')],
  [/^⬆ LEVEL UP · (\d+) ₽$/, U('⬆ დონის აწევა · $1 ₽', '⬆ ПОВЫСИТЬ · $1 ₽', '⬆ ПІДВИЩИТИ · $1 ₽')],
  [/^need (\d+) ₽ more$/, U('აკლია $1 ₽', 'не хватает $1 ₽', 'бракує $1 ₽')],
  [/^(\S+) · WIN (\d+) ₽ \(×(\d+)\)$/, U('$1 · მოგება $2 ₽ (×$3)', '$1 · ВЫИГРЫШ $2 ₽ (×$3)', '$1 · ВИГРАШ $2 ₽ (×$3)')],
  [/^(.+) – (.+): (\d+)%$/, U('$1 – $2: $3%', '$1 – $2: $3%', '$1 – $2: $3%')],
  [/^🏁 NEW RECORD · (\S+) (.+): (.+) \(was (.+)\)$/, U('🏁 ახალი რეკორდი · $1 $2: $3 (იყო $4)', '🏁 НОВЫЙ РЕКОРД · $1 $2: $3 (было $4)', '🏁 НОВИЙ РЕКОРД · $1 $2: $3 (було $4)')],
  [/^🏁 NEW RECORD · (\S+) (.+): (.+)$/, U('🏁 ახალი რეკორდი · $1 $2: $3', '🏁 НОВЫЙ РЕКОРД · $1 $2: $3', '🏁 НОВИЙ РЕКОРД · $1 $2: $3')],
  [/^\(was (.+)\)$/, U('(იყო $1)', '(было $1)', '(було $1)')],
  [/^🏁 NEW RECORD · (\S+) (.+):\s*$/, U('🏁 ახალი რეკორდი · $1 $2:', '🏁 НОВЫЙ РЕКОРД · $1 $2:', '🏁 НОВИЙ РЕКОРД · $1 $2:')],
  [/^Based on your last (\d+) runs · you last ×([\d.]+) as long as an average stalker$/, U('ეფუძნება შენს ბოლო $1 რბოლას · საშუალო სტალკერზე ×$2-ჯერ დიდხანს ძლებ', 'На основе твоих последних $1 забегов · ты держишься в ×$2 дольше среднего сталкера', 'На основі твоїх останніх $1 забігів · ти тримаєшся в ×$2 довше за середнього сталкера')],
  [/^(\d+)% to reach 15:00$/, U('$1% შანსი 15:00-მდე', '$1% дожить до 15:00', '$1% дожити до 15:00')],
  [/^✨ Suggested from your last (\d+) runs$/, U('✨ რჩევა შენი ბოლო $1 რბოლიდან', '✨ Совет по твоим последним $1 забегам', '✨ Порада за твоїми останніми $1 забігами')],
  [/^(🟢|🟡|🔴) (.+)$/, U('$1 $2', '$1 $2', '$1 $2')],
  [/^🎁 FREE ROLL \((\d+)\)$/, U('🎁 უფასო ტრიალი ($1)', '🎁 БЕСПЛАТНЫЙ РАУНД ($1)', '🎁 БЕЗКОШТОВНИЙ РАУНД ($1)')],
  [/^⚡ AUTO FREE ROLL \((\d+)\)$/, U('⚡ ავტო უფასო ტრიალი ($1)', '⚡ АВТО БЕСПЛАТНЫЙ РАУНД ($1)', '⚡ АВТО БЕЗКОШТОВНИЙ РАУНД ($1)')],
  [/^🎲 AUTO-PICK & ROLL$/, U('🎲 ავტო-არჩევა და დატრიალება', '🎲 АВТОВЫБОР И БРОСОК', '🎲 АВТОВИБІР І КИДОК')],
  [/^🎁 SELECT FREE ROLL \((\d+)\)$/, U('🎁 აირჩიე უფასო ტრიალი ($1)', '🎁 ВЫБЕРИ БЕСПЛАТНЫЙ РАУНД ($1)', '🎁 ОБЕРИ БЕЗКОШТОВНИЙ РАУНД ($1)')],
  [/^🎁 ARMED — press play \((\d+)\)$/, U('🎁 მზადაა — დააჭირე თამაშს ($1)', '🎁 ГОТОВО — жми играть ($1)', '🎁 ГОТОВО — тисни грати ($1)')],
  [/^🎁 FREE DAILY PLAY · (\d+) ₽ ×(\d+)$/, U('🎁 უფასო დღიური თამაში · $1 ₽ ×$2', '🎁 БЕСПЛАТНАЯ ИГРА ДНЯ · $1 ₽ ×$2', '🎁 БЕЗКОШТОВНА ГРА ДНЯ · $1 ₽ ×$2')],
  [/^🎁 FREE DAILY PLAY · (\d+) ₽$/, U('🎁 უფასო დღიური თამაში · $1 ₽', '🎁 БЕСПЛАТНАЯ ИГРА ДНЯ · $1 ₽', '🎁 БЕЗКОШТОВНА ГРА ДНЯ · $1 ₽')],
  [/^🎁 FREE PLAY ARMED · (\d+) ₽ — press play!$/, U('🎁 უფასო თამაში მზადაა · $1 ₽ — დააჭირე თამაშს!', '🎁 БЕСПЛАТНАЯ ИГРА ГОТОВА · $1 ₽ — жми играть!', '🎁 БЕЗКОШТОВНА ГРА ГОТОВА · $1 ₽ — тисни грати!')],
  [/^🍀 LUCKY HOUR · (\d+) min left$/, U('🍀 იღბლიანი საათი · დარჩა $1 წთ', '🍀 СЧАСТЛИВЫЙ ЧАС · осталось $1 мин', '🍀 ЩАСЛИВА ГОДИНА · лишилось $1 хв')],
  [/^🕐 Stay bonus in (\d+):(\d+)$/, U('🕐 დარჩენის ბონუსი $1:$2-ში', '🕐 Бонус за время через $1:$2', '🕐 Бонус за час через $1:$2')],
  [/^🎁 (\d+) free plays today$/, U('🎁 დღეს $1 უფასო თამაში', '🎁 $1 бесплатных игр сегодня', '🎁 $1 безкоштовних ігор сьогодні')],
  [/^💸 CASHBACK (\d+) ₽$/, U('💸 ქეშბექი $1 ₽', '💸 КЭШБЭК $1 ₽', '💸 КЕШБЕК $1 ₽')],
  [/^🕐 Stay bonus \+(\d+) ₽$/, U('🕐 დარჩენის ბონუსი +$1 ₽', '🕐 Бонус за время +$1 ₽', '🕐 Бонус за час +$1 ₽')],
  [/^📢 (\S+) won (\d+) ₽ on (.+) \(×([\d.]+)\)$/, U('📢 $1-მ მოიგო $2 ₽ · $3 (×$4)', '📢 $1 выиграл $2 ₽ в $3 (×$4)', '📢 $1 виграв $2 ₽ у $3 (×$4)')],
  [/^(.+) \+ (.+)$/, U('$1 + $2', '$1 + $2', '$1 + $2')],
  [/^⏰ Free chest in (\d+):(\d+)$/, U('⏰ უფასო ზარდახშა $1:$2-ში', '⏰ Бесплатный сундук через $1:$2', '⏰ Безкоштовна скриня через $1:$2')],
  [/^⏰ Free chest \+(\d+) ₽$/, U('⏰ უფასო ზარდახშა +$1 ₽', '⏰ Бесплатный сундук +$1 ₽', '⏰ Безкоштовна скриня +$1 ₽')],
  [/^🎲 One more try −20% · (\d+)s$/, U('🎲 კიდევ ერთი ცდა −20% · $1წ', '🎲 Ещё попытка −20% · $1с', '🎲 Ще спроба −20% · $1с')],
  [/^🎰 (\d+) free play tokens$/, U('🎰 $1 უფასო თამაშის ჟეტონი', '🎰 Жетонов бесплатной игры: $1', '🎰 Жетонів безкоштовної гри: $1')],
  [/^🎰 (\d+) losses in a row · FREE PLAY token!$/, U('🎰 $1 წაგება ზედიზედ · უფასო თამაშის ჟეტონი!', '🎰 $1 проигрышей подряд · жетон бесплатной игры!', '🎰 $1 програшів поспіль · жетон безкоштовної гри!')],
  [/^☢️ Jackpot grows ([\d.]+)% of each bet$/, U('☢️ ჯეკპოტი იზრდება ყოველი ფსონის $1%-ით', '☢️ Джекпот растёт на $1% от ставки', '☢️ Джекпот росте на $1% від ставки')],
  [/^(\d+) pts$/, U('$1 ქ.', '$1 оч.', '$1 оч.')],
  [/^×([\d.]+) · \+(\d+) ₽$/, U('×$1 · +$2 ₽', '×$1 · +$2 ₽', '×$1 · +$2 ₽')],
  [/^💀 empty box · lost (\d+) ₽$/, U('💀 ცარიელი ყუთი · წააგე $1 ₽', '💀 пустая коробка · потеряно $1 ₽', '💀 порожня коробка · втрачено $1 ₽')],
  [/^Door (\d+) had a 🐐 — stay or switch\?$/, U('კარს $1 ჰყავდა 🐐 — დარჩენა თუ შეცვლა?', 'За дверью $1 был 🐐 — остаться или сменить?', 'За дверима $1 був 🐐 — залишитись чи змінити?')],
  [/^🏆 The prize was behind door (\d+)! \+(\d+) ₽$/, U('🏆 პრიზი კარს $1 იყო! +$2 ₽', '🏆 Приз был за дверью $1! +$2 ₽', '🏆 Приз був за дверима $1! +$2 ₽')],
  [/^🐐 The prize was behind door (\d+) · lost (\d+) ₽$/, U('🐐 პრიზი კარს $1 იყო · წააგე $2 ₽', '🐐 Приз был за дверью $1 · потеряно $2 ₽', '🐐 Приз був за дверима $1 · втрачено $2 ₽')],
  [/^(.+) wins! \+(\d+) ₽$/, U('$1 იმარჯვებს! +$2 ₽', '$1 побеждает! +$2 ₽', '$1 перемагає! +$2 ₽')],
  [/^(.+) wins · you lose (\d+) ₽$/, U('$1 იმარჯვებს · წააგე $2 ₽', '$1 побеждает · проигрыш $2 ₽', '$1 перемагає · програш $2 ₽')],
  [/^🔐 CRACKED! \+(\d+) ₽ \(×(\d+)\)$/, U('🔐 გატეხილია! +$1 ₽ (×$2)', '🔐 ВЗЛОМАНО! +$1 ₽ (×$2)', '🔐 ЗЛАМАНО! +$1 ₽ (×$2)')],
  [/^🔐 Vault (\d+)%$/, U('🔐 სეიფი $1%', '🔐 Сейф $1%', '🔐 Сейф $1%')],
  [/^🔄 Free plays reset in (\d+)h (\d+)m$/, U('🔄 უფასო თამაშები განახლდება $1სთ $2წთ-ში', '🔄 Бесплатные игры обновятся через $1ч $2м', '🔄 Безкоштовні ігри оновляться через $1год $2хв')],
  [/^💸 Cashback: (\d+)% of today's losses$/, U('💸 ქეშბექი: დღევანდელი წაგების $1%', '💸 Кэшбэк: $1% сегодняшних проигрышей', '💸 Кешбек: $1% сьогоднішніх програшів')],
  [/^🎉 (.+)$/, U('🎉 $1', '🎉 $1', '🎉 $1')],
  [/^🎁 (.+)$/, U('🎁 $1', '🎁 $1', '🎁 $1')],
  [/^⭐ (.+)$/, U('⭐ $1', '⭐ $1', '⭐ $1')],
  [/^(📦|🎁|💼|👑) (.+)$/, U('$1 $2', '$1 $2', '$1 $2')],
  [/^🏆 (.+)$/, U('🏆 $1', '🏆 $1', '🏆 $1')],
  [/^(.+) \+ (.+)$/, U('$1 + $2', '$1 + $2', '$1 + $2')],
  [/^⏰ (.+)$/, U('⏰ $1', '⏰ $1', '⏰ $1')],
];

// ----- hooks -----
let BANNER_EN = null;
const _iBanner = banner;
banner = function (title, sub, dur, cls, prio) {
  if (I18n.cur === 'en') return _iBanner(title, sub, dur, cls, prio);
  BANNER_EN = title;
  try { _iBanner(I18n.t(String(title || '')), I18n.t(String(sub || '')), dur, cls, prio); } finally { BANNER_EN = null; }
};
const _iMake = Quests.make.bind(Quests);
Quests.make = function () { const n = this.list.length; _iMake(); for (const q of this.list.slice(n)) { q._enBase = q.base; q._enText = q.text; if (I18n.cur === 'en') continue; if (q.base) q.base = I18n.t(q.base); q.text = I18n.t(q.text); } };
// contracts made in one language follow a language switch
I18n.request = function (L) { if (typeof Quests === 'undefined' || !Quests.list) return; for (const q of Quests.list) { if (q._enText === undefined) continue; if (q._enBase !== undefined && q._enBase !== null) q.base = L === 'en' ? q._enBase : this.t(q._enBase, L); q.text = L === 'en' ? q._enText : this.t(q._enText, L); } if (Quests.hash !== undefined) Quests.hash = null; };
const _iLoad = Save.load.bind(Save);
Save.load = function () { _iLoad(); I18n.apply(Save.data.lang || 'en'); };
// catch the language being changed in Settings, and keep dynamic UI translated
setInterval(() => {
  if (!Save.data) return;
  const L = I18N_LANGS.includes(Save.data.lang) ? Save.data.lang : 'en';
  if (L !== I18n.cur) { I18n.apply(L); I18n.request(L); if (typeof hudBuild === 'function' && G && !G.title && P) hudBuild(); }
}, 700);
// ----- instant translation: anything the game writes is translated before the screen repaints, so languages never flicker -----
I18n.cache = new Map();
I18n.tc = function (s) { // cached translation for hot paths (HUD, canvas)
  const k = this.cur + '\u0001' + s; let v = this.cache.get(k);
  if (v === undefined) { try { v = this.t(s, this.cur); } catch (e) { v = s; } if (this.cache.size > 6000) this.cache.clear(); this.cache.set(k, v); }
  return v;
};
I18n.trText = function (n) {
  const raw = n.nodeValue; if (!raw || raw === n._tr) return;
  const t = raw.trim(); if (!t || !/[a-z]/i.test(t)) { n._tr = raw; return; }
  n._en = raw; const out = raw.replace(t, this.tc(t)); n._tr = out; if (out !== raw) n.nodeValue = out;
};
const i18nObserve = () => {
  const skip = /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/;
  new MutationObserver((ms) => {
    if (I18n.cur === 'en') return;
    for (const m of ms) {
      if (m.type === 'characterData') { const n = m.target; if (n.parentNode && !skip.test(n.parentNode.nodeName)) I18n.trText(n); }
      else if (m.type === 'attributes') { const el = m.target; if (m.attributeName !== 'placeholder') { const v = el.getAttribute(m.attributeName), k = 'en' + m.attributeName.replace('-', ''); if (v && v !== el.dataset[k + 'T']) { el.dataset[k] = v; const out = I18n.tc(v); el.dataset[k + 'T'] = out; if (out !== v) el.setAttribute(m.attributeName, out); } } else if (m.attributeName === 'placeholder' && el.placeholder !== el.dataset.trPh) { el.dataset.enPh = el.placeholder; el.placeholder = el.dataset.trPh = I18n.tc(el.placeholder); } }
      else for (const a of m.addedNodes) {
        if (a.nodeType === 3) { if (a.parentNode && !skip.test(a.parentNode.nodeName)) I18n.trText(a); }
        else if (a.nodeType === 1 && !skip.test(a.nodeName)) { try { I18n.dom(a); } catch (e) { /* keep english */ } }
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'data-tip'] });
};
if (document.body) i18nObserve(); else addEventListener('DOMContentLoaded', i18nObserve);
// safety sweep: catches text created before the language was known (it only fixes leftovers, so nothing flickers)
// during a run only the HUD is on screen, so don't walk the hidden bunker/casino every 1.5s (that caused frame hitches on phones)
const i18nSweep = () => {
  if (!Save.data || I18n.cur === 'en' || document.visibilityState !== 'visible') return;
  const inRun = typeof G !== 'undefined' && G && !G.title && G.state === 'play';
  try { I18n.dom(inRun ? $('hud') : document.body); } catch (e) { /* keep going */ }
};
addEventListener('DOMContentLoaded', () => setTimeout(i18nSweep, 0)); addEventListener('load', i18nSweep); setInterval(i18nSweep, 1500);
// text drawn on the game canvas (labels, prompts, floating texts) is translated too
{
  const C = CanvasRenderingContext2D.prototype, tr = (s) => (typeof s === 'string' && I18n.cur !== 'en' && /[A-Za-z]{2}/.test(s) ? I18n.tc(s) : s);
  const _ft = C.fillText, _st2 = C.strokeText, _mt = C.measureText;
  C.fillText = function (s, ...a) { return _ft.call(this, tr(s), ...a); };
  C.strokeText = function (s, ...a) { return _st2.call(this, tr(s), ...a); };
  C.measureText = function (s) { return _mt.call(this, tr(s)); };
}
// HUD lines rewritten every second are translated as they are written (no English flicker)
addEventListener('DOMContentLoaded', () => {
  const _st = setText;
  // translate only when the English text actually changed, and through the cache: the HUD writes ~10 fields every frame
  const raw = {};
  setText = function (id, v) { const k = I18n.cur + '\u0001' + v; if (raw[id] === k) return; raw[id] = k; if (I18n.cur !== 'en' && typeof v === 'string' && /\p{L}/u.test(v)) { try { v = I18n.tc(v); } catch (e) { /* keep english */ } } return _st(id, v); };
});

// the co-op lobby redraws itself every second: translate right after each redraw
addEventListener('DOMContentLoaded', () => {
  const tr = () => { if (I18n.cur !== 'en' && $('coop')) try { I18n.dom($('coop')); } catch (e) { /* keep english */ } };
  for (const name of ['coLobbyUI', 'coUI', 'coStatus']) {
    const f = window[name]; if (typeof f !== 'function') continue;
    const w = function (...a) { const r = f.apply(this, a); tr(); return r; };
    try { window[name] = w; } catch (e) { /* not replaceable */ }
  }
});
