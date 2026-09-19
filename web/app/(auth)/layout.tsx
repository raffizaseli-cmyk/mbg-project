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
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-slate-100/80">
      {/* Clean subtle ambient pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200/50" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(#0f172a 1px, transparent 1px)",
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
