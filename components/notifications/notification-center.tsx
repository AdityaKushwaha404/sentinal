"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, AlertCircle, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  userId: string;
  monitorId: string;
  type: "DOWNTIME_ALERT" | "UPTIME_RECOVERY" | "SSL_EXPIRING_WARNING";
  title: string;
  message: string;
  sentTo: string;
  isRead: boolean;
  sentAt: string;
  monitor: {
    name: string;
    slug: string;
    type: string;
  };
}

export function NotificationCenter() {
  const queryClient = useQueryClient();

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark notifications read");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<any>(["notifications"]);

      if (previous) {
        queryClient.setQueryData(["notifications"], {
          notifications: previous.notifications.map((n: any) => ({ ...n, isRead: true })),
          unreadCount: 0,
        });
      }
      return { previous };
    },
    onError: (err, variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark notification read");
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<any>(["notifications"]);

      if (previous) {
        queryClient.setQueryData(["notifications"], {
          notifications: previous.notifications.map((n: any) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, previous.unreadCount - 1),
        });
      }
      return { previous };
    },
    onError: (err, variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<any>(["notifications"]);

      if (previous) {
        const deletedItem = previous.notifications.find((n: any) => n.id === id);
        const unreadDiff = deletedItem && !deletedItem.isRead ? 1 : 0;

        queryClient.setQueryData(["notifications"], {
          notifications: previous.notifications.filter((n: any) => n.id !== id),
          unreadCount: Math.max(0, previous.unreadCount - unreadDiff),
        });
      }
      return { previous };
    },
    onError: (err, variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover.Root>
      <Popover.Trigger
        className="relative p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/70 cursor-pointer transition-all focus:outline-none flex items-center justify-center border border-transparent hover:border-border/40 shadow-xs"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-extrabold text-white ring-2 ring-background animate-pulse">
            {unreadCount}
          </span>
        )}
      </Popover.Trigger>
      
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="z-50 w-80 max-h-[420px] overflow-hidden rounded-2xl bg-card/95 border border-border/80 shadow-2xl backdrop-blur-md flex flex-col focus:outline-none animate-in fade-in-50 slide-in-from-top-1 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60 bg-muted/30">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alert Center</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 disabled:opacity-50 flex items-center gap-1 bg-transparent border-0 cursor-pointer transition-colors"
                >
                  <Check className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40 scrollbar-none">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <BellOff className="h-10 w-10 opacity-30 stroke-[1.5]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">No alerts logged</span>
                </div>
              ) : (
                notifications.map((n) => {
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && markRead.mutate(n.id)}
                      className={`p-4 text-left text-xs transition-all flex gap-3 items-start select-none group relative ${
                        n.isRead 
                          ? "opacity-65 hover:opacity-100 hover:bg-muted/15 cursor-default" 
                          : "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] cursor-pointer"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.type === "DOWNTIME_ALERT" ? (
                          <div className="p-1 rounded-lg bg-destructive/10 border border-destructive/20">
                            <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                          </div>
                        ) : n.type === "UPTIME_RECOVERY" ? (
                          <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          </div>
                        ) : (
                          <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground truncate text-[11px] tracking-tight">{n.title || n.monitor.name}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0 font-medium">
                            {new Date(n.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2 font-medium">{n.message}</p>
                      </div>

                      {/* Hover Trash Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification.mutate(n.id);
                        }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground bg-transparent border-0 cursor-pointer"
                        title="Delete Alert"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
