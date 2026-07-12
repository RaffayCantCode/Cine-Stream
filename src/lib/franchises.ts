export interface FranchiseItem {
  id: number;
  media_type: "movie" | "tv" | "anime";
  tmdb_type?: "movie" | "tv";
  anilist_id?: number;
  title?: string;
  release_date?: string;
  poster_path?: string;
}

export interface FranchiseGroup {
  name: string;
  items: FranchiseItem[];
}

export interface FranchiseDefinition {
  id: string;
  name: string;
  overview: string;
  backdrop_path: string;
  poster_path: string;
  items?: FranchiseItem[];
  groups?: FranchiseGroup[];
}

export const FRANCHISES: FranchiseDefinition[] = [
  {
    id: "marvel",
    name: "Marvel Cinematic Universe",
    overview: "The complete chronological timeline of the Marvel Cinematic Universe, spanning from the origins of the first Avenger to the multiverse saga.",
    backdrop_path: "/9BBTo63ANSmhC4e6r62OJFuK2GL.jpg", // Avengers backdrop
    poster_path: "/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg", // Avengers poster
    items: [
      { id: 241388, media_type: "tv" }, // Eyes of Wakanda
      { id: 1771, media_type: "movie" }, // Captain America: The First Avenger

      { id: 61550, media_type: "tv" }, // Agent Carter
      { id: 299537, media_type: "movie" }, // Captain Marvel
      { id: 1726, media_type: "movie" }, // Iron Man
      { id: 10138, media_type: "movie" }, // Iron Man 2
      { id: 1724, media_type: "movie" }, // The Incredible Hulk

      { id: 10195, media_type: "movie" }, // Thor
      { id: 24428, media_type: "movie" }, // The Avengers

      { id: 1403, media_type: "tv" }, // Agents of S.H.I.E.L.D.
      { id: 76338, media_type: "movie" }, // Thor: The Dark World
      { id: 68721, media_type: "movie" }, // Iron Man 3

      { id: 100402, media_type: "movie" }, // Captain America: The Winter Soldier
      { id: 118340, media_type: "movie" }, // Guardians of the Galaxy
      { id: 283995, media_type: "movie" }, // Guardians of the Galaxy Vol. 2
      { id: 232125, media_type: "tv" }, // I Am Groot
      { id: 61889, media_type: "tv" }, // Daredevil
      { id: 38472, media_type: "tv" }, // Jessica Jones
      { id: 99861, media_type: "movie" }, // Avengers: Age of Ultron
      { id: 62126, media_type: "tv" }, // Luke Cage
      { id: 102899, media_type: "movie" }, // Ant-Man
      { id: 62127, media_type: "tv" }, // Iron Fist
      { id: 271110, media_type: "movie" }, // Captain America: Civil War

      { id: 497698, media_type: "movie" }, // Black Widow
      { id: 62285, media_type: "tv" }, // The Defenders
      { id: 284052, media_type: "movie" }, // Doctor Strange
      { id: 284054, media_type: "movie" }, // Black Panther
      { id: 69088, media_type: "tv" }, // Agents of S.H.I.E.L.D.: Slingshot
      { id: 315635, media_type: "movie" }, // Spider-Man: Homecoming
      { id: 284053, media_type: "movie" }, // Thor: Ragnarok

      { id: 68716, media_type: "tv" }, // Inhumans
      { id: 67178, media_type: "tv" }, // The Punisher
      { id: 67466, media_type: "tv" }, // Runaways
      { id: 66190, media_type: "tv" }, // Cloak & Dagger
      { id: 363088, media_type: "movie" }, // Ant-Man and the Wasp
      { id: 299536, media_type: "movie" }, // Avengers: Infinity War
      { id: 299534, media_type: "movie" }, // Avengers: Endgame
      { id: 84958, media_type: "tv" }, // Loki
      { id: 91363, media_type: "tv" }, // What If...?
      { id: 138505, media_type: "tv" }, // Marvel Zombies
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
      { id: 114471, media_type: "tv" }, // Ironheart
      { id: 894205, media_type: "movie" }, // Werewolf by Night
      { id: 774752, media_type: "movie" }, // The Guardians of the Galaxy Holiday Special
      { id: 640146, media_type: "movie" }, // Ant-Man and The Wasp: Quantumania
      { id: 447365, media_type: "movie" }, // Guardians of the Galaxy Vol. 3
      { id: 114472, media_type: "tv" }, // Secret Invasion
      { id: 609681, media_type: "movie" }, // The Marvels
      { id: 138501, media_type: "tv" }, // Agatha All Along
      { id: 202555, media_type: "tv" }, // Daredevil: Born Again
      { id: 822119, media_type: "movie" }, // Captain America: Brave New World
      { id: 986056, media_type: "movie" }, // Thunderbolts*
      { id: 617126, media_type: "movie" }, // The Fantastic Four: First Steps
      { id: 198178, media_type: "tv" }, // Wonder Man
      { id: 1439930, media_type: "movie" } // The Punisher: One Last Kill
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
    name: "Lord of the Rings Saga",
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
    poster_path: "/zOCnMPoUxgJK1RFPfN4PcnT16gr.jpg",
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
  },

  {
    id: "naruto",
    name: "Naruto (Japanese Dub)",
    overview: "The complete journey of Naruto Uzumaki, from a mischievous ninja student to the Seventh Hokage.",
    backdrop_path: "/5F0HVEgkgP99fEWDjPyikGt9jQi.jpg",
    poster_path: "/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    items: [
      { id: 46260, media_type: "anime", anilist_id: 20 }, // Naruto
      { id: 31910, media_type: "anime", anilist_id: 1735 }, // Naruto Shippuden
      { id: 70881, media_type: "anime", anilist_id: 97938 }, // Boruto
    ],
  },
  {
    id: "mission-impossible",
    name: "Mission: Impossible Franchise",
    overview: "Ethan Hunt and the IMF team embark on their most dangerous missions yet, saving the world from catastrophic threats.",
    backdrop_path: "/5jnoAA74Qwb5w6B9FMvnc20n6Ie.jpg",
    poster_path: "/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg",
    items: [
      { id: 954, media_type: "movie" }, // Mission: Impossible
      { id: 955, media_type: "movie" }, // Mission: Impossible II
      { id: 956, media_type: "movie" }, // Mission: Impossible III
      { id: 56292, media_type: "movie" }, // Mission: Impossible - Ghost Protocol
      { id: 177677, media_type: "movie" }, // Mission: Impossible - Rogue Nation
      { id: 353081, media_type: "movie" }, // Mission: Impossible - Fallout
      { id: 575264, media_type: "movie" }, // Mission: Impossible - Dead Reckoning Part One
      { id: 575265, media_type: "movie" }, // Mission: Impossible - The Final Reckoning
    ],
  },
  {
    id: "james-bond",
    name: "James Bond Collection",
    overview: "The legendary spy film series based on Ian Fleming’s novels, following MI6 agent 007, James Bond.",
    backdrop_path: "/dOSECZImeyZldoq0ObieBE0lwie.jpg",
    poster_path: "/ofwSiqOFShhunAIYYdSMHMJQSx2.jpg",
    groups: [
      {
        name: "Daniel Craig Era",
        items: [
          { id: 36557, media_type: "movie" }, // Casino Royale
          { id: 10764, media_type: "movie" }, // Quantum of Solace
          { id: 37724, media_type: "movie" }, // Skyfall
          { id: 206647, media_type: "movie" }, // Spectre
          { id: 370172, media_type: "movie" }, // No Time to Die
        ]
      },
      {
        name: "Previous Bond Films",
        items: [
          { id: 646, media_type: "movie" }, // Dr. No
          { id: 657, media_type: "movie" }, // From Russia with Love
          { id: 658, media_type: "movie" }, // Goldfinger
          { id: 660, media_type: "movie" }, // Thunderball
          { id: 667, media_type: "movie" }, // You Only Live Twice
          { id: 668, media_type: "movie" }, // On Her Majesty's Secret Service
          { id: 681, media_type: "movie" }, // Diamonds Are Forever
          { id: 253, media_type: "movie" }, // Live and Let Die
          { id: 682, media_type: "movie" }, // The Man with the Golden Gun
          { id: 691, media_type: "movie" }, // The Spy Who Loved Me
          { id: 698, media_type: "movie" }, // Moonraker
          { id: 699, media_type: "movie" }, // For Your Eyes Only
          { id: 700, media_type: "movie" }, // Octopussy
          { id: 707, media_type: "movie" }, // A View to a Kill
          { id: 708, media_type: "movie" }, // The Living Daylights
          { id: 709, media_type: "movie" }, // Licence to Kill
          { id: 710, media_type: "movie" }, // GoldenEye
          { id: 714, media_type: "movie" }, // Tomorrow Never Dies
          { id: 36643, media_type: "movie" }, // The World Is Not Enough
          { id: 36669, media_type: "movie" }, // Die Another Day
        ]
      }
    ]
  }
,
  {
    id: "harry-potter",
    name: "Harry Potter Collection",
    overview: "The complete story of the Boy Who Lived and the Wizarding World, from Harry's years at Hogwarts to Newt Scamander's adventures.",
    backdrop_path: "/kmEsQL2vOTA0jnM28fXS45Ky8kX.jpg",
    poster_path: "/eVPs2Y0LyvTLZn6AP5Z6O2rtiGB.jpg",
    groups: [
      {
        name: "The Original Series",
        items: [
          { id: 671, media_type: "movie" },
          { id: 672, media_type: "movie" },
          { id: 673, media_type: "movie" },
          { id: 674, media_type: "movie" },
          { id: 675, media_type: "movie" },
          { id: 767, media_type: "movie" },
          { id: 12444, media_type: "movie" },
          { id: 12445, media_type: "movie" },
        ]
      },
      {
        name: "Fantastic Beasts",
        items: [
          { id: 259316, media_type: "movie" },
          { id: 338952, media_type: "movie" },
          { id: 338953, media_type: "movie" },
        ]
      }
    ]
  },
  {
    id: "incredibles",
    name: "The Incredibles Collection",
    overview: "The adventures of a family of former superheroes rediscovering their powers and saving the world.",
    backdrop_path: "/6oi6V1O9MJRNnfV8E9JMntmFqBD.jpg",
    poster_path: "/l7GqbzkJwowYRIXAtUz2iCPi64a.jpg",
    items: [
      { id: 9806, media_type: "movie" },
      { id: 260513, media_type: "movie" },
    ]
  },
  {
    id: "batman",
    name: "Batman Collection",
    overview: "The complete cinematic journey of Gotham's Dark Knight across different eras and actors.",
    backdrop_path: "/xyhrCEdB4XRkelfVsqXeUZ6rLHi.jpg",
    poster_path: "/ogyw5LTmL53dVxsppcy8Dlm30Fu.jpg",
    groups: [
      {
        name: "Classic Batman",
        items: [
          { id: 268, media_type: "movie" }, // Batman (1989)
          { id: 364, media_type: "movie" }, // Batman Returns
          { id: 414, media_type: "movie" }, // Batman Forever
          { id: 415, media_type: "movie" }, // Batman & Robin
        ]
      },
      {
        name: "The Dark Knight Trilogy",
        items: [
          { id: 272, media_type: "movie" }, // Batman Begins
          { id: 155, media_type: "movie" }, // The Dark Knight
          { id: 49026, media_type: "movie" }, // The Dark Knight Rises
        ]
      },
      {
        name: "The Batman",
        items: [
          { id: 414906, media_type: "movie" }, // The Batman
        ]
      }
    ]
  },
  {
    id: "spiderman",
    name: "Spider-Man Collection",
    overview: "The spectacular cinematic adventures of the friendly neighborhood Spider-Man.",
    backdrop_path: "/zQ8AxTPiCiS5nnwXpwTBPBHSaa5.jpg",
    poster_path: "/kjdJntyBeEvqm9w97QGBdxPptzj.jpg",
    groups: [
      {
        name: "Tobey Maguire",
        items: [
          { id: 557, media_type: "movie" }, // Spider-Man
          { id: 558, media_type: "movie" }, // Spider-Man 2
          { id: 559, media_type: "movie" }, // Spider-Man 3
        ]
      },
      {
        name: "The Amazing Spider-Man",
        items: [
          { id: 1930, media_type: "movie" }, // TASM
          { id: 102382, media_type: "movie" }, // TASM 2
        ]
      },
      {
        name: "Tom Holland (MCU)",
        items: [
          { id: 315635, media_type: "movie" }, // Homecoming
          { id: 429617, media_type: "movie" }, // Far From Home
          { id: 634649, media_type: "movie" }, // No Way Home
        ]
      },
      {
        name: "Spider-Verse",
        items: [
          { id: 324857, media_type: "movie" }, // Into the Spider-Verse
          { id: 569094, media_type: "movie" }, // Across the Spider-Verse
        ]
      }
    ]
  },
  {
    id: "jurassic-park",
    name: "Jurassic Park Collection",
    overview: "A thrilling saga where resurrected dinosaurs roam once again, bringing awe and terror to the modern world.",
    backdrop_path: "/njFixYzIxX8jsn6KMSEtAzi4avi.jpg",
    poster_path: "/qIm2nHXLpBBdMxi8dvfrnDkBUDh.jpg",
    groups: [
      {
        name: "Original Trilogy",
        items: [
          { id: 329, media_type: "movie" },
          { id: 330, media_type: "movie" },
          { id: 331, media_type: "movie" },
        ]
      },
      {
        name: "Jurassic World",
        items: [
          { id: 135397, media_type: "movie" },
          { id: 351286, media_type: "movie" },
          { id: 507086, media_type: "movie" },
          { id: 1234821, media_type: "movie" },
        ]
      }
    ]
  },
  {
    id: "pirates-of-the-caribbean",
    name: "Pirates of the Caribbean Collection",
    overview: "The swashbuckling adventures of Captain Jack Sparrow across the seven seas.",
    backdrop_path: "/wxgD3fB5lQ2sGJLog0rvXW049Pf.jpg",
    poster_path: "/zRBaZxS5YauLvRYjAdL4AUCwlht.jpg",
    items: [
      { id: 22, media_type: "movie" },
      { id: 58, media_type: "movie" },
      { id: 285, media_type: "movie" },
      { id: 1865, media_type: "movie" },
      { id: 166426, media_type: "movie" },
    ]
  },
  {
    id: "hunger-games",
    name: "The Hunger Games Collection",
    overview: "Katniss Everdeen's fight for survival and rebellion against the Capitol in the dystopian nation of Panem.",
    backdrop_path: "/Ipp7cegtub4t0mu7xaKLQkYoGc.jpg",
    poster_path: "/cEBNDEMGqvSvU0knEv9Wl3dk5kv.jpg",
    items: [
      { id: 70160, media_type: "movie" },
      { id: 101299, media_type: "movie" },
      { id: 131631, media_type: "movie" },
      { id: 131634, media_type: "movie" },
      { id: 695721, media_type: "movie" },
    ]
  },
  {
    id: "shrek",
    name: "Shrek Collection",
    overview: "The fairytale adventures of a grumpy ogre, his talking donkey, and a princess with a secret.",
    backdrop_path: "/lhsd1zCsq5UquvcNalmhuddV3tI.jpg",
    poster_path: "/qNHZMe92A7Pyl46qUH29hVOtbSK.jpg",
    groups: [
      {
        name: "Main Films",
        items: [
          { id: 808, media_type: "movie" },
          { id: 809, media_type: "movie" },
          { id: 810, media_type: "movie" },
          { id: 10192, media_type: "movie" },
        ]
      },
      {
        name: "Puss in Boots",
        items: [
          { id: 417859, media_type: "movie" },
          { id: 315162, media_type: "movie" },
        ]
      }
    ]
  },
  {
    id: "cars",
    name: "Cars Collection",
    overview: "Lightning McQueen's high-speed adventures from arrogant rookie to veteran racer.",
    backdrop_path: "/A8DqaTGwZ8iCEjWMNRsZumzfKLw.jpg",
    poster_path: "/uq3N2SFj1Y06zA6LzCQPkmBdaaE.jpg",
    items: [
      { id: 920, media_type: "movie" },
      { id: 49013, media_type: "movie" },
      { id: 260514, media_type: "movie" },
    ]
  },
  {
    id: "john-wick",
    name: "John Wick Collection",
    overview: "The legendary hitman John Wick is pulled back into the criminal underworld, taking on the world's top assassins.",
    backdrop_path: "/fSwYa5q2xRkBoOOjueLpkLf3N1m.jpg",
    poster_path: "/sm7rZZivZm2NhJDucFf3gpfFdVt.jpg",
    items: [
      { id: 245891, media_type: "movie" },
      { id: 324552, media_type: "movie" },
      { id: 458156, media_type: "movie" },
      { id: 603692, media_type: "movie" },
      { id: 541671, media_type: "movie", title: "Ballerina" },
    ]
  },
  {
    id: "godzilla",
    name: "Godzilla (MonsterVerse)",
    overview: "The epic cinematic universe pitting humanity against the titans, focusing on Godzilla and Kong.",
    backdrop_path: "/psZ5CETZoaq2VRnxk95HuxOnI5D.jpg",
    poster_path: "/inNN466SKHNjbGmpfhfsaPQNleS.jpg",
    items: [
      { id: 124905, media_type: "movie" },
      { id: 293167, media_type: "movie" },
      { id: 373571, media_type: "movie" },
      { id: 399566, media_type: "movie" },
      { id: 823464, media_type: "movie" },
    ]
  },
  {
    id: "planet-of-the-apes",
    name: "Planet of the Apes (Reboot) Collection",
    overview: "The rise of genetically enhanced apes and their conflict with humanity for the future of Earth.",
    backdrop_path: "/iMhm0g555HgQNIXAMvnlgOiW5Rz.jpg",
    poster_path: "/afGkMC4HF0YtXYNkyfCgTDLFe6m.jpg",
    items: [
      { id: 61791, media_type: "movie" },
      { id: 119450, media_type: "movie" },
      { id: 281338, media_type: "movie" },
      { id: 653346, media_type: "movie" },
    ]
  },
  {
    id: "attack-on-titan",
    name: "Attack on Titan (Japanese Dub)",
    overview: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.",
    backdrop_path: "/rqbCbjB19amtOtFQbb3K2lgm2zv.jpg",
    poster_path: "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    items: [
      { id: 1429, media_type: "anime", anilist_id: 16498, title: "Attack on Titan (Season 1)", release_date: "2013-04-07" },
      { id: 1429, media_type: "anime", anilist_id: 20958, title: "Attack on Titan (Season 2)", release_date: "2017-04-01" },
      { id: 1429, media_type: "anime", anilist_id: 99147, title: "Attack on Titan (Season 3)", release_date: "2018-07-23" },
      { id: 1429, media_type: "anime", anilist_id: 104578, title: "Attack on Titan (Season 3 Part 2)", release_date: "2019-04-29" },
      { id: 1429, media_type: "anime", anilist_id: 110277, title: "Attack on Titan (Final Season)", release_date: "2020-12-07" },
      { id: 1429, media_type: "anime", anilist_id: 131681, title: "Attack on Titan (Final Season Part 2)", release_date: "2022-01-10" },
      { id: 1429, media_type: "anime", anilist_id: 146984, title: "Attack on Titan (The Final Chapters Special 1)", release_date: "2023-03-04" },
      { id: 1429, media_type: "anime", anilist_id: 162314, title: "Attack on Titan (The Final Chapters Special 2)", release_date: "2023-11-05" },
    ]
  },
  {
    id: "game-of-thrones",
    name: "Game of Thrones Universe",
    overview: "The epic fantasy series based on George R.R. Martin's A Song of Ice and Fire.",
    backdrop_path: "/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg",
    poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    items: [
      { id: 1399, media_type: "tv", title: "Game of Thrones" },
      { id: 94997, media_type: "tv", title: "House of the Dragon" },
      { id: 224372, media_type: "tv", title: "A Knight of the Seven Kingdoms" },
    ]
  },
  {
    id: "demon-slayer",
    name: "Demon Slayer Collection",
    overview: "Follow Tanjiro Kamado's journey to become a Demon Slayer and save his sister.",
    backdrop_path: "/3GQKYh6Trm8pxd2AypovoYQf4Ay.jpg",
    poster_path: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    items: [
      { id: 85937, media_type: "anime", anilist_id: 101922, title: "Demon Slayer: Season 1", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg" },
      { id: 635302, media_type: "anime", anilist_id: 112151, title: "Mugen Train (Movie)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx112151-1qlQwPB1RrJe.png" },
      { id: 85937, media_type: "anime", anilist_id: 129874, title: "Mugen Train Arc", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx129874-g6ZKXB94Hui1.jpg" },
      { id: 85937, media_type: "anime", anilist_id: 142329, title: "Entertainment District Arc", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx142329-kET1PIXJv2eW.jpg" },
      { id: 85937, media_type: "anime", anilist_id: 145117, title: "Swordsmith Village Arc", poster_path: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx145117-Ifr7hYCRldjr.jpg" },
      { id: 85937, media_type: "anime", anilist_id: 166240, title: "Hashira Training Arc", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166240-PBV7zukIHW7V.png" },
    ]
  },
  {
    id: "jujutsu-kaisen",
    name: "Jujutsu Kaisen Collection",
    overview: "Yuji Itadori joins a secret organization of Jujutsu Sorcerers to eliminate a powerful Curse.",
    backdrop_path: "/lthkKBLe1rX6iThgVFg22O02sJw.jpg",
    poster_path: "/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg",
    items: [
      { id: 95479, media_type: "anime", anilist_id: 113415, title: "Jujutsu Kaisen Season 1", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg" },
      { id: 810693, media_type: "anime", anilist_id: 131573, title: "Jujutsu Kaisen 0 (Movie)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131573-rpl82vDEDRm6.jpg" },
      { id: 95479, media_type: "anime", anilist_id: 145064, title: "Jujutsu Kaisen Season 2", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-hSNRJM03pvv1.jpg" },
      { id: 95479, media_type: "anime", anilist_id: 172463, title: "Jujutsu Kaisen Season 3", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx172463-LnXqHzt74SJL.jpg" },
    ]
  },
  {
    id: "breaking-bad",
    name: "Breaking Bad Universe",
    overview: "The critically acclaimed saga of Walter White and Jimmy McGill.",
    backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    poster_path: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
    items: [
      { id: 1396, media_type: "tv" },
      { id: 559969, media_type: "movie", title: "El Camino: A Breaking Bad Movie" },
      { id: 60059, media_type: "tv" },
    ]
  },
  {
    id: "indiana-jones",
    name: "Indiana Jones Collection",
    overview: "The globe-trotting archaeological adventures of Dr. Henry \"Indiana\" Jones Jr.",
    backdrop_path: "/zPACwR32amTNvzId9qyapCWXYDJ.jpg",
    poster_path: "/ceG9VzoRAVGwivFU403Wc3AHRys.jpg",
    items: [
      { id: 85, media_type: "movie" },
      { id: 87, media_type: "movie" },
      { id: 89, media_type: "movie" },
      { id: 217, media_type: "movie" },
      { id: 335977, media_type: "movie" },
    ]
  },
  {
    id: "transformers",
    name: "Transformers Collection",
    overview: "The war between the heroic Autobots and the evil Decepticons.",
    backdrop_path: "/iCDMBi6WLjUBnt24dNwHqqF81UL.jpg",
    poster_path: "/4N4sipl8T72tNE4earcctQa2Kw2.jpg",
    items: [
      { id: 1858, media_type: "movie" },
      { id: 8373, media_type: "movie" },
      { id: 37834, media_type: "movie" },
      { id: 91314, media_type: "movie" },
      { id: 335988, media_type: "movie" },
      { id: 424783, media_type: "movie" },
      { id: 667538, media_type: "movie" },
      { id: 698687, media_type: "movie" }, // Transformers One
    ]
  },
  {
    id: "rocky",
    name: "Rocky Collection",
    overview: "The inspiring story of Philadelphia boxer Rocky Balboa.",
    backdrop_path: "/xUZ2G8MRGEljqgqLxMJItK4iHfY.jpg",
    poster_path: "/aYtBYWqCdUqcnoodWJdcTG3pFev.jpg",
    items: [
      { id: 1366, media_type: "movie" },
      { id: 1367, media_type: "movie" },
      { id: 1371, media_type: "movie" },
      { id: 1374, media_type: "movie" },
      { id: 1375, media_type: "movie" },
      { id: 1246, media_type: "movie" },
    ]
  },
  {
    id: "creed",
    name: "Creed Collection",
    overview: "Adonis Creed's journey to forge his own legacy in the boxing world.",
    backdrop_path: "/kODNw6GJNdgldUMEhKPlCw8wQCr.jpg",
    poster_path: "/1BfTsk5VWuw8FCocAhCyqnRbEzq.jpg",
    items: [
      { id: 312221, media_type: "movie" },
      { id: 480530, media_type: "movie" },
      { id: 677179, media_type: "movie" },
    ]
  },
  {
    id: "kung-fu-panda",
    name: "Kung Fu Panda Collection",
    overview: "The adventures of Po, the clumsiest panda who must fulfill an ancient prophecy.",
    backdrop_path: "/qdthf9WrRDSaIkGVQGhhJ9pz1hn.jpg",
    poster_path: "/wWt4JYXTg5Wr3xBW2phBrMKgp3x.jpg",
    items: [
      { id: 9502, media_type: "movie" },
      { id: 49444, media_type: "movie" },
      { id: 140300, media_type: "movie" },
      { id: 1011985, media_type: "movie" },
    ]
  },
  {
    id: "how-to-train-your-dragon",
    name: "How to Train Your Dragon Collection",
    overview: "Hiccup and Toothless unite vikings and dragons in an epic adventure.",
    backdrop_path: "/59vDC1BuEQvti24OMr0ZvtAK6R1.jpg",
    poster_path: "/ygGmAO60t8GyqUo9xYeYxSZAR3b.jpg",
    items: [
      { id: 10191, media_type: "movie" },
      { id: 82702, media_type: "movie" },
      { id: 166428, media_type: "movie" },
    ]
  },
  {
    id: "ice-age",
    name: "Ice Age Collection",
    overview: "A misfit herd of prehistoric animals go on hilarious adventures.",
    backdrop_path: "/8pwIhymsxfAVjrAE7syDjQULn37.jpg",
    poster_path: "/gLhHHZUzeseRXShoDyC4VqLgsNv.jpg",
    items: [
      { id: 425, media_type: "movie" },
      { id: 950, media_type: "movie" },
      { id: 8355, media_type: "movie" },
      { id: 57800, media_type: "movie" },
      { id: 278154, media_type: "movie" },
    ]
  },
  {
    id: "despicable-me",
    name: "Despicable Me Collection",
    overview: "The story of Gru, his adopted daughters, and the mischievous Minions.",
    backdrop_path: "/2XSeKDmIa2KxaiJy4J9e8FrIZhk.jpg",
    poster_path: "/b1BT309QWjtFUlJPLmXmrcHOWEL.jpg",
    items: [
      { id: 20352, media_type: "movie" },
      { id: 93456, media_type: "movie" },
      { id: 324852, media_type: "movie" },
      { id: 519182, media_type: "movie" },
    ]
  },
  {
    id: "minions",
    name: "Minions Collection",
    overview: "The prequel adventures of the yellow, gibberish-speaking Minions.",
    backdrop_path: "/wKrxeY6lbu7KFBsWVcMH6M8avwr.jpg",
    poster_path: "/dr02BdCNAUPVU07aOodwPYv6HCf.jpg",
    items: [
      { id: 211672, media_type: "movie" },
      { id: 438148, media_type: "movie" },
    ]
  },
  {
    id: "toy-story",
    name: "Toy Story Collection",
    overview: "The adventures of Woody, Buzz Lightyear, and their toy friends as they navigate the challenges of growing up.",
    backdrop_path: "/3Rfvhy1Nl6sSGJwyjb0QiZzZYlB.jpg",
    poster_path: "/uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg",
    items: [
      { id: 862, media_type: "movie", title: "Toy Story" },
      { id: 863, media_type: "movie", title: "Toy Story 2" },
      { id: 10193, media_type: "movie", title: "Toy Story 3" },
      { id: 301528, media_type: "movie", title: "Toy Story 4" },
    ]
  },
  {
    id: "dune",
    name: "Dune Collection",
    overview: "The epic saga of Paul Atreides and the desert planet of Arrakis.",
    backdrop_path: "/zRKQW58MBEY078AxkHxEJzUskCl.jpg",
    poster_path: "/gDzOcq0pfeCeqMBwKIJlSmQpjkZ.jpg",
    items: [
      { id: 90228, media_type: "tv", title: "Dune: Prophecy" },
      { id: 438631, media_type: "movie", title: "Dune: Part One" },
      { id: 693134, media_type: "movie", title: "Dune: Part Two" },
    ]
  },
  {
    id: "jojo",
    name: "JoJo's Bizarre Adventure",
    overview: "The multi-generational saga of the Joestar family, who are possessed with intense psychic strength, and the adventures each member encounters.",
    backdrop_path: "/mLKN1dsimKPiXCZ48KED0X8a02t.jpg",
    poster_path: "/ogAWwbh3frWtiTyyXrZaVFtqCgp.jpg",
    items: [
      { id: 45790, media_type: "anime", anilist_id: 14719, title: "Phantom Blood & Battle Tendency (Part 1 & 2)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx14719-VT5dRzTBSZ0w.jpg" },
      { id: 45790, media_type: "anime", anilist_id: 20474, title: "Stardust Crusaders (Part 3)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20474-xuqem5GBlBtb.jpg" },
      { id: 45790, media_type: "anime", anilist_id: 20799, title: "Stardust Crusaders - Battle in Egypt", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20799-S1eyqBDlx51E.jpg" },
      { id: 45790, media_type: "anime", anilist_id: 21450, title: "Diamond is Unbreakable (Part 4)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21450-D7XFwEQjZ5GA.jpg" },
      { id: 45790, media_type: "anime", anilist_id: 102883, title: "Golden Wind (Part 5)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx102883-S9KzdMJhDswJ.png" },
      { id: 45790, media_type: "anime", anilist_id: 131942, title: "Stone Ocean (Part 6)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131942-rermlZ9lplHX.png" },
    ]
  },
  {
    id: "fate-series",
    name: "Fate Anime Series",
    overview: "The epic Fate universe, exploring the Holy Grail Wars where mages summon heroic spirits from history to battle for their deepest wishes. Listed in chronological watch order.",
    backdrop_path: "/b2mskN6F9kUolFc8mTBiEJwfXLC.jpg",
    poster_path: "/x7nYPOveHhINREhTtwBHot9ersB.jpg",
    items: [
      { id: 45845, media_type: "anime", anilist_id: 10087, title: "Fate/Zero (Season 1)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx10087-M4Hd9qrHGrXk.png" },
      { id: 45845, media_type: "anime", anilist_id: 11741, title: "Fate/Zero (Season 2)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11741-oEy1fJHYm2zJ.jpg" },
      { id: 37858, media_type: "anime", anilist_id: 356, title: "Fate/stay night (2006)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx356-mTpMvtillumS.png" },
      { id: 61415, media_type: "anime", anilist_id: 19603, title: "Unlimited Blade Works (Season 1)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19603-ycT0pyEgDVQu.jpg" },
      { id: 61415, media_type: "anime", anilist_id: 20792, title: "Unlimited Blade Works (Season 2)", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20792-Q53sZsUAh5FF.jpg" },
      { id: 441130, media_type: "anime", tmdb_type: "movie", anilist_id: 20791, title: "Heaven's Feel I. presage flower", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20791-yPCX5GJuMH2k.png" },
      { id: 530254, media_type: "anime", tmdb_type: "movie", anilist_id: 21718, title: "Heaven's Feel II. lost butterfly", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21718-Hjj26Sapx1bd.jpg" },
      { id: 556973, media_type: "anime", tmdb_type: "movie", anilist_id: 21719, title: "Heaven's Feel III. spring song", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21719-MSdTlkno0Z0u.jpg" },
      { id: 72304, media_type: "anime", anilist_id: 98035, title: "Fate/Apocrypha", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx98035-rdkjeqUUsG2j.jpg" },
      { id: 90677, media_type: "anime", anilist_id: 103275, title: "Fate/Grand Order: Babylonia", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx103275-SN0wwshS3tWA.jpg" },
      { id: 219816, media_type: "anime", anilist_id: 154966, title: "Fate/strange Fake", poster_path: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154966-eQRCmSrCh96j.png" },
    ]
  },
  {
    id: "the-matrix",
    name: "The Matrix Collection",
    overview: "Welcome to the Desert of the Real. The groundbreaking sci-fi franchise that challenged our perception of reality.",
    backdrop_path: "/bRm2DEgUiYciDw3myHuYFInD7la.jpg",
    poster_path: "/bV9qTVHTVf0gkW0j7p7M0ILD4pG.jpg",
    items: [
      { id: 603, media_type: "movie", title: "The Matrix" },
      { id: 604, media_type: "movie", title: "The Matrix Reloaded" },
      { id: 605, media_type: "movie", title: "The Matrix Revolutions" },
      { id: 624860, media_type: "movie", title: "The Matrix Resurrections" }
    ]
  },
  {
    id: "twilight-saga",
    name: "The Twilight Saga",
    overview: "The epic romance of a teenage girl and a vampire, based on the bestselling novels by Stephenie Meyer.",
    backdrop_path: "/3be0BffeZTyMbj4Ndzo6Y877SBQ.jpg",
    poster_path: "/3PlBwwizkPDZITeIPUlXQCejeQD.jpg",
    items: [
      { id: 1587, media_type: "movie", title: "Twilight" },
      { id: 18239, media_type: "movie", title: "The Twilight Saga: New Moon" },
      { id: 24021, media_type: "movie", title: "The Twilight Saga: Eclipse" },
      { id: 41233, media_type: "movie", title: "The Twilight Saga: Breaking Dawn - Part 1" },
      { id: 82690, media_type: "movie", title: "The Twilight Saga: Breaking Dawn - Part 2" }
    ]
  }
];
