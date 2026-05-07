import { MediaCard } from "./MediaCard";
import { MediaItem } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface MediaRowProps {
  title: string;
  items?: MediaItem[];
  isLoading?: boolean;
  seeAllHref?: string;
}

export function MediaRow({ title, items, isLoading, seeAllHref }: MediaRowProps) {
  if (!isLoading && (!items || items.length === 0)) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="py-5 md:py-7 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-base md:text-lg font-bold text-white tracking-wide">{title}</h2>
        </div>
        {seeAllHref && (
          <a
            href={seeAllHref}
            className="flex items-center gap-0.5 text-xs font-semibold text-white/40 hover:text-primary transition-colors group"
          >
            See all
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </a>
        )}
      </div>

      {/* Scroll row */}
      <div className="w-full overflow-x-auto pb-4 pt-2 hide-scrollbar">
        <div className="flex gap-3 md:gap-4 px-5 md:px-10 w-max">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 rounded-xl bg-muted/40"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))
            : items?.map((item, i) => (
                <MediaCard key={item.id} item={item} index={i} />
              ))}
        </div>
      </div>
    </motion.div>
  );
}
