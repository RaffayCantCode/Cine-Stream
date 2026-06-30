import Link from "next/link";
import { Film, Tv, Sparkles, Star, Clapperboard, Globe, ChevronRight } from "lucide-react";

const portalCards = [
  {
    title: "Cinema",
    subtitle: "Movies",
    description: "Blockbusters, indie darlings, timeless classics — the big screen experience at home.",
    icon: Film,
    href: "/browse/movies",
    gradient: "from-[#111844] via-[#1a2268] to-[#4B5694]",
    borderColor: "border-[#4B5694]/50",
    accentColor: "bg-[#4B5694]",
  },
  {
    title: "Series",
    subtitle: "TV Shows",
    description: "Binge-worthy seasons, gripping dramas, and laugh-out-loud comedies.",
    icon: Tv,
    href: "/browse/tv",
    gradient: "from-[#111844] via-[#1e2a50] to-[#7288AE]",
    borderColor: "border-[#7288AE]/50",
    accentColor: "bg-[#7288AE]",
  },
  {
    title: "Anime",
    subtitle: "JP Dub + Eng Sub",
    description: "Japanese audio, English subtitles — from classics to seasonal hits.",
    icon: Sparkles,
    href: "/anime",
    gradient: "from-[#111844] via-[#2a2244] to-[#EAE0CF]",
    borderColor: "border-[#EAE0CF]/30",
    accentColor: "bg-[#EAE0CF]",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6 md:px-12">
        <div className="max-w-screen-2xl mx-auto w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo-icon.svg" alt="CineStream" className="w-9 h-9" />
            <span className="font-bold text-xl tracking-wider">
              <span className="text-[#EAE0CF]">CINE</span>
              <span className="bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] bg-clip-text text-transparent">STREAM</span>
            </span>
          </Link>
          <Link
            href="/"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-[#EAE0CF] text-sm font-bold hover:shadow-lg hover:shadow-[#4B5694]/30 transition-all"
          >
            Start Browsing
          </Link>
        </div>
      </nav>

      {/* ─── UNIVERSE PORTAL ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111844] via-[#111844]/80 to-background pointer-events-none" />
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-[#4B5694]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-[#7288AE]/5 rounded-full blur-[120px]" />

        <div className="relative w-full px-6 md:px-12 max-w-screen-2xl mx-auto pt-28 pb-20">
          <div className="flex flex-col lg:flex-row lg:items-end gap-10 lg:gap-20 mb-14">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-10 h-[2px] bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] rounded-full" />
                <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#7288AE]">All in one place</span>
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05]">
                <span className="text-[#EAE0CF]">Movies.</span>
                <br />
                <span className="text-[#EAE0CF]">TV.</span>
                <br />
                <span className="bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] bg-clip-text text-transparent">Anime.</span>
              </h1>
              <p className="text-[#7288AE] text-lg md:text-xl mt-5 font-medium leading-relaxed max-w-lg">
                All in one place. Stream everything you love — curated, premium, and always fresh.
              </p>
              <div className="flex items-center gap-4 mt-7">
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#7288AE]/60">
                  <Clapperboard className="w-4 h-4" />
                  <span>10K+ Titles</span>
                </div>
                <div className="w-px h-4 bg-[#7288AE]/20" />
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#7288AE]/60">
                  <Star className="w-4 h-4" />
                  <span>Curated</span>
                </div>
                <div className="w-px h-4 bg-[#7288AE]/20" />
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#7288AE]/60">
                  <Globe className="w-4 h-4" />
                  <span>HD Quality</span>
                </div>
              </div>
              <div className="mt-8 flex items-center gap-4">
                <Link
                  href="/"
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-[#EAE0CF] font-bold text-sm hover:shadow-xl hover:shadow-[#4B5694]/30 transition-all"
                >
                  Start Exploring
                </Link>
                <Link
                  href="/anime"
                  className="px-8 py-3.5 rounded-xl border border-[#7288AE]/30 text-[#EAE0CF]/80 font-bold text-sm hover:border-[#7288AE]/60 hover:text-[#EAE0CF] transition-all"
                >
                  Browse Anime
                </Link>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-[#EAE0CF]/20">
              {[...Array(3)].map((_, i) => (
                <span key={i} className="text-3xl font-black" style={{ opacity: 0.6 - i * 0.15 }}>✦</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {portalCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group relative overflow-hidden rounded-2xl border transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]"
                style={{ borderColor: "rgba(114, 136, 174, 0.15)" }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-80`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/[0.04] to-transparent rounded-bl-full" />

                <div className="relative p-7 md:p-8">
                  <div className={`w-12 h-12 rounded-xl ${card.accentColor}/20 border ${card.borderColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <card.icon className="w-6 h-6 text-[#EAE0CF]" />
                  </div>
                  <h3 className="text-xl font-black text-[#EAE0CF] mb-0.5">{card.title}</h3>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-[#7288AE]/80 mb-3">{card.subtitle}</p>
                  <p className="text-sm text-[#7288AE]/70 leading-relaxed mb-5 line-clamp-2">{card.description}</p>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#EAE0CF]/80 group-hover:text-[#EAE0CF] transition-colors">
                    <span>Explore</span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative border-t border-[#7288AE]/20 py-10">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-12 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="CineStream" className="w-7 h-7 opacity-90" />
            <span className="text-base font-black tracking-widest text-white/90">
              CINE<span className="text-primary">STREAM</span>
            </span>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <p className="text-xs sm:text-sm text-white/70 font-semibold tracking-wide">
              Movies. TV. Anime. All in one place.
            </p>
            <p className="text-[10px] sm:text-xs text-[#7288AE]/80 max-w-md px-4 font-medium leading-relaxed">
              CineStream does not host any media, it only provides media from open sources!
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
