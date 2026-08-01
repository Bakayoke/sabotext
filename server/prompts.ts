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
  {
    id: 'friend-spill',
    recipient: L('En kompis', 'A friend'),
    task: L('Berätta att du råkat berätta deras hemlighet', 'Admit you accidentally spilled their secret'),
  },
  {
    id: 'ex-bumped',
    recipient: L('Din ex', 'Your ex'),
    task: L('Säg hej efter att ni råkat se varandra i mataffären', 'Say hi after bumping into each other at the store'),
  },
  {
    id: 'boss-raise',
    recipient: L('Chefen', 'Your boss'),
    task: L('Be om löneförhöjning', 'Ask for a raise'),
  },
  {
    id: 'boss-zoom-bg',
    recipient: L('Chefen', 'Your boss'),
    task: L('Förklara vad som syns i bakgrunden på Zoom', 'Explain what’s visible in your Zoom background'),
  },
  {
    id: 'colleague-smell',
    recipient: L('En kollega', 'A coworker'),
    task: L('Påpeka diskret att de luktar starkt', 'Subtly mention that they smell strong'),
  },
  {
    id: 'colleague-credit',
    recipient: L('En kollega', 'A coworker'),
    task: L('Säg att de tog cred för ditt jobb', 'Say they took credit for your work'),
  },
  {
    id: 'hr-harass',
    recipient: L('HR', 'HR'),
    task: L('Rapportera att kaffemaskinen terroriserar dig', 'Report that the coffee machine is terrorizing you'),
  },
  {
    id: 'client-typo',
    recipient: L('En kund', 'A client'),
    task: L('Förklara typofelen i deras presentation', 'Explain the typo in their presentation'),
  },
  {
    id: 'client-invoice',
    recipient: L('En kund', 'A client'),
    task: L('Påminn om en obetald faktura', 'Remind them about an unpaid invoice'),
  },
  {
    id: 'dating-app',
    recipient: L('Någon från Tinder', 'Someone from Tinder'),
    task: L('Föreslå en första dejt på ett konstigt ställe', 'Suggest a first date at a weird place'),
  },
  {
    id: 'dating-late',
    recipient: L('Din dejt', 'Your date'),
    task: L('Säg att du är sen med en absurt dålig ursäkt', 'Say you’re late with an absurdly bad excuse'),
  },
  {
    id: 'dating-end',
    recipient: L('Någon du dejtat i en månad', 'Someone you’ve dated for a month'),
    task: L('Gör slut via SMS', 'Break up over text'),
  },
  {
    id: 'dating-parents-meet',
    recipient: L('Din crush', 'Your crush'),
    task: L('Fråga om de vill träffa dina föräldrar. Imorgon.', 'Ask if they want to meet your parents. Tomorrow.'),
  },
  {
    id: 'partner-forgot',
    recipient: L('Din partner', 'Your partner'),
    task: L('Erkänn att du glömt er årsdag', 'Admit you forgot your anniversary'),
  },
  {
    id: 'partner-netflix',
    recipient: L('Din partner', 'Your partner'),
    task: L('Erkänn att du sett klart serien utan dem', 'Admit you finished the series without them'),
  },
  {
    id: 'mum-tattoo',
    recipient: L('Mamma', 'Mum'),
    task: L('Berätta att du skaffat tatuering', 'Tell her you got a tattoo'),
  },
  {
    id: 'mum-move',
    recipient: L('Mamma', 'Mum'),
    task: L('Säg att du ska flytta utomlands. Nästa vecka.', 'Say you’re moving abroad. Next week.'),
  },
  {
    id: 'dad-crypto',
    recipient: L('Pappa', 'Dad'),
    task: L('Berätta att du investerat hans pengar i crypto', 'Tell him you invested his money in crypto'),
  },
  {
    id: 'dad-job',
    recipient: L('Pappa', 'Dad'),
    task: L('Förklara vad du egentligen jobbar med', 'Explain what you actually do for work'),
  },
  {
    id: 'sibling-favor',
    recipient: L('Ditt syskon', 'Your sibling'),
    task: L('Be dem hämta dig mitt i natten', 'Ask them to pick you up in the middle of the night'),
  },
  {
    id: 'grandma-tech',
    recipient: L('Mormor', 'Grandma'),
    task: L('Förklara vad TikTok är', 'Explain what TikTok is'),
  },
  {
    id: 'grandma-visit',
    recipient: L('Mormor', 'Grandma'),
    task: L('Säg att du kommer på söndag (du kommer inte)', 'Say you’re coming on Sunday (you’re not)'),
  },
  {
    id: 'family-group',
    recipient: L('Familjechatten', 'The family group chat'),
    task: L('Svara på mammas 14 meddelanden med ett enda SMS', 'Reply to mum’s 14 messages with one single text'),
  },
  {
    id: 'uncle-politics',
    recipient: L('Din farbror', 'Your uncle'),
    task: L('Avsluta en politisk diskussion snällt', 'End a political argument politely'),
  },
  {
    id: 'neighbor-park',
    recipient: L('Grannen', 'Your neighbor'),
    task: L('Be dem flytta bilen som blockerar din', 'Ask them to move the car blocking yours'),
  },
  {
    id: 'neighbor-party',
    recipient: L('Grannen', 'Your neighbor'),
    task: L('Bjud in dig själv på deras fest', 'Invite yourself to their party'),
  },
  {
    id: 'landlord-mold',
    recipient: L('Hyresvärden', 'Your landlord'),
    task: L('Rapportera mögel på det mest dramatiska sättet', 'Report mold in the most dramatic way'),
  },
  {
    id: 'landlord-pet',
    recipient: L('Hyresvärden', 'Your landlord'),
    task: L('Berätta att du skaffat husdjur. Mot reglerna.', 'Say you got a pet. Against the rules.'),
  },
  {
    id: 'roommate-food',
    recipient: L('Din rumskompis', 'Your roommate'),
    task: L('Erkänn att du ätit deras leftovers', 'Admit you ate their leftovers'),
  },
  {
    id: 'roommate-guest',
    recipient: L('Din rumskompis', 'Your roommate'),
    task: L('Säg att din kompis sover över. Igen.', 'Say your friend is staying over. Again.'),
  },
  {
    id: 'bestie-borrow-money',
    recipient: L('Din bästa kompis', 'Your best friend'),
    task: L('Be om att låna pengar. Igen.', 'Ask to borrow money. Again.'),
  },
  {
    id: 'bestie-cancel',
    recipient: L('Din bästa kompis', 'Your best friend'),
    task: L('Ställ in era planer för tredje gången', 'Cancel your plans for the third time'),
  },
  {
    id: 'friend-ugly',
    recipient: L('En kompis', 'A friend'),
    task: L('Säg ärligt vad du tycker om deras outfit', 'Honestly say what you think of their outfit'),
  },
  {
    id: 'group-trip',
    recipient: L('Kompisgänget', 'The friend group'),
    task: L('Föreslå en galen destination för nästa resa', 'Suggest a wild destination for the next trip'),
  },
  {
    id: 'group-bill',
    recipient: L('Middagschatten', 'The dinner group chat'),
    task: L('Påminn om att någon glömt swisha', 'Remind someone they forgot to Swish'),
  },
  {
    id: 'party-host',
    recipient: L('Festvärden', 'The party host'),
    task: L('Fråga om det finns mer snacks. Diskret.', 'Ask if there’s more snacks. Discreetly.'),
  },
  {
    id: 'party-leave',
    recipient: L('Värden', 'The host'),
    task: L('Säg hejdå utan att låta som att du flyr', 'Say goodbye without sounding like you’re fleeing'),
  },
  {
    id: 'gym-spot',
    recipient: L('Någon på gymmet', 'Someone at the gym'),
    task: L('Be om att få använda bänken. De sitter på den.', 'Ask to use the bench. They’re sitting on it.'),
  },
  {
    id: 'gym-trainer',
    recipient: L('Din PT', 'Your personal trainer'),
    task: L('Säg att du ätit rent i en vecka (lögn)', 'Say you’ve eaten clean for a week (lie)'),
  },
  {
    id: 'doctor-symptom',
    recipient: L('Vårdcentralen', 'The clinic'),
    task: L('Beskriv dina symptom så vagt som möjligt', 'Describe your symptoms as vaguely as possible'),
  },
  {
    id: 'doctor-sicknote',
    recipient: L('Din läkare', 'Your doctor'),
    task: L('Be om sjukintyg för något pinsamt', 'Ask for a sick note for something embarrassing'),
  },
  {
    id: 'dentist-fear',
    recipient: L('Tandläkaren', 'The dentist'),
    task: L('Förklara varför du inte varit där på 5 år', 'Explain why you haven’t been in 5 years'),
  },
  {
    id: 'hair-change',
    recipient: L('Frisören', 'Your hairdresser'),
    task: L('Be om en total makeover baserat på en vag känsla', 'Ask for a total makeover based on a vague vibe'),
  },
  {
    id: 'mechanic',
    recipient: L('Verkstaden', 'The mechanic'),
    task: L('Fråga hur dyrt det blir — med panik i rösten', 'Ask how expensive it’ll be — with panic in your voice'),
  },
  {
    id: 'ikea',
    recipient: L('IKEA kundtjänst', 'IKEA customer service'),
    task: L('Beskriv skruvarna du har kvar efter hyllan', 'Describe the leftover screws after the shelf'),
  },
  {
    id: 'support-wifi',
    recipient: L('Bredbandsbolaget', 'Your ISP'),
    task: L('Klaga på att wifit bara funkar när det regnar', 'Complain that Wi‑Fi only works when it rains'),
  },
  {
    id: 'support-app',
    recipient: L('App-supporten', 'App support'),
    task: L('Beskriv ett bug på det minst hjälpsamma sättet', 'Describe a bug in the least helpful way'),
  },
  {
    id: 'bank-loan',
    recipient: L('Banken', 'The bank'),
    task: L('Fråga om bolån med noll koll på siffror', 'Ask about a mortgage with zero grasp of numbers'),
  },
  {
    id: 'insurance',
    recipient: L('Försäkringsbolaget', 'The insurance company'),
    task: L('Förklara hur TV:n “föll” av sig själv', 'Explain how the TV “fell” by itself'),
  },
  {
    id: 'airline-bag',
    recipient: L('Flygbolaget', 'The airline'),
    task: L('Rapportera att ditt bagage åkt till fel land', 'Report that your bag went to the wrong country'),
  },
  {
    id: 'hotel',
    recipient: L('Hotellet', 'The hotel'),
    task: L('Be om uppgradering med usla argument', 'Ask for an upgrade with terrible arguments'),
  },
  {
    id: 'restaurant',
    recipient: L('Restaurangen', 'The restaurant'),
    task: L('Klaga på maten men på ett snällt sätt', 'Complain about the food, but nicely'),
  },
  {
    id: 'pizza-wrong',
    recipient: L('Pizzerian', 'The pizzeria'),
    task: L('Säg att du fick fel pizza. Igen.', 'Say you got the wrong pizza. Again.'),
  },
  {
    id: 'delivery-missing',
    recipient: L('Budfirman', 'The delivery company'),
    task: L('Säg att paketet “levererats” men inte finns', 'Say the package was “delivered” but isn’t there'),
  },
  {
    id: 'uber-route',
    recipient: L('Din Uber-förare', 'Your Uber driver'),
    task: L('Be dem ta en omväg av personliga skäl', 'Ask them to take a detour for personal reasons'),
  },
  {
    id: 'taxi-sing',
    recipient: L('Taxichauffören', 'The taxi driver'),
    task: L('Be dem sänka radion. Eller höja den.', 'Ask them to turn the radio down. Or up.'),
  },
  {
    id: 'wrong-number-love',
    recipient: L('Fel nummer', 'Wrong number'),
    task: L('Fortsätt konversationen som om ni känner varandra', 'Continue the chat like you know each other'),
  },
  {
    id: 'influencer-collab',
    recipient: L('En mikroinfluencer', 'A micro-influencer'),
    task: L('Erbjud samarbete. Du har ingen produkt.', 'Offer a collab. You have no product.'),
  },
  {
    id: 'celebrity',
    recipient: L('En kändis (DM)', 'A celebrity (DM)'),
    task: L('Skriv något som absolut inte borde skickas', 'Write something that absolutely shouldn’t be sent'),
  },
  {
    id: 'podcast',
    recipient: L('Din favoritpodd', 'Your favorite podcast'),
    task: L('Föreslå dig själv som gäst', 'Suggest yourself as a guest'),
  },
  {
    id: 'teacher-grade',
    recipient: L('Din lärare', 'Your teacher'),
    task: L('Argumentera för högre betyg med usla skäl', 'Argue for a higher grade with terrible reasons'),
  },
  {
    id: 'classmate',
    recipient: L('En klasskompis', 'A classmate'),
    task: L('Be om anteckningarna. Timmen innan tentan.', 'Ask for the notes. An hour before the exam.'),
  },
  {
    id: 'police-park',
    recipient: L('Polisen (hypotetiskt)', 'The police (hypothetically)'),
    task: L('Förklara den olagliga parkeringen', 'Explain the illegal parking'),
  },
  {
    id: 'building-board',
    recipient: L('Bostadsrättsföreningen', 'The housing association'),
    task: L('Försvara dig mot klagomål om fest', 'Defend yourself against noise complaints'),
  },
  {
    id: 'dog-walker',
    recipient: L('Hundrastaren', 'The dog walker'),
    task: L('Förklara varför hunden beter sig konstigt idag', 'Explain why the dog is acting weird today'),
  },
  {
    id: 'vet',
    recipient: L('Veterinären', 'The vet'),
    task: L('Beskriv vad katten gjort med soffan', 'Describe what the cat did to the sofa'),
  },
  {
    id: 'absurd-ai',
    recipient: L('En AI-assistent', 'An AI assistant'),
    task: L('Be om råd i en situation du absolut inte borde fråga AI om', 'Ask for advice in a situation you should never ask AI about'),
  },
  {
    id: 'absurd-moon',
    recipient: L('NASA', 'NASA'),
    task: L('Ansök om att bli astronaut via SMS', 'Apply to become an astronaut via text'),
  },
  {
    id: 'absurd-ghost',
    recipient: L('Spöket i lägenheten', 'The ghost in your apartment'),
    task: L('Be dem vara tystare efter 23', 'Ask them to be quieter after 11pm'),
  },
  {
    id: 'absurd-plant',
    recipient: L('Dina växter', 'Your plants'),
    task: L('Be om ursäkt för att du glömt vattna i tre veckor', 'Apologize for forgetting to water them for three weeks'),
  },
  {
    id: 'absurd-mirror',
    recipient: L('Dig själv i spegeln', 'Yourself in the mirror'),
    task: L('Ge dig själv pepp inför en jobbig dag', 'Hype yourself up for a rough day'),
  },
  {
    id: 'work-meeting',
    recipient: L('Hela möteschatten', 'The whole meeting chat'),
    task: L('Säg att du “snart är inne” — du har inte duschat', 'Say you’re “joining soon” — you haven’t showered'),
  },
  {
    id: 'work-slack',
    recipient: L('Slack-kanalen #random', 'Slack channel #random'),
    task: L('Dela en “rolig” grej som ingen tycker är rolig', 'Share a “funny” thing nobody finds funny'),
  },
  {
    id: 'work-intern',
    recipient: L('Praktikanten', 'The intern'),
    task: L('Be dem göra något du själv hatar', 'Ask them to do something you hate doing'),
  },
  {
    id: 'dating-friendzone',
    recipient: L('Någon i friendzone', 'Someone in the friendzone'),
    task: L('Försök ta er ur friendzonen. Diskret.', 'Try to leave the friendzone. Discreetly.'),
  },
  {
    id: 'ex-stuff',
    recipient: L('Din ex', 'Your ex'),
    task: L('Be om att få tillbaka dina grejer. Speciellt hoodien.', 'Ask for your stuff back. Especially the hoodie.'),
  },
  {
    id: 'stranger-bar',
    recipient: L('Någon du fick numret till på krogen', 'Someone whose number you got at the bar'),
    task: L('Skriv dagen efter. Du minns knappt dem.', 'Text the next day. You barely remember them.'),
  },
  {
    id: 'wedding-speech',
    recipient: L('Brudparet', 'The wedding couple'),
    task: L('Bekräfta att ditt tal blir “kort”', 'Confirm that your speech will be “short”'),
  },
  {
    id: 'baby-shower',
    recipient: L('Baby shower-chatten', 'The baby shower chat'),
    task: L('Säg att du glömt presenten hemma', 'Say you left the gift at home'),
  },
  {
    id: 'new-year',
    recipient: L('Kompisgänget', 'The friend group'),
    task: L('Föreslå nyårsplan. Det är den 30 december.', 'Suggest New Year’s plans. It’s December 30.'),
  },
  {
    id: 'festival',
    recipient: L('Festivalchatten', 'The festival group chat'),
    task: L('Erkänn att du tappat bort biljetterna', 'Admit you lost the tickets'),
  },
  {
    id: 'camping',
    recipient: L('Tältkompisarna', 'Your camping crew'),
    task: L('Säg att du “packat lätt” — du glömde allt', 'Say you “packed light” — you forgot everything'),
  },
  {
    id: 'ski-trip',
    recipient: L('Skidresan', 'The ski trip chat'),
    task: L('Säg att du egentligen inte kan åka skidor', 'Admit you actually can’t ski'),
  },
  {
    id: 'book-club',
    recipient: L('Bokklubben', 'The book club'),
    task: L('Säg att du läst boken. Du har sett filmen.', 'Say you read the book. You watched the movie.'),
  },
  {
    id: 'boardgame',
    recipient: L('Spelkvällsgänget', 'The game night crew'),
    task: L('Föreslå Monopoly. Medvetet.', 'Suggest Monopoly. On purpose.'),
  },
]

export function pickPrompts(count: number, lang: Lang, excludeIds: Set<string>): Prompt[] {
  void lang
  const theme = todaysTheme()
  const unused = PROMPTS.filter((p) => !excludeIds.has(p.id))
  const pool = unused.length > 0 ? unused : [...PROMPTS]

  // Prefer true randomness; lightly sprinkle at most one themed prompt if available
  const themedUnused = shuffle(pool.filter((p) => theme.ids.includes(p.id)))
  const rest = shuffle(pool.filter((p) => !theme.ids.includes(p.id)))
  const out: Prompt[] = []

  if (themedUnused.length > 0 && Math.random() < 0.28) {
    out.push(themedUnused[0]!)
  }

  for (const p of shuffle([...themedUnused.slice(out.length ? 1 : 0), ...rest])) {
    if (out.length >= count) break
    if (!out.some((x) => x.id === p.id)) out.push(p)
  }

  // If pool exhausted mid-pick, fill from full catalog excluding already chosen
  if (out.length < count) {
    for (const p of shuffle(PROMPTS)) {
      if (out.length >= count) break
      if (!out.some((x) => x.id === p.id)) out.push(p)
    }
  }

  return out
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
    ids: [
      'boss-late',
      'coworker',
      'hr',
      'client',
      'landlord',
      'bank',
      'boss-raise',
      'boss-zoom-bg',
      'colleague-smell',
      'colleague-credit',
      'hr-harass',
      'client-typo',
      'client-invoice',
      'work-meeting',
      'work-slack',
      'work-intern',
      'work-sick',
      'work-resign',
      'work-zoom',
      'work-coffee',
    ],
  },
  {
    id: 'dating',
    label: L('Dating-drama', 'Dating drama'),
    blurb: L('Crush, ex och dåliga ursäkter.', 'Crush, ex, and terrible excuses.'),
    ids: [
      'crush',
      'ex-hello',
      'date-cancel',
      'partner-sorry',
      'bestie-secret',
      'stranger',
      'dating-app',
      'dating-late',
      'dating-end',
      'dating-parents-meet',
      'partner-forgot',
      'partner-netflix',
      'dating-ghost',
      'dating-explain',
      'dating-parents',
      'dating-friendzone',
      'ex-bumped',
      'ex-stuff',
      'stranger-bar',
      'wrong-number-love',
    ],
  },
  {
    id: 'family',
    label: L('Familjefesten', 'Family night'),
    blurb: L('Mamma, pappa och syskon — pinsamt garanterat.', 'Mum, dad, siblings — awkward guaranteed.'),
    ids: [
      'mum-money',
      'dad-car',
      'sibling',
      'roommate',
      'wedding',
      'neighbor',
      'mum-tattoo',
      'mum-move',
      'dad-crypto',
      'dad-job',
      'sibling-favor',
      'grandma-tech',
      'grandma-visit',
      'family-group',
      'uncle-politics',
      'family-dinner',
      'family-secret',
      'family-pet',
      'family-lie',
      'roommate-food',
      'roommate-guest',
    ],
  },
  {
    id: 'absurd',
    label: L('Absurt', 'Absurd'),
    blurb: L('Uber, flyg, polisen och fel nummer.', 'Uber, flights, police, and wrong numbers.'),
    ids: [
      'uber',
      'flight',
      'police',
      'influencer',
      'hairdresser',
      'delivery',
      'dentist',
      'absurd-alien',
      'absurd-time',
      'absurd-pizza',
      'absurd-neighbor-cat',
      'absurd-ai',
      'absurd-moon',
      'absurd-ghost',
      'absurd-plant',
      'absurd-mirror',
      'celebrity',
      'podcast',
      'ikea',
      'insurance',
      'vet',
      'dog-walker',
    ],
  },
  {
    id: 'party',
    label: L('Kalasläge', 'Party mode'),
    blurb: L('Kompisar, kalas och gruppchattar.', 'Friends, parties, and group chats.'),
    ids: [
      'party-skip',
      'groupchat',
      'friend-borrow',
      'gym',
      'bestie-secret',
      'wedding',
      'friend-spill',
      'bestie-borrow-money',
      'bestie-cancel',
      'friend-ugly',
      'group-trip',
      'group-bill',
      'party-host',
      'party-leave',
      'gym-spot',
      'gym-trainer',
      'wedding-speech',
      'baby-shower',
      'new-year',
      'festival',
      'camping',
      'ski-trip',
      'book-club',
      'boardgame',
    ],
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
