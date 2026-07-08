"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, AlertCircle, ShieldAlert, ShieldCheck } from "lucide-react";
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

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover.Root>
      <Popover.Trigger
        className="relative p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors focus:outline-none flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-background animate-pulse">
            {unreadCount}
          </span>
        )}
      </Popover.Trigger>
      
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="z-50 w-80 max-h-[400px] overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-xs font-bold uppercase tracking-wider">Alert Center</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-[10px] font-semibold text-emerald-500 hover:text-emerald-400 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <BellOff className="h-8 w-8 opacity-45" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">No alerts logged</span>
                </div>
              ) : (
                notifications.map((n) => {
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && markRead.mutate(n.id)}
                      className={`p-3.5 text-left text-xs transition-colors cursor-pointer flex gap-2.5 items-start ${
                        n.isRead ? "hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
                      }`}
                    >
                      {n.type === "DOWNTIME_ALERT" ? (
                        <ShieldAlert className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
                      ) : n.type === "UPTIME_RECOVERY" ? (
                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground truncate">{n.title || n.monitor.name}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0">
                            {new Date(n.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                      </div>
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
