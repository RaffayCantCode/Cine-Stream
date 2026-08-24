"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Film,
  Tv,
  Sparkles,
  BookOpen,
  Zap,
  Shield,
  Star,
  Play,
  CheckCircle2,
  ChevronRight,
  Smartphone,
  Server,
  ArrowRight,
  ChevronDown,
  Palette,
  Clock,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { animate, stagger } from "animejs";

// ─── 5 STREAMING SOURCES DATA (GENERIC SOURCE 1 - 5) ────────────────────────
const MOVIE_SOURCES = [
  {
    id: "source-1",
    name: "Source 1",
    label: "Primary Cluster",
    tag: "Recommended",
    tagColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    latency: "14ms",
    reliability: "99.8%",
    quality: "1080p Full HD",
    description: "Primary ultra-high bitrate cluster with edge acceleration for instant movie starts.",
    outageReason: "Simulated ISP Block / Connection Timeout",
  },
  {
    id: "source-2",
    name: "Source 2",
    label: "High-Speed Node",
    tag: "Ultra-Fast",
    tagColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    latency: "18ms",
    reliability: "99.5%",
    quality: "1080p FHD",
    description: "High-speed redundant nodes optimized for bufferless high definition playback.",
    outageReason: "Simulated CDN Server Congestion (1400ms)",
  },
  {
    id: "source-3",
    name: "Source 3",
    label: "Bufferless Mirror",
    tag: "Low Latency",
    tagColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    latency: "22ms",
    reliability: "99.2%",
    quality: "1080p FHD",
    description: "Dedicated bufferless mirror with multi-audio and multilingual subtitle sync.",
    outageReason: "Simulated Geo-Restriction / Gateway Error",
  },
  {
    id: "source-4",
    name: "Source 4",
    label: "Resilient Gateway",
    tag: "Stable Backup",
    tagColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    latency: "28ms",
    reliability: "98.9%",
    quality: "1080p / 720p",
    description: "Resilient secondary gateway ensuring comprehensive subtitle availability.",
    outageReason: "Simulated Upstream Maintenance",
  },
  {
    id: "source-5",
    name: "Source 5",
    label: "Universal Fallback",
    tag: "Guardian Node",
    tagColor: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40",
    latency: "32ms",
    reliability: "99.9%",
    quality: "1080p FHD",
    description: "Global fallback cluster guaranteeing that your stream stays active no matter what.",
    outageReason: null,
  },
];

const ANIME_SOURCES = [
  {
    id: "anime-source-1",
    name: "Source 1",
    label: "Broadcast Core",
    tag: "Recommended",
    tagColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    latency: "12ms",
    reliability: "99.9%",
    quality: "1080p 60FPS",
    description: "Native Japanese broadcast stream with lightning fast English subtitles.",
    outageReason: "Simulated Broadcast Server Offline",
  },
  {
    id: "anime-source-2",
    name: "Source 2",
    label: "Japanese Sub Node",
    tag: "JP Sub",
    tagColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    latency: "16ms",
    reliability: "99.6%",
    quality: "1080p FHD",
    description: "Original Japanese audio paired with crisp, synchronized English subtitles.",
    outageReason: "Simulated Audio Track Buffer Timeout",
  },
  {
    id: "anime-source-3",
    name: "Source 3",
    label: "Simulcast Mirror",
    tag: "Fast Buffer",
    tagColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    latency: "20ms",
    reliability: "99.1%",
    quality: "1080p FHD",
    description: "Direct stream link with zero buffering and seasonal episode pre-fetch.",
    outageReason: "Simulated Rate Limit Exhaustion",
  },
  {
    id: "anime-source-4",
    name: "Source 4",
    label: "Uncut / Special Cut",
    tag: "OVA & Movies",
    tagColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    latency: "26ms",
    reliability: "98.7%",
    quality: "1080p FHD",
    description: "Includes special OVAs, uncut theatrical editions, and remastered classics.",
    outageReason: "Simulated Transcoding Packet Loss",
  },
  {
    id: "anime-source-5",
    name: "Source 5",
    label: "Universal Anime Fallback",
    tag: "Guardian Node",
    tagColor: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40",
    latency: "30ms",
    reliability: "99.9%",
    quality: "1080p FHD",
    description: "Global anime fallback cluster ensuring uninterrupted binge watching.",
    outageReason: null,
  },
];

// ─── THEMES DATA ────────────────────────────────────────────────────────────
const THEMES_SHOWCASE = [
  {
    name: "Liquid Glass",
    slug: "theme-glass",
    tagline: "Translucent Refraction & Ambient Glows",
    border: "border-sky-500/40",
    bg: "from-sky-950/40 via-purple-950/30 to-[#07080E]",
    badge: "bg-sky-500/20 text-sky-300",
    accent: "#38bdf8",
  },
  {
    name: "OLED Midnight",
    slug: "theme-oled",
    tagline: "True Pure Black (#000000) & High Contrast",
    border: "border-zinc-700/60",
    bg: "from-black via-zinc-950 to-black",
    badge: "bg-zinc-800 text-zinc-300",
    accent: "#f43f5e",
  },
  {
    name: "Cinema Gold",
    slug: "theme-cinema",
    tagline: "Velvet Crimson & Lustrous Golden Radiance",
    border: "border-amber-500/40",
    bg: "from-rose-950/40 via-amber-950/30 to-[#07080E]",
    badge: "bg-amber-500/20 text-amber-300",
    accent: "#f59e0b",
  },
  {
    name: "Wisteria Bloom",
    slug: "theme-wisteria",
    tagline: "Electric Violet & Magenta Pink Aurora",
    border: "border-purple-500/40",
    bg: "from-purple-950/50 via-fuchsia-950/30 to-[#07080E]",
    badge: "bg-purple-500/20 text-purple-300",
    accent: "#c084fc",
  },
  {
    name: "Lemon Solaris",
    slug: "theme-solaris",
    tagline: "Zesty Sun Gold & Warm Amber Glow",
    border: "border-yellow-500/40",
    bg: "from-yellow-950/40 via-amber-950/30 to-[#07080E]",
    badge: "bg-yellow-500/20 text-yellow-300",
    accent: "#eab308",
  },
];

// ─── FAQ DATA ───────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is Cine-Stream and is it completely free?",
    a: "Cine-Stream is an all-in-one cinematic vault that allows you to stream thousands of Movies, TV Shows, Anime series, and read Manga completely free with zero subscription requirements, zero paywalls, and zero invasive popups.",
  },
  {
    q: "How does the 5-Source streaming system guarantee 0 dead links?",
    a: "Every single movie and anime connects to 5 independent server clusters (Source 1 through Source 5). If any 4 sources encounter regional blocks, latency, or outages, the remaining active source immediately takes over with 0 interruption.",
  },
  {
    q: "Are anime series available in Japanese with English Subtitles?",
    a: "Yes! The Anime player provides authentic Japanese audio with high-precision English subtitles (JP Sub), fully integrated with AniList for episode guides and seasonal simulcasts.",
  },
  {
    q: "Does Cine-Stream support progress tracking and watchlists?",
    a: "Yes! Cine-Stream features automatic Continue Watching tracking and a personal Watchlist system. You can pick up any movie, TV episode, or anime right where you left off across your sessions.",
  },
  {
    q: "Can I install Cine-Stream as an app on my phone or tablet?",
    a: "Yes! Cine-Stream is a Progressive Web App (PWA). You can tap 'Add to Home Screen' in Safari on iOS or Chrome on Android/Desktop to launch Cine-Stream as a standalone fullscreen app.",
  },
  {
    q: "Is Cine-Stream really built and maintained by just 1 person?",
    a: "Yes! Cine-Stream is engineered, designed, and maintained entirely by a solo developer ('R') as a passion project for movie lovers and anime fans worldwide.",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const devSectionRef = useRef<HTMLDivElement>(null);

  // States
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<"movies" | "anime">("movies");
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [isOutageSimulated, setIsOutageSimulated] = useState(false);
  const [activeThemeIndex, setActiveThemeIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pingPulse, setPingPulse] = useState(false);

  // ─── CONTINUOUS SCROLL GAUGE TRACKER ─────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ─── ANIME.JS INITIAL LOAD & CONTINUOUS SCROLL-TRIGGERED ANIMATIONS ──────
  useEffect(() => {
    try {
      // 1. Initial Hero Stagger Reveal
      animate(".anime-hero-stagger", {
        translateY: [40, 0],
        opacity: [0, 1],
        delay: stagger(90, { start: 150 }),
        duration: 850,
        ease: "outQuad",
      });

      // 2. Floating Hero Preview Cards
      animate(".anime-card-float", {
        translateY: [50, 0],
        opacity: [0, 1],
        scale: [0.96, 1],
        delay: stagger(130, { start: 450 }),
        duration: 950,
        ease: "outQuad",
      });

      // 3. Ambient Floating Glow Orbs Loop
      animate(".anime-glow-orb", {
        translateY: [-18, 18],
        translateX: [-12, 12],
        scale: [1, 1.1],
        duration: 5500,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      });

      // 4. Floating 3D Micro-Physics for Hero Cards
      animate(".anime-hover-card-1", {
        translateY: [-6, 6],
        duration: 4000,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      });

      animate(".anime-hover-card-2", {
        translateY: [6, -6],
        duration: 4600,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      });

      animate(".anime-hover-card-3", {
        translateY: [-8, 8],
        duration: 5000,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      });

      // 5. Golden Signature Shimmer Pulse
      animate(".anime-gold-signature", {
        filter: [
          "drop-shadow(0 0 10px rgba(255, 215, 0, 0.4))",
          "drop-shadow(0 0 25px rgba(255, 215, 0, 0.8))",
          "drop-shadow(0 0 10px rgba(255, 215, 0, 0.4))",
        ],
        duration: 3200,
        loop: true,
        ease: "inOutSine",
      });

      // 6. Intersection Observer for Scroll Storytelling
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const targets = entry.target.querySelectorAll(".anime-scroll-reveal");
              if (targets.length > 0) {
                animate(targets, {
                  translateY: [35, 0],
                  opacity: [0, 1],
                  delay: stagger(100),
                  duration: 800,
                  ease: "outQuad",
                });
              }
            }
          });
        },
        { threshold: 0.15 }
      );

      document.querySelectorAll(".scroll-scene").forEach((el) => observer.observe(el));

      return () => observer.disconnect();
    } catch (e) {
      console.error("Anime.js scroll anim error", e);
    }
  }, []);

  // ─── SOURCE SWITCHER & OUTAGE SIMULATION ANIMATIONS ───────────────────────
  const handleSourceSelect = (index: number) => {
    setSelectedSourceIndex(index);
    setPingPulse(true);
    setTimeout(() => setPingPulse(false), 500);

    try {
      animate(".anime-source-display", {
        scale: [0.97, 1],
        opacity: [0.6, 1],
        duration: 300,
        ease: "outQuad",
      });
    } catch {}
  };

  const toggleOutageSimulation = () => {
    const nextState = !isOutageSimulated;
    setIsOutageSimulated(nextState);

    // If simulating outage, lock onto Source 5 (the surviving savior source)
    if (nextState) {
      setSelectedSourceIndex(4);
    }

    try {
      // Animate shockwave / status switch
      animate(".anime-outage-banner", {
        scale: [0.95, 1.02, 1],
        opacity: [0, 1],
        duration: 500,
        ease: "outQuad",
      });

      animate(".anime-source-pill", {
        translateX: [-10, 0],
        delay: stagger(60),
        duration: 400,
        ease: "outQuad",
      });
    } catch {}
  };

  const currentSources = activeCategory === "movies" ? MOVIE_SOURCES : ANIME_SOURCES;
  const currentSelectedSource = currentSources[selectedSourceIndex] || currentSources[0];

  return (
    <div className="min-h-screen bg-[#07080E] text-[#EAE0CF] overflow-x-hidden font-sans selection:bg-purple-500/30 selection:text-white">
      {/* ─── KINETIC SCROLL PROGRESS GAUGE (Top of Page) ─── */}
      <div className="fixed top-0 inset-x-0 z-50 h-[3px] bg-white/[0.05] pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(168,85,247,0.8)]"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* ─── AMBIENT BACKGROUND GLOW LIGHTS ─── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="anime-glow-orb absolute -top-40 left-1/4 w-[600px] h-[600px] bg-purple-900/15 rounded-full blur-[160px]" />
        <div className="anime-glow-orb absolute top-1/3 -right-20 w-[500px] h-[500px] bg-indigo-900/15 rounded-full blur-[150px]" />
        <div className="anime-glow-orb absolute top-2/3 left-10 w-[550px] h-[550px] bg-rose-900/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* ─── TOP NAVIGATION ─── */}
      <nav className="fixed top-0 inset-x-0 z-40 h-[calc(4.75rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center px-4 sm:px-8 md:px-12 bg-[#07080E]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img
                src="/logo-icon.svg"
                alt="CineStream"
                className="w-9 h-9 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
              />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="font-black text-xl tracking-wider text-white">
              CINE<span className="bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">STREAM</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-7 text-xs font-bold tracking-wider uppercase text-white/70">
            <a href="#overview" className="hover:text-white transition-colors">Overview</a>
            <a href="#movies" className="hover:text-white transition-colors">Movies</a>
            <a href="#tv" className="hover:text-white transition-colors">TV Series</a>
            <a href="#anime" className="hover:text-white transition-colors">Anime & Manga</a>
            <a href="#sources" className="hover:text-white transition-colors flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              5 Sources Demo
            </a>
            <a href="#themes" className="hover:text-white transition-colors">Themes</a>
            <a href="#solo-dev" className="hover:text-amber-400 transition-colors flex items-center gap-1.5 text-amber-300 font-extrabold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Made by R
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="relative group overflow-hidden px-5 sm:px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-[length:200%_auto] hover:bg-right transition-[background-position] duration-500 text-white text-xs sm:text-sm font-black tracking-wide shadow-[0_0_25px_rgba(147,51,234,0.4)] hover:shadow-[0_0_35px_rgba(147,51,234,0.6)] flex items-center gap-2"
            >
              <span>Enter Vault</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── SCENE 1: HERO PORTAL & KINETIC ENTRANCE ─── */}
      <section ref={heroRef} id="overview" className="scroll-scene relative min-h-[92vh] flex items-center pt-32 pb-20 px-4 sm:px-8 md:px-12 z-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 flex flex-col items-start">
              {/* Live Status Badge */}
              <div className="anime-hero-stagger opacity-0 inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md mb-6 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-extrabold tracking-widest uppercase text-emerald-300">
                  5 Failover Sources Online
                </span>
                <span className="w-px h-3 bg-white/20" />
                <span className="text-[11px] font-bold text-white/60">100% Free & Ad-Free</span>
              </div>

              {/* Main Headline */}
              <h1 className="anime-hero-stagger opacity-0 text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.06] text-white">
                The Next-Gen <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent drop-shadow-sm">
                  Cinematic Vault.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="anime-hero-stagger opacity-0 text-white/70 text-base sm:text-lg md:text-xl font-medium mt-6 leading-relaxed max-w-2xl">
                Stream over <strong className="text-white font-bold">10,000+ Movies</strong>, binge full <strong className="text-white font-bold">TV Seasons</strong>, watch Japanese subbed <strong className="text-white font-bold">Anime</strong> with English subtitles, and read <strong className="text-white font-bold">Manga</strong> — powered by 5 redundant fallback sources so you never miss a moment.
              </p>

              {/* Feature Highlights Pills */}
              <div className="anime-hero-stagger opacity-0 flex flex-wrap items-center gap-3 sm:gap-4 mt-7 text-xs font-bold text-white/80">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                  <span>10K+ Movies</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                  <Tv className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Full TV Shows</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>JP Sub Anime</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                  <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                  <span>Manga Reader</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>5 Resilient Sources</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="anime-hero-stagger opacity-0 flex flex-wrap items-center gap-4 mt-9">
                <Link
                  href="/"
                  className="px-8 py-4 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Start Streaming Now</span>
                </Link>
                <a
                  href="#sources"
                  className="px-7 py-4 rounded-full bg-white/[0.06] border border-white/15 text-white/90 font-bold text-sm hover:bg-white/10 hover:border-white/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>Test 4-Outage Simulator</span>
                </a>
              </div>

              {/* Solo Dev Tribute Highlight */}
              <div className="anime-hero-stagger opacity-0 mt-8 flex items-center gap-3 text-xs text-white/60">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                <span>Handcrafted by 1 solo developer (R) • 0 ads • 100% free forever</span>
              </div>
            </div>

            {/* Right Column: Interactive 3D Floating Reel Preview */}
            <div ref={cardsRef} className="lg:col-span-5 relative flex flex-col items-center justify-center">
              {/* Back Card: TV Series */}
              <div className="anime-card-float anime-hover-card-1 opacity-0 w-full max-w-[340px] sm:max-w-[380px] rounded-2xl bg-zinc-900/90 border border-white/15 p-4 shadow-2xl backdrop-blur-xl -rotate-6 transform hover:rotate-0 transition-transform duration-500 z-10 mb-[-90px] mr-12">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1">
                    <Tv className="w-3 h-3" /> TV Show • S02 E08
                  </span>
                  <span className="flex items-center gap-1 text-xs font-black text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> 8.8
                  </span>
                </div>
                <div className="relative h-28 sm:h-32 rounded-xl overflow-hidden bg-zinc-800">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  <img
                    src="https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg"
                    alt="The Last of Us"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  <span className="absolute bottom-2 left-3 z-20 font-black text-sm tracking-wider text-white drop-shadow">THE LAST OF US</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
                  <span>Auto-Next Episode Ready</span>
                  <span className="text-emerald-400 font-bold">5 Sources Armed</span>
                </div>
              </div>

              {/* Middle Card: Blockbuster Movie (Front & Center) */}
              <div className="anime-card-float anime-hover-card-2 opacity-0 w-full max-w-[350px] sm:max-w-[400px] rounded-2xl bg-zinc-900/95 border border-purple-500/30 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-20 hover:scale-105 transition-all duration-300 sheen-wrapper">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[10px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
                    <Film className="w-3 h-3" /> Cinema • 1080p FHD
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-[10px] font-bold text-purple-300">
                    Source 1 Active
                  </span>
                </div>
                <div className="relative h-36 sm:h-40 rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/60 to-indigo-950/80">
                  <img
                    src="https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg"
                    alt="Dune: Part Two"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-400 font-black text-xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> 8.9
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-xl font-black text-white drop-shadow">Dune: Part Two</h3>
                    <p className="text-xs text-white/70 line-clamp-1 mt-0.5">Paul Atreides unites with Chani and the Fremen.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Stream Ready • 1080p FHD</span>
                  </div>
                  <Link
                    href="/"
                    className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-black hover:bg-white/90 transition-all flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-black" /> Watch
                  </Link>
                </div>
              </div>

              {/* Bottom/Right Card: Anime Hub */}
              <div className="anime-card-float anime-hover-card-3 opacity-0 w-full max-w-[340px] sm:max-w-[380px] rounded-2xl bg-zinc-900/90 border border-white/15 p-4 shadow-2xl backdrop-blur-xl rotate-6 transform hover:rotate-0 transition-transform duration-500 z-10 mt-[-70px] ml-12">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-[10px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Anime • JP Sub
                  </span>
                  <span className="text-[11px] font-bold text-sky-400">AniList Synced</span>
                </div>
                <div className="relative h-28 sm:h-32 rounded-xl overflow-hidden bg-zinc-800">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  <img
                    src="https://image.tmdb.org/t/p/w500/geCRueV3ElhRTr0xtJuEWJt6dJ1.jpg"
                    alt="Solo Leveling"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  <span className="absolute bottom-2 left-3 z-20 font-black text-sm tracking-wider text-white drop-shadow">SOLO LEVELING</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
                  <span>Episode 12 (JP Sub)</span>
                  <span className="text-purple-300 font-bold">English Subs Synced</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCENE 2: THE 6 CORE PILLARS GRID ─── */}
      <section className="scroll-scene relative py-24 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] bg-[#05060A]/80 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black tracking-widest uppercase text-purple-400 bg-purple-500/10 px-3.5 py-1.5 rounded-full border border-purple-500/20">
              Why Cine-Stream Exists
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 tracking-tight">
              Streaming Engineered for Pure Perfection.
            </h2>
            <p className="text-white/60 text-base sm:text-lg mt-4 font-medium">
              We took everything that frustrates people on other streaming platforms and solved it from the ground up.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="anime-scroll-reveal group rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-purple-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-lg hover:shadow-purple-500/10">
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">5-Source Failover Matrix</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Never get stuck with buffering or dead video links. Every single movie, TV episode, and anime connects to 5 high-speed redundant streaming servers (Source 1 through Source 5).
              </p>
            </div>

            {/* Feature 2 */}
            <div className="anime-scroll-reveal group rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-rose-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-lg hover:shadow-rose-500/10">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6 group-hover:scale-110 transition-transform">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">10,000+ Movies & TV Vault</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                From current theatrical blockbusters to timeless cinematic classics, explore curated franchise hubs, top-rated lists, and deep genre filters.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="anime-scroll-reveal group rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-sky-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-lg hover:shadow-sky-500/10">
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Anime & Manga Hub</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                AniList integration with seasonal broadcast schedules, authentic Japanese audio with English subtitles, and a built-in interactive Manga reader.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="anime-scroll-reveal group rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-amber-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-lg hover:shadow-amber-500/10">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Palette className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">5 Curated Visual Themes</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Choose your ideal viewing aesthetic: Liquid Glass, OLED True Black, Cinema Gold & Crimson, Wisteria Bloom, or Lemon Solaris.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="anime-scroll-reveal group rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-emerald-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-lg hover:shadow-emerald-500/10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Resume & Watchlist Sync</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Cine-Stream remembers exactly where you left off. Continue watching instantly on any screen with automatic timestamp and episode memorization.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="anime-scroll-reveal group rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-lg hover:shadow-indigo-500/10">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Installable PWA App</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Designed to run natively across all devices. Install Cine-Stream on iOS, Android, macOS, or Windows for a borderless fullscreen theater experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCENE 3: MOVIES & CINEMA DEEP DIVE ─── */}
      <section id="movies" className="scroll-scene relative py-28 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Info Column */}
            <div className="anime-scroll-reveal lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-black tracking-widest uppercase mb-6">
                <Film className="w-3.5 h-3.5" /> Cinema & Movies
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                From Hollywood Blockbusters to Underground Indie Gems.
              </h2>
              <p className="text-white/70 text-base sm:text-lg font-medium mt-6 leading-relaxed">
                Experience crystal clear 1080p Full HD streaming with deep metadata, cast filmographies, official trailer embeds, and curated collection franchises.
              </p>

              <div className="space-y-4 mt-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Curated Franchise Universes:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Explore the Marvel Cinematic Universe, Star Wars, Harry Potter, Batman, and Lord of the Rings.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Deep Cast & Crew Exploration:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Click on any actor or director to explore their entire filmography and biography.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">5 Redundant Video Sources:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Source 1 through Source 5 guarantee zero buffering and zero downtime.</span>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/browse/movies"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(225,29,72,0.4)] hover:shadow-[0_0_35px_rgba(225,29,72,0.6)] transition-all"
                >
                  <span>Explore Movies Catalog</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Visual Card */}
            <div className="anime-scroll-reveal lg:col-span-6">
              <div className="relative rounded-2xl bg-zinc-900/90 border border-white/10 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">Featured Movie Premiere</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-white/10 text-[11px] font-bold text-white/80">IMDb 8.9 / 10</span>
                </div>

                <div className="relative h-64 sm:h-72 rounded-xl overflow-hidden bg-zinc-900">
                  <img
                    src="https://image.tmdb.org/t/p/w1280/nb3xI8XI3w4pMVZ38VijbsyBqP4.jpg"
                    alt="Oppenheimer & Dune"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  <div className="relative z-10 p-5 sm:p-6 flex flex-col justify-end h-full">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1">Trending Worldwide</span>
                    <h3 className="text-2xl sm:text-3xl font-black text-white">Oppenheimer & Dune</h3>
                    <p className="text-xs text-white/80 mt-1.5 line-clamp-2">
                      Christopher Nolan's biographical masterpiece detailing the birth of the atomic age, streamed with HDR color grading.
                    </p>
                    <div className="flex items-center gap-2.5 mt-3.5">
                      <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase">1080p Full HD</span>
                      <span className="px-2.5 py-1 rounded bg-white/10 text-white/80 text-[10px] font-bold">Dolby Atmos</span>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">5 Sources Armed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCENE 4: TV SERIES DEEP DIVE ─── */}
      <section id="tv" className="scroll-scene relative py-28 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] bg-[#05060A]/90 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Visual Column */}
            <div className="anime-scroll-reveal lg:col-span-6 order-2 lg:order-1">
              <div className="relative rounded-2xl bg-zinc-900/90 border border-white/10 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">Series Episode Tracker</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">Season 2 Active</span>
                </div>

                {/* Simulated Episode Selector */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-black text-xs">
                        E01
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">When You're Lost in the Darkness</div>
                        <div className="text-[10px] text-white/50">81 min • 1080p Stream</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">Watched</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/80 font-black text-xs">
                        E02
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Infected</div>
                        <div className="text-[10px] text-white/50">53 min • 1080p Stream</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-white/60">Ready to Play</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/80 font-black text-xs">
                        E03
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Long, Long Time</div>
                        <div className="text-[10px] text-white/50">75 min • 1080p Stream</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-white/60">Ready to Play</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                  <span>Auto-advances to next episode</span>
                  <span className="text-emerald-400 font-bold">5 Sources per Episode</span>
                </div>
              </div>
            </div>

            {/* Right Info Column */}
            <div className="anime-scroll-reveal lg:col-span-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black tracking-widest uppercase mb-6">
                <Tv className="w-3.5 h-3.5" /> TV Series & Binge Watching
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Seamless Seasons, Zero Friction.
              </h2>
              <p className="text-white/70 text-base sm:text-lg font-medium mt-6 leading-relaxed">
                Whether you're starting a 10-season classic or following the newest weekly release, Cine-Stream handles episode tracking, season navigation, and next-episode transitions effortlessly.
              </p>

              <div className="space-y-4 mt-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Auto-Next Episode Advance:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Never break your immersion. When an episode concludes, the next one queues seamlessly.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Season & Episode Progress Tracking:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Keep track of watched episodes with instant visual indicators and resume triggers.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Comprehensive Subtitles & Audio:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Enjoy clean multilingual subtitles with adjustable styling and timing sync.</span>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/browse/tv"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] transition-all"
                >
                  <span>Explore TV Series</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCENE 5: ANIME & MANGA UNIVERSE ─── */}
      <section id="anime" className="scroll-scene relative py-28 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Info Column */}
            <div className="anime-scroll-reveal lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-black tracking-widest uppercase mb-6">
                <Sparkles className="w-3.5 h-3.5" /> Otaku Universe
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Japanese Audio, English Subs & Manga in One Place.
              </h2>
              <p className="text-white/70 text-base sm:text-lg font-medium mt-6 leading-relaxed">
                Powered directly by AniList and Kitsu APIs. Track the latest seasonal anime simulcasts in original Japanese audio with high-precision English subtitles, and read full manga chapters with our custom manga reader.
              </p>

              <div className="space-y-4 mt-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Japanese Audio with English Subtitles:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Stream authentic Japanese voice acting with crisp, frame-accurate English subtitles on every episode.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">AniList Seasonal Calendars:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Browse trending, top-rated, and upcoming anime by season (Spring, Summer, Fall, Winter).</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm font-bold">Continuous Manga Reader:</strong>
                    <span className="text-white/60 text-sm ml-1.5">Enjoy high-resolution manga scans with seamless infinite scroll and chapter navigation.</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-10">
                <Link
                  href="/anime"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(147,51,234,0.4)] hover:shadow-[0_0_35px_rgba(147,51,234,0.6)] transition-all"
                >
                  <span>Launch Anime Hub</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/manga"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-teal-600/20 border border-teal-500/40 text-teal-300 font-extrabold text-sm hover:bg-teal-600/30 transition-all"
                >
                  <BookOpen className="w-4 h-4 text-teal-400" />
                  <span>Read Manga</span>
                </Link>
              </div>
            </div>

            {/* Right Visual Mock Card */}
            <div className="anime-scroll-reveal lg:col-span-6">
              <div className="relative rounded-2xl bg-zinc-900/90 border border-purple-500/30 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">AniList Sync Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-[10px] font-black text-purple-300">JP SUB</span>
                    <span className="px-2.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/80">ENGLISH SUBS</span>
                  </div>
                </div>

                <div className="relative h-64 sm:h-72 rounded-xl overflow-hidden bg-zinc-900">
                  <img
                    src="https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQBSkxWAAk83.jpg"
                    alt="Jujutsu Kaisen"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  <div className="relative z-10 p-5 sm:p-6 flex flex-col justify-end h-full">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Anime of the Year</span>
                    <h3 className="text-2xl sm:text-3xl font-black text-white">Jujutsu Kaisen & Frieren</h3>
                    <p className="text-xs text-white/80 mt-1.5 line-clamp-2">
                      Full seasons, uncut Blu-Ray editions, OVA specials, and complete AniList episode notes.
                    </p>
                    <div className="flex items-center gap-2.5 mt-3.5">
                      <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 text-[10px] font-black">5 Anime Sources</span>
                      <span className="px-2.5 py-1 rounded bg-white/10 text-white/80 text-[10px] font-bold">1080p 60fps</span>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Zero Ads</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCENE 6: SERVER RACK VISUAL — 4 DOWN, 1 SAVES YOUR STREAM ─── */}
      <section ref={sourcesRef} id="sources" className="scroll-scene relative py-12 sm:py-16 px-4 sm:px-6 md:px-8 border-t border-white/[0.06] bg-[#05060A]/95 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <span className="text-[11px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20 inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Multi-Source Failover Engine
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mt-2.5 tracking-tight">
              Even If 4 Sources Go Down, <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                1 Will Always Save Your Stream.
              </span>
            </h2>
            <p className="text-white/60 text-xs sm:text-sm mt-2 font-medium leading-relaxed">
              5 independent server clusters power every stream. Click below to test failover in real-time.
            </p>

            <div className="flex items-center justify-center mt-4">
              <button
                onClick={toggleOutageSimulation}
                className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                  isOutageSimulated
                    ? "bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)]"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isOutageSimulated ? "Reset Simulation" : "Simulate 4-Source Outage"}</span>
              </button>
            </div>
          </div>

          {/* ─── SERVER RACK SHELF VISUAL (COMPACT) ─── */}
          <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-4 sm:p-5 shadow-2xl backdrop-blur-xl overflow-hidden">
            {/* Rack header */}
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center">
                  <Server className="w-3.5 h-3.5 text-white/60" />
                </div>
                <div>
                  <div className="text-[11px] font-black text-white uppercase tracking-widest">CineStream Server Rack</div>
                  <div className={`text-[10px] font-bold ${isOutageSimulated ? "text-rose-400" : "text-emerald-400"}`}>
                    {isOutageSimulated ? "⚠ Failover Active — Source 5 Online" : "✓ All 5 Sources Healthy"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80]" />
              </div>
            </div>

            {/* The 5 server shelves */}
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((num) => {
                const isDown = isOutageSimulated && num < 5;
                const isSavior = isOutageSimulated && num === 5;
                const isNormal = !isOutageSimulated;
                return (
                  <div
                    key={num}
                    className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-500 ${
                      isSavior
                        ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        : isDown
                        ? "bg-rose-950/20 border-rose-500/20 opacity-80"
                        : "bg-white/[0.02] border-white/10"
                    }`}
                  >
                    {/* Slot number */}
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      isSavior ? "bg-emerald-500 text-black" : isDown ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-white/10 text-white/60"
                    }`}>
                      0{num}
                    </div>

                    {/* Server bar graphic */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-black text-white">Source {num}</span>
                        <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isSavior
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : isDown
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        }`}>
                          {isSavior ? "Guardian — Online" : isDown ? "OFFLINE" : "Online"}
                        </span>
                      </div>
                      {/* Visual LED strip / activity bar */}
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isSavior
                              ? "bg-gradient-to-r from-emerald-500 to-teal-400 w-full animate-pulse"
                              : isDown
                              ? "bg-rose-600/50"
                              : "bg-gradient-to-r from-emerald-500 to-sky-400"
                          }`}
                          style={{ width: isDown && !isSavior ? "15%" : isNormal ? `${72 + num * 4}%` : isSavior ? "100%" : "15%" }}
                        />
                      </div>
                    </div>

                    {/* Status LED */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isSavior
                        ? "bg-emerald-400 shadow-[0_0_10px_#4ade80] animate-pulse"
                        : isDown
                        ? "bg-rose-500 shadow-[0_0_6px_#ef4444]"
                        : "bg-emerald-400 shadow-[0_0_6px_#4ade80]"
                    }`} />
                  </div>
                );
              })}
            </div>

            {/* Footer bar */}
            <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-3 text-xs">
              {isOutageSimulated ? (
                <span className="text-rose-300 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  Sources 1–4 down. Source 5 auto-engaged in &lt;50ms.
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  All 5 sources online — automatic failover ready
                </span>
              )}
              <Link
                href="/"
                className="px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all shrink-0"
              >
                Watch Now →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCENE 7: 5 CUSTOM VISUAL THEMES — LIVE DEMO ─── */}
      <section id="themes" className="scroll-scene relative py-20 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black tracking-widest uppercase text-amber-400 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/20">
              Personalized Aesthetics
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 tracking-tight">
              5 Hand-Crafted Visual Themes.
            </h2>
            <p className="text-white/60 text-sm sm:text-base mt-4 font-medium">
              Click a theme below to see a live preview of what Cine-Stream looks like.
            </p>
          </div>

          {/* Theme Selector Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {THEMES_SHOWCASE.map((theme, i) => (
              <button
                key={theme.slug}
                onClick={() => setActiveThemeIndex(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all duration-200 bg-gradient-to-r ${theme.bg} ${
                  activeThemeIndex === i
                    ? "border-white shadow-lg scale-105"
                    : "border-white/15 hover:border-white/35 hover:scale-[1.02]"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.accent }} />
                <span style={{ color: activeThemeIndex === i ? theme.accent : "rgba(255,255,255,0.8)" }}>{theme.name}</span>
              </button>
            ))}
          </div>

          {/* Live Theme Preview Window */}
          {(() => {
            const t = THEMES_SHOWCASE[activeThemeIndex];
            return (
              <div className={`rounded-3xl border overflow-hidden shadow-2xl transition-all duration-500 bg-gradient-to-b ${t.bg} ${t.border}`}>
                {/* Fake browser chrome */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.08] bg-black/40 backdrop-blur-md">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <div className="flex-1 mx-4 py-1 px-3 rounded bg-white/[0.06] text-[11px] text-white/50 font-mono">
                    cinestream.app — {t.name} Theme
                  </div>
                </div>

                {/* Fake UI inside the window */}
                <div className="p-6 space-y-4">
                  {/* Fake nav */}
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: t.accent + "33" }} />
                    <div className="h-3 w-24 rounded-full bg-white/20" />
                    <div className="ml-auto flex gap-2">
                      <div className="h-3 w-14 rounded-full bg-white/10" />
                      <div className="h-3 w-14 rounded-full bg-white/10" />
                    </div>
                  </div>
                  {/* Fake hero area */}
                  <div
                    className="rounded-2xl p-6 flex flex-col gap-3"
                    style={{ background: `linear-gradient(135deg, ${t.accent}18 0%, transparent 100%)`, border: `1px solid ${t.accent}30` }}
                  >
                    <div className="h-4 w-2/3 rounded-full" style={{ backgroundColor: t.accent + "60" }} />
                    <div className="h-3 w-1/2 rounded-full bg-white/20" />
                    <div className="flex gap-2 mt-2">
                      <div
                        className="h-8 w-24 rounded-full text-[10px] flex items-center justify-center text-black font-black"
                        style={{ backgroundColor: t.accent }}
                      >
                        ▶ Play
                      </div>
                      <div className="h-8 w-20 rounded-full bg-white/10" />
                    </div>
                  </div>
                  {/* Fake card grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {["Dune", "The Last of Us", "Solo Leveling", "Frieren"].map((title) => (
                      <div
                        key={title}
                        className="rounded-xl overflow-hidden aspect-[2/3]"
                        style={{ background: `linear-gradient(160deg, ${t.accent}20, #00000080)`, border: `1px solid ${t.accent}20` }}
                      >
                        <div className="p-2">
                          <div className="h-2 w-full rounded bg-white/20 mb-1" />
                          <div className="h-1.5 w-2/3 rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Theme info footer */}
                <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between bg-black/20">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${t.badge}`}>
                      {t.name}
                    </span>
                    <span className="text-xs text-white/60 font-medium hidden sm:inline">{t.tagline}</span>
                  </div>
                  <Link
                    href="/"
                    className="text-[11px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full border transition-all hover:opacity-80"
                    style={{ borderColor: t.accent + "60", color: t.accent }}
                  >
                    Try It →
                  </Link>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ─── SCENE 8: SOLO DEVELOPER — CLEAN CENTERED ─── */}
      <section ref={devSectionRef} id="solo-dev" className="scroll-scene relative py-28 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] bg-[#05060A] z-10">
        <div className="max-w-2xl mx-auto text-center">
          {/* Glow orb behind signature */}
          <div className="absolute left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[140px] pointer-events-none" />

          <p className="text-xs font-black tracking-widest uppercase text-amber-400 mb-8">
            Made by 1 Developer
          </p>

          {/* Golden R Signature */}
          <div className="relative mx-auto w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center mb-8 group">
            <div className="absolute inset-0 rounded-full border border-amber-500/25 bg-amber-500/5 backdrop-blur-sm" />
            <div className="absolute inset-3 rounded-full border border-dashed border-amber-400/30" />
            <svg
              viewBox="0 0 200 200"
              className="anime-gold-signature w-36 h-36 sm:w-48 sm:h-48 transition-transform duration-500 group-hover:scale-110"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="goldSheenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF9D2" />
                  <stop offset="25%" stopColor="#FFD700" />
                  <stop offset="50%" stopColor="#FFA000" />
                  <stop offset="75%" stopColor="#FFC107" />
                  <stop offset="100%" stopColor="#D48806" />
                </linearGradient>
                <linearGradient id="goldShadowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE082" />
                  <stop offset="100%" stopColor="#FF8F00" />
                </linearGradient>
                <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M 65 155 C 65 140, 68 85, 72 48 C 73 38, 76 35, 84 35 C 105 35, 140 40, 140 75 C 140 100, 115 110, 88 112 C 100 118, 125 138, 145 165 C 148 169, 142 172, 136 166 C 118 142, 95 122, 82 116 L 75 160 C 74 167, 65 166, 65 155 Z"
                fill="url(#goldSheenGradient)"
                filter="url(#goldGlow)"
              />
              <path
                d="M 80 50 L 78 98 C 96 97, 124 93, 124 74 C 124 53, 98 50, 80 50 Z"
                fill="#05060A"
                opacity="0.9"
              />
              <path
                d="M 45 150 C 65 168, 110 178, 160 152 C 166 148, 168 155, 162 159 C 110 188, 55 178, 40 155 C 38 152, 42 147, 45 150 Z"
                fill="url(#goldShadowGradient)"
              />
              <circle cx="145" cy="42" r="3" fill="#FFFDE7" />
              <circle cx="152" cy="165" r="2.5" fill="#FFE082" />
            </svg>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] transition-all"
          >
            <Play className="w-4 h-4 fill-black" />
            Start Watching
          </Link>
        </div>
      </section>

      {/* ─── SCENE 9: FAQ ACCORDION ─── */}
      <section id="faq" className="scroll-scene relative py-28 px-4 sm:px-8 md:px-12 border-t border-white/[0.06] z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
              Got Questions?
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className="anime-scroll-reveal rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-white/20"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full text-left p-6 flex items-center justify-between gap-4"
                  >
                    <span className="text-base sm:text-lg font-black text-white tracking-tight">{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-purple-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-0 text-sm text-white/70 font-medium leading-relaxed border-t border-white/[0.06]">
                      <p className="mt-4">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── GRAND FINALE CTA BANNER ─── */}
      <section className="scroll-scene relative py-24 px-4 sm:px-8 md:px-12 border-t border-white/[0.08] overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-[#07080E] to-[#05060B] pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-widest uppercase text-white">Your Cinema Experience Awaits</span>
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.08]">
            Ready to Experience the Future of Streaming?
          </h2>

          <p className="text-white/70 text-base sm:text-xl font-medium mt-6 max-w-2xl mx-auto leading-relaxed">
            No payments. No subscription traps. Just 10,000+ Movies, TV Shows, Anime & Manga ready with 5 backup sources.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="px-9 py-4 rounded-full bg-white text-black font-black text-base hover:bg-white/90 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>Launch Cine-Stream Now</span>
            </Link>
            <Link
              href="/anime"
              className="px-8 py-4 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-200 font-black text-base hover:bg-purple-600/40 hover:scale-105 active:scale-95 transition-all"
            >
              Browse Anime Hub
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative border-t border-white/[0.08] py-14 bg-[#05060A] z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              <img src="/logo-icon.svg" alt="CineStream" className="w-8 h-8 opacity-90" />
              <span className="text-xl font-black tracking-wider text-white">
                CINE<span className="text-purple-400">STREAM</span>
              </span>
            </div>
            <p className="text-xs text-white/50 max-w-md font-medium">
              Movies, TV Series, Anime & Manga in one unified platform. CineStream does not host any media files on its servers.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-bold uppercase tracking-wider text-white/60">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/browse/movies" className="hover:text-white transition-colors">Movies</Link>
            <Link href="/browse/tv" className="hover:text-white transition-colors">TV Shows</Link>
            <Link href="/anime" className="hover:text-white transition-colors">Anime</Link>
            <Link href="/manga" className="hover:text-white transition-colors">Manga</Link>
            <Link href="/watchlist" className="hover:text-white transition-colors">Watchlist</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-12 mt-8 pt-8 border-t border-white/[0.04] text-center text-[11px] text-white/40 font-medium">
          Handcrafted with ❤️ by R for movie and anime lovers worldwide • Powered by Next.js & Anime.js
        </div>
      </footer>
    </div>
  );
}


