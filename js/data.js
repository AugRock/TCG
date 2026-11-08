/*
 * THÈME DU JEU — tout ce qui est spécifique au thème est ici.
 * Pour changer de thème (joueurs, voitures, montagnes…), il suffit de
 * remplacer cet objet : le moteur (app.js) ne connaît que la structure.
 *
 * Données réelles : nom, ville, pays, sport, année d'ouverture, capacité.
 * Statistique de jeu : "prestige" (0-100) est un choix d'équilibrage, pas une donnée.
 * Capacités approximatives (elles changent avec les rénovations).
 */
const THEME = {
  name: "Tribunes",
  tagline: "Collectionne les stades les plus mythiques du monde",
  currentYear: 2026,

  rarities: {
    commune:    { label: "Commune",    weight: 62, color: "#8a94a6", sellValue: 5 },
    rare:       { label: "Rare",       weight: 27, color: "#3b82f6", sellValue: 15 },
    epique:     { label: "Épique",     weight: 9,  color: "#a855f7", sellValue: 40 },
    legendaire: { label: "Légendaire", weight: 2,  color: "#f59e0b", sellValue: 120 },
  },

  sports: {
    football:  { label: "Football",            icon: "⚽" },
    rugby:     { label: "Rugby",               icon: "🏉" },
    us:        { label: "Football américain",  icon: "🏈" },
    baseball:  { label: "Baseball",            icon: "⚾" },
    tennis:    { label: "Tennis",              icon: "🎾" },
    cricket:   { label: "Cricket",             icon: "🏏" },
    basket:    { label: "Basket",              icon: "🏀" },
    auto:      { label: "Sport auto",          icon: "🏁" },
    olympique: { label: "Olympique",           icon: "🏅" },
    autre:     { label: "Autres sports",       icon: "🏟️" },
  },

  // Statistiques utilisées en duel (la plus haute gagne)
  stats: [
    { key: "capacity", label: "Capacité",   unit: "places", get: c => c.capacity },
    { key: "age",      label: "Ancienneté", unit: "ans",    get: c => THEME.currentYear - c.year },
    { key: "prestige", label: "Prestige",   unit: "/100",   get: c => c.prestige },
  ],

  cards: [
    // ---- Légendaires
    { id: "maracana",   name: "Maracanã",                 city: "Rio de Janeiro", flag: "🇧🇷", sport: "football", year: 1950, capacity: 78838,  prestige: 99, rarity: "legendaire", fact: "Théâtre du « Maracanaço », la finale perdue par le Brésil face à l'Uruguay en 1950." },
    { id: "wembley",    name: "Wembley",                  city: "Londres",        flag: "🇬🇧", sport: "football", year: 2007, capacity: 90000,  prestige: 97, rarity: "legendaire", fact: "Reconstruit sur le site de l'ancien Wembley, célèbre pour son arche de 133 m." },
    { id: "mcg",        name: "Melbourne Cricket Ground", city: "Melbourne",      flag: "🇦🇺", sport: "cricket",  year: 1853, capacity: 100024, prestige: 95, rarity: "legendaire", fact: "Plus grand stade d'Australie, stade principal des JO de 1956." },
    { id: "indy",       name: "Indianapolis Motor Speedway", city: "Indianapolis", flag: "🇺🇸", sport: "auto",   year: 1909, capacity: 257325, prestige: 94, rarity: "legendaire", fact: "Surnommé « The Brickyard » : la piste fut pavée de briques en 1909." },
    { id: "azteca",     name: "Estadio Azteca",           city: "Mexico",         flag: "🇲🇽", sport: "football", year: 1966, capacity: 87523,  prestige: 96, rarity: "legendaire", fact: "Seul stade à avoir accueilli deux finales de Coupe du monde (1970 et 1986)." },

    // ---- Épiques
    { id: "campnou",    name: "Camp Nou",                 city: "Barcelone",      flag: "🇪🇸", sport: "football", year: 1957, capacity: 99354,  prestige: 93, rarity: "epique" },
    { id: "bernabeu",   name: "Santiago Bernabéu",        city: "Madrid",         flag: "🇪🇸", sport: "football", year: 1947, capacity: 83186,  prestige: 92, rarity: "epique" },
    { id: "sdf",        name: "Stade de France",          city: "Saint-Denis",    flag: "🇫🇷", sport: "football", year: 1998, capacity: 80698,  prestige: 88, rarity: "epique", fact: "Construit pour la Coupe du monde 1998, remportée par la France." },
    { id: "sansiro",    name: "San Siro",                 city: "Milan",          flag: "🇮🇹", sport: "football", year: 1926, capacity: 75817,  prestige: 90, rarity: "epique" },
    { id: "chatrier",   name: "Court Philippe-Chatrier",  city: "Paris",          flag: "🇫🇷", sport: "tennis",   year: 1928, capacity: 15225,  prestige: 91, rarity: "epique" },
    { id: "centrecourt",name: "Centre Court",             city: "Wimbledon",      flag: "🇬🇧", sport: "tennis",   year: 1922, capacity: 14979,  prestige: 94, rarity: "epique" },
    { id: "lords",      name: "Lord's",                   city: "Londres",        flag: "🇬🇧", sport: "cricket",  year: 1814, capacity: 31100,  prestige: 89, rarity: "epique", fact: "Surnommé « The Home of Cricket »." },
    { id: "panathenaic",name: "Stade panathénaïque",      city: "Athènes",        flag: "🇬🇷", sport: "olympique",year: 1896, capacity: 45000,  prestige: 87, rarity: "epique", fact: "Rebâti sur un site antique pour les premiers Jeux olympiques modernes de 1896." },
    { id: "msg",        name: "Madison Square Garden",    city: "New York",       flag: "🇺🇸", sport: "basket",   year: 1968, capacity: 19812,  prestige: 90, rarity: "epique" },
    { id: "narendra",   name: "Narendra Modi Stadium",    city: "Ahmedabad",      flag: "🇮🇳", sport: "cricket",  year: 1983, capacity: 132000, prestige: 84, rarity: "epique", fact: "Plus grand stade du monde par la capacité depuis sa reconstruction en 2020." },

    // ---- Rares
    { id: "oldtrafford",name: "Old Trafford",             city: "Manchester",     flag: "🇬🇧", sport: "football", year: 1910, capacity: 74310,  prestige: 86, rarity: "rare" },
    { id: "anfield",    name: "Anfield",                  city: "Liverpool",      flag: "🇬🇧", sport: "football", year: 1884, capacity: 61276,  prestige: 85, rarity: "rare" },
    { id: "westfalen",  name: "Signal Iduna Park",        city: "Dortmund",       flag: "🇩🇪", sport: "football", year: 1974, capacity: 81365,  prestige: 85, rarity: "rare" },
    { id: "allianz",    name: "Allianz Arena",            city: "Munich",         flag: "🇩🇪", sport: "football", year: 2005, capacity: 75024,  prestige: 83, rarity: "rare" },
    { id: "bombonera",  name: "La Bombonera",             city: "Buenos Aires",   flag: "🇦🇷", sport: "football", year: 1940, capacity: 54000,  prestige: 88, rarity: "rare" },
    { id: "monumental", name: "Estadio Monumental",       city: "Buenos Aires",   flag: "🇦🇷", sport: "football", year: 1938, capacity: 84567,  prestige: 82, rarity: "rare" },
    { id: "velodrome",  name: "Stade Vélodrome",          city: "Marseille",      flag: "🇫🇷", sport: "football", year: 1937, capacity: 67394,  prestige: 80, rarity: "rare" },
    { id: "twickenham", name: "Twickenham",               city: "Londres",        flag: "🇬🇧", sport: "rugby",    year: 1909, capacity: 82000,  prestige: 84, rarity: "rare" },
    { id: "edenpark",   name: "Eden Park",                city: "Auckland",       flag: "🇳🇿", sport: "rugby",    year: 1900, capacity: 50000,  prestige: 83, rarity: "rare" },
    { id: "michigan",   name: "Michigan Stadium",         city: "Ann Arbor",      flag: "🇺🇸", sport: "us",       year: 1927, capacity: 107601, prestige: 78, rarity: "rare", fact: "Surnommé « The Big House », plus grand stade des États-Unis." },
    { id: "lambeau",    name: "Lambeau Field",            city: "Green Bay",      flag: "🇺🇸", sport: "us",       year: 1957, capacity: 81441,  prestige: 80, rarity: "rare" },
    { id: "fenway",     name: "Fenway Park",              city: "Boston",         flag: "🇺🇸", sport: "baseball", year: 1912, capacity: 37755,  prestige: 82, rarity: "rare" },
    { id: "berlin",     name: "Olympiastadion",           city: "Berlin",         flag: "🇩🇪", sport: "olympique",year: 1936, capacity: 74475,  prestige: 79, rarity: "rare" },
    { id: "rungrado",   name: "Stade Rungrado",           city: "Pyongyang",      flag: "🇰🇵", sport: "football", year: 1989, capacity: 114000, prestige: 55, rarity: "rare" },
    { id: "edengardens",name: "Eden Gardens",             city: "Calcutta",       flag: "🇮🇳", sport: "cricket",  year: 1864, capacity: 68000,  prestige: 80, rarity: "rare" },

    // ---- Communes
    { id: "parcdesprinces", name: "Parc des Princes",     city: "Paris",          flag: "🇫🇷", sport: "football", year: 1972, capacity: 47929,  prestige: 76, rarity: "commune" },
    { id: "luz",        name: "Estádio da Luz",           city: "Lisbonne",       flag: "🇵🇹", sport: "football", year: 2003, capacity: 64642,  prestige: 72, rarity: "commune" },
    { id: "celticpark", name: "Celtic Park",              city: "Glasgow",        flag: "🇬🇧", sport: "football", year: 1892, capacity: 60411,  prestige: 74, rarity: "commune" },
    { id: "luzhniki",   name: "Loujniki",                 city: "Moscou",         flag: "🇷🇺", sport: "football", year: 1956, capacity: 81000,  prestige: 70, rarity: "commune" },
    { id: "soccercity", name: "FNB Stadium",              city: "Johannesburg",   flag: "🇿🇦", sport: "football", year: 1989, capacity: 94736,  prestige: 73, rarity: "commune" },
    { id: "ellispark",  name: "Ellis Park",               city: "Johannesburg",   flag: "🇿🇦", sport: "rugby",    year: 1928, capacity: 62567,  prestige: 75, rarity: "commune" },
    { id: "cairo",      name: "Stade international du Caire", city: "Le Caire",   flag: "🇪🇬", sport: "football", year: 1960, capacity: 75000,  prestige: 65, rarity: "commune" },
    { id: "yokohama",   name: "Stade international de Yokohama", city: "Yokohama", flag: "🇯🇵", sport: "football", year: 1998, capacity: 72327, prestige: 68, rarity: "commune" },
    { id: "birdsnest",  name: "Stade national de Pékin",  city: "Pékin",          flag: "🇨🇳", sport: "olympique",year: 2008, capacity: 80000,  prestige: 74, rarity: "commune", fact: "Surnommé « le Nid d'oiseau »." },
    { id: "montreal",   name: "Stade olympique",          city: "Montréal",       flag: "🇨🇦", sport: "olympique",year: 1976, capacity: 56040,  prestige: 62, rarity: "commune" },
    { id: "att",        name: "AT&T Stadium",             city: "Arlington",      flag: "🇺🇸", sport: "us",       year: 2009, capacity: 80000,  prestige: 70, rarity: "commune" },
    { id: "yankee",     name: "Yankee Stadium",           city: "New York",       flag: "🇺🇸", sport: "baseball", year: 2009, capacity: 46537,  prestige: 75, rarity: "commune" },
    { id: "wrigley",    name: "Wrigley Field",            city: "Chicago",        flag: "🇺🇸", sport: "baseball", year: 1914, capacity: 41649,  prestige: 74, rarity: "commune" },
    { id: "ashe",       name: "Arthur Ashe Stadium",      city: "New York",       flag: "🇺🇸", sport: "tennis",   year: 1997, capacity: 23771,  prestige: 77, rarity: "commune" },
    { id: "croke",      name: "Croke Park",               city: "Dublin",         flag: "🇮🇪", sport: "autre",    year: 1884, capacity: 82300,  prestige: 72, rarity: "commune" },
    { id: "kokugikan",  name: "Ryōgoku Kokugikan",        city: "Tokyo",          flag: "🇯🇵", sport: "autre",    year: 1985, capacity: 11098,  prestige: 78, rarity: "commune", fact: "Temple du sumo à Tokyo." },
  ],
};
