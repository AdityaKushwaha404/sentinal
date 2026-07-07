import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center justify-center">
        {/* Placeholder Navigation / Brand Logo */}
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight text-white">
            Sentinel
          </span>
          <p className="mt-2 text-sm text-zinc-400">
            SaaS Website Monitoring Platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
