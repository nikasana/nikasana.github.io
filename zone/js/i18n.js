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
      for (const L of I18N_LANGS) if (T[L] && T[L].length !== seen.length) console.warn('[i18n] ' + g + '/' + L + ': ' + T[L].length + ' vs ' + seen.length);
      seen.forEach((en, i) => { const tr = {}; for (const L of I18N_LANGS) if (T[L] && T[L].length === seen.length) tr[L] = T[L][i]; D.set(en, tr); N.set(numKey(en), { tr, en }); });
    }
    for (const [en, tr] of Object.entries(UI_TR)) { D.set(en, tr); N.set(numKey(en), { tr, en }); }
    this.dict = D; this.norm = N;
    // names used inside longer texts (bosses, regions, artifacts...), longest first
    const T = []; for (const g of ['enemies', 'regions', 'arts', 'weapons', 'stages', 'anoms', 'events', 'items', 'chars']) for (const it of groups[g] || []) { const en = it.o[it.f]; if (en && en.length > 2 && D.get(en)) T.push(en); }
    this.terms = [...new Set(T)].sort((a, b) => b.length - a.length);
  },
  // translate one string: exact → same words with other numbers → names swapped inside
  t(s, L = this.cur) {
    if (!s || L === 'en' || typeof s !== 'string') return s;
    const d = this.dict.get(s); if (d && d[L]) return d[L];
    const n = this.norm.get(numKey(s));
    if (n && n.tr[L]) { const nums = s.match(/\d+(\.\d+)?/g) || []; let i = 0; return n.tr[L].replace(/\d+(\.\d+)?/g, (m) => (nums[i] !== undefined ? nums[i++] : m)); }
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
    this.build();
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
    const L = this.cur, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = w.nextNode())) {
      const raw = n.nodeValue, t = raw.trim(); if (!t || !/[a-z]/i.test(t) && n._en === undefined) continue;
      if (n._en !== undefined && n._tr !== raw) n._en = undefined; // the game rewrote this text
      if (n._en === undefined) { if (!/[a-z]/i.test(t)) continue; n._en = raw; }
      const src = n._en.trim(), out = L === 'en' ? src : this.t(src, L);
      const v = n._en.replace(src, out); if (v !== raw) n.nodeValue = v; n._tr = n.nodeValue;
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
const UI_PATTERNS = [
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
Quests.make = function () { const n = this.list.length; _iMake(); if (I18n.cur === 'en') return; for (const q of this.list.slice(n)) { if (q.base) q.base = I18n.t(q.base); q.text = I18n.t(q.text); } };
const _iLoad = Save.load.bind(Save);
Save.load = function () { _iLoad(); I18n.apply(Save.data.lang || 'en'); };
// catch the language being changed in Settings, and keep dynamic UI translated
setInterval(() => {
  if (!Save.data) return;
  const L = I18N_LANGS.includes(Save.data.lang) ? Save.data.lang : 'en';
  if (L !== I18n.cur) { I18n.apply(L); if (typeof hudBuild === 'function' && G && !G.title && P) hudBuild(); }
  else if (L !== 'en') I18n.dom(document.body);
}, 700);
