"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Clock, Mail, Globe, Zap, Database, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface QuickCheckResult {
  url?: string;
  status?: number;
  statusText?: string;
  latency?: number;
  ssl?: string;
  ok?: boolean;
  error?: string;
}

export default function MarketingPage() {
  const { isSignedIn } = useAuth();
  const dashboardUrl = isSignedIn ? "/dashboard" : "/sign-in?redirect_url=/dashboard";
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickCheckResult | null>(null);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/quick-check?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        error: "Failed to connect to Sentinel testing API",
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-background text-foreground overflow-hidden relative selection:bg-accent">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 dark:bg-[radial-gradient(#1f1f23_1px,transparent_1px)] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative border-b border-border/65 bg-gradient-to-b dark:from-zinc-950 dark:via-background dark:to-background from-muted/30 via-background to-background overflow-hidden">
        
        {/* Subtle Radial Glow for Depth */}
        <div className="absolute top-[10%] left-[20%] w-[600px] h-[300px] bg-emerald-500/[0.04] rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[250px] bg-zinc-700/[0.03] rounded-full blur-[120px] pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20 lg:py-38 z-10 w-full relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Heading, Subheading & Actions */}
            <div className="lg:col-span-7 text-left flex flex-col items-start">
              
              {/* Status Pill */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Global Network</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.08] font-sans">
                Infrastructure monitoring <br />
                <span className="text-muted-foreground font-sans">built for scaling teams.</span>
              </h1>
              
              <p className="mt-6 max-w-xl text-sm sm:text-base leading-relaxed text-muted-foreground font-medium">
                Sentinel is a developer-first platform designed to observe target status, certificate lifetimes, and response latencies globally. Get notified instantly when your systems degrade.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <Link
                  href={dashboardUrl}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all font-sans shadow-sm cursor-pointer"
                >
                  Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/status/demo"
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background text-foreground hover:bg-accent px-5 py-3 text-xs font-bold transition-all"
                >
                  View Live Demo
                </Link>
              </div>

            </div>

            {/* Right Column: Interactive Terminal Widget */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
              <div className="w-full max-w-md rounded-2xl border border-border bg-card/75 p-5 shadow-2xl relative backdrop-blur-md text-card-foreground">
                
                {/* Console header bar */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sentinel Sandbox</span>
                </div>

                <form onSubmit={handleTest} className="space-y-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Test Instant Probe</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. google.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1 bg-background border border-border focus:border-border text-foreground rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-medium placeholder:text-muted-foreground/50"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer font-sans disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Run"}
                    </button>
                  </div>
                </form>

                {/* Live Console Output */}
                <div className="mt-4 pt-4 border-t border-border min-h-[120px] flex flex-col justify-center">
                  {!result && !loading && (
                    <div className="text-center py-6 text-[11px] text-muted-foreground font-medium">
                      Enter a hostname and click run to execute an instant HTTP uptime probe.
                    </div>
                  )}

                  {loading && (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/80" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider animate-pulse">Running global latency check...</span>
                    </div>
                  )}

                  {result && !loading && (
                    <div className="space-y-3">
                      {result.error ? (
                        <div className="flex items-center gap-2 text-xs text-destructive font-semibold bg-destructive/5 border border-destructive/10 p-3 rounded-lg">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{result.error}</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5 font-mono text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TARGET:</span>
                            <span className="text-foreground font-semibold">{result.url}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">STATUS:</span>
                            <span className={`font-bold uppercase ${result.ok ? "text-emerald-500" : "text-destructive"}`}>
                              {result.status} {result.statusText}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">LATENCY:</span>
                            <span className="text-foreground font-bold">{result.latency} ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">SSL ENVELOPE:</span>
                            <span className="text-foreground font-semibold">{result.ssl}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Trusted By / Logos Section */}
      <section className="py-12 border-b border-border bg-muted/15 z-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">Trusted by tech leads at scaling teams</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6 opacity-40 grayscale contrast-200">
            <span className="text-[11px] font-extrabold tracking-widest text-foreground">VERCEL</span>
            <span className="text-[11px] font-extrabold tracking-widest text-foreground">LINEAR</span>
            <span className="text-[11px] font-extrabold tracking-widest text-foreground">STRIPE</span>
            <span className="text-[11px] font-extrabold tracking-widest text-foreground">GITHUB</span>
            <span className="text-[11px] font-extrabold tracking-widest text-foreground">RAYCAST</span>
          </div>
        </div>
      </section>

      {/* Symmetric Grid Features Section */}
      <section className="lg:py-38 py-20 sm:py-24 z-10 bg-muted/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Production Reliability</h2>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Engineered for absolute uptime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 transition-all hover:border-border/80 hover:shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                <Globe className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">Availability Probes</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                  Continuously check connectivity from endpoints worldwide. Support HTTP status verifications and port socket pings.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 transition-all hover:border-border/80 hover:shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">Automated SSL Tracker</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                  Retrieve certificate chains, verify parameters, and receive warnings dispatched 30 days before expiration.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 transition-all hover:border-border/80 hover:shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                <Mail className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">Resend Notifications</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                  Direct notifications sent directly to email list instances upon connection and verification failures.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 transition-all hover:border-border/80 hover:shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                <Clock className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">Incident Lifecycles</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                  Triggers, status shifts, recoveries, and incident durations are resolved and tracked automatically.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 transition-all hover:border-border/80 hover:shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                <Zap className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">Precision Latencies</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                  Deep analytics detailing network delays and historical trends. Filterable windows (24h, 7d, 30d).
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 transition-all hover:border-border/80 hover:shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                <Database className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">Target Assertions</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                  Custom parameters to verify server payloads, response headers, and customized error thresholds.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-border bg-gradient-to-b from-background to-muted/20 z-10 text-center">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 relative z-10 flex flex-col items-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Start observing in seconds.
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground text-xs font-medium">
            Zero configuration limits. Build your infrastructure observing center within 2 minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
            <Link
              href={dashboardUrl}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
            >
              Enter Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
