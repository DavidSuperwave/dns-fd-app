"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/domains");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      <span className="ml-3">Redirecting to domains...</span>
    </div>
  );
}