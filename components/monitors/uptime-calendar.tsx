"use client";

import React from "react";

interface UptimeCalendarProps {
  checks: { checkedAt: string; isAvailable: boolean }[];
  days?: number;
}

export function UptimeCalendar({ checks, days = 90 }: UptimeCalendarProps) {
  // Aggregate checks by date: 0 = Down (none successful), 1 = Partial (some successful), 2 = Up (all successful)
  const daysData: { [dateStr: string]: { total: number; success: number } } = {};
  
  // Fill calendar with all dates in the range
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    daysData[dateStr] = { total: 0, success: 0 };
  }

  // Populate data
  checks.forEach((c) => {
    const dateStr = new Date(c.checkedAt).toISOString().split("T")[0];
    if (daysData[dateStr] !== undefined) {
      daysData[dateStr].total++;
      if (c.isAvailable) {
        daysData[dateStr].success++;
      }
    }
  });

  const dailySlots = Object.keys(daysData).map((dateStr) => {
    const day = daysData[dateStr];
    let status: "no_data" | "up" | "partial" | "down" = "no_data";
    let uptimePct = 100;

    if (day.total > 0) {
      uptimePct = Math.round((day.success / day.total) * 100);
      if (day.success === day.total) status = "up";
      else if (day.success === 0) status = "down";
      else status = "partial";
    }

    return {
      dateStr,
      status,
      uptimePct,
      totalChecks: day.total,
    };
  }).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 justify-start">
        {dailySlots.map((slot) => {
          let bgColor = "bg-muted/40 border-muted/50";
          if (slot.status === "up") bgColor = "bg-emerald-500 hover:bg-emerald-400 border-emerald-600/10";
          else if (slot.status === "partial") bgColor = "bg-amber-500 hover:bg-amber-400 border-amber-600/10";
          else if (slot.status === "down") bgColor = "bg-destructive hover:bg-destructive/80 border-destructive/10";

          return (
            <div
              key={slot.dateStr}
              className={`h-7 w-7 rounded-md border flex items-center justify-center transition-all cursor-help relative group ${bgColor}`}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-36 p-2 rounded-lg bg-popover text-popover-foreground text-[10px] font-mono leading-relaxed border border-border shadow-md">
                <div className="font-bold text-foreground">{slot.dateStr}</div>
                <div className="flex justify-between mt-1 text-muted-foreground">
                  <span>Uptime:</span>
                  <span className="text-foreground font-semibold">{slot.totalChecks > 0 ? `${slot.uptimePct}%` : "No data"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Probes:</span>
                  <span className="text-foreground font-semibold">{slot.totalChecks}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-500 border border-emerald-600/10" />
          <span>Operational</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-amber-500 border border-amber-600/10" />
          <span>Partial Degradation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-destructive border border-destructive/10" />
          <span>Outage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-muted/40 border border-muted/50" />
          <span>No Data</span>
        </div>
      </div>
    </div>
  );
}
