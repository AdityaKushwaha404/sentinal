import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CreateMonitorPayload {
  name: string;
  url: string;
  type: "HTTP" | "HTTPS" | "TCP" | "SSL" | "PING" | "JSON_API";
  monitorInterval: number;
  tags?: string[];
  httpMethod?: "GET" | "POST" | "PUT" | "HEAD" | "OPTIONS";
  httpHeaders?: Record<string, string>;
  timeoutMs?: number;
  expectedStatusCode?: number;
  jsonPath?: string;
  jsonPathExpected?: string;
  tcpPort?: number;
}

interface UpdateMonitorPayload {
  name?: string;
  url?: string;
  monitorInterval?: number;
  isActive?: boolean;
  tags?: string[];
  httpMethod?: "GET" | "POST" | "PUT" | "HEAD" | "OPTIONS";
  httpHeaders?: Record<string, string>;
  timeoutMs?: number;
  expectedStatusCode?: number;
  jsonPath?: string;
  jsonPathExpected?: string;
  tcpPort?: number;
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/metrics");
      if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
      return res.json();
    },
    refetchInterval: 10000, // Poll metrics every 10s
  });
}

export function useMonitors(tagFilter?: string) {
  return useQuery({
    queryKey: ["monitors", tagFilter],
    queryFn: async () => {
      const url = tagFilter ? `/api/monitors?tag=${encodeURIComponent(tagFilter)}` : "/api/monitors";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch monitors");
      return res.json();
    },
    refetchInterval: 10000, // Poll monitor statuses every 10s
  });
}

export function useMonitor(id: string) {
  return useQuery({
    queryKey: ["monitor", id],
    queryFn: async () => {
      const res = await fetch(`/api/monitors/${id}`);
      if (!res.ok) throw new Error("Failed to fetch monitor details");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useMonitorAnalytics(id: string, days = 7) {
  return useQuery({
    queryKey: ["monitor-analytics", id, days],
    queryFn: async () => {
      const res = await fetch(`/api/monitors/${id}/analytics?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch monitor analytics");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useMonitorChecks(id: string, limit = 50) {
  return useQuery({
    queryKey: ["monitor-checks", id, limit],
    queryFn: async () => {
      const res = await fetch(`/api/monitors/${id}/checks?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch monitor checks");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useMonitorIncidents(id: string) {
  return useQuery({
    queryKey: ["monitor-incidents", id],
    queryFn: async () => {
      const res = await fetch(`/api/monitors/${id}/incidents`);
      if (!res.ok) throw new Error("Failed to fetch monitor incidents");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateMonitorPayload) => {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create monitor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

export function useUpdateMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateMonitorPayload & { id: string }) => {
      const res = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update monitor");
      return res.json();
    },
    onMutate: async ({ id, ...payload }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ["monitors"] });
      await queryClient.cancelQueries({ queryKey: ["monitor", id] });

      // Snapshot previous values
      const previousMonitors = queryClient.getQueryData<any[]>(["monitors"]);
      const previousMonitor = queryClient.getQueryData<any>(["monitor", id]);

      // Optimistically update ["monitors"] cache
      if (previousMonitors) {
        queryClient.setQueryData(
          ["monitors"],
          previousMonitors.map((m) =>
            m.id === id ? { ...m, ...payload } : m
          )
        );
      }

      // Optimistically update single ["monitor", id] cache
      if (previousMonitor) {
        queryClient.setQueryData(["monitor", id], {
          ...previousMonitor,
          ...payload,
        });
      }

      return { previousMonitors, previousMonitor, id };
    },
    onError: (err, variables, context: any) => {
      // Rollback cache if mutation fails
      if (context) {
        if (context.previousMonitors) {
          queryClient.setQueryData(["monitors"], context.previousMonitors);
        }
        if (context.previousMonitor) {
          queryClient.setQueryData(["monitor", context.id], context.previousMonitor);
        }
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      queryClient.invalidateQueries({ queryKey: ["monitor", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/monitors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete monitor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}
