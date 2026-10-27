/**
 * Mock catalogue used until the admin dashboard + backend supply real titles.
 * Images are Unsplash stock photos; all titles, people and stories are fictional.
 */

export type Maturity = "All" | "7+" | "13+" | "16+" | "18+";

export type Title = {
  id: string;
  title: string;
  image: string;
  type: "movie" | "series";
  year: number;
  maturity: Maturity;
  genres: string[];
  runtime?: string;
  seasons?: number;
  synopsis: string;
  cast: string[];
  tags: string[];
  match: number;
  original?: boolean;
  kids?: boolean;
  isNew?: boolean;
  comingSoon?: string;
  quality: "HD" | "4K";
};

export const img = (id: string, w = 600, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=70`;

const T = (t: Omit<Title, "match" | "quality"> & { match?: number; quality?: "HD" | "4K" }): Title => ({
  match: 90,
  quality: "4K",
  ...t,
});

export const catalog: Title[] = [
  T({ id: "eko-nights", title: "Eko Nights", image: "1593717191400-84f38ee95485", type: "series", seasons: 2, year: 2026, maturity: "16+", genres: ["Thriller", "Crime", "Nollywood"], synopsis: "A rideshare driver picks up the wrong passenger on Lagos Island and spends one long night running from people who want a package he never knew he had.", cast: ["Tobi Adeyemi", "Kemi Lawal", "Chuka Obi"], tags: ["Suspenseful", "Gritty"], match: 98, original: true, isNew: true }),
  T({ id: "third-mainland", title: "Third Mainland", image: "1648023200201-8fcede127835", type: "movie", runtime: "2h 04m", year: 2025, maturity: "18+", genres: ["Crime", "Action", "Nollywood"], synopsis: "Two estranged brothers on opposite sides of the law are forced to work together when a heist on the city's longest bridge goes wrong.", cast: ["Ifeanyi Nwosu", "Dapo Bankole", "Zainab Musa"], tags: ["Exciting", "Violent"], match: 95, original: true }),
  T({ id: "queen-of-balogun", title: "Queen of Balogun", image: "1530785602389-07594beb8b73", type: "series", seasons: 3, year: 2026, maturity: "13+", genres: ["Drama", "Family", "Nollywood"], synopsis: "A fabric trader builds a market empire from one small stall, while rivals and family secrets threaten everything she has built.", cast: ["Funke Adesina", "Amaka Eze", "Bayo Ojo"], tags: ["Emotional", "Inspiring"], match: 97, original: true }),
  T({ id: "danfo-diaries", title: "Danfo Diaries", image: "1549383433-0d8ef3f38afa", type: "series", seasons: 4, year: 2025, maturity: "13+", genres: ["Comedy", "Nollywood"], synopsis: "Every episode, a new set of strangers shares one yellow bus, one traffic jam and one very talkative conductor.", cast: ["Seyi Martins", "Ngozi Uche", "Aliyu Bello"], tags: ["Witty", "Feel-good"], match: 94 }),
  T({ id: "chairmans-son", title: "The Chairman's Son", image: "1616805765352-beedbad46b2a", type: "movie", runtime: "1h 58m", year: 2026, maturity: "16+", genres: ["Drama", "Suspense", "Nollywood"], synopsis: "Heir to a powerful family business, a young man discovers the fortune he is about to inherit was built on a lie.", cast: ["Emeka Okafor", "Tolu Babatunde", "Hauwa Sani"], tags: ["Dark", "Intimate"], match: 92, isNew: true }),
  T({ id: "afro-and-ashes", title: "Afro & Ashes", image: "1519699047748-de8e457a634e", type: "movie", runtime: "1h 46m", year: 2024, maturity: "13+", genres: ["Romance", "Drama"], synopsis: "A painter and a firefighter meet on the worst day of their lives and slowly learn how to start again together.", cast: ["Adaeze Okeke", "Femi Coker"], tags: ["Romantic", "Heartfelt"], match: 89 }),
  T({ id: "harmattan-road", title: "Harmattan Road", image: "1765285353856-0d00e478f2c8", type: "movie", runtime: "2h 21m", year: 2025, maturity: "16+", genres: ["Epic", "Adventure", "Action"], synopsis: "A trader leads a caravan across the north through dust storms, bandits and a promise he made to his dying father.", cast: ["Musa Garba", "Aisha Danladi", "Yakubu Idris"], tags: ["Epic", "Rousing"], match: 93, original: true }),
  T({ id: "island-money", title: "Island Money", image: "1618828665347-d870c38c95c7", type: "series", seasons: 1, year: 2026, maturity: "All", genres: ["Documentary", "Business"], synopsis: "Inside the boardrooms, startups and side hustles shaping the new Lagos economy, told by the people building it.", cast: ["Narrated by Bisi Olatunji"], tags: ["Informative", "Inspiring"], match: 88, isNew: true }),
  T({ id: "market-day", title: "Market Day", image: "1761370980776-93f2110a99a7", type: "movie", runtime: "1h 32m", year: 2024, maturity: "All", genres: ["Family", "Comedy"], synopsis: "Sent to the market with one list and a little money, a teenager turns a simple errand into the biggest adventure of his summer.", cast: ["Timi Ajayi", "Mama Rukky"], tags: ["Fun", "Feel-good"], match: 91, kids: true }),
  T({ id: "last-show", title: "Last Show at the Odeon", image: "1489599849927-2ee91cede3ba", type: "movie", runtime: "1h 51m", year: 2025, maturity: "16+", genres: ["Mystery", "Thriller"], synopsis: "On the final night before an old cinema is demolished, the audience realises the film on screen is about them.", cast: ["Kola Adewale", "Rita Okon"], tags: ["Mind-bending", "Eerie"], match: 90 }),
  T({ id: "surulere-sunshine", title: "Sunny Side of Surulere", image: "1522529599102-193c0d76b5b6", type: "movie", runtime: "1h 38m", year: 2026, maturity: "13+", genres: ["Comedy", "Romance", "Nollywood"], synopsis: "An eternally optimistic barber decides to win back his ex by fixing every problem on her street, whether the neighbours like it or not.", cast: ["Seyi Martins", "Bimpe Alade"], tags: ["Goofy", "Feel-good"], match: 87, isNew: true }),
  T({ id: "no-witness", title: "No Witness", image: "1570158268183-d296b2892211", type: "series", seasons: 2, year: 2025, maturity: "18+", genres: ["Crime", "Thriller"], synopsis: "A detective in Port Harcourt hunts a killer who leaves no trace, until a street hawker claims she saw everything.", cast: ["Chuka Obi", "Ebiere Tamuno"], tags: ["Gritty", "Suspenseful"], match: 96 }),
  T({ id: "the-lecturer", title: "The Lecturer", image: "1614023342667-6f060e9d1e04", type: "series", seasons: 1, year: 2026, maturity: "16+", genres: ["Drama", "Suspense"], synopsis: "A respected university lecturer is drawn into a grading scandal that reaches far beyond the campus gates.", cast: ["Dapo Bankole", "Amaka Eze"], tags: ["Provocative", "Cerebral"], match: 90, original: true, isNew: true }),
  T({ id: "old-soldiers", title: "Old Soldiers", image: "1761839258605-d1b118266ccc", type: "movie", runtime: "1h 55m", year: 2024, maturity: "13+", genres: ["Drama", "History"], synopsis: "Two veterans reunite after forty years to keep a promise they made on the front line.", cast: ["Baba Fashola", "Okon Edet"], tags: ["Moving", "Heartfelt"], match: 86 }),
  T({ id: "corner-office", title: "Corner Office", image: "1764169689207-e23fb66e1fcf", type: "series", seasons: 2, year: 2025, maturity: "16+", genres: ["Drama", "Business"], synopsis: "Five executives fight for one promotion at a Victoria Island bank, and none of them plays fair.", cast: ["Tolu Babatunde", "Hauwa Sani", "Kemi Lawal"], tags: ["Witty", "Dramatic"], match: 91 }),
  T({ id: "after-sunset", title: "After Sunset", image: "1766830423687-1e6b417222ee", type: "movie", runtime: "1h 42m", year: 2026, maturity: "13+", genres: ["Romance"], synopsis: "Two strangers stranded at a lagoon-side resort agree to spend one evening as if it were their last.", cast: ["Femi Coker", "Zainab Musa"], tags: ["Romantic", "Intimate"], match: 85, comingSoon: "Fri 31 Oct" }),
  T({ id: "ankara-dreams", title: "Ankara Dreams", image: "1628144029346-8a98676311b6", type: "series", seasons: 2, year: 2025, maturity: "13+", genres: ["Drama", "Nollywood"], synopsis: "A young designer from Aba risks everything to show her collection at Lagos Fashion Week.", cast: ["Ngozi Uche", "Bayo Ojo"], tags: ["Inspiring", "Stylish"], match: 92, original: true }),
  T({ id: "mama-calabar", title: "Mama Calabar", image: "1613876215075-276fd62c89a4", type: "movie", runtime: "1h 49m", year: 2024, maturity: "13+", genres: ["Drama", "Family", "Nollywood"], synopsis: "A celebrated chef returns home to save her mother's restaurant and the recipes that built a family.", cast: ["Rita Okon", "Edidiong Bassey"], tags: ["Heartfelt", "Warm"], match: 90 }),
  T({ id: "northern-bride", title: "The Northern Bride", image: "1523297736436-356615162cc8", type: "movie", runtime: "1h 57m", year: 2025, maturity: "13+", genres: ["Romance", "Drama"], synopsis: "Weeks before her wedding in Kano, a bride meets the one person who knows why she is really getting married.", cast: ["Aisha Danladi", "Yakubu Idris"], tags: ["Romantic", "Emotional"], match: 88 }),
  T({ id: "small-small-love", title: "Small Small Love", image: "1559563628-42bc585dee3e", type: "movie", runtime: "1h 36m", year: 2026, maturity: "13+", genres: ["Comedy", "Romance"], synopsis: "A wedding planner who doesn't believe in love is hired by the one man who swears he'll make her change her mind.", cast: ["Bimpe Alade", "Tobi Adeyemi"], tags: ["Charming", "Light-hearted"], match: 89, comingSoon: "Mon 3 Nov" }),
  T({ id: "campus-queens", title: "Campus Queens", image: "1589156191108-c762ff4b96ab", type: "series", seasons: 3, year: 2025, maturity: "16+", genres: ["Comedy", "Drama"], synopsis: "Four best friends navigate final year, side hustles and one terrible hostel landlord.", cast: ["Adaeze Okeke", "Funke Adesina"], tags: ["Fun", "Bingeworthy"], match: 93 }),
  T({ id: "missed-call", title: "Missed Call", image: "1631787365642-8089af2351be", type: "movie", runtime: "1h 41m", year: 2026, maturity: "16+", genres: ["Thriller", "Suspense"], synopsis: "A woman receives a call from her own number warning her not to go home tonight.", cast: ["Kemi Lawal", "Ifeanyi Nwosu"], tags: ["Chilling", "Suspenseful"], match: 94, isNew: true }),
  T({ id: "carried", title: "Carried", image: "1487546331507-fcf8a5d27ab3", type: "movie", runtime: "1h 24m", year: 2024, maturity: "All", genres: ["Documentary"], synopsis: "Mothers from six Nigerian states share the stories, songs and sacrifices behind raising the next generation.", cast: ["Narrated by Ronke Ojo"], tags: ["Moving", "Intimate"], match: 87 }),
  T({ id: "go-slow", title: "Go-Slow", image: "1648023199223-25d3622bcb13", type: "movie", runtime: "1h 33m", year: 2025, maturity: "13+", genres: ["Comedy", "Nollywood"], synopsis: "Stuck in the worst traffic jam in history, a groom has eight hours to reach his own wedding.", cast: ["Seyi Martins", "Aliyu Bello"], tags: ["Hilarious", "Chaotic"], match: 95 }),
  T({ id: "bridge-city", title: "Bridge City", image: "1719314073622-9399d167725b", type: "series", seasons: 1, year: 2025, maturity: "All", genres: ["Documentary"], synopsis: "How three bridges, a lagoon and twenty million people turned Lagos into Africa's busiest city.", cast: ["Narrated by Bisi Olatunji"], tags: ["Informative"], match: 84 }),
  T({ id: "night-shift", title: "Night Shift", image: "1661628014274-0df78c28beef", type: "series", seasons: 2, year: 2026, maturity: "16+", genres: ["Thriller", "Drama"], synopsis: "The doctors and nurses of an Abuja emergency ward fight to save lives while their own fall apart.", cast: ["Hauwa Sani", "Emeka Okafor"], tags: ["Intense", "Emotional"], match: 92, comingSoon: "Thu 6 Nov" }),
  T({ id: "the-stairwell", title: "The Stairwell", image: "1608992204898-036ffc94095c", type: "movie", runtime: "1h 37m", year: 2025, maturity: "18+", genres: ["Horror"], synopsis: "Residents of an old Yaba estate discover that the stairwell has one more floor than the building does.", cast: ["Dapo Bankole", "Ebiere Tamuno"], tags: ["Scary", "Eerie"], match: 88 }),
  T({ id: "neon-ikoyi", title: "Neon Ikoyi", image: "1601042879364-f3947d3f9c16", type: "series", seasons: 1, year: 2026, maturity: "18+", genres: ["Crime", "Thriller"], synopsis: "A nightclub owner becomes an informant to protect her brother, and learns the police are the most dangerous people in the room.", cast: ["Zainab Musa", "Chuka Obi"], tags: ["Stylish", "Gritty"], match: 93, original: true }),
  T({ id: "expressway", title: "Expressway", image: "1566276423184-a8c13d2a88a1", type: "movie", runtime: "1h 44m", year: 2024, maturity: "16+", genres: ["Thriller", "Action"], synopsis: "A truck driver on the Lagos-Ibadan expressway realises the cargo he is hauling is alive.", cast: ["Musa Garba", "Femi Coker"], tags: ["Tense", "Exciting"], match: 90 }),
  T({ id: "corridor", title: "Corridor", image: "1529440701349-739a457dbcdd", type: "movie", runtime: "1h 29m", year: 2026, maturity: "18+", genres: ["Horror", "Mystery"], synopsis: "A security guard at an empty office tower keeps hearing his late father's voice on the 13th floor.", cast: ["Okon Edet"], tags: ["Scary", "Atmospheric"], match: 86, comingSoon: "Fri 7 Nov" }),
  T({ id: "rainy-season", title: "Rainy Season", image: "1541702467897-41915a07d3a7", type: "movie", runtime: "1h 52m", year: 2025, maturity: "13+", genres: ["Drama", "Romance"], synopsis: "Over one rainy season in Enugu, a widower and his teenage daughter learn how to talk to each other again.", cast: ["Emeka Okafor", "Chiamaka Nnaji"], tags: ["Heartfelt", "Quiet"], match: 89 }),
  T({ id: "daddys-girl", title: "Daddy's Girl", image: "1624272864537-8ecc72b67958", type: "movie", runtime: "1h 34m", year: 2025, maturity: "All", genres: ["Family", "Comedy"], synopsis: "When mum travels for a month, a clueless dad and his very organised daughter swap roles at home.", cast: ["Tobi Adeyemi", "Little Ife"], tags: ["Feel-good", "Fun"], match: 92, kids: true }),
  T({ id: "ludo-kings", title: "Ludo Kings", image: "1577896849786-738ed6c78bd3", type: "series", seasons: 2, year: 2026, maturity: "7+", genres: ["Family", "Comedy"], synopsis: "One family. One board game. One trophy that has started a feud across three generations.", cast: ["Mama Rukky", "Seyi Martins"], tags: ["Fun", "Feel-good"], match: 90, kids: true, isNew: true }),
  T({ id: "badagry-beach", title: "Beach Day at Badagry", image: "1597524678053-5e6fef52d8a3", type: "movie", runtime: "1h 18m", year: 2024, maturity: "All", genres: ["Kids", "Family", "Adventure"], synopsis: "A family day trip becomes a treasure hunt when the kids find an old map in the sand.", cast: ["Timi Ajayi", "Little Ife"], tags: ["Adventurous", "Fun"], match: 88, kids: true }),
  T({ id: "compound-kids", title: "The Compound Kids", image: "1592599457566-c660153d9548", type: "series", seasons: 3, year: 2025, maturity: "7+", genres: ["Kids", "Comedy"], synopsis: "Four friends in the same compound solve neighbourhood mysteries before their parents get home.", cast: ["Little Ife", "Timi Ajayi"], tags: ["Fun", "Clever"], match: 94, kids: true, original: true }),
  T({ id: "football-fever", title: "Football Fever", image: "1502086223501-7ea6ecd79368", type: "series", seasons: 2, year: 2026, maturity: "7+", genres: ["Kids", "Sports"], synopsis: "An underdog street team from Ajegunle trains for the biggest junior tournament in Lagos.", cast: ["Timi Ajayi"], tags: ["Exciting", "Inspiring"], match: 93, kids: true }),
  T({ id: "circle-of-friends", title: "Circle of Friends", image: "1627764940620-90393d0e8c34", type: "series", seasons: 1, year: 2025, maturity: "All", genres: ["Kids", "Education"], synopsis: "Songs, games and stories that teach little ones counting, colours and kindness.", cast: ["Aunty Bisi"], tags: ["Educational", "Musical"], match: 90, kids: true }),
  T({ id: "toy-car-racers", title: "Toy Car Racers", image: "1599376672737-bd66af54c8f5", type: "movie", runtime: "1h 12m", year: 2024, maturity: "All", genres: ["Kids", "Adventure"], synopsis: "Two brothers build the fastest toy car on the street and enter a race across the whole estate.", cast: ["Little Ife", "Timi Ajayi"], tags: ["Fun", "Exciting"], match: 87, kids: true }),
  T({ id: "balloon-party", title: "Balloon Party", image: "1516890896652-41ca1a35787c", type: "movie", runtime: "1h 05m", year: 2026, maturity: "All", genres: ["Kids", "Comedy"], synopsis: "A birthday party goes wonderfully wrong when every balloon starts floating away with a guest.", cast: ["Aunty Bisi"], tags: ["Silly", "Fun"], match: 86, kids: true, isNew: true }),
  T({ id: "village-christmas", title: "Christmas in the Village", image: "1712668055078-0dea0d2bfa11", type: "movie", runtime: "1h 39m", year: 2025, maturity: "All", genres: ["Family", "Comedy", "Holiday"], synopsis: "Three city cousins are sent to their grandmother's village for Christmas, with no data and no escape.", cast: ["Mama Rukky", "Seyi Martins"], tags: ["Warm", "Funny"], match: 91, kids: true }),
  T({ id: "reels-of-nollywood", title: "Reels of Nollywood", image: "1478720568477-152d9b164e26", type: "series", seasons: 1, year: 2026, maturity: "13+", genres: ["Documentary"], synopsis: "From VHS tapes to global streaming: the untold history of Africa's biggest film industry.", cast: ["Narrated by Ronke Ojo"], tags: ["Informative", "Nostalgic"], match: 95, original: true }),
  T({ id: "behind-the-clapboard", title: "Behind the Clapboard", image: "1485846234645-a62644f84728", type: "movie", runtime: "1h 28m", year: 2025, maturity: "All", genres: ["Documentary"], synopsis: "A year with the crews, extras and stunt teams who make blockbusters happen on a Nollywood budget.", cast: ["Narrated by Bisi Olatunji"], tags: ["Fascinating"], match: 85 }),
  T({ id: "lagos-from-above", title: "Lagos From Above", image: "1618828665011-0abd973f7bb8", type: "movie", runtime: "58m", year: 2024, maturity: "All", genres: ["Documentary", "Nature"], synopsis: "Breathtaking drone footage reveals the patterns, rhythms and secrets of a megacity.", cast: ["Narrated by Ronke Ojo"], tags: ["Stunning"], match: 83 }),
  T({ id: "keke-kingdom", title: "Keke Kingdom", image: "1573662766191-066ba9570a4b", type: "movie", runtime: "1h 16m", year: 2025, maturity: "All", genres: ["Documentary", "Business"], synopsis: "The drivers, owners and unions behind Nigeria's most famous three-wheeler.", cast: ["Narrated by Bisi Olatunji"], tags: ["Informative", "Fun"], match: 84 }),
  T({ id: "megacity", title: "Megacity", image: "1594538756542-8c88bda491c5", type: "series", seasons: 1, year: 2026, maturity: "All", genres: ["Documentary"], synopsis: "How Africa's fastest growing cities are planning for the next fifty years.", cast: ["Narrated by Ronke Ojo"], tags: ["Informative"], match: 82, comingSoon: "Sat 8 Nov" }),
];

export const byId = (id: string) => catalog.find((t) => t.id === id);

const ORDER: Maturity[] = ["All", "7+", "13+", "16+", "18+"];
/** True when a title's rating is within a profile's maturity limit. */
export const allowedFor = (t: Title, max: Maturity = "18+") => ORDER.indexOf(t.maturity) <= ORDER.indexOf(max);

export type Tab = "home" | "series" | "movies" | "new" | "mylist";

export type RowDef = { id: string; title: string; items: Title[]; ranked?: boolean; progress?: boolean };

const released = (t: Title) => !t.comingSoon;

export function rowsFor(tab: Tab, kids: boolean, max: Maturity = "18+"): RowDef[] {
  let pool = catalog.filter((t) => released(t) && allowedFor(t, max));
  if (kids) pool = pool.filter((t) => t.kids);
  if (tab === "series") pool = pool.filter((t) => t.type === "series");
  if (tab === "movies") pool = pool.filter((t) => t.type === "movie");

  const g = (genre: string) => pool.filter((t) => t.genres.includes(genre));
  const label = tab === "series" ? "Series" : tab === "movies" ? "Movies" : "";

  if (kids) {
    return [
      { id: "kids-popular", title: "Popular with Kids", items: [...pool].sort((a, b) => b.match - a.match) },
      { id: "kids-family", title: "Family Movie Night", items: g("Family") },
      { id: "kids-shows", title: "Kids' Shows", items: pool.filter((t) => t.type === "series") },
      { id: "kids-adventure", title: "Fun & Adventure", items: pool.filter((t) => t.genres.some((x) => ["Adventure", "Comedy", "Sports"].includes(x))) },
    ].filter((r) => r.items.length);
  }

  const top = [...pool].sort((a, b) => b.match - a.match).slice(0, 10);
  return [
    { id: "trending", title: `Trending Now${label ? ` in ${label}` : ""}`, items: [...pool].sort((a, b) => b.year - a.year || b.match - a.match).slice(0, 14) },
    { id: "top10", title: `Top 10 ${label || "Titles"} in Nigeria Today`, items: top, ranked: true },
    { id: "nollywood", title: "Nollywood Hits", items: g("Nollywood") },
    { id: "originals", title: "Only on MyFlix", items: pool.filter((t) => t.original) },
    { id: "new", title: "New Releases", items: pool.filter((t) => t.isNew) },
    { id: "thrillers", title: "Crime & Thrillers", items: pool.filter((t) => t.genres.some((x) => ["Crime", "Thriller", "Suspense"].includes(x))) },
    { id: "comedy", title: "Comedies to Lift Your Mood", items: g("Comedy") },
    { id: "romance", title: "Love Stories", items: g("Romance") },
    { id: "family", title: "Family Favourites", items: g("Family") },
    { id: "horror", title: "Scary Nights", items: g("Horror") },
    { id: "docs", title: "Documentaries", items: g("Documentary") },
  ].filter((r) => r.items.length >= 2);
}

export function featuredFor(tab: Tab, kids: boolean, max: Maturity = "18+"): Title {
  const pool = catalog.filter((t) => released(t) && (!kids || t.kids) && allowedFor(t, max));
  const pick = kids ? "compound-kids" : tab === "movies" ? "third-mainland" : tab === "series" ? "queen-of-balogun" : "eko-nights";
  const typed = pool.filter((t) => tab === "movies" ? t.type === "movie" : tab === "series" ? t.type === "series" : true);
  return pool.find((t) => t.id === pick) ?? [...typed].sort((a, b) => b.match - a.match)[0] ?? pool[0] ?? catalog[0];
}

export function search(q: string, kids: boolean, max: Maturity = "18+"): Title[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return catalog.filter(
    (t) =>
      (!kids || t.kids) &&
      allowedFor(t, max) &&
      [t.title, ...t.genres, ...t.cast, ...t.tags].some((x) => x.toLowerCase().includes(s)),
  );
}

export function similarTo(t: Title, kids: boolean, max: Maturity = "18+"): Title[] {
  return catalog
    .filter((x) => x.id !== t.id && (!kids || x.kids) && allowedFor(x, max) && x.genres.some((g) => t.genres.includes(g)))
    .slice(0, 9);
}

export function episodesFor(t: Title, season: number) {
  const count = 6 + ((t.title.length + season) % 4);
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    title: i === 0 ? "Pilot" : `Episode ${i + 1}`,
    runtime: `${42 + ((i * 7 + season) % 15)}m`,
    synopsis:
      i === 0
        ? t.synopsis
        : `The stakes rise for everyone in ${t.title} as old loyalties are tested and a new secret comes to light.`,
  }));
}

export const comingSoon = () => catalog.filter((t) => t.comingSoon);
