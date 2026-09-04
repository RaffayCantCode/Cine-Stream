# CineStream 🎬
CineStream is a full-featured streaming and reading platform for movies, TV shows, anime, and manga. Built with Next.js 15 and deployed on Cloudflare Pages / Vercel.

<img width="1920" height="920" alt="1" src="https://github.com/user-attachments/assets/b623ac2b-f97b-4af0-ac95-c3489e041355" />

---
## ✨ Features
### Entertainment & Reading Hub
- 🎬 **Movies** - Browse popular, top-rated, trending movies from TMDB
- 📺 **TV Shows** - Stream TV series with season and episode selection
- 🇯🇵 **Anime** - Japanese anime with sub/dub streaming options
- 📖 **Manga & Manhwa** - Extensive library of Manga, Manhwa, and Manhua with an interactive reader
### User Experience
- 🔍 **Unified Search** - Quickly find any movie, TV show, anime, manga, or manhwa
- 👤 **User Accounts** - Sign up / login with email or OAuth (Google)
- 📊 **Watch & Read History** - Track what you have watched and read
- ⏭️ **Continue Watching & Reading** - Pick up right where you left off
- 🗑️ **Library Management** - Easily clear items from your continue lists
- 📱 **Responsive Design** - Optimized for mobile, tablet, and desktop screens


---
### 🎥 Movie & TV Streaming
- Multiple streaming sources for high availability
- Automatic failover if a source is unreachable
- English subtitles and captions where available
<img width="1908" height="916" alt="2" src="https://github.com/user-attachments/assets/821e2cce-e435-420a-99a9-acc66e48734a" />


---
### 🎌 Anime Streaming (Japanese Audio with English Subtitles)
- Multiple dedicated anime streaming engines
- Comprehensive episode selectors and anime metadata
- Auto-fallback between sources
<img width="1920" height="923" alt="6" src="https://github.com/user-attachments/assets/c5d51ffe-e4a0-4c47-8d55-980945e7679b" />

---
### 📖 Manga & Manhwa Reader
- 📚 **Massive Library** - Read popular Manga, Korean Manhwa, and Chinese Manhua
- 👓 **Reader Experience** - High-resolution chapter viewer with smooth page transitions
- 📑 **Chapter Navigation** - Full chapter lists with release history and scanlation details
- 🔖 **Reading Progress Tracking** - Automatically saves current chapter and position
  <img width="1909" height="913" alt="3" src="https://github.com/user-attachments/assets/572a2f8c-d34a-4036-bc5d-e647d726c0e5" />

  
---

## 🛠️ Tech Stack
| Technology | Purpose |
|------------|---------|
| **Next.js 15** | Full-Stack React Framework |
| **React 19** | Modern UI Library |
| **TypeScript** | Strict Type Safety |
| **Tailwind CSS** | Responsive Styling |
| **NextAuth.js** | Authentication & Sessions |
| **Drizzle ORM** | Database ORM & Migrations |
| **Cloudflare D1 / Postgres** | Database Layer |
| **Framer Motion** | UI Animations & Transitions |
| **TMDB API** | Movie & TV Show Metadata |
| **Jikan API** | Anime Metadata |
| **Manga Engines** | Manga & Manhwa Chapter Fetching |
---
<img width="1901" height="911" alt="4" src="https://github.com/user-attachments/assets/8ea9902b-b5a0-4872-92a8-08440d18c8e7" />

## 🚀 Getting Started
### Prerequisites
- Node.js 18+
- TMDB API key (free from themoviedb.org)
- Database credentials (Postgres or Cloudflare D1)
### Local Development
```bash
# Clone the repository
git clone https://github.com/RaffayCantCode/Cine-Stream.git
cd Cine-Stream
# Install dependencies
npm install
# Copy environment file
cp .env.example .env.local
# Edit .env.local with your credentials
# Required: TMDB_API_KEY, POSTGRES_URL / DB bindings, NEXTAUTH_SECRET
# Run database migrations
npm run db:migrate
# Start the dev server
npm run dev

📁 Project Structure
Cine-Stream/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # Backend API endpoints
│   │   │   ├── anime/         # Anime streaming endpoints
│   │   │   ├── manga/         # Manga & Manhwa API
│   │   │   ├── tmdb/          # Movie & TV show endpoints
│   │   │   └── auth/          # NextAuth endpoints
│   │   ├── anime/             # Anime pages
│   │   ├── manga/             # Manga discovery & reader pages
│   │   │   ├── [id]/          # Manga details
│   │   │   │   └── read/      # Interactive chapter reader
│   │   │   └── continue-reading/
│   │   ├── movie/             # Movie detail pages
│   │   ├── tv/                # TV show detail pages
│   │   └── ...
│   ├── components/             # Reusable UI components
│   │   ├── manga/             # MangaCard, Reader, and related UI
│   │   ├── VideoPlayer.tsx    # Movie & TV player
│   │   ├── AnimePlayer.tsx    # Anime player
│   │   └── ...
│   └── lib/                   # Data fetching engines & helpers
│       ├── streaming-fetch.ts # Movie & TV sources
│       ├── anime-embed.ts     # Anime stream sources
│       ├── jikan-fetch.ts     # Anime metadata
│       ├── manga-fetch.ts     # Manga/Manhwa fetching engine
│       └── manga-history.ts   # Reading progress storage
├── public/                    # Static assets & icons
└── wrangler.toml              # Cloudflare configuration

📝 API Credits
TMDB - Movie and TV show metadata (themoviedb.org)
Jikan - Anime metadata (jikan.moe)
Manga Sources - WeebCentral & Asura Scans
Streaming Sources - All embed sources

⚠️ Disclaimer
CineStream is for educational purposes only. All video and reading content is retrieved from third-party sources. Please support original creators and publishers by purchasing licensed media and subscribing to official services.

📄 License
MIT License - feel free to use this for your own projects!

Made with ❤️ using Next.js 15
