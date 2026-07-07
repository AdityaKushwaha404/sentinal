"use client";

import React, { useState } from "react";
import { Loader2, Play, AlertCircle, Globe, Shield, Activity, Cpu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickCheckResult {
  url?: string;
  status?: number;
  statusText?: string;
  latency?: number;
  ssl?: string;
  ok?: boolean;
  error?: string;
}

export default function QuickCheckPage() {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"HTTP" | "HTTPS" | "TCP" | "SSL" | "PING" | "JSON_API">("HTTP");
  const [tcpPort, setTcpPort] = useState("80");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [history, setHistory] = useState<(QuickCheckResult & { timestamp: Date; type: string })[]>([]);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const queryParams = new URLSearchParams({
        url,
        type,
        ...(type === "TCP" || type === "PING" ? { tcpPort } : {}),
      });

      const res = await fetch(`/api/quick-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          type,
          tcpPort: type === "TCP" || type === "PING" ? parseInt(tcpPort, 10) : undefined,
        }),
      });

      const data = await res.json();
      setResult(data);
      setHistory((prev) => [
        { ...data, url, type, timestamp: new Date() },
        ...prev.slice(0, 4),
      ]);
    } catch {
      const errorResult = {
        error: "Failed to connect to Sentinel testing API",
        ok: false,
      };
      setResult(errorResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 font-sans selection:bg-accent max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="pb-5 border-b border-border">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground uppercase sm:text-2xl">
          Quick Check Prober
        </h1>
        <p className="mt-1 text-xs text-muted-foreground font-medium">
          Perform a one-off diagnostics probe from Sentinel's global network nodes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Check Form */}
        <Card className="md:col-span-2 bg-card border-border text-card-foreground rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold tracking-tight">Diagnostics Configurator</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">Choose the probe parameters to run against your target host.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="type" className="text-xs font-semibold text-muted-foreground">Probe Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <SelectTrigger className="bg-background border-border text-foreground rounded-xl">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                      <SelectItem value="HTTP">HTTP</SelectItem>
                      <SelectItem value="HTTPS">HTTPS</SelectItem>
                      <SelectItem value="TCP">TCP Port Check</SelectItem>
                      <SelectItem value="SSL">SSL Cert Only</SelectItem>
                      <SelectItem value="PING">Ping (TCP)</SelectItem>
                      <SelectItem value="JSON_API">JSON API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(type === "TCP" || type === "PING") && (
                  <div className="space-y-1">
                    <Label htmlFor="tcpPort" className="text-xs font-semibold text-muted-foreground">TCP Port</Label>
                    <Input
                      id="tcpPort"
                      value={tcpPort}
                      onChange={(e) => setTcpPort(e.target.value)}
                      className="bg-background border-border text-foreground rounded-xl"
                      placeholder="80"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="url" className="text-xs font-semibold text-muted-foreground">
                  {["TCP", "PING"].includes(type) ? "Target Host / IP Address" : "Target URL"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 bg-background border-border text-foreground rounded-xl"
                    placeholder={["TCP", "PING"].includes(type) ? "1.1.1.1" : "https://example.com/api"}
                  />
                  <Button
                    type="submit"
                    disabled={loading || !url.trim()}
                    className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer font-sans disabled:opacity-50 flex items-center justify-center gap-1.5 border-0"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Run Probe <Play className="h-3 w-3" /></>}
                  </Button>
                </div>
              </div>
            </form>

            {/* Results Console */}
            <div className="mt-8 pt-6 border-t border-border min-h-[140px] flex flex-col justify-center bg-muted/10 p-4 rounded-xl">
              {!result && !loading && (
                <div className="text-center py-6 text-[11px] text-muted-foreground font-medium">
                  Enter target host information and click run to dispatch diagnostics.
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider animate-pulse">Running live checks...</span>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-3">
                  {result.error ? (
                    <div className="flex items-center gap-2 text-xs text-destructive font-semibold bg-destructive/5 border border-destructive/10 p-3.5 rounded-xl">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{result.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 font-mono text-xs">
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                        <span className="text-muted-foreground">TARGET:</span>
                        <span className="text-foreground font-bold">{result.url}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                        <span className="text-muted-foreground">AVAILABILITY:</span>
                        <span className={`font-bold uppercase ${result.ok ? "text-emerald-500" : "text-destructive"}`}>
                          {result.ok ? "ONLINE" : "OFFLINE"}
                        </span>
                      </div>
                      {result.status !== undefined && (
                        <div className="flex justify-between border-b border-border/40 pb-1.5">
                          <span className="text-muted-foreground">STATUS CODE:</span>
                          <span className="text-foreground font-bold">{result.status} {result.statusText}</span>
                        </div>
                      )}
                      {result.latency !== undefined && (
                        <div className="flex justify-between border-b border-border/40 pb-1.5">
                          <span className="text-muted-foreground">ROUND-TRIP TIME:</span>
                          <span className="text-foreground font-bold">{result.latency} ms</span>
                        </div>
                      )}
                      {result.ssl && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SSL ENVELOPE:</span>
                          <span className="text-foreground font-semibold">{result.ssl}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History Panel */}
        <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold tracking-tight">Recent Sessions</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">Session checks (cleared on refresh).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="text-center py-8 text-[11px] text-muted-foreground font-medium">
                No recent checks recorded.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {history.map((h, i) => (
                  <div key={i} className="p-3 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground truncate max-w-[120px]">{h.url}</span>
                      <span className={`text-[10px] font-bold ${h.ok ? "text-emerald-500" : "text-destructive"}`}>
                        {h.latency !== undefined ? `${h.latency}ms` : h.ok ? "OK" : "FAIL"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>{h.type}</span>
                      <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
