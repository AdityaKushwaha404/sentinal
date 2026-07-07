export const MONITOR_TYPES = {
  HTTP: "HTTP",
  PING: "PING",
  TCP: "TCP",
  SSL: "SSL",
} as const;

export const MONITOR_STATUS = {
  HEALTHY: "HEALTHY",
  WARNING: "WARNING",
  DOWN: "DOWN",
} as const;
