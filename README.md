# CineStream 🎬

CineStream is a full-featured streaming platform for movies, TV shows, anime, and manga. Built with Next.js 15 and deployed on Vercel.

<img width="1920" height="920" alt="1" src="https://github.com/user-attachments/assets/a1568e8b-91da-4300-9824-722f7328f50e" />

---

## ✨ Features

### Entertainment Hub
- 🎬 **Movies** - Browse popular, top-rated, trending movies from TMDB
- 📺 **TV Shows** - Stream TV series with episode selection
- 🇯🇵 **Anime** - Japanese anime with sub/dub options

### User Experience
- 🔍 **Search** - Find any movie, show, anime, or manga
- 👤 **User Accounts** - Sign up/login with email or OAuth (Google)
- 📊 **Watch History** - Track what you've watched
- ⏭️ **Continue Watching** - Pick up where you left off
- 🗑️ **Remove Items** - Clear items from your continue list
- 📱 **Responsive Design** - Works on mobile, tablet, and desktop


<img width="1908" height="917" alt="3" src="https://github.com/user-attachments/assets/9e95443f-5348-4f5b-86bd-8bdf29032ef3" />

---

### Streaming
- Multiple streaming sources for reliability
- Auto-fallback if one source fails
- English subtitles where available


<img width="1908" height="923" alt="2" src="https://github.com/user-attachments/assets/a1773ced-df97-4776-b397-d1acf5dd0b09" />


---

### Anime Streaming (Japanese Dub With English Subtitles)
- Multiple streaming sources for reliability
- Auto-fallback if one source fails
- Currently in work!


<img width="1897" height="918" alt="4" src="https://github.com/user-attachments/assets/8d187927-b04a-4263-a337-2ca6cac34344" />

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | Framework |
| **React 19** | UI Library |
| **TypeScript** | Type Safety |
| **Tailwind CSS** | Styling |
| **NextAuth.js** | Authentication |
| **Drizzle ORM** | Database |
| **Vercel Postgres** | Database |
| **Framer Motion** | Animations |
| **TMDB API** | Movie/TV Data |
| **Jikan API** | Anime Metadata |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Vercel account (for deployment)
- TMDB API key (free from themoviedb.org)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/stream-vault.git
cd stream-vault

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your credentials
# Required: TMDB_API_KEY, POSTGRES_URL, NEXTAUTH_SECRET

# Run database migrations
npm run db:migrate

# Start the dev server
npm run dev
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Connect your GitHub repository
2. Add the required environment variables in Vercel dashboard:
   - `TMDB_API_KEY` - Get from [TMDB](https://www.themoviedb.org/settings/api)
   - `POSTGRES_URL` - Add Vercel Postgres from the Storage tab
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your Vercel project URL
3. Deploy!

## 📁 Project Structure

```
stream-vault/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── anime/         # Anime API
│   │   │   ├── manga/         # Manga API
│   │   │   ├── tmdb/          # Movie/TV API
│   │   │   └── auth/          # Authentication
│   │   ├── anime/             # Anime pages
│   │   ├── movie/             # Movie detail pages
│   │   ├── tv/                # TV show pages
│   │   └── ...
│   ├── components/             # React components
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── VideoPlayer.tsx    # Movie/TV player
│   │   ├── AnimePlayer.tsx    # Anime player
│   │   └── ...
│   └── lib/                   # Utilities & APIs
│       ├── streaming-fetch.ts # Movie/TV sources
│       ├── anime-embed.ts     # Anime sources
│       ├── jikan-fetch.ts     # Anime metadata
│       └── mangadex-fetch.ts  # Manga API
├── public/                     # Static assets
└── .env.local                  # Environment variables
```

## 📝 API Credits

- **TMDB** - Movie and TV show data (themoviedb.org)
- **Jikan** - Anime metadata (jikan.moe)
- **Streaming Sources** - VidSrc, 2Embed, VidKing, VidSrc.in

## ⚠️ Disclaimer

CineStream is for educational purposes only. All content is provided by third-party sources. Please support the original creators by purchasing or subscribing to their services when possible.

## 📄 License

MIT License - feel free to use this for your own projects!

---

Made with ❤️ using Next.js 15
