export const runtime = 'edge';
"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Send, Users, Link as LinkIcon, Copy, PlayCircle, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
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
}

export default function WatchPartyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [partyState, setPartyState] = useState<PartyState | null>(null);
  const [usersCount, setUsersCount] = useState(1);
  const [channel, setChannel] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
                      />
                    ) : partyState.mediaType === "anime" ? (
                      <AnimePlayer 
                        animeId={partyState.mediaId}
                        animeTitle={partyState.title || ""}
                        episode={partyState.episode || 1}
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
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.01]">
              <h2 className="font-bold text-white">Party Chat</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {usersCount} Online
              </div>
            </div>

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
          </aside>

        </div>
      </main>
    </div>
  );
}
