export const runtime = 'edge';
import Link from "next/link";
import { Film, Tv, Sparkles, Star, Clapperboard, Globe, ChevronRight } from "lucide-react";

const portalCards = [
  {
    title: "Cinema",
    subtitle: "Blockbusters & Classics",
    description: "Indie darlings, Hollywood blockbusters, and timeless cinematic masterpieces.",
    icon: Film,
    href: "/browse/movies",
    badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    accentGlow: "group-hover:border-rose-500/40",
  },
  {
    title: "Series",
    subtitle: "TV Shows & Originals",
    description: "Binge-worthy seasons, gripping dramas, and iconic TV series.",
    icon: Tv,
    href: "/browse/tv",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    accentGlow: "group-hover:border-emerald-500/40",
  },
  {
    title: "Anime",
    subtitle: "JP Sub & Eng Dub",
    description: "Japanese audio, English subtitles — seasonal hits and legendary series.",
    icon: Sparkles,
    href: "/anime",
    badgeColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    accentGlow: "group-hover:border-purple-500/40",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080E] text-white overflow-x-hidden font-sans">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-20 flex items-center px-6 md:px-12 bg-[#07080E]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-screen-2xl mx-auto w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="CineStream" className="w-9 h-9 drop-shadow-[0_0_12px_rgba(124,58,237,0.4)]" />
            <span className="font-black text-xl tracking-wider">
              <span className="text-white">CINE</span>
              <span className="text-white">STREAM</span>
            </span>
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-full bg-white text-black text-xs md:text-sm font-extrabold hover:bg-white/90 hover:shadow-lg hover:shadow-white/10 transition-all"
          >
            Start Browsing
          </Link>
        </div>
      </nav>

      {/* ─── HERO PORTAL ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-28 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#07080E] to-[#07080E] pointer-events-none" />
        <div className="absolute top-1/4 left-10 w-[450px] h-[450px] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative w-full px-6 md:px-12 max-w-screen-2xl mx-auto z-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-14">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-white/70">
                  Unified Streaming Vault
                </span>
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] drop-shadow-md">
                <span className="text-white">Movies.</span>
                <br />
                <span className="text-white/90">TV.</span>
                <br />
                <span className="text-white">Anime.</span>
              </h1>
              <p className="text-white/60 text-base md:text-xl mt-6 font-medium leading-relaxed max-w-xl">
                Stream everything in one place. Curated, ultra-fast, zero bloat, and always free.
              </p>
              <div className="flex flex-wrap items-center gap-6 mt-8">
                <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-white/50">
                  <Clapperboard className="w-4 h-4 text-rose-400" />
                  <span>10K+ Movies</span>
                </div>
                <div className="w-px h-4 bg-white/15" />
                <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-white/50">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span>Top Rated</span>
                </div>
                <div className="w-px h-4 bg-white/15" />
                <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-white/50">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Full HD</span>
                </div>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/"
                  className="px-8 py-3.5 rounded-full bg-white text-black font-extrabold text-sm hover:bg-white/90 hover:shadow-xl hover:shadow-white/10 transition-all"
                >
                  Explore Catalog →
                </Link>
                <Link
                  href="/anime"
                  className="px-8 py-3.5 rounded-full bg-white/[0.06] border border-white/15 text-white/90 font-bold text-sm hover:bg-white/10 hover:border-white/30 transition-all"
                >
                  Browse Anime
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portalCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`group relative overflow-hidden rounded-xl border border-white/10 bg-card/80 p-8 transition-all duration-300 hover:scale-[1.02] hover:bg-card/95 shadow-[0_12px_32px_rgba(0,0,0,0.65)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.9)] sheen-wrapper ${card.accentGlow}`}
              >
                <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                  <div>
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 ${card.badgeColor}`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-1 tracking-tight">{card.title}</h3>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-white/40 mb-3">{card.subtitle}</p>
                    <p className="text-sm text-white/60 font-medium leading-relaxed">{card.description}</p>
                  </div>
                  <div className="mt-6 flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-white/80 group-hover:text-white transition-colors">
                    <span>Enter Vault</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative border-t border-white/[0.08] py-12 bg-[#05060B]">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="CineStream" className="w-7 h-7 opacity-90" />
            <span className="text-lg font-black tracking-wider text-[#D3D1CE]">
              CINE<span className="text-[#B3B7BA]">STREAM</span>
            </span>
          </div>
          <p className="text-xs text-white/50 font-medium max-w-md leading-relaxed">
            Movies. TV. Anime. All in one place. CineStream does not host any files locally.
          </p>
        </div>
      </footer>
    </div>
  );
}
