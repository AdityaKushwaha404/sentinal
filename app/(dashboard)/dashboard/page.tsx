"use client";

import React, { useState } from "react";


import { Plus, Search, Loader2, Play, Pause, Trash2, Edit, ExternalLink, Activity, ShieldAlert, Wifi, Database, Cpu, Globe, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";

import { useDashboardMetrics, useMonitors, useUpdateMonitor, useDeleteMonitor } from "@/hooks/use-monitors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MonitorWizard } from "@/components/monitors/monitor-wizard";

interface Tag {
  id: string;
  name: string;
  userId: string;
}

interface Monitor {
  id: string;
  name: string;
  url: string;
  type: "HTTP" | "HTTPS" | "TCP" | "SSL" | "PING" | "JSON_API";
  monitorInterval: number;
  isActive: boolean;
  status: "HEALTHY" | "WARNING" | "DOWN";
  slug: string;
  lastCheckedAt?: string | null;
  lastOnlineAt?: string | null;
  tags?: Tag[];
}

// Form Zod schemas
const monitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().min(1, "Target is required"),
  monitorInterval: z.number().int().min(1, "Interval must be at least 1 minute"),
  tagsInput: z.string().optional(),
});

type MonitorFormValues = z.infer<typeof monitorSchema>;

export default function DashboardPage() {

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);

  // React Query hooks
  const { data: metrics } = useDashboardMetrics();
  const { data: monitors, isLoading: isMonitorsLoading } = useMonitors();
  const updateMonitor = useUpdateMonitor(selectedMonitor?.id || "");
  const deleteMonitor = useDeleteMonitor();

  const editForm = useForm<MonitorFormValues>({
    resolver: zodResolver(monitorSchema),
  });

  const onEditSubmit = (values: MonitorFormValues) => {
    const tags = values.tagsInput ? values.tagsInput.split(",").map(t => t.trim()).filter(Boolean) : [];
    updateMonitor.mutate(
      {
        name: values.name,
        url: values.url,
        monitorInterval: values.monitorInterval,
        tags,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setSelectedMonitor(null);
        },
      }
    );
  };

  const handleEditClick = (monitor: Monitor) => {
    setSelectedMonitor(monitor);
    editForm.reset({
      name: monitor.name,
      url: monitor.url,
      monitorInterval: monitor.monitorInterval,
      tagsInput: monitor.tags?.map((t: Tag) => t.name).join(", ") || "",
    });
    setIsEditOpen(true);
  };

  const handleDeleteClick = (monitor: Monitor) => {
    setSelectedMonitor(monitor);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedMonitor) {
      deleteMonitor.mutate(selectedMonitor.id, {
        onSuccess: () => {
          setIsDeleteOpen(false);
          setSelectedMonitor(null);
        },
      });
    }
  };

  const toggleActive = (monitor: Monitor) => {
    updateMonitor.mutate({
      isActive: !monitor.isActive,
    });
  };

  // Compile unique tags list
  const allTags = new Set<string>();
  monitors?.forEach((m: Monitor) => {
    m.tags?.forEach((t: Tag) => allTags.add(t.name));
  });

  // Filter monitors
  const filteredMonitors = monitors?.filter((m: Monitor) => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag === "ALL" || m.tags?.some((t: Tag) => t.name === selectedTag);
    return matchesSearch && matchesTag;
  });

  const getMonitorIcon = (type: Monitor["type"]) => {
    switch (type) {
      case "HTTP":
      case "JSON_API":
        return <Globe className="h-4 w-4 text-emerald-500" />;
      case "HTTPS":
      case "SSL":
        return <Shield className="h-4 w-4 text-emerald-500" />;
      case "TCP":
        return <Activity className="h-4 w-4 text-emerald-500" />;
      case "PING":
        return <Cpu className="h-4 w-4 text-emerald-500" />;
      default:
        return <Globe className="h-4 w-4 text-emerald-500" />;
    }
  };


  return (
    <div className="space-y-8 font-sans selection:bg-accent">
      
      {/* Professional Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground uppercase sm:text-2xl">
            Operations Center
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            Monitor real-time network latency, server availability, and active SSL handshakes globally.
          </p>
        </div>

        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer transition-all shadow-sm self-start sm:self-center font-sans border-0"
        >
          <Plus className="h-4 w-4" />
          Add Monitor Target
        </button>

        <MonitorWizard isOpen={isAddOpen} onOpenChange={setIsAddOpen} />
      </div>

      {/* Conditional Alert Banner */}
      {metrics?.offline && metrics.offline > 0 ? (
        <div className="flex items-center gap-3 text-xs text-destructive font-semibold bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
          <span>System Alert: {metrics.offline} target{metrics.offline > 1 ? "s are" : " is"} currently failing status checks. Immediate action required.</span>
        </div>
      ) : null}

      {/* Richer KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Total Targets",
            value: metrics?.total ?? 0,
            description: "Registered infrastructure checks",
            icon: Cpu,
            color: "text-muted-foreground",
            trend: "+0",
          },
          {
            title: "Active Uptime Ratio",
            value: `${metrics?.uptimePercentage ?? "100.00"}%`,
            description: "Operational availability standard",
            icon: Wifi,
            color: "text-emerald-500",
            trend: "99.98% target",
          },
          {
            title: "Average Latency",
            value: `${metrics?.avgResponseTime ?? 0} ms`,
            description: "Mean response delay",
            icon: Activity,
            color: "text-amber-500",
            trend: "Normal threshold",
          },
          {
            title: "Open Alerts",
            value: metrics?.offline ?? 0,
            description: "Current failing check statuses",
            icon: ShieldAlert,
            color: "text-destructive",
            trend: "Action required",
          }
        ].map((kpi, idx) => (
          <div 
            key={idx} 
            className="rounded-2xl border border-border bg-card text-card-foreground p-5 flex flex-col justify-between hover:border-border/80 shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{kpi.title}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <div className="mt-4">
              <div className="text-2xl font-extrabold tracking-tight text-foreground">{kpi.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1 font-semibold leading-none">{kpi.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
              <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border uppercase tracking-widest">{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Monitors Table Section */}
      <Card className="bg-card border-border text-card-foreground shadow-sm rounded-2xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6">
          <div>
            <CardTitle className="text-sm font-bold tracking-tight">Infrastructure Monitor Targets</CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Active checking parameters and operational configurations.
            </CardDescription>
          </div>
        </CardHeader>

        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 pb-6 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="bg-background border-border text-foreground pl-9 focus-visible:ring-1 focus-visible:ring-ring rounded-xl"
              placeholder="Search monitors by name or URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tag:</span>
            <Select value={selectedTag} onValueChange={(v) => setSelectedTag(v || "ALL")}>
              <SelectTrigger className="bg-background border-border text-foreground w-[140px] rounded-xl text-xs">
                <SelectValue placeholder="Select tag" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                <SelectItem value="ALL">All Tags</SelectItem>
                {Array.from(allTags).map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Monitors Table */}
        <CardContent className="p-0">
          {isMonitorsLoading ? (
            <div className="flex justify-center items-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              Loading Monitor configurations...
            </div>
          ) : !filteredMonitors || filteredMonitors.length === 0 ? (
            /* Illustration Empty State */
            <div className="text-center py-24 px-6 bg-muted/10">
              <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-2xl bg-background border border-border mb-6 shadow-inner">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-md font-bold text-foreground">No Monitor Targets Registered</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 font-medium leading-relaxed">
                Sentinel does not observe any systems yet. Register your first website endpoint above.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto relative">
              <Table>
                <TableHeader className="border-b border-border">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider pl-6">Name</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Interval</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Tags</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Last Checked</TableHead>
                    <TableHead className="text-right text-muted-foreground text-xs font-semibold uppercase tracking-wider pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMonitors.map((monitor: Monitor) => (
                    <TableRow key={monitor.id} className="border-border hover:bg-muted/50 group transition-all">
                      <TableCell className="font-medium pl-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <Link href={`/dashboard/monitors/${monitor.id}`} className="text-foreground hover:text-primary hover:underline flex items-center gap-1 font-bold text-sm">
                            {monitor.name} <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </Link>
                          <span className="text-xs text-muted-foreground max-w-[280px] truncate">{monitor.url}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1.5 w-fit bg-muted text-muted-foreground border border-border/80 text-[10px] rounded-md font-bold px-2 py-0.5 uppercase tracking-wide">
                          {getMonitorIcon(monitor.type)}
                          <span>{monitor.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${
                            !monitor.isActive ? "bg-muted-foreground" :
                            monitor.status === "HEALTHY" ? "bg-emerald-500 animate-pulse" :
                            monitor.status === "WARNING" ? "bg-amber-500" : "bg-destructive animate-ping"
                          }`} />
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {!monitor.isActive ? "PAUSED" : monitor.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground text-xs font-medium">{monitor.monitorInterval}m</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {monitor.tags && monitor.tags.length > 0 ? (
                            monitor.tags.map((t: Tag) => (
                               <Badge key={t.id} variant="secondary" className="bg-muted text-muted-foreground border border-border/85 text-[9px] rounded-md font-bold px-2 py-0.5 uppercase tracking-wide">
                                {t.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground font-bold">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium">
                        {monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleTimeString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleActive(monitor)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors"
                            title={monitor.isActive ? "Pause Monitor" : "Resume Monitor"}
                          >
                            {monitor.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleEditClick(monitor)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors"
                            title="Edit Monitor"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(monitor)}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted cursor-pointer transition-colors"
                            title="Delete Monitor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card border border-border text-card-foreground rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-md font-bold tracking-tight text-foreground">Edit Monitor Target</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Update configurations or tags for this checking target.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name" className="text-xs font-semibold text-muted-foreground">Friendly Name</Label>
              <Input id="edit-name" {...editForm.register("name")} className="bg-background border-border text-foreground rounded-xl" />
              {editForm.formState.errors.name && <p className="text-xs text-destructive mt-1">{editForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-url" className="text-xs font-semibold text-muted-foreground">Target URL</Label>
              <Input id="edit-url" {...editForm.register("url")} className="bg-background border-border text-foreground rounded-xl" />
              {editForm.formState.errors.url && <p className="text-xs text-destructive mt-1">{editForm.formState.errors.url.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-interval" className="text-xs font-semibold text-muted-foreground">Check Interval</Label>
              <Select onValueChange={(v) => editForm.setValue("monitorInterval", parseInt(v || "5", 10))} value={String(editForm.watch("monitorInterval"))}>
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
            <div className="space-y-1">
              <Label htmlFor="edit-tagsInput" className="text-xs font-semibold text-muted-foreground">Tags (Comma-separated)</Label>
              <Input id="edit-tagsInput" {...editForm.register("tagsInput")} className="bg-background border-border text-foreground rounded-xl" />
            </div>
            <DialogFooter className="mt-6">
              <button type="submit" className="w-full flex justify-center items-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer transition-all border-0">
                {updateMonitor.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border border-border text-card-foreground rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-md font-bold tracking-tight text-destructive">Delete Monitor Configuration</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Are you sure you want to delete <strong>{selectedMonitor?.name}</strong>? This action will permanently prune all associated check history logs and incidents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2">
            <button onClick={() => setIsDeleteOpen(false)} className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer">
              Cancel
            </button>
            <button onClick={handleDeleteConfirm} className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 cursor-pointer transition-all border-0">
              {deleteMonitor.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Permanently
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
