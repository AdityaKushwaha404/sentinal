import React from "react";
import { notFound } from "next/navigation";
import { Activity, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StatusPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicStatusPage({ params }: StatusPageProps) {
  const { slug } = await params;

  // Retrieve monitor by slug
  const monitor = await db.monitor.findUnique({
    where: { slug },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 30, // Last 30 checks for visual grid
      },
      incidents: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!monitor) {
    return notFound();
  }

  // Calculate stats
  const totalChecks = monitor.checks.length;
  const successfulChecks = monitor.checks.filter(c => c.isAvailable).length;
  const uptimePercentage = totalChecks > 0 ? ((successfulChecks / totalChecks) * 100).toFixed(2) : "100.00";

  const avgLatency = totalChecks > 0 
    ? Math.round(monitor.checks.reduce((acc, c) => acc + c.responseTime, 0) / totalChecks) 
    : 0;

  const currentStatus = monitor.status; // HEALTHY, WARNING, DOWN

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-accent">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-8 mb-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted border border-border shadow-inner">
              <Activity className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{monitor.name} Status</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Public status dashboard powered by Sentinel</p>
            </div>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>

        {/* Global Banner Uptime Status */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-6 mb-8 shadow-xs ${
          currentStatus === "HEALTHY" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" :
          currentStatus === "WARNING" ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400" :
          "bg-destructive/10 border-destructive/20 text-destructive dark:text-destructive"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-3 w-3 rounded-full ${
              currentStatus === "HEALTHY" ? "bg-emerald-500 animate-pulse" :
              currentStatus === "WARNING" ? "bg-amber-500" : "bg-destructive animate-ping"
            }`} />
            <h2 className="text-lg font-bold tracking-tight">
              {currentStatus === "HEALTHY" ? "All Systems Operational" :
               currentStatus === "WARNING" ? "Experiencing Degraded Performance" :
               "Service Interruption / Offline"}
            </h2>
          </div>
          <span className="text-xs font-semibold opacity-70">
            Last checked: {monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleTimeString() : "Never"}
          </span>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <Card className="bg-card border-border text-card-foreground shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Uptime Ratio</CardDescription>
              <CardTitle className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{uptimePercentage}%</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card border-border text-card-foreground shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Average Latency</CardDescription>
              <CardTitle className="text-2xl font-bold mt-1 text-foreground">{avgLatency}ms</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card border-border text-card-foreground shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Checks Monitored</CardDescription>
              <CardTitle className="text-2xl font-bold mt-1 text-foreground">{totalChecks} cycles</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Performance Grid */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-12 shadow-sm text-card-foreground">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Recent Check History (Last 30 Checks)
          </h3>
          <div className="flex gap-1.5 h-8 items-end">
            {monitor.checks.slice().reverse().map((check) => (
              <div 
                key={check.id} 
                className={`flex-1 h-full rounded-[3px] transition-all cursor-pointer ${
                  check.isAvailable ? "bg-emerald-500 hover:bg-emerald-400" : "bg-destructive hover:bg-destructive/90"
                }`}
                title={`Checked at ${new Date(check.checkedAt).toLocaleTimeString()} - Latency: ${check.responseTime}ms - Status: ${check.isAvailable ? "UP" : "DOWN"}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 font-medium">
            <span>30 checks ago</span>
            <span>Just now</span>
          </div>
        </div>

        {/* Incidents Section */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold tracking-tight text-foreground border-b border-border pb-3">Incident History</h3>
          
          {monitor.incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-2xl border border-border">
              No incidents reported in the last 7 days.
            </div>
          ) : (
            <div className="space-y-4">
              {monitor.incidents.map((incident) => (
                <div key={incident.id} className="p-5 rounded-2xl border border-border bg-card text-card-foreground shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-sm font-bold text-foreground">{incident.title}</h4>
                    <Badge className={incident.status === "RESOLVED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-destructive/10 text-destructive border-destructive/25"}>
                      {incident.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{incident.description || "No detail logs provided."}</p>
                  <div className="flex gap-4 text-[10px] text-muted-foreground mt-2 font-medium">
                    <span>Started: {new Date(incident.startedAt).toLocaleString()}</span>
                    {incident.resolvedAt && (
                      <span>Resolved: {new Date(incident.resolvedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t border-border pt-8 text-center text-xs text-muted-foreground font-medium">
          &copy; {new Date().getFullYear()} Sentinel Inc. All Status Pages are generated dynamically.
        </footer>
      </div>
    </div>
  );
}
