import type { Lang, Localized, Prompt } from './types.js'

function L(sv: string, en: string): Localized {
  return { sv, en }
}

export const PROMPTS: Prompt[] = [
  {
    id: 'boss-late',
    recipient: L('Chefen', 'Your boss'),
    task: L('Svara varför du är sen till jobbet', 'Explain why you’re late for work'),
  },
  {
    id: 'party-skip',
    recipient: L('En kompis', 'A friend'),
    task: L('Svara varför du inte kan komma på kalaset', 'Explain why you can’t come to the party'),
  },
  {
    id: 'date-cancel',
    recipient: L('Någon du dejtade en gång', 'Someone you went on one date with'),
    task: L('Säg att du inte vill ses igen', 'Say you don’t want to meet again'),
  },
  {
    id: 'mum-money',
    recipient: L('Mamma', 'Mum'),
    task: L('Be om att låna 2000 kr', 'Ask to borrow 2000 kr'),
  },
  {
    id: 'ex-hello',
    recipient: L('Din ex', 'Your ex'),
    task: L('Skriv att du mår bra utan dem', 'Say you’re doing fine without them'),
  },
  {
    id: 'landlord',
    recipient: L('Hyresvärden', 'Your landlord'),
    task: L('Förklara varför hyran är sen', 'Explain why the rent is late'),
  },
  {
    id: 'groupchat',
    recipient: L('Klasschatten', 'The group chat'),
    task: L('Berätta att du inte kan hjälpa till med grupparbetet', 'Say you can’t help with the group project'),
  },
  {
    id: 'neighbor',
    recipient: L('Grannen', 'Your neighbor'),
    task: L('Klaga på deras höga musik', 'Complain about their loud music'),
  },
  {
    id: 'dentist',
    recipient: L('Tandläkaren', 'The dentist'),
    task: L('Avboka din tid i sista minuten', 'Cancel your appointment last minute'),
  },
  {
    id: 'coworker',
    recipient: L('En kollega', 'A coworker'),
    task: L('Be dem ta över ditt jobb idag', 'Ask them to cover your shift today'),
  },
  {
    id: 'crush',
    recipient: L('Din crush', 'Your crush'),
    task: L('Fråga om ni ska ta en fika', 'Ask them out for coffee'),
  },
  {
    id: 'sibling',
    recipient: L('Ditt syskon', 'Your sibling'),
    task: L('Be dem ljuga åt dig till föräldrarna', 'Ask them to lie for you to your parents'),
  },
  {
    id: 'uber',
    recipient: L('Din Uber-förare', 'Your Uber driver'),
    task: L('Be dem vänta fem minuter till', 'Ask them to wait five more minutes'),
  },
  {
    id: 'teacher',
    recipient: L('Din lärare', 'Your teacher'),
    task: L('Förklara varför du inte gjort läxan', 'Explain why you didn’t do the homework'),
  },
  {
    id: 'bestie-secret',
    recipient: L('Din bästa kompis', 'Your best friend'),
    task: L('Be dem hålla en hemlighet', 'Ask them to keep a secret'),
  },
  {
    id: 'delivery',
    recipient: L('Budet', 'The delivery person'),
    task: L('Be dem ställa paketet utanför', 'Ask them to leave the package outside'),
  },
  {
    id: 'gym',
    recipient: L('Gymkompisen', 'Your gym buddy'),
    task: L('Säg att du skippar träningen idag', 'Say you’re skipping the workout today'),
  },
  {
    id: 'wedding',
    recipient: L('Brudparet', 'The wedding couple'),
    task: L('Säg att du inte kan komma på bröllopet', 'Say you can’t make it to the wedding'),
  },
  {
    id: 'bank',
    recipient: L('Banken', 'The bank'),
    task: L('Fråga varför ditt kort är spärrat', 'Ask why your card is blocked'),
  },
  {
    id: 'roommate',
    recipient: L('Din rumskompis', 'Your roommate'),
    task: L('Be dem diska. Nu.', 'Ask them to do the dishes. Now.'),
  },
  {
    id: 'hr',
    recipient: L('HR', 'HR'),
    task: L('Be om en ledig dag imorgon', 'Ask for a day off tomorrow'),
  },
  {
    id: 'stranger',
    recipient: L('Fel nummer', 'Wrong number'),
    task: L('Svara någon som skickat dig ett SMS av misstag', 'Reply to someone who texted you by mistake'),
  },
  {
    id: 'dad-car',
    recipient: L('Pappa', 'Dad'),
    task: L('Berätta att du har bucklat bilen', 'Tell him you dented the car'),
  },
  {
    id: 'friend-borrow',
    recipient: L('En kompis', 'A friend'),
    task: L('Be om att låna deras lägenhet i helgen', 'Ask to borrow their apartment for the weekend'),
  },
  {
    id: 'client',
    recipient: L('En kund', 'A client'),
    task: L('Förklara att leveransen är försenad', 'Explain that the delivery is delayed'),
  },
  {
    id: 'partner-sorry',
    recipient: L('Din partner', 'Your partner'),
    task: L('Be om ursäkt för något du gjort', 'Apologize for something you did'),
  },
  {
    id: 'hairdresser',
    recipient: L('Frisören', 'Your hairdresser'),
    task: L('Säg att du hatar din nya frisyr', 'Say you hate your new haircut'),
  },
  {
    id: 'flight',
    recipient: L('Flygbolaget', 'The airline'),
    task: L('Fråga om du kan få ombokning gratis', 'Ask if you can rebook for free'),
  },
  {
    id: 'influencer',
    recipient: L('En influencer du följer', 'An influencer you follow'),
    task: L('Fråga om samarbete', 'Ask about a collaboration'),
  },
  {
    id: 'police',
    recipient: L('Polisen (hypotetiskt)', 'The police (hypothetically)'),
    task: L('Förklara varför du körde för fort', 'Explain why you were speeding'),
  },
  {
    id: 'dating-ghost',
    recipient: L('Någon du ghostat', 'Someone you ghosted'),
    task: L('Förklara varför du försvann i tre veckor', 'Explain why you disappeared for three weeks'),
  },
  {
    id: 'dating-explain',
    recipient: L('Din dejt', 'Your date'),
    task: L('Förklara varför du luktar som en grill', 'Explain why you smell like a barbecue'),
  },
  {
    id: 'work-sick',
    recipient: L('Din chef', 'Your boss'),
    task: L('Säg att du är sjuk men låter full', 'Say you’re sick but sound drunk'),
  },
  {
    id: 'work-resign',
    recipient: L('HR-chefen', 'The HR director'),
    task: L('Säg upp dig via SMS', 'Quit your job over text'),
  },
  {
    id: 'work-zoom',
    recipient: L('Teamet på Zoom', 'The team on Zoom'),
    task: L('Säg att du glömde stänga av mikrofonen', 'Say you forgot to mute your mic'),
  },
  {
    id: 'family-dinner',
    recipient: L('Hela familjen', 'The whole family'),
    task: L('Säg att du inte kan komma på julmiddagen', 'Say you can’t make it to Christmas dinner'),
  },
  {
    id: 'family-secret',
    recipient: L('Mormor', 'Grandma'),
    task: L('Berätta en hemlighet hon inte borde veta', 'Tell her a secret she shouldn’t know'),
  },
  {
    id: 'family-pet',
    recipient: L('Mamma', 'Mum'),
    task: L('Berätta att du råkat mata hunden choklad', 'Tell her you accidentally fed the dog chocolate'),
  },
  {
    id: 'absurd-alien',
    recipient: L('Utomjordingar', 'Aliens'),
    task: L('Förklara varför jorden är värt ett besök', 'Explain why Earth is worth visiting'),
  },
  {
    id: 'absurd-time',
    recipient: L('Dig själv från framtiden', 'Your future self'),
    task: L('Varna dig själv om något du borde sluta med', 'Warn yourself to stop doing something'),
  },
  {
    id: 'absurd-pizza',
    recipient: L('Pizzerian', 'The pizzeria'),
    task: L('Beställ en pizza med de konstigaste toppingsen', 'Order a pizza with the weirdest toppings'),
  },
  {
    id: 'absurd-neighbor-cat',
    recipient: L('Grannen', 'Your neighbor'),
    task: L('Förklara varför deras katt bor hos dig nu', 'Explain why their cat lives with you now'),
  },
  {
    id: 'dating-parents',
    recipient: L('Din partners föräldrar', "Your partner's parents"),
    task: L('Förklara varför du inte har ett riktigt jobb', 'Explain why you don’t have a real job'),
  },
  {
    id: 'work-coffee',
    recipient: L('Kontorets kaffemaskin-grupp', 'The office coffee chat'),
    task: L('Erkänn att du aldrig diskat din mugg', 'Admit you never washed your mug'),
  },
  {
    id: 'family-lie',
    recipient: L('Pappa', 'Dad'),
    task: L('Erkänn en vit lögn du hållit i åratal', 'Confess a white lie you’ve kept for years'),
  },
]

export function pickPrompts(count: number, lang: Lang, excludeIds: Set<string>): Prompt[] {
  void lang
  const theme = todaysTheme()
  const themed = PROMPTS.filter((p) => theme.ids.includes(p.id) && !excludeIds.has(p.id))
  const available = PROMPTS.filter((p) => !excludeIds.has(p.id))
  const preferred = [...themed, ...available.filter((p) => !themed.includes(p))]
  const pool = preferred.length >= count ? preferred : [...PROMPTS]
  const shuffledThemed = shuffle([...themed])
  const rest = shuffle(pool.filter((p) => !shuffledThemed.includes(p)))
  return [...shuffledThemed, ...rest].slice(0, count)
}

export function localize(text: Localized, lang: Lang): string {
  return lang === 'en' ? text.en : text.sv
}

export type DayTheme = {
  id: string
  label: Localized
  blurb: Localized
  ids: string[]
}

const DAY_THEMES: DayTheme[] = [
  {
    id: 'work',
    label: L('Jobb-kaos', 'Work chaos'),
    blurb: L('Chefer, kollegor och HR får sig en omgång.', 'Bosses, coworkers, and HR take the hit.'),
    ids: ['boss-late', 'coworker', 'hr', 'client', 'landlord', 'bank'],
  },
  {
    id: 'dating',
    label: L('Dating-drama', 'Dating drama'),
    blurb: L('Crush, ex och dåliga ursäkter.', 'Crush, ex, and terrible excuses.'),
    ids: ['crush', 'ex-hello', 'date-cancel', 'partner-sorry', 'bestie-secret', 'stranger'],
  },
  {
    id: 'family',
    label: L('Familjefesten', 'Family night'),
    blurb: L('Mamma, pappa och syskon — pinsamt garanterat.', 'Mum, dad, siblings — awkward guaranteed.'),
    ids: ['mum-money', 'dad-car', 'sibling', 'roommate', 'wedding', 'neighbor'],
  },
  {
    id: 'absurd',
    label: L('Absurt', 'Absurd'),
    blurb: L('Uber, flyg, polisen och fel nummer.', 'Uber, flights, police, and wrong numbers.'),
    ids: ['uber', 'flight', 'police', 'influencer', 'hairdresser', 'delivery', 'dentist'],
  },
  {
    id: 'party',
    label: L('Kalasläge', 'Party mode'),
    blurb: L('Kompisar, kalas och gruppchattar.', 'Friends, parties, and group chats.'),
    ids: ['party-skip', 'groupchat', 'friend-borrow', 'gym', 'bestie-secret', 'wedding'],
  },
]

function stockholmDayIndex() {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return hash
}

export function todaysTheme(): DayTheme {
  return DAY_THEMES[stockholmDayIndex() % DAY_THEMES.length]!
}

export function exampleHighlights(lang: Lang): { task: string; original: string; sabotage: string }[] {
  if (lang === 'en') {
    return [
      {
        task: 'Explain why you’re late for work',
        original: 'Sorry, traffic was crazy this morning.',
        sabotage: 'Sorry, I woke up in a stranger’s kitchen and had to Uber barefoot.',
      },
      {
        task: 'Say you can’t come to the party',
        original: 'Can’t make it tonight, need an early night.',
        sabotage: 'Can’t make it — I’m emotionally in a situationship with my couch.',
      },
    ]
  }
  return [
    {
      task: 'Svara chefen varför du är sen',
      original: 'Förlåt, det var köer på vägen.',
      sabotage: 'Förlåt, jag vaknade i nåns kök och fick Uber:a barfota.',
    },
    {
      task: 'Säg att du inte kan komma på kalaset',
      original: 'Kan tyvärr inte ikväll, behöver sova.',
      sabotage: 'Kan inte — jag är i en situationship med soffan just nu.',
    },
  ]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
