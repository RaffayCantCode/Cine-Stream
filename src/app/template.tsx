"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 30, 
        mass: 1,
        opacity: { duration: 0.3 }
      }}
      className="flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}
