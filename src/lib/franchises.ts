export interface FranchiseItem {
  id: number;
  media_type: "movie" | "tv";
}

export interface FranchiseDefinition {
  id: string;
  name: string;
  overview: string;
  backdrop_path: string;
  poster_path: string;
  items: FranchiseItem[];
}

export const FRANCHISES: FranchiseDefinition[] = [
  {
    id: "marvel",
    name: "Marvel Cinematic Universe",
    overview: "The complete chronological timeline of the Marvel Cinematic Universe, spanning from the origins of the first Avenger to the multiverse saga.",
    backdrop_path: "/9BBTo63ANSmhC4e6r62OJFuK2GL.jpg", // Avengers backdrop
    poster_path: "/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg", // Avengers poster
    items: [
      { id: 1771, media_type: "movie" }, // Captain America: The First Avenger
      { id: 299537, media_type: "movie" }, // Captain Marvel
      { id: 1726, media_type: "movie" }, // Iron Man
      { id: 10138, media_type: "movie" }, // Iron Man 2
      { id: 1724, media_type: "movie" }, // The Incredible Hulk
      { id: 10195, media_type: "movie" }, // Thor
      { id: 24428, media_type: "movie" }, // The Avengers
      { id: 76338, media_type: "movie" }, // Thor: The Dark World
      { id: 68721, media_type: "movie" }, // Iron Man 3
      { id: 100402, media_type: "movie" }, // Captain America: The Winter Soldier
      { id: 118340, media_type: "movie" }, // Guardians of the Galaxy
      { id: 283995, media_type: "movie" }, // Guardians of the Galaxy Vol. 2
      { id: 232125, media_type: "tv" }, // I Am Groot
      { id: 99861, media_type: "movie" }, // Avengers: Age of Ultron
      { id: 102899, media_type: "movie" }, // Ant-Man
      { id: 271110, media_type: "movie" }, // Captain America: Civil War
      { id: 497698, media_type: "movie" }, // Black Widow
      { id: 284054, media_type: "movie" }, // Black Panther
      { id: 315635, media_type: "movie" }, // Spider-Man: Homecoming
      { id: 284052, media_type: "movie" }, // Doctor Strange
      { id: 284053, media_type: "movie" }, // Thor: Ragnarok
      { id: 363088, media_type: "movie" }, // Ant-Man and the Wasp
      { id: 299536, media_type: "movie" }, // Avengers: Infinity War
      { id: 299534, media_type: "movie" }, // Avengers: Endgame
      { id: 84958, media_type: "tv" }, // Loki
      { id: 91363, media_type: "tv" }, // What If...?
      { id: 85271, media_type: "tv" }, // WandaVision
      { id: 533535, media_type: "movie" }, // Deadpool & Wolverine
      { id: 566525, media_type: "movie" }, // Shang-Chi and the Legend of the Ten Rings
      { id: 88396, media_type: "tv" }, // The Falcon and the Winter Soldier
      { id: 524434, media_type: "movie" }, // Eternals
      { id: 429617, media_type: "movie" }, // Spider-Man: Far From Home
      { id: 634649, media_type: "movie" }, // Spider-Man: No Way Home
      { id: 453395, media_type: "movie" }, // Doctor Strange in the Multiverse of Madness
      { id: 88329, media_type: "tv" }, // Hawkeye
      { id: 92749, media_type: "tv" }, // Moon Knight
      { id: 505642, media_type: "movie" }, // Black Panther: Wakanda Forever
      { id: 122226, media_type: "tv" }, // Echo
      { id: 92783, media_type: "tv" }, // She-Hulk: Attorney at Law
      { id: 92782, media_type: "tv" }, // Ms. Marvel
      { id: 616037, media_type: "movie" }, // Thor: Love and Thunder
      { id: 894205, media_type: "movie" }, // Werewolf by Night
      { id: 774752, media_type: "movie" }, // The Guardians of the Galaxy Holiday Special
      { id: 640146, media_type: "movie" }, // Ant-Man and The Wasp: Quantumania
      { id: 447365, media_type: "movie" }, // Guardians of the Galaxy Vol. 3
      { id: 114472, media_type: "tv" }, // Secret Invasion
      { id: 609681, media_type: "movie" }, // The Marvels
      { id: 138501, media_type: "tv" }, // Agatha All Along
    ],
  },
  {
    id: "star-wars",
    name: "Star Wars Saga",
    overview: "A long time ago in a galaxy far, far away... The epic Skywalker saga and surrounding stories in chronological order.",
    backdrop_path: "/ziECpBRIyclmBNaFSWlvCfsKbMD.jpg", // Return of the Jedi backdrop
    poster_path: "/jQYlydvHm3kUix1f8prMucrplhm.jpg", // Return of the Jedi poster
    items: [
      { id: 1893, media_type: "movie" }, // The Phantom Menace
      { id: 1894, media_type: "movie" }, // Attack of the Clones
      { id: 12180, media_type: "movie" }, // The Clone Wars (Movie)
      { id: 4194, media_type: "tv" }, // The Clone Wars (TV)
      { id: 1895, media_type: "movie" }, // Revenge of the Sith
      { id: 348350, media_type: "movie" }, // Solo
      { id: 92830, media_type: "tv" }, // Obi-Wan
      { id: 83867, media_type: "tv" }, // Andor
      { id: 330459, media_type: "movie" }, // Rogue One
      { id: 11, media_type: "movie" }, // A New Hope
      { id: 1891, media_type: "movie" }, // The Empire Strikes Back
      { id: 1892, media_type: "movie" }, // Return of the Jedi
      { id: 82856, media_type: "tv" }, // The Mandalorian
      { id: 115036, media_type: "tv" }, // Book of Boba Fett
      { id: 140607, media_type: "movie" }, // The Force Awakens
      { id: 181808, media_type: "movie" }, // The Last Jedi
      { id: 181812, media_type: "movie" }, // The Rise of Skywalker
    ],
  },
  {
    id: "lotr",
    name: "Middle-earth Saga",
    overview: "The complete journey through Middle-earth, from the Second Age to the destruction of the One Ring.",
    backdrop_path: "/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg", // Return of the King backdrop
    poster_path: "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg", // Return of the king poster
    items: [
      { id: 84773, media_type: "tv" }, // Rings of Power
      { id: 49051, media_type: "movie" }, // Hobbit 1
      { id: 57158, media_type: "movie" }, // Hobbit 2
      { id: 122917, media_type: "movie" }, // Hobbit 3
      { id: 120, media_type: "movie" }, // LOTR 1
      { id: 121, media_type: "movie" }, // LOTR 2
      { id: 122, media_type: "movie" }, // LOTR 3
    ],
  },
  {
    id: "godfather",
    name: "The Godfather Trilogy",
    overview: "The epic tale of the Corleone family, chronicling their rise to power and the tragic consequences of their deeply flawed American dream.",
    backdrop_path: "/tmU7GeKVybMWFButWEGl2M4GeiP.jpg", // Godfather backdrop
    poster_path: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // Godfather poster
    items: [
      { id: 238, media_type: "movie" }, // Godfather 1
      { id: 240, media_type: "movie" }, // Godfather 2
      { id: 242, media_type: "movie" }, // Godfather 3 (assuming 242, actually let's verify Godfather 3 ID: 242)
    ],
  },
  {
    id: "fast-furious",
    name: "The Fast Saga",
    overview: "The high-octane franchise centered on illegal street racing, heists, spies, and family.",
    backdrop_path: "/4XM8DUTQb3lhLemJC51Jx4a2EuA.jpg",
    poster_path: "/fiVW06jE7z9YnO4trhaMEdclSiC.jpg",
    items: [
      { id: 9799, media_type: "movie" }, // The Fast and the Furious
      { id: 584, media_type: "movie" }, // 2 Fast 2 Furious
      { id: 9615, media_type: "movie" }, // Tokyo Drift
      { id: 13804, media_type: "movie" }, // Fast & Furious
      { id: 51497, media_type: "movie" }, // Fast Five
      { id: 82992, media_type: "movie" }, // Fast & Furious 6
      { id: 168259, media_type: "movie" }, // Furious 7
      { id: 337339, media_type: "movie" }, // The Fate of the Furious
      { id: 384018, media_type: "movie" }, // Hobbs & Shaw
      { id: 385128, media_type: "movie" }, // F9
      { id: 385687, media_type: "movie" }, // Fast X
    ],
  },
  {
    id: "avatar",
    name: "Avatar (Movies)",
    overview: "James Cameron's visually stunning sci-fi epic set on the alien moon of Pandora.",
    backdrop_path: "/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg",
    poster_path: "/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
    items: [
      { id: 19995, media_type: "movie" }, // Avatar (19995 is the actual ID for Avatar 1)
      { id: 76600, media_type: "movie" }, // Avatar: The Way of Water
      { id: 83533, media_type: "movie" }, // Avatar: Fire and Ash
    ],
  },
  {
    id: "avatar-tla",
    name: "Avatar: The Last Airbender",
    overview: "The epic animated journey of the Avatar, mastering the elements to bring balance to the world.",
    backdrop_path: "/xUB3xFMgsHgPmdWnUWkHTJ03vHa.jpg",
    poster_path: "/yaGt4GIutpbXHsv48tWceWg6s56.jpg",
    items: [
      { id: 246, media_type: "tv" }, // Avatar: The Last Airbender (Original Animated Series)
      { id: 33880, media_type: "tv" }, // The Legend of Korra
      { id: 82452, media_type: "tv" }, // Netflix Live Action
    ],
  }
];
