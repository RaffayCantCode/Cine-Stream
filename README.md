# StreamVault 🎬

StreamVault is a full-featured streaming platform for movies, TV shows, anime, and manga. Built with Next.js 15 and deployed on Vercel.

![StreamVault Banner](https://via.placeholder.com/1200x400/1a1a2e/6366f1?text=StreamVault)

## ✨ Features

### Entertainment Hub
- 🎬 **Movies** - Browse popular, top-rated, trending movies from TMDB
- 📺 **TV Shows** - Stream TV series with episode selection
- 🇯🇵 **Anime** - Japanese anime with sub/dub options
- 📚 **Manga** - Read manga online via MangaDex

### User Experience
- 🔍 **Search** - Find any movie, show, anime, or manga
- 👤 **User Accounts** - Sign up/login with email or OAuth (Google)
- 📊 **Watch History** - Track what you've watched
- ⏭️ **Continue Watching** - Pick up where you left off
- 🗑️ **Remove Items** - Clear items from your continue list
- 📱 **Responsive Design** - Works on mobile, tablet, and desktop

### Streaming
- Multiple streaming sources for reliability
- Auto-fallback if one source fails
- English subtitles where available

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
| **MangaDex API** | Manga Data |
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
│   │   ├── manga/             # Manga pages
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
- **MangaDex** - Manga metadata and covers (mangadex.org)
- **Jikan** - Anime metadata (jikan.moe)
- **Streaming Sources** - VidSrc, 2Embed, VidKing, VidSrc.in

## ⚠️ Disclaimer

StreamVault is for educational purposes only. All content is provided by third-party sources. Please support the original creators by purchasing or subscribing to their services when possible.

## 📄 License

MIT License - feel free to use this for your own projects!

---

Made with ❤️ using Next.js 15
