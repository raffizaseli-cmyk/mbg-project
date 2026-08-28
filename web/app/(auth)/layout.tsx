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
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-background overflow-hidden z-0">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-blue-100/40 to-transparent blur-3xl opacity-60 rounded-full" />
        <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-gradient-radial from-indigo-100/40 to-transparent blur-3xl opacity-60 rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light pointer-events-none" />
      </div>
      
      {/* Content wrapper */}
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
