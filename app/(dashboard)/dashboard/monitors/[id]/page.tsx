"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, ShieldCheck, AlertTriangle, FileText, BarChart3, Settings as SettingsIcon, Loader2, Activity, Globe, ExternalLink, Trash2, Play, Pause, Calendar, Award, Hourglass, ShieldAlert, Cpu, Zap } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

import { useMonitor, useMonitorAnalytics, useMonitorChecks, useMonitorIncidents, useUpdateMonitor, useDeleteMonitor } from "@/hooks/use-monitors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HealthScoreRing } from "@/components/monitors/health-score-ring";
import { UptimeCalendar } from "@/components/monitors/uptime-calendar";

interface MonitorCheck {
  id: string;
  monitorId: string;
  statusCode: number | null;
  responseTime: number;
  isAvailable: boolean;
  errorMessage: string | null;
  checkedAt: string;
}

interface Incident {
  id: string;
  monitorId: string;
  status: "OPEN" | "RESOLVED";
  title: string;
  description: string | null;
  startedAt: string;
  resolvedAt: string | null;
  
  // AI summary fields
  aiSummary: string | null;
  aiLikelyCause: string | null;
  aiRecommendedActions: string | null;
  aiConfidenceScore: number | null;
  aiGeneratedAt: string | null;
}

// Collapsible row helper subcomponent for rendering AI Analysis
function IncidentRow({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow 
        className="border-border hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="font-semibold text-foreground">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
              {incident.title}
              {incident.aiSummary && (
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] h-4 py-0 flex items-center gap-0.5 font-bold uppercase">
                  <Zap className="h-2 w-2" /> AI Analyzed
                </Badge>
              )}
            </span>
            <span className="text-xs text-muted-foreground font-medium">{incident.description}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge className={incident.status === "RESOLVED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-destructive/10 text-destructive border-destructive/25"}>
            {incident.status}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs font-mono">
          {new Date(incident.startedAt).toLocaleString()}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs font-mono">
          {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : <span className="text-destructive font-bold animate-pulse">Active</span>}
        </TableCell>
      </TableRow>
      {expanded && incident.aiSummary && (
        <TableRow className="bg-muted/20 border-border hover:bg-muted/20">
          <TableCell colSpan={4} className="p-4 border-t-0">
            <div className="rounded-xl border border-border bg-card/65 p-4 space-y-3.5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/60 pb-2 gap-2">
                <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Cpu className="h-3.5 w-3.5 text-blue-500" />
                  Gemini Incident Diagnostics
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold">Confidence:</span>
                  <Badge className={incident.aiConfidenceScore && incident.aiConfidenceScore > 0.7 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"}>
                    {incident.aiConfidenceScore ? `${Math.round(incident.aiConfidenceScore * 100)}%` : "N/A"}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-3 text-xs">
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider mb-1">Executive Summary</span>
                  <p className="text-foreground leading-relaxed font-medium">{incident.aiSummary}</p>
                </div>
                {incident.aiLikelyCause && (
                  <div>
                    <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider mb-1">Likely Root Cause</span>
                    <p className="text-foreground font-semibold text-xs">{incident.aiLikelyCause}</p>
                  </div>
                )}
                {incident.aiRecommendedActions && (
                  <div>
                    <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider mb-1">Recommended Remediation Path</span>
                    <ul className="list-disc pl-4 text-foreground space-y-1 font-medium leading-relaxed">
                      {incident.aiRecommendedActions.split(",").map((action, i) => (
                        <li key={i}>{action.trim()}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

const settingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().min(1, "Target is required"),
  monitorInterval: z.number().int().min(1),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MonitorDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  
  const [activeTab, setActiveTab] = useState("overview");
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [isMounted, setIsMounted] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Avoid SSR hydration mismatch for Recharts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // React Query hooks
  const { data: monitor, isLoading: isMonitorLoading, refetch: refetchMonitor } = useMonitor(id);
  const { data: analytics, isLoading: isAnalyticsLoading } = useMonitorAnalytics(id, analyticsDays);
  const { data: checks, isLoading: isChecksLoading } = useMonitorChecks(id, 50);
  const { data: incidents, isLoading: isIncidentsLoading } = useMonitorIncidents(id);
  const updateMonitor = useUpdateMonitor();
  const deleteMonitor = useDeleteMonitor();

  // Settings form setup
  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  // Sync settings form default values once loaded
  useEffect(() => {
    if (monitor) {
      settingsForm.reset({
        name: monitor.name,
        url: monitor.url,
        monitorInterval: monitor.monitorInterval,
      });
    }
  }, [monitor, settingsForm]);

  if (isMonitorLoading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/85" />
        Loading monitor workspace details...
      </div>
    );
  }

  if (!monitor) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-foreground">Monitor Target Not Found</h3>
        <p className="text-xs text-muted-foreground mt-1">This configuration could not be resolved or you lack access permissions.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-xs text-muted-foreground underline hover:text-foreground">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Settings form action
  const onSettingsSubmit = (values: SettingsFormValues) => {
    setSaveSuccess(false);
    updateMonitor.mutate({
      id,
      ...values,
    }, {
      onSuccess: () => {
        refetchMonitor();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  // Delete Action
  const handleDelete = () => {
    if (confirm(`Are you sure you want to permanently prune ${monitor.name}?`)) {
      deleteMonitor.mutate(id, {
        onSuccess: () => {
          router.push("/dashboard");
        },
      });
    }
  };

  const handleToggleActive = () => {
    updateMonitor.mutate({
      id,
      isActive: !monitor.isActive,
    }, {
      onSuccess: () => refetchMonitor(),
    });
  };

  return (
    <div className="space-y-8 font-sans selection:bg-accent">
      
      {/* Back navigation & Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold uppercase tracking-wider font-sans">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to monitors
        </Link>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleActive}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            {monitor.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {monitor.isActive ? "Pause Monitor" : "Resume Monitor"}
          </button>
        </div>
      </div>

      {/* Monitor Hero Header */}
      <div className="p-6 rounded-2xl border border-border bg-card text-card-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-border/80 transition-all shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border shadow-inner">
            <Globe className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {monitor.name}
              <Link href={monitor.url} target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </h1>
            <p className="text-xs text-muted-foreground mt-1 select-all font-semibold">{monitor.url}</p>
          </div>
        </div>
        
        {/* Status Pill Indicator */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          <span className={`h-2.5 w-2.5 rounded-full ${
            !monitor.isActive ? "bg-muted-foreground" :
            monitor.status === "HEALTHY" ? "bg-emerald-500 animate-pulse" :
            monitor.status === "WARNING" ? "bg-amber-500" : "bg-destructive animate-ping"
          }`} />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {!monitor.isActive ? "PAUSED" : monitor.status}
          </span>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        {/* Mobile View Dropdown Tab Selector */}
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={(v) => { if (v) setActiveTab(v); }}>
            <SelectTrigger className="bg-background border-border text-foreground w-full rounded-xl text-xs font-bold uppercase tracking-wider h-11">
              <SelectValue placeholder="Select tab view" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="checks">Checks</SelectItem>
              <SelectItem value="ssl">SSL Cert</SelectItem>
              <SelectItem value="incidents">Incidents</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop View Tab List */}
        <TabsList className="hidden sm:flex bg-muted/50 border border-border p-1 rounded-xl max-w-full justify-start h-auto gap-1 whitespace-nowrap scrollbar-none pb-2">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg px-4 py-2 cursor-pointer border border-transparent data-[state=active]:border-border shadow-xs shrink-0">
            <Activity className="h-3.5 w-3.5 text-emerald-500" /> Overview
          </TabsTrigger>
          <TabsTrigger value="checks" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg px-4 py-2 cursor-pointer border border-transparent data-[state=active]:border-border shadow-xs shrink-0">
            <FileText className="h-3.5 w-3.5 text-emerald-500" /> Checks
          </TabsTrigger>
          <TabsTrigger value="ssl" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg px-4 py-2 cursor-pointer border border-transparent data-[state=active]:border-border shadow-xs shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> SSL Cert
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg px-4 py-2 cursor-pointer border border-transparent data-[state=active]:border-border shadow-xs shrink-0">
            <Clock className="h-3.5 w-3.5 text-emerald-500" /> Incidents
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg px-4 py-2 cursor-pointer border border-transparent data-[state=active]:border-border shadow-xs shrink-0">
            <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg px-4 py-2 cursor-pointer border border-transparent data-[state=active]:border-border shadow-xs shrink-0">
            <SettingsIcon className="h-3.5 w-3.5 text-emerald-500" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-card border-border text-card-foreground col-span-2 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold tracking-tight">Recent Latency Trend</CardTitle>
                <CardDescription className="text-muted-foreground text-xs">Uptime check performance parameters.</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] w-full pb-6">
                {isAnalyticsLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : isMounted && analytics?.chartData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.chartData.slice(-15)}>
                      <defs>
                        <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="var(--muted-foreground)" fontSize={9} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={9} unit="ms" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)", borderRadius: "12px" }}
                        labelFormatter={(l) => new Date(l).toLocaleString()}
                        formatter={(v) => [`${v} ms`, "Latency"]}
                      />
                      <Area type="monotone" dataKey="responseTime" stroke="#10b981" fillOpacity={1} fill="url(#latencyGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-xs font-semibold">
                    No latency data logged yet. Active monitoring scheduler is running.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Uptime Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{isAnalyticsLoading ? "--" : `${analytics?.uptime ?? 100}%`}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-semibold">Uptime accuracy over current checking window.</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Average Ping</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{isAnalyticsLoading ? "--" : `${analytics?.avgLatency ?? 0} ms`}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-semibold">Average round-trip response duration.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Checks */}
        <TabsContent value="checks">
          <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-tight">Historical Response Log</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Recent pings and connection verification codes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isChecksLoading ? (
                <div className="flex justify-center items-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> Loading checks...
                </div>
              ) : !checks || checks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs font-semibold">No checks logged yet.</div>
              ) : (
                <div className="w-full overflow-x-auto relative">
                  <Table>
                    <TableHeader className="border-b border-border">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Response Code</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Latency</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Error Details</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Checked At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checks.map((check: MonitorCheck) => (
                        <TableRow key={check.id} className="border-border hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <Badge className={check.isAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-destructive/10 text-destructive border-destructive/25"}>
                              {check.isAvailable ? "UP" : "DOWN"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-foreground font-mono text-xs">{check.statusCode || "-"}</TableCell>
                          <TableCell className="text-foreground text-xs font-semibold">{check.responseTime}ms</TableCell>
                          <TableCell className="text-muted-foreground text-xs truncate max-w-[220px]">
                            {check.errorMessage || "Success"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(check.checkedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: SSL */}
        <TabsContent value="ssl">
          <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-tight">SSL / TLS Handshake Details</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Security certificate configurations and validator status.</CardDescription>
            </CardHeader>
            <CardContent>
              {monitor.sslCertificate ? (
                <div className="grid gap-4 sm:grid-cols-4">
                  
                  {/* Card 1: Issuer */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 text-card-foreground flex flex-col gap-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Issuer</span>
                      <Award className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-foreground truncate" title={monitor.sslCertificate.issuer}>
                      {monitor.sslCertificate.issuer}
                    </p>
                  </div>

                  {/* Card 2: Status */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 text-card-foreground flex flex-col gap-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Status</span>
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <Badge className={monitor.sslCertificate.status === "VALID" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-destructive/10 text-destructive border-destructive/25"}>
                        {monitor.sslCertificate.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Card 3: Expiry Date */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 text-card-foreground flex flex-col gap-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Expiry</span>
                      <Calendar className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      {new Date(monitor.sslCertificate.expiryDate).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Card 4: Days Left */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 text-card-foreground flex flex-col gap-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Days Left</span>
                      <Hourglass className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-extrabold text-foreground">
                      {Math.max(0, Math.ceil((new Date(monitor.sslCertificate.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                    </p>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-xs font-semibold flex flex-col items-center justify-center gap-2">
                  <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                  No certificate information has been logged yet. SSL checks trigger for https:// hosts.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Incidents */}
        <TabsContent value="incidents">
          <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-tight">Incident Log Tracker</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Operational downtime incidents and resolutions timeline.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isIncidentsLoading ? (
                <div className="flex justify-center items-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> Loading incidents...
                </div>
              ) : !incidents || incidents.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs font-semibold flex flex-col items-center justify-center gap-2">
                  <ShieldCheck className="h-8 w-8 text-emerald-500" />
                  No incidents reported. All systems fully functional.
                </div>
              ) : (
                <div className="w-full overflow-x-auto relative">
                  <Table>
                    <TableHeader className="border-b border-border">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Incident Details</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Incident Started</TableHead>
                        <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Resolved At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents.map((incident: Incident) => (
                        <IncidentRow key={incident.id} incident={incident} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Analytics */}
        <TabsContent value="analytics">
          <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Latency History</CardTitle>
                <CardDescription className="text-muted-foreground text-xs">Detailed response times over the selected period.</CardDescription>
              </div>
              <div>
                <Select value={String(analyticsDays)} onValueChange={(v) => setAnalyticsDays(parseInt(v || "7", 10))}>
                  <SelectTrigger className="bg-background border-border text-foreground rounded-xl text-xs w-[130px]">
                    <SelectValue placeholder="Time window" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                    <SelectItem value="1">Last 24 Hours</SelectItem>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] w-full pb-6">
              {isAnalyticsLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : isMounted && analytics?.chartData?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="latencyGradFull" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleDateString()} stroke="var(--muted-foreground)" fontSize={9} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={9} unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)", borderRadius: "12px" }}
                      labelFormatter={(l) => new Date(l).toLocaleString()}
                      formatter={(v) => [`${v} ms`, "Latency"]}
                    />
                    <Area type="monotone" dataKey="responseTime" stroke="#10b981" fillOpacity={1} fill="url(#latencyGradFull)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-xs font-semibold flex-col items-center justify-center gap-2">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  Insufficient data points to map latency history chart.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Settings */}
        <TabsContent value="settings" className="space-y-6">
          
          {/* General Config Card */}
          <Card className="bg-card border-border text-card-foreground rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-tight">Monitor Configuration</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Update check parameters and naming conventions.</CardDescription>
            </CardHeader>
            <CardContent>
              {saveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold mb-4">
                  ✓ Monitor settings successfully updated!
                </div>
              )}
              <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4 max-w-xl">
                <div className="space-y-1">
                  <Label htmlFor="settings-name" className="text-xs font-semibold text-muted-foreground">Friendly Name</Label>
                  <Input id="settings-name" {...settingsForm.register("name")} className="bg-background border-border text-foreground rounded-xl" />
                  {settingsForm.formState.errors.name && <p className="text-xs text-destructive mt-1">{settingsForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-url" className="text-xs font-semibold text-muted-foreground">Target URL</Label>
                  <Input id="settings-url" {...settingsForm.register("url")} className="bg-background border-border text-foreground rounded-xl" />
                  {settingsForm.formState.errors.url && <p className="text-xs text-destructive mt-1">{settingsForm.formState.errors.url.message}</p>}
                </div>
                <div className="space-y-1 pb-4">
                  <Label htmlFor="settings-interval" className="text-xs font-semibold text-muted-foreground">Check Interval</Label>
                  <Select onValueChange={(v) => settingsForm.setValue("monitorInterval", parseInt(v || "5", 10))} value={String(settingsForm.watch("monitorInterval"))}>
                    <SelectTrigger className="bg-background border-border text-foreground rounded-xl">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                      <SelectItem value="1">1 minute</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 border-t border-border pt-6">
                  <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer transition-all">
                    {updateMonitor.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="bg-destructive/5 border border-destructive/20 text-card-foreground rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold tracking-tight text-destructive">Danger Zone</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Permanently remove this monitor and its historic latency records.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                This action is irreversible. Once deleted, all historical connection checks, response logs, incident records, and SSL details will be permanently pruned from the database.
              </p>
              <button 
                type="button" 
                onClick={handleDelete} 
                className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 cursor-pointer transition-all self-start sm:self-center shrink-0"
              >
                {deleteMonitor.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />}
                Delete Monitor Configuration
              </button>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}

