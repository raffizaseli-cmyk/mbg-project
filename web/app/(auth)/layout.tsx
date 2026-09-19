"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Redirect jika sudah login
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
    setIsReady(true);
  }, [router]);

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-950">
      {/* Dynamic Multi-Color Ambient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Deep gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
        
        {/* Ambient Glow Orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/25 rounded-full blur-[120px] animate-pulse-soft" />
        <div className="absolute top-1/4 -right-20 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 left-1/3 w-[28rem] h-[28rem] bg-violet-600/20 rounded-full blur-[130px]" />
        <div className="absolute top-10 right-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />

        {/* Subtle geometric dot grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />
      </div>
      
      {/* Content wrapper */}
      <div className="relative z-10 w-full flex items-center justify-center py-6">
        {children}
      </div>
    </div>
  );
}
