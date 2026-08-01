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
]

export function pickPrompts(count: number, lang: Lang, excludeIds: Set<string>): Prompt[] {
  void lang
  const available = PROMPTS.filter((p) => !excludeIds.has(p.id))
  const pool = available.length >= count ? available : [...PROMPTS]
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function localize(text: Localized, lang: Lang): string {
  return lang === 'en' ? text.en : text.sv
}
