import type { Dwelling, Fuel, HealthProfile } from '../core/types'

export type Language = 'en' | 'hi'

const en = {
  'nav.day': 'Your day',
  'nav.home': 'Your home',
  'nav.ward': 'Your ward',
  'nav.method': 'Method',
  'nav.city': 'City',
  'nav.language': 'हिन्दी',
  'nav.homeLabel': 'SAANS home',

  'hero.title': 'Your family has a breath budget.',
  'hero.lede':
    'SAANS turns the smog forecast into the hours you can safely spend outside, the fixes your home needs, and what each choice actually saves.',
  'hero.cta': 'Plan today',
  'hero.secondary': 'How the numbers work',
  'hero.now': '{city} now. {category}, driven by {dominant}.',
  'hero.who': 'PM2.5 {pm} µg/m³, {times}× the WHO 24-hour limit of 15.',
  'hero.loading': 'Reading the forecast…',
  'hero.sample': 'Sample forecast. The live service could not be reached.',
  'hero.offline': 'Offline. Showing the last forecast saved on this device.',

  'stage.hour': 'Hour',
  'stage.pm': 'PM2.5',
  'stage.layer': 'Boundary layer',
  'stage.landmark': 'City air quality simulation',

  'chapter.one.hours': '05–09',
  'chapter.one.title': 'The lid is still on the city.',
  'chapter.one.body':
    'Overnight the ground cools and the air stops rising. Last evening’s smoke sits under a shallow layer, and the morning’s traffic is added to it. For most winter days this is the most expensive time to be outside.',
  'chapter.two.hours': '12–16',
  'chapter.two.title': 'The sun lifts the lid.',
  'chapter.two.body':
    'By early afternoon the boundary layer is several times deeper, so the same emissions mix into far more air. This is the window the planner will move your day into.',
  'chapter.three.hours': '18–23',
  'chapter.three.title': 'The lid comes back down.',
  'chapter.three.body':
    'Cooking smoke meets evening traffic as the layer collapses. Whatever is in the air at bedtime is what the bedroom will hold until morning.',
  'chapter.pmAt': 'PM2.5 at {hour}',
  'chapter.layerAt': 'Layer at {hour}',

  'cost.title': 'What the day costs',
  'cost.dose': 'is what your household breathes today on the routines below.',
  'cost.budget': 'is a whole day at the WHO limit of 15 µg/m³, and that is the budget.',
  'cost.used': 'of that budget is spent before anything is moved.',
  'cost.window': 'is the cleanest two-hour stretch in today’s forecast.',
  'cost.none': 'No clean window',

  'day.title': 'Rewrite the day.',
  'day.note':
    'Drag a routine, or focus it and use the arrow keys. Every move is priced in the particles your household actually breathes.',
  'day.member': 'Budget for',
  'day.of': 'of',
  'day.budget': 'Budget spent',
  'day.cleanest': 'Cleanest window today',
  'day.windowNote': 'Two hours at the lowest average PM2.5 between 06:00 and 21:00.',
  'day.adopt': 'Move my day into it',
  'day.reset': 'Reset the day',
  'day.peak': 'Costliest routine',
  'day.best': 'Best single move',
  'day.saved': 'saved by moving {label} to {hour}.',
  'day.drag': 'Drag to move, arrow keys to nudge',
  'day.indoors': '{pm} µg/m³ indoors',
  'day.summary': 'Daily exposure budget summary',
  'day.curve': 'PM2.5 through the day',
  'day.curveLabel': 'Lowest {low} µg/m³ at {lowHour}; highest {high} at {highHour}.',

  'home.title': 'The second smog season.',
  'home.note':
    'A wood stove puts six times the particles into a room that an LPG flame does. This is a single-zone mass balance, not a guess.',
  'home.rowOne': 'What the stove puts in',
  'home.rowTwo': 'What the room does with it',
  'home.rowThree': 'What to change first',
  'home.lpg': 'LPG flame',
  'home.wood': 'Wood or biomass',
  'home.both': 'Both',
  'home.hours': 'Hours a day',
  'home.perHour': 'µg/h',
  'home.dwelling': 'Home',
  'home.fuel': 'Cooking fuel',
  'home.purifier': 'Purifier in the room',
  'home.purifierOff': 'None',
  'home.cookingPeak': 'While cooking',
  'home.dailyMean': 'Daily average',
  'home.clearance': 'Time to clear 90%',
  'home.recommended': 'Purifier size for this room',
  'home.cost': 'one-time',
  'home.recurring': 'per year',
  'home.free': 'free',
  'home.roomCaption': '{pm} µg/m³ while cooking · {state}',
  'home.purifierOn': 'purifier running',
  'home.purifierNone': 'no purifier',

  'ward.title': 'One street can move the number.',
  'ward.note':
    'A scenario, not a measurement: what changes if households on this street stop burning wood. Every factor is listed on the method page.',
  'ward.households': '{count} households · {wood} cooking on wood',
  'ward.switch': 'Switching to clean cooking',
  'ward.switchValue': '{count} of {total} households',
  'ward.pm25': 'PM2.5 not emitted',
  'ward.co2': 'CO₂e avoided',
  'ward.people': 'People breathing less',
  'ward.inhaled': 'Particles not inhaled',
  'ward.perYear': 'per year',
  'ward.cost':
    'Switching to LPG costs these households about {cost} more a year across the street. An induction connection is cheaper and cleaner; the method page shows both.',
  'ward.recess': 'School recess, decided',
  'ward.recessBody':
    '{current} µg/m³ at 10:30 against {best} µg/m³ in the clean window. Moving recess there means {saved} mg of PM2.5 the whole school does not breathe, every day.',
  'ward.recessNote': 'The cleanest 45 minutes between 08:00 and 16:00, for 400 children.',
  'ward.scenario':
    'Ward figures are a bottom-up scenario for {city}, not a measurement of the air.',
  'ward.heatmap': 'Smoothed exposure across the street.',
  'ward.heatmapNote':
    'A kernel-smoothed surface over tonight’s forecast, with a spread wherever the readings run out.',

  'plan.title': 'Ask for the plan.',
  'plan.note':
    'The model is given the numbers already computed here. It phrases them; it never invents one. Without a key, the same plan is written by the local engine.',
  'plan.generate': 'Write my plan',
  'plan.generating': 'Writing…',
  'plan.given': 'What the writer is given',
  'plan.givenNote':
    'No free text is sent. The request body is a fixed schema, validated on both sides, so there is nothing to inject.',
  'plan.sourceModel': 'Written by Gemini from the computed facts',
  'plan.sourceEngine': 'Written by the local engine from the computed facts',
  'plan.empty': 'No plan written yet.',
  'plan.emptyBody':
    'The plan uses the six numbers beside it and nothing else: the clean window, the household budget, the kitchen peak and the cheapest fix. If the model is unavailable, the local engine writes the same structure from the same facts.',
  'plan.today': 'Today',
  'plan.slipMeta': '{city} · {date}',
  'plan.when': 'When',
  'plan.impact': 'Impact',
  'plan.total': 'Budget spent today',
  'plan.caution': 'An estimate for planning, not medical advice.',
  'plan.pmNow': 'PM2.5 now',
  'plan.aqi': 'CPCB AQI',
  'plan.window': 'Clean window',
  'plan.dayTotal': 'Day total',
  'plan.kitchen': 'Kitchen peak',
  'plan.topFix': 'Top fix',
  'plan.none': 'none',

  'close.title': 'Take the plan with you.',
  'close.body':
    'One image for the family group, one calendar entry for the clean hour, and the whole thing works offline on a phone.',
  'close.cta': 'Download the plan card',
  'close.working': 'Making the card…',
  'close.done': 'Card saved',

  'footer.menu': 'Sections',
  'footer.install': 'Install SAANS',
  'footer.data': 'Data and method',
  'footer.sources': 'Sources and licences',
  'footer.security': 'Security',
  'footer.access': 'Accessibility',
  'footer.pictures': 'Photographs',
  'footer.reading': 'Reading the forecast for {city}.',
  'footer.disclaimer':
    'SAANS estimates exposure from public forecasts. It is not a medical device and does not diagnose. If someone in your home has asthma, heart disease or is pregnant, follow their clinician’s advice.',
  'footer.credit':
    'Air quality and weather: Open-Meteo, CC BY 4.0. AQI: CPCB National AQI. Guideline: WHO 2021.',

  'common.retry': 'Retry',
  'common.close': 'Close',
  'common.skip': 'Skip to content',
  'common.search': 'Search',
  'common.share': 'Share card',
  'common.calendar': 'Add clean hour to calendar',
  'common.error': 'The forecast could not be reached.',
  'common.searching': 'Searching…',
  'common.noMatch': 'No place matched that name.',
  'common.cityNote': 'Currently reading the forecast for {city}.',
  'common.cityPrivacy':
    'Search runs through this server against Open-Meteo Geocoding. The browser sends the word you type and nothing else.',
  'error.title': 'Something interrupted the display.',
  'error.body': 'Your saved household settings are safe. Reload the view to continue.',
  'error.reset': 'Reload view',
} as const

export type StringKey = keyof typeof en

const hi: Record<StringKey, string> = {
  'nav.day': 'आपका दिन',
  'nav.home': 'आपका घर',
  'nav.ward': 'आपका मोहल्ला',
  'nav.method': 'विधि',
  'nav.city': 'शहर',
  'nav.language': 'English',
  'nav.homeLabel': 'SAANS मुखपृष्ठ',

  'hero.title': 'आपके परिवार के पास साँस का बजट है।',
  'hero.lede':
    'SAANS धुंध के पूर्वानुमान को उन घंटों में बदलता है जब आप बाहर सुरक्षित रह सकते हैं, घर के ज़रूरी बदलाव बताता है, और हर चुनाव की असली बचत दिखाता है।',
  'hero.cta': 'आज की योजना',
  'hero.secondary': 'गणना कैसे होती है',
  'hero.now': '{city} अभी। {category}, मुख्य कारण {dominant}।',
  'hero.who': 'PM2.5 {pm} µg/m³, WHO की 24 घंटे की सीमा 15 से {times} गुना।',
  'hero.loading': 'पूर्वानुमान पढ़ रहे हैं…',
  'hero.sample': 'नमूना पूर्वानुमान। लाइव सेवा उपलब्ध नहीं।',
  'hero.offline': 'ऑफ़लाइन। इस डिवाइस पर सहेजा पिछला पूर्वानुमान।',

  'stage.hour': 'समय',
  'stage.pm': 'PM2.5',
  'stage.layer': 'सीमा परत',
  'stage.landmark': 'शहर वायु गुणवत्ता अनुकरण',

  'chapter.one.hours': '05–09',
  'chapter.one.title': 'शहर पर ढक्कन अभी बना है।',
  'chapter.one.body':
    'रात भर ज़मीन ठंडी होती है और हवा ऊपर उठना बंद कर देती है। कल शाम का धुआँ नीची परत के नीचे फँसा रहता है, और सुबह की गाड़ियाँ उसमें जुड़ जाती हैं। सर्दियों के अधिकतर दिनों में बाहर रहने का यह सबसे महँगा समय है।',
  'chapter.two.hours': '12–16',
  'chapter.two.title': 'सूरज ढक्कन उठा देता है।',
  'chapter.two.body':
    'दोपहर तक सीमा परत कई गुना गहरी हो जाती है, इसलिए वही धुआँ बहुत ज़्यादा हवा में घुल जाता है। यही वह खिड़की है जिसमें योजनाकार आपका दिन ले जाएगा।',
  'chapter.three.hours': '18–23',
  'chapter.three.title': 'ढक्कन फिर गिरने लगता है।',
  'chapter.three.body':
    'परत सिकुड़ते ही खाना बनाने का धुआँ शाम की गाड़ियों से मिल जाता है। सोते समय हवा में जो है, सुबह तक शयनकक्ष में वही रहेगा।',
  'chapter.pmAt': '{hour} बजे PM2.5',
  'chapter.layerAt': '{hour} बजे परत',

  'cost.title': 'दिन की कीमत',
  'cost.dose': 'आज नीचे दिए दिनचर्या से आपके परिवार की साँस में इतना जाता है।',
  'cost.budget': 'WHO की सीमा 15 µg/m³ पर पूरे दिन की मात्रा है। यही बजट है।',
  'cost.used': 'बजट का इतना हिस्सा कुछ भी बदलने से पहले खर्च हो चुका है।',
  'cost.window': 'आज के पूर्वानुमान की सबसे साफ़ दो घंटे की अवधि है।',
  'cost.none': 'कोई साफ़ खिड़की नहीं',

  'day.title': 'दिन बदलिए।',
  'day.note':
    'किसी काम को खींचें, या उसे चुनकर तीर कुंजियाँ दबाएँ। हर बदलाव की कीमत उन कणों में है जो आपका परिवार सचमुच साँस में लेता है।',
  'day.member': 'बजट किसके लिए',
  'day.of': 'में से',
  'day.budget': 'बजट खर्च',
  'day.cleanest': 'आज की सबसे साफ़ खिड़की',
  'day.windowNote': '06:00 से 21:00 के बीच सबसे कम औसत PM2.5 वाले दो घंटे।',
  'day.adopt': 'मेरा दिन वहाँ ले चलें',
  'day.reset': 'दिन रीसेट करें',
  'day.peak': 'सबसे महँगा काम',
  'day.best': 'सबसे बड़ा एक बदलाव',
  'day.saved': '{label} को {hour} पर ले जाने से बचत।',
  'day.drag': 'खींचें, तीर कुंजियों से आगे बढ़ाएँ',
  'day.indoors': 'घर के अंदर {pm} µg/m³',
  'day.summary': 'दैनिक संपर्क बजट सारांश',
  'day.curve': 'दिन भर PM2.5',
  'day.curveLabel': 'सबसे कम {low} µg/m³ {lowHour} पर; सबसे ज़्यादा {high} {highHour} पर।',

  'home.title': 'दूसरा धुंध मौसम।',
  'home.note':
    'लकड़ी का चूल्हा कमरे में LPG की तुलना में छह गुना कण छोड़ता है। यह एक-कक्ष द्रव्यमान संतुलन है, अनुमान नहीं।',
  'home.rowOne': 'चूल्हा क्या छोड़ता है',
  'home.rowTwo': 'कमरा उसका क्या करता है',
  'home.rowThree': 'पहले क्या बदलें',
  'home.lpg': 'LPG की लौ',
  'home.wood': 'लकड़ी या गोबर',
  'home.both': 'दोनों',
  'home.hours': 'घंटे प्रतिदिन',
  'home.perHour': 'µg/घंटा',
  'home.dwelling': 'घर',
  'home.fuel': 'खाना बनाने का ईंधन',
  'home.purifier': 'कमरे में प्यूरीफायर',
  'home.purifierOff': 'कोई नहीं',
  'home.cookingPeak': 'खाना बनाते समय',
  'home.dailyMean': 'दैनिक औसत',
  'home.clearance': '90% साफ़ होने का समय',
  'home.recommended': 'इस कमरे के लिए प्यूरीफायर',
  'home.cost': 'एक बार',
  'home.recurring': 'प्रति वर्ष',
  'home.free': 'मुफ़्त',
  'home.roomCaption': 'खाना बनाते समय {pm} µg/m³ · {state}',
  'home.purifierOn': 'प्यूरीफायर चालू',
  'home.purifierNone': 'प्यूरीफायर नहीं',

  'ward.title': 'एक गली आँकड़ा बदल सकती है।',
  'ward.note':
    'यह परिदृश्य है, माप नहीं: अगर इस गली के घर लकड़ी जलाना छोड़ दें तो क्या बदलेगा। सभी कारक विधि पृष्ठ पर हैं।',
  'ward.households': '{count} घर · {wood} लकड़ी पर खाना बनाते हैं',
  'ward.switch': 'स्वच्छ ईंधन अपनाने वाले',
  'ward.switchValue': '{total} में से {count} घर',
  'ward.pm25': 'PM2.5 जो नहीं निकला',
  'ward.co2': 'CO₂e बचा',
  'ward.people': 'कम साँस लेने वाले लोग',
  'ward.inhaled': 'कण जो साँस में नहीं गए',
  'ward.perYear': 'प्रति वर्ष',
  'ward.cost':
    'LPG पर जाने से इन घरों को साल भर में लगभग {cost} अधिक लगते हैं। इंडक्शन कनेक्शन सस्ता और साफ़ है; विधि पृष्ठ दोनों दिखाता है।',
  'ward.recess': 'स्कूल की छुट्टी, तय',
  'ward.recessBody':
    '10:30 पर {current} µg/m³ बनाम साफ़ खिड़की में {best} µg/m³। छुट्टी वहाँ ले जाने से पूरा स्कूल रोज़ {saved} mg PM2.5 साँस में नहीं लेता।',
  'ward.recessNote': '08:00 से 16:00 के बीच सबसे साफ़ 45 मिनट, 400 बच्चों के लिए।',
  'ward.scenario': 'ये आँकड़े {city} के लिए नीचे से बनाया परिदृश्य हैं, हवा की माप नहीं।',
  'ward.heatmap': 'गली में समायोजित संपर्क सतह।',
  'ward.heatmapNote': 'आज रात के पूर्वानुमान पर कर्नेल-समायोजित सतह, जहाँ आँकड़े कम हों वहाँ फैलाव के साथ।',

  'plan.title': 'योजना माँगिए।',
  'plan.note':
    'मॉडल को यहीं की गई गणना दी जाती है। वह उसे शब्द देता है; कोई नया आँकड़ा नहीं बनाता। बिना कुंजी, वही योजना स्थानीय इंजन लिखता है।',
  'plan.generate': 'मेरी योजना लिखें',
  'plan.generating': 'लिख रहे हैं…',
  'plan.given': 'लेखक को क्या दिया जाता है',
  'plan.givenNote':
    'कोई मुक्त पाठ नहीं भेजा जाता। अनुरोध एक तय schema है, दोनों तरफ़ जाँचा जाता है, इसलिए इंजेक्शन की गुंजाइश नहीं।',
  'plan.sourceModel': 'गणना किए तथ्यों से Gemini द्वारा लिखा गया',
  'plan.sourceEngine': 'गणना किए तथ्यों से स्थानीय इंजन द्वारा लिखा गया',
  'plan.empty': 'अभी कोई योजना नहीं लिखी गई।',
  'plan.emptyBody':
    'योजना बगल के छह आँकड़ों से बनती है और कुछ नहीं: साफ़ खिड़की, परिवार का बजट, रसोई का शिखर और सबसे सस्ता उपाय। मॉडल उपलब्ध न हो तो स्थानीय इंजन वही ढाँचा लिखता है।',
  'plan.today': 'आज',
  'plan.slipMeta': '{city} · {date}',
  'plan.when': 'कब',
  'plan.impact': 'असर',
  'plan.total': 'आज खर्च हुआ बजट',
  'plan.caution': 'यह योजना के लिए अनुमान है, चिकित्सकीय सलाह नहीं।',
  'plan.pmNow': 'PM2.5 अभी',
  'plan.aqi': 'CPCB AQI',
  'plan.window': 'साफ़ खिड़की',
  'plan.dayTotal': 'दिन का कुल',
  'plan.kitchen': 'रसोई का शिखर',
  'plan.topFix': 'पहला उपाय',
  'plan.none': 'कोई नहीं',

  'close.title': 'योजना साथ ले जाइए।',
  'close.body':
    'परिवार के समूह के लिए एक तस्वीर, साफ़ घंटे के लिए एक कैलेंडर प्रविष्टि, और पूरा ऐप फ़ोन पर ऑफ़लाइन चलता है।',
  'close.cta': 'योजना कार्ड डाउनलोड करें',
  'close.working': 'कार्ड बन रहा है…',
  'close.done': 'कार्ड सहेजा गया',

  'footer.menu': 'अनुभाग',
  'footer.install': 'SAANS इंस्टॉल करें',
  'footer.data': 'डेटा और विधि',
  'footer.sources': 'स्रोत और लाइसेंस',
  'footer.security': 'सुरक्षा',
  'footer.access': 'सुगम्यता',
  'footer.pictures': 'तस्वीरें',
  'footer.reading': '{city} का पूर्वानुमान पढ़ रहे हैं।',
  'footer.disclaimer':
    'SAANS सार्वजनिक पूर्वानुमान से संपर्क का अनुमान लगाता है। यह चिकित्सा उपकरण नहीं है और रोग नहीं बताता। घर में दमा, हृदय रोग या गर्भावस्था हो तो डॉक्टर की सलाह लें।',
  'footer.credit': 'हवा और मौसम: Open-Meteo, CC BY 4.0. AQI: CPCB राष्ट्रीय AQI. सीमा: WHO 2021.',

  'common.retry': 'फिर कोशिश करें',
  'common.close': 'बंद करें',
  'common.skip': 'मुख्य सामग्री पर जाएँ',
  'common.search': 'खोजें',
  'common.share': 'शेयर कार्ड',
  'common.calendar': 'साफ़ घंटा कैलेंडर में जोड़ें',
  'common.error': 'पूर्वानुमान उपलब्ध नहीं।',
  'common.searching': 'खोज रहे हैं…',
  'common.noMatch': 'इस नाम से कोई जगह नहीं मिली।',
  'common.cityNote': 'अभी {city} का पूर्वानुमान पढ़ रहे हैं।',
  'common.cityPrivacy':
    'खोज इसी सर्वर से Open-Meteo Geocoding तक जाती है। ब्राउज़र केवल आपका लिखा शब्द भेजता है।',
  'error.title': 'प्रदर्शन में कोई त्रुटि आई।',
  'error.body': 'आपकी सहेजी गई सेटिंग्स सुरक्षित हैं। जारी रखने के लिए पृष्ठ रीलोड करें।',
  'error.reset': 'पृष्ठ रीलोड करें',
}

const dictionaries: Record<Language, Record<StringKey, string>> = { en, hi }

export function translate(language: Language, key: StringKey): string {
  return dictionaries[language][key] ?? en[key]
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

export const PROFILE_LABEL_I18N: Record<Language, Record<HealthProfile, string>> = {
  en: {
    adult: 'Adult',
    child: 'Child',
    elder: 'Older adult',
    asthma: 'Asthma',
    pregnancy: 'Pregnancy',
  },
  hi: {
    adult: 'वयस्क',
    child: 'बच्चा',
    elder: 'वृद्ध',
    asthma: 'दमा',
    pregnancy: 'गर्भावस्था',
  },
}

export const DWELLING_LABEL_I18N: Record<Language, Record<Dwelling, string>> = {
  en: {
    'one-room': 'One room',
    apartment: 'Apartment',
    house: 'Independent house',
  },
  hi: {
    'one-room': 'एक कमरा',
    apartment: 'फ़्लैट',
    house: 'स्वतंत्र घर',
  },
}

export const FUEL_LABEL_I18N: Record<Language, Record<Fuel, string>> = {
  en: {
    lpg: 'LPG cylinder',
    biomass: 'Wood / biomass',
    mixed: 'Both',
    none: 'Electric only',
  },
  hi: {
    lpg: 'LPG गैस',
    biomass: 'लकड़ी / उपला',
    mixed: 'दोनों',
    none: 'केवल बिजली',
  },
}

export const ROUTINE_LABEL_I18N: Record<Language, Record<string, string>> = {
  en: {
    walk: 'Morning walk',
    school: 'School run',
    commute: 'Commute to work',
    lunch: 'Lunch outside',
    play: 'Evening play',
    cook: 'Cooking',
    errand: 'Evening errand',
  },
  hi: {
    walk: 'सुबह की सैर',
    school: 'स्कूल आना-जाना',
    commute: 'दफ़्तर सफ़र',
    lunch: 'बाहर दोपहर भोजन',
    play: 'शाम का खेल',
    cook: 'खाना बनाना',
    errand: 'शाम का काम',
  },
}
