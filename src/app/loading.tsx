"use client";

import { motion } from "framer-motion";

export default function Loading() {
  return (
    <div className="h-[100dvh] w-full bg-[#07091e] z-[9999] flex flex-col items-center justify-center p-6 select-none relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(75,86,148,0.15)_0%,transparent_60%)]" />
      
      <div className="relative flex flex-col items-center gap-6">
        {/* Animated logo/spinner */}
        <div className="relative w-20 h-20">
          {/* Glowing background ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-[#7288AE]/10"
            style={{ borderTopColor: "rgba(114,136,174,0.8)" }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          />
          {/* Inner pulse */}
          <motion.div
            className="absolute inset-2.5 rounded-full bg-gradient-to-br from-[#4B5694] to-[#7288AE] flex items-center justify-center shadow-lg animate-pulse"
          >
            <img src="/logo-icon.svg" alt="" className="w-8 h-8 opacity-75" />
          </motion.div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="font-black text-xl tracking-wider text-white">
            CINE<span className="bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] bg-clip-text text-transparent">STREAM</span>
          </h2>
          <p className="text-xs text-white/45 font-medium tracking-wide animate-pulse">
            Loading page...
          </p>
        </div>
      </div>
    </div>
  );
}
