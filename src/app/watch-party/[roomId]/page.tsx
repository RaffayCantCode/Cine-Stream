"use client";
export const runtime = 'edge';

import { useEffect, useState, useRef, use, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Send, Users, Link as LinkIcon, Copy, PlayCircle, Loader2, MessageSquare, ListVideo, CheckCircle2 } from "lucide-react";
import { fetchJson, cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { VideoPlayer } from "@/components/VideoPlayer";
import { AnimePlayer } from "@/components/AnimePlayer";

interface Message {
  id: string;
  userId: string;
  userEmail: string;
  text: string;
  timestamp: number;
}

interface PartyState {
  mediaId: string | null;
  mediaType: "movie" | "tv" | "anime" | null;
  title: string | null;
  season?: number;
  episode?: number;
  hostId: string;
  sourceName?: string;
  syncTimestamp?: number;
  syncId?: string;
}

export default function WatchPartyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0B0F19]"><Loader2 className="w-8 h-8 animate-spin text-white/40" /></div>}>
      <WatchPartyContent roomId={roomId} />
    </Suspense>
  );
}

function WatchPartyContent({ roomId }: { roomId: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [partyState, setPartyState] = useState<PartyState | null>(null);
  const [usersCount, setUsersCount] = useState(1);
  const [channel, setChannel] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [hostCurrentTime, setHostCurrentTime] = useState(0);
  const [forceReloadCount, setForceReloadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Episode Queue State
  const [activeTab, setActiveTab] = useState<"chat" | "episodes">("chat");
  const [tvSeasons, setTvSeasons] = useState<any[]>([]);
  const [tvEpisodes, setTvEpisodes] = useState<any[]>([]);
  const [animeEpisodes, setAnimeEpisodes] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isFetchingEpisodes, setIsFetchingEpisodes] = useState(false);

  // Initial media params from URL
  const initialMediaId = searchParams.get("mediaId");
  const initialMediaType = searchParams.get("mediaType") as any;
  const initialSeason = searchParams.get("season") ? Number(searchParams.get("season")) : undefined;
  const initialEpisode = searchParams.get("episode") ? Number(searchParams.get("episode")) : undefined;
  const initialTitle = searchParams.get("title");

  const userId = session?.user?.id || `guest-${Math.floor(Math.random() * 10000)}`;
  const userEmail = session?.user?.email?.split("@")[0] || "Guest";

  useEffect(() => {
    if (status === "loading") return;

    // Initialize Supabase channel
    const roomChannel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: userId },
      },
    });

    roomChannel
      .on("presence", { event: "sync" }, () => {
        const state = roomChannel.presenceState();
        setUsersCount(Object.keys(state).length);
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload]);
      })
      .on("broadcast", { event: "media_sync" }, ({ payload }) => {
        setPartyState(payload);
        if (payload.syncId) {
          setForceReloadCount(prev => prev + 1);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await roomChannel.track({ user: userEmail, online_at: new Date().toISOString() });
          
          // If we are the first to join or we provided initial media, broadcast it
          if (initialMediaId && initialMediaType) {
            const newState: PartyState = {
              mediaId: initialMediaId,
              mediaType: initialMediaType,
              title: initialTitle || "Media",
              season: initialSeason,
              episode: initialEpisode,
              hostId: userId,
            };
            setPartyState(newState);
            roomChannel.send({
              type: "broadcast",
              event: "media_sync",
              payload: newState,
            });
          }
        }
      });

    setChannel(roomChannel);

    return () => {
      roomChannel.unsubscribe();
    };
  }, [roomId, status, initialMediaId, initialMediaType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch episodes for TV and Anime
  useEffect(() => {
    if (!partyState?.mediaId) return;
    const fetchMedia = async () => {
      setIsFetchingEpisodes(true);
      try {
        if (partyState.mediaType === "tv") {
          const data = await fetchJson<any>(`/api/tmdb/tv/${partyState.mediaId}`);
          const validSeasons = data.seasons?.filter((s: any) => s.season_number > 0) || [];
          setTvSeasons(validSeasons);
          
          const currentSeason = partyState.season || (validSeasons.length > 0 ? validSeasons[0].season_number : 1);
          setSelectedSeason(currentSeason);
          
          const seasonData = await fetchJson<any>(`/api/tmdb/tv/${partyState.mediaId}/season/${currentSeason}`);
          setTvEpisodes(seasonData.episodes || []);
        } else if (partyState.mediaType === "anime") {
          const data = await fetchJson<any>(`/api/anime/info?id=${partyState.mediaId}`);
          setAnimeEpisodes(data.episodes || []);
        }
      } catch (err) {
        console.error("Failed to fetch episodes", err);
      } finally {
        setIsFetchingEpisodes(false);
      }
    };
    fetchMedia();
  }, [partyState?.mediaId, partyState?.mediaType]);

  // Fetch specific season for TV when selectedSeason changes
  useEffect(() => {
    if (partyState?.mediaType !== "tv" || !partyState?.mediaId) return;
    const fetchSeason = async () => {
      setIsFetchingEpisodes(true);
      try {
        const seasonData = await fetchJson<any>(`/api/tmdb/tv/${partyState.mediaId}/season/${selectedSeason}`);
        setTvEpisodes(seasonData.episodes || []);
      } catch (err) {
        console.error("Failed to fetch season episodes", err);
      } finally {
        setIsFetchingEpisodes(false);
      }
    };
    fetchSeason();
  }, [selectedSeason, partyState?.mediaId, partyState?.mediaType]);

  const handleChangeEpisode = (seasonNum: number, episodeNum: number) => {
    if (!channel || !partyState || userId !== partyState.hostId) return;

    const newState: PartyState = {
      ...partyState,
      season: seasonNum,
      episode: episodeNum,
      syncTimestamp: 0,
      syncId: crypto.randomUUID()
    };

    setPartyState(newState);
    channel.send({
      type: "broadcast",
      event: "media_sync",
      payload: newState,
    });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !channel) return;

    const msg: Message = {
      id: crypto.randomUUID(),
      userId,
      userEmail,
      text: chatInput.trim(),
      timestamp: Date.now(),
    };

    channel.send({
      type: "broadcast",
      event: "chat_message",
      payload: msg,
    });
    
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/watch-party/${roomId}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const syncEveryone = () => {
    if (!channel || !partyState || userId !== partyState.hostId) return;

    let currentSource = "";
    try {
      const sourceKey = partyState.mediaType === "anime"
        ? `sv_src_anime_${userId}_${partyState.mediaId}`
        : `sv_src_${userId}_${partyState.mediaType}_${partyState.mediaId}`;
      const saved = localStorage.getItem(sourceKey);
      if (saved) currentSource = saved;
    } catch {}

    const newState: PartyState = {
      ...partyState,
      sourceName: currentSource,
      syncTimestamp: hostCurrentTime,
      syncId: crypto.randomUUID()
    };

    setPartyState(newState);
    channel.send({
      type: "broadcast",
      event: "media_sync",
      payload: newState,
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col md:pl-56 lg:pl-64 h-full relative">
        <div className="flex-1 flex flex-col xl:flex-row h-full">
          
          {/* Main Content Area (Player) */}
          <div className="flex-1 h-full flex flex-col bg-black/95 relative border-r border-white/5">
            <div className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <PlayCircle className="w-5 h-5 text-primary" />
                <h1 className="font-bold text-white tracking-wide">Watch Party</h1>
                {partyState?.title && (
                  <>
                    <span className="text-white/20">—</span>
                    <span className="text-white/60 text-sm font-medium line-clamp-1">{partyState.title}</span>
                  </>
                )}
              </div>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm font-semibold transition-colors"
              >
                {isCopied ? <Loader2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {isCopied ? "Copied!" : "Invite Friends"}
              </button>
            </div>

            {partyState?.hostId === userId && partyState.mediaId && (
              <div className="bg-primary/10 border-b border-primary/20 p-3 flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                  <PlayCircle className="w-4 h-4" />
                  Host Controls
                </div>
                <button
                  onClick={syncEveryone}
                  className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  Sync Everyone to Me
                </button>
              </div>
            )}

            <div className="flex-1 flex flex-col p-4 xl:p-8 relative overflow-y-auto overflow-x-hidden">
              <div className="flex-1 flex flex-col justify-center">
                {partyState?.mediaId ? (
                  <div className="w-full max-w-5xl mx-auto">
                    {partyState.mediaType === "movie" || partyState.mediaType === "tv" ? (
                      <VideoPlayer 
                        type={partyState.mediaType} 
                        id={Number(partyState.mediaId)} 
                        season={partyState.season}
                        episode={partyState.episode}
                        title={partyState.title || ""}
                        startProgress={partyState.syncTimestamp}
                        forcedSource={partyState.sourceName}
                        forceReloadCount={forceReloadCount}
                        onProgress={(time) => { if (userId === partyState.hostId) setHostCurrentTime(time); }}
                      />
                    ) : partyState.mediaType === "anime" ? (
                      <AnimePlayer 
                        animeId={partyState.mediaId}
                        animeTitle={partyState.title || ""}
                        episode={partyState.episode || 1}
                        startProgress={partyState.syncTimestamp}
                        forcedSource={partyState.sourceName}
                        forceReloadCount={forceReloadCount}
                        onProgress={(time) => { if (userId === partyState.hostId) setHostCurrentTime(time); }}
                      />
                    ) : null}
                  </div>
              ) : (
                <div className="text-center p-8 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="w-10 h-10 text-white/20" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-3">Waiting for media</h2>
                  <p className="text-white/50 text-sm leading-relaxed mb-8">
                    The host hasn&apos;t started anything yet. Browse Stream Vault and click "Watch Together" on any movie or show to start syncing!
                  </p>

                  <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl mb-8 text-left shadow-lg shadow-primary/5">
                    <h3 className="text-primary font-bold text-sm mb-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Feature in Development
                    </h3>
                    <p className="text-white/60 text-xs leading-relaxed mb-3">
                      Watch Together is currently a manual sync experience. The host must select a media, start playing, and then manually click the "Sync Everyone to Me" button above the chat to sync the room.
                    </p>
                    <p className="text-white/80 text-xs font-semibold bg-white/5 p-2 rounded-lg border border-white/10">
                      💡 For the best syncing experience, ensure all users are on Source 3 (VidLink).
                    </p>
                  </div>
                  <button onClick={() => router.push("/")} className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20">
                    Browse Catalog
                  </button>
                </div>
              )}
          </div>
          </div>
        </div>

        {/* Chat Sidebar */}
          <aside className="w-full xl:w-96 shrink-0 h-[40vh] xl:h-full flex flex-col bg-[#0A0D1F] border-t xl:border-t-0 border-white/5">
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-2 bg-white/[0.01]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                    activeTab === "chat" ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
                {(partyState?.mediaType === "tv" || partyState?.mediaType === "anime") && (
                  <button
                    onClick={() => setActiveTab("episodes")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                      activeTab === "episodes" ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <ListVideo className="w-4 h-4" />
                    Episodes
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mr-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {usersCount} Online
              </div>
            </div>

            {activeTab === "chat" ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, i) => {
                    const isMe = msg.userId === userId;
                    const showHeader = i === 0 || messages[i - 1].userId !== msg.userId;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        {showHeader && (
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1 px-1">
                            {isMe ? "You" : msg.userEmail}
                          </span>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                          isMe 
                            ? "bg-gradient-to-br from-[#4B5694] to-[#7288AE] text-white rounded-tr-sm" 
                            : "bg-white/[0.05] text-white/90 border border-white/5 rounded-tl-sm"
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="shrink-0 w-12 h-12 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center rounded-xl transition-all"
                    >
                      <Send className="w-5 h-5 text-white ml-0.5" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {partyState?.mediaType === "tv" && tvSeasons.length > 0 && (
                  <div className="p-4 border-b border-white/5 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2">
                    {tvSeasons.map((s) => (
                      <button
                        key={s.season_number}
                        onClick={() => setSelectedSeason(s.season_number)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                          selectedSeason === s.season_number ? "bg-primary text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                        )}
                      >
                        Season {s.season_number}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {isFetchingEpisodes ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-white/30" />
                    </div>
                  ) : partyState?.mediaType === "tv" ? (
                    tvEpisodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => userId === partyState?.hostId && handleChangeEpisode(selectedSeason, ep.episode_number)}
                        disabled={userId !== partyState?.hostId}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3",
                          partyState.season === selectedSeason && partyState.episode === ep.episode_number
                            ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg"
                            : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white",
                          userId !== partyState?.hostId && "cursor-default"
                        )}
                      >
                        <span className="text-sm font-black w-10 shrink-0">E{ep.episode_number}</span>
                        <span className="text-xs truncate flex-1">{ep.name}</span>
                        {userId === partyState?.hostId && partyState.season === selectedSeason && partyState.episode === ep.episode_number && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : partyState?.mediaType === "anime" ? (
                    animeEpisodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => userId === partyState?.hostId && handleChangeEpisode(1, ep.number)}
                        disabled={userId !== partyState?.hostId}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3",
                          partyState.episode === ep.number
                            ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg"
                            : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white",
                          userId !== partyState?.hostId && "cursor-default"
                        )}
                      >
                        <span className="text-sm font-black w-10 shrink-0">E{ep.number}</span>
                        <span className="text-xs truncate flex-1">{ep.title || `Episode ${ep.number}`}</span>
                        {userId === partyState?.hostId && partyState.episode === ep.number && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : null}
                  
                  {userId !== partyState?.hostId && (
                    <div className="text-[10px] text-center text-white/40 uppercase tracking-widest mt-4 p-4 border-t border-white/5">
                      Only the Host can change the episode
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>

        </div>
      </main>
    </div>
  );
}
