export const unsplash = (id: string, width = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;

export type TrendingTitle = {
  id: string;
  title: string;
  image: string;
  year: number;
  rating: string;
  type: "Movie" | "Series" | "Docuseries";
  genres: string[];
  synopsis: string;
};

export const trending: TrendingTitle[] = [
  {
    id: "eko-nights",
    title: "Eko Nights",
    image: "1593717191400-84f38ee95485",
    year: 2026,
    rating: "16+",
    type: "Series",
    genres: ["Thriller", "Crime"],
    synopsis:
      "A rideshare driver picks up the wrong passenger on Lagos Island and spends one long night running from people who want a package he never knew he had.",
  },
  {
    id: "third-mainland",
    title: "Third Mainland",
    image: "1648023200201-8fcede127835",
    year: 2025,
    rating: "18+",
    type: "Movie",
    genres: ["Crime", "Drama"],
    synopsis:
      "Two estranged brothers on opposite sides of the law are forced to work together when a heist on the city's longest bridge goes wrong.",
  },
  {
    id: "queen-of-balogun",
    title: "Queen of Balogun",
    image: "1530785602389-07594beb8b73",
    year: 2026,
    rating: "13+",
    type: "Series",
    genres: ["Drama", "Family"],
    synopsis:
      "A fabric trader builds a market empire from one small stall, while rivals and family secrets threaten to unravel everything she has built.",
  },
  {
    id: "danfo-diaries",
    title: "Danfo Diaries",
    image: "1549383433-0d8ef3f38afa",
    year: 2025,
    rating: "13+",
    type: "Series",
    genres: ["Comedy"],
    synopsis:
      "Every episode, a new set of strangers shares one yellow bus, one traffic jam and one very talkative conductor.",
  },
  {
    id: "chairmans-son",
    title: "The Chairman's Son",
    image: "1616805765352-beedbad46b2a",
    year: 2026,
    rating: "16+",
    type: "Movie",
    genres: ["Drama", "Suspense"],
    synopsis:
      "Heir to a powerful family business, a young man discovers the fortune he is about to inherit was built on a lie.",
  },
  {
    id: "afro-and-ashes",
    title: "Afro & Ashes",
    image: "1519699047748-de8e457a634e",
    year: 2024,
    rating: "13+",
    type: "Movie",
    genres: ["Romance", "Drama"],
    synopsis:
      "A painter and a firefighter meet on the worst day of their lives and slowly learn how to start again together.",
  },
  {
    id: "harmattan-road",
    title: "Harmattan Road",
    image: "1765285353856-0d00e478f2c8",
    year: 2025,
    rating: "16+",
    type: "Movie",
    genres: ["Epic", "Adventure"],
    synopsis:
      "A trader leads a caravan across the north through dust storms, bandits and a promise he made to his dying father.",
  },
  {
    id: "island-money",
    title: "Island Money",
    image: "1618828665347-d870c38c95c7",
    year: 2026,
    rating: "All",
    type: "Docuseries",
    genres: ["Documentary", "Business"],
    synopsis:
      "Inside the boardrooms, startups and side hustles shaping the new Lagos economy, told by the people building it.",
  },
  {
    id: "market-day",
    title: "Market Day",
    image: "1761370980776-93f2110a99a7",
    year: 2024,
    rating: "All",
    type: "Movie",
    genres: ["Family", "Comedy"],
    synopsis:
      "Sent to the market with one list and a little money, a teenager turns a simple errand into the biggest adventure of his summer.",
  },
  {
    id: "last-show",
    title: "Last Show at the Odeon",
    image: "1489599849927-2ee91cede3ba",
    year: 2025,
    rating: "16+",
    type: "Movie",
    genres: ["Mystery"],
    synopsis:
      "On the final night before an old cinema is demolished, the audience realises the film on screen is about them.",
  },
];

export type Reason = {
  title: string;
  body: string;
  icon: "tv" | "download" | "data" | "kids";
};

export const reasons: Reason[] = [
  {
    title: "Watch on every screen",
    body: "Stream on Smart TVs, PlayStation, Xbox, Chromecast, Apple TV, phones, tablets and laptops in up to 4K Ultra HD.",
    icon: "tv",
  },
  {
    title: "Download and go offline",
    body: "Save your favourites before you leave home and keep watching when the network drops or the light goes off.",
    icon: "download",
  },
  {
    title: "Data that works for you",
    body: "Choose Data Saver, HD or 4K on each profile so your bundle lasts as long as your binge.",
    icon: "data",
  },
  {
    title: "Profiles made for kids",
    body: "Children get their own safe space packed with cartoons and family films, with PIN locks and age controls you set.",
    icon: "kids",
  },
];

export type Faq = { question: string; answer: string[] };

export const faqs: Faq[] = [
  {
    question: "What is MyFlix?",
    answer: [
      "MyFlix is a Nigerian streaming service with Nollywood hits, international movies, TV series, documentaries, anime and more, all on your favourite devices.",
      "Watch as much as you like, whenever you like, with no adverts, for one simple monthly price. New titles land every week.",
    ],
  },
  {
    question: "How much does MyFlix cost?",
    answer: [
      "Watch on your phone, laptop or TV for one fixed monthly fee. Plans start from ₦1,500 for Mobile, ₦2,500 for Basic, ₦4,000 for Standard and ₦5,500 for Premium with 4K. No hidden charges and no contracts.",
    ],
  },
  {
    question: "How do I pay?",
    answer: [
      "Pay with your debit card, bank transfer or USSD. Payments are processed securely and you get a receipt every month.",
    ],
  },
  {
    question: "Where can I watch?",
    answer: [
      "Anywhere you are. Sign in on the web or with the MyFlix app on your Android or iPhone, smart TV, streaming stick or games console.",
      "Download titles on the mobile app to watch on the road, on a flight or anywhere without internet.",
    ],
  },
  {
    question: "How do I cancel?",
    answer: [
      "MyFlix is flexible. No contracts and no cancellation fees. Cancel online in two clicks from your Account page and keep watching until the end of your billing period.",
    ],
  },
  {
    question: "What can I watch on MyFlix?",
    answer: [
      "A large library of Nollywood films, African series, Hollywood blockbusters, documentaries, kids' shows and MyFlix Originals, with something new every week.",
    ],
  },
  {
    question: "Is MyFlix good for kids?",
    answer: [
      "Kids profiles give children a space full of family viewing, managed by you.",
      "Parents can set maturity ratings, block specific titles and add a PIN to any profile.",
    ],
  },
  {
    question: "How much data does MyFlix use?",
    answer: [
      "You decide. Data Saver uses roughly 0.3 GB per hour, HD around 3 GB per hour and 4K Ultra HD around 7 GB per hour. Change it anytime per profile.",
    ],
  },
];

export const footerLinks = [
  "FAQ",
  "Help Centre",
  "Account",
  "Media Centre",
  "Investor Relations",
  "Jobs",
  "Ways to Watch",
  "Terms of Use",
  "Privacy",
  "Cookie Preferences",
  "Corporate Information",
  "Contact Us",
  "Speed Test",
  "Legal Notices",
  "Only on MyFlix",
];

export const languages = ["English", "Yorùbá", "Hausa", "Igbo", "Pidgin"];
