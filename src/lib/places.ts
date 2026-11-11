import { OBLASTS } from "@/data/oblasts"

export type PlaceKind = "city" | "oblast" | "area"

export type Place = {
  id: string
  name: string
  lon: number
  lat: number
  oblast: string
  kind: PlaceKind
  aliases: string[]
}

const CITIES: Place[] = [
  city("kyiv", "Київ", 30.524, 50.45, "kyiv", ["києві", "києва", "київ"]),
  city("chernihiv", "Чернігів", 31.29, 51.498, "cernigivska-oblast", ["чернігові", "чернігова", "чернігів"]),
  city("sumy", "Суми", 34.799, 50.907, "sumska-oblast", ["сумах", "суми"]),
  city("poltava", "Полтава", 34.551, 49.59, "poltavska-oblast", ["полтаві", "полтави", "полтава"]),
  city("kharkiv", "Харків", 36.231, 49.992, "xarkivska-oblast", ["харкові", "харкова", "харків"]),
  city("dnipro", "Дніпро", 35.042, 48.468, "dnipropetrovska", ["дніпрі", "дніпра", "дніпро"]),
  city("zaporizhzhia", "Запоріжжя", 35.139, 47.838, "zaporizka-oblast", ["запоріжжі", "запоріжжя", "запоріжжям"]),
  city("kryvyi-rih", "Кривий Ріг", 33.392, 47.91, "dnipropetrovska", ["кривого рогу", "кривий ріг", "кривому розі"]),
  city("nikopol", "Нікополь", 34.392, 47.569, "dnipropetrovska", ["нікополі", "нікополя", "нікополь"]),
  city("mykolaiv", "Миколаїв", 31.995, 46.975, "mikolayivska-oblast", ["миколаєві", "миколаєва", "миколаїв"]),
  city("odesa", "Одеса", 30.724, 46.482, "odeska", ["одесі", "одеси", "одеса"]),
  city("kherson", "Херсон", 32.617, 46.635, "xersonska-oblast", ["херсоні", "херсона", "херсон"]),
  city("vinnytsia", "Вінниця", 28.469, 49.233, "vinnicka-oblast", ["вінниці", "вінниця"]),
  city("zhytomyr", "Житомир", 28.659, 50.254, "zitomirska-oblast", ["житомирі", "житомира", "житомир"]),
  city("rivne", "Рівне", 26.251, 50.619, "rivnenska-oblast", ["рівному", "рівне", "рівного"]),
  city("lutsk", "Луцьк", 25.342, 50.747, "volinska-oblast", ["луцьку", "луцька", "луцьк"]),
  city("lviv", "Львів", 24.032, 49.842, "lvivska", ["львові", "львова", "львів"]),
  city("ternopil", "Тернопіль", 25.595, 49.553, "ternopilska-oblast", ["тернополі", "тернополя", "тернопіль"]),
  city("khmelnytskyi", "Хмельницький", 26.987, 49.423, "xmelnycka-oblast", ["хмельницькому", "хмельницького", "хмельницький"]),
  city("chernivtsi", "Чернівці", 25.935, 48.292, "cernivecka-oblast", ["чернівцях", "чернівці"]),
  city("ivano", "Івано-Франківськ", 24.712, 48.922, "ivano-frankivska-oblast", ["івано-франківську", "івано-франківська", "івано-франківськ", "франківську", "франківськ"]),
  city("uzhhorod", "Ужгород", 22.288, 48.62, "zakarpatska-oblast", ["ужгороді", "ужгорода", "ужгород"]),
  city("cherkasy", "Черкаси", 32.062, 49.444, "cerkaska-oblast", ["черкасах", "черкас", "черкаси"]),
  city("kropyvnytskyi", "Кропивницький", 32.266, 48.511, "kirovogradska-oblast", ["кропивницькому", "кропивницького", "кропивницький"]),
  city("bila-tserkva", "Біла Церква", 30.112, 49.796, "kyivska", ["білій церкві", "білої церкви", "біла церква", "білу церкву"]),
  city("uman", "Умань", 30.222, 48.749, "cerkaska-oblast", ["умані", "умань"]),
  city("oleksandriia", "Олександрія", 33.116, 48.667, "kirovogradska-oblast", ["олександрії", "олександрія"]),
  city("pavlohrad", "Павлоград", 35.87, 48.534, "dnipropetrovska", ["павлограді", "павлограда", "павлоград"]),
  city("lozova", "Лозова", 36.316, 48.889, "xarkivska-oblast", ["лозовій", "лозової", "лозова"]),
  city("kupiansk", "Куп'янськ", 37.616, 49.711, "xarkivska-oblast", ["купянську", "купянська", "купянськ", "куп'янську", "куп'янська", "куп'янськ"]),
  city("chuhuiv", "Чугуїв", 36.688, 49.836, "xarkivska-oblast", ["чугуєві", "чугуєва", "чугуїв"]),
  city("melitopol", "Мелітополь", 35.366, 46.848, "zaporizka-oblast", ["мелітополі", "мелітополя", "мелітополь"]),
  city("berdiansk", "Бердянськ", 36.788, 46.755, "zaporizka-oblast", ["бердянську", "бердянська", "бердянськ"]),
  city("konotop", "Конотоп", 33.209, 51.24, "sumska-oblast", ["конотопі", "конотопа", "конотоп"]),
  city("nizhyn", "Ніжин", 31.887, 51.048, "cernigivska-oblast", ["ніжині", "ніжина", "ніжин"]),
  city("pryluky", "Прилуки", 32.388, 50.589, "cernigivska-oblast", ["прилуках", "прилук", "прилуки"]),
  city("myrhorod", "Миргород", 33.613, 49.964, "poltavska-oblast", ["миргороді", "миргорода", "миргород"]),
  city("kremenchuk", "Кременчук", 33.42, 49.068, "poltavska-oblast", ["кременчуці", "кременчука", "кременчук"]),
  city("horishni", "Горішні Плавні", 33.656, 49.011, "poltavska-oblast", ["горішніх плавнях", "горішні плавні"]),
  city("znamianka", "Знам'янка", 32.674, 48.713, "kirovogradska-oblast", ["знамянці", "знамянка", "знам'янці", "знам'янка"]),
  city("fastiv", "Фастів", 29.918, 50.076, "kyivska", ["фастові", "фастова", "фастів"]),
  city("boryspil", "Бориспіль", 30.955, 50.353, "kyivska", ["борисполі", "борисполя", "бориспіль"]),
  city("brovary", "Бровари", 30.791, 50.511, "kyivska", ["броварах", "броварів", "бровари"]),
  city("irpin", "Ірпінь", 30.259, 50.522, "kyivska", ["ірпені", "ірпеня", "ірпінь"]),
  city("bucha", "Буча", 30.212, 50.548, "kyivska", ["бучі", "буча"]),
  city("obukhiv", "Обухів", 30.62, 50.11, "kyivska", ["обухові", "обухова", "обухів"]),
  city("vasylkiv", "Васильків", 30.313, 50.185, "kyivska", ["василькові", "василькова", "васильків"]),
  city("pereiaslav", "Переяслав", 31.445, 50.065, "kyivska", ["переяславі", "переяслава", "переяслав"]),
  city("yahotyn", "Яготин", 31.763, 50.276, "kyivska", ["яготині", "яготина", "яготин"]),
  city("stavyshche", "Ставище", 30.192, 49.39, "kyivska", ["ставищі", "ставища", "ставище"]),
  city("zhashkiv", "Жашків", 30.107, 49.248, "cerkaska-oblast", ["жашкові", "жашкова", "жашків"]),
  city("buky", "Буки", 30.391, 49.093, "cerkaska-oblast", ["буках", "буки"]),
  city("shyriaieve", "Ширяєве", 30.19, 47.384, "odeska", ["ширяєвому", "ширяєве", "ширяєвого"]),
  city("novomyrhorod", "Новомиргород", 31.652, 48.797, "kirovogradska-oblast", ["новомиргороді", "новомиргорода", "новомиргород"]),
  city("ochakiv", "Очаків", 31.545, 46.615, "mikolayivska-oblast", ["очакові", "очакова", "очаків"]),
  city("chornobyl", "Чорнобиль", 30.222, 51.276, "kyivska", ["чорнобилі", "чорнобиля", "чорнобиль", "зоні відчуження", "зона відчуження", "зони відчуження", "зону відчуження"]),
  city("izium", "Ізюм", 37.278, 49.191, "xarkivska-oblast", ["ізюмі", "ізюма", "ізюм"]),
  city("barvinkove", "Барвінкове", 37.025, 48.903, "xarkivska-oblast", ["барвінковому", "барвінкове", "барвінкового"]),
  city("sakhnovshchyna", "Сахновщина", 35.87, 49.15, "xarkivska-oblast", ["сахновщині", "сахновщини", "сахновщину", "сахновщина"]),
  city("zachepylivka", "Зачепилівка", 35.24, 49.194, "xarkivska-oblast", ["зачепилівці", "зачепилівки", "зачепилівку", "зачепилівка"]),
  city("krasnopavlivka", "Краснопавлівка", 36.316, 49.136, "xarkivska-oblast", ["краснопавлівці", "краснопавлівки", "краснопавлівку", "краснопавлівка"]),
  city("derhachi", "Дергачі", 36.113, 50.11, "xarkivska-oblast", ["дергачах", "дергачів", "дергачі"]),
  city("mala-danylivka", "Мала Данилівка", 36.167, 50.064, "xarkivska-oblast", ["малу данилівку", "малої данилівки", "малій данилівці", "мала данилівка"]),
  city("bezliudivka", "Безлюдівка", 36.272, 49.867, "xarkivska-oblast", ["безлюдівці", "безлюдівки", "безлюдівку", "безлюдівка"]),
  city("tsyrkuny", "Циркуни", 36.433, 50.091, "xarkivska-oblast", ["циркунах", "циркуни", "циркунів"]),
  city("zmiiv", "Зміїв", 36.355, 49.687, "xarkivska-oblast", ["змієві", "змієва", "зміїв"]),
  city("slobozhanske", "Слобожанське", 36.53, 49.597, "xarkivska-oblast", ["слобожанському", "слобожанського", "слобожанське"]),
  city("birky", "Бірки", 36.206, 49.688, "xarkivska-oblast", ["бірках", "бірки"]),
  city("synelnykove", "Синельникове", 35.515, 48.317, "dnipropetrovska", ["синельниковому", "синельникове"]),
  city("kamianske", "Кам'янське", 34.613, 48.511, "dnipropetrovska", ["кам'янському", "кам'янського", "кам'янське", "камянському", "камянське"]),
  city("novomoskovsk", "Самар", 35.226, 48.632, "dnipropetrovska", ["новомосковську", "новомосковська", "новомосковськ", "самарі", "самар"]),
  city("pokrov", "Покров", 34.11, 47.65, "dnipropetrovska", ["покрові", "покрова", "покров"]),
]

function city(
  id: string,
  name: string,
  lon: number,
  lat: number,
  oblast: string,
  aliases: string[],
): Place {
  return { id, name, lon, lat, oblast, kind: "city", aliases }
}

const OBLAST_ALIASES: Record<string, string[]> = {
  "vinnicka-oblast": ["вінниччин", "вінницьк"],
  "volinska-oblast": ["волині", "волинь", "волинськ"],
  dnipropetrovska: ["дніпропетровщин", "дніпропетровськ"],
  "donecka-oblast": ["донеччин", "донецьк"],
  "zitomirska-oblast": ["житомирщин"],
  "zakarpatska-oblast": ["закарпатті", "закарпаття", "закарпатськ"],
  "zaporizka-oblast": ["запорізьк", "запоріжжін"],
  "ivano-frankivska-oblast": ["івано-франківщин", "прикарпатті", "прикарпаття"],
  "kirovogradska-oblast": ["кіровоградщин"],
  "luganska-oblast": ["луганщин", "луганськ"],
  lvivska: ["львівщин"],
  "mikolayivska-oblast": ["миколаївщин"],
  odeska: ["одещин", "одещину", "одещини"],
  "poltavska-oblast": ["полтавщин"],
  "rivnenska-oblast": ["рівненщин"],
  "sumska-oblast": ["сумщин"],
  "ternopilska-oblast": ["тернопільщин", "тернопілл"],
  "xarkivska-oblast": ["харківщин", "слобожанщин"],
  "xmelnycka-oblast": ["хмельниччин"],
  "cerkaska-oblast": ["черкащин"],
  "cernivecka-oblast": ["буковині", "буковина", "чернівеччин"],
  "cernigivska-oblast": ["чернігівщин"],
  "xersonska-oblast": ["херсонщин"],
  kyivska: ["київщин"],
}

const AREAS: Place[] = [
  {
    id: "black-sea",
    name: "Чорне море",
    lon: 31.15,
    lat: 46.12,
    oblast: "odeska",
    kind: "area",
    aliases: ["чорного моря", "чорне море", "чорному морі"],
  },
]

function oblastPlaces(): Place[] {
  return OBLASTS.filter((o) => o.slug).map((o) => ({
    id: `oblast:${o.slug}`,
    name: o.name,
    lon: o.lon,
    lat: o.lat,
    oblast: o.slug as string,
    kind: "oblast" as const,
    aliases: OBLAST_ALIASES[o.slug as string] ?? [],
  }))
}

export const PLACES: Place[] = [...CITIES, ...AREAS, ...oblastPlaces()]

export type Alias = { alias: string; place: Place }

export const ALIASES: Alias[] = PLACES.flatMap((place) =>
  place.aliases.map((alias) => ({ alias: alias.toLowerCase().replace(/['’ʼ]/g, ""), place })),
).sort((a, b) => b.alias.length - a.alias.length)
