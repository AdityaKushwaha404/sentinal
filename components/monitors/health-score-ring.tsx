"use client";

import React from "react";

interface HealthScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export function HealthScoreRing({ score, size = 120, strokeWidth = 10 }: HealthScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  let strokeColor = "stroke-emerald-500";
  if (score < 70) strokeColor = "stroke-destructive";
  else if (score < 90) strokeColor = "stroke-amber-500";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Animated value track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`fill-none transition-all duration-500 ease-out ${strokeColor}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {/* Centered text */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight text-foreground">{score}</span>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">Health</span>
      </div>
    </div>
  );
}
