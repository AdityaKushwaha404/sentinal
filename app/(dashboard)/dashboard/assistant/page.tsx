"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Send, Trash2, Edit2, Check, X, Plus,
  Loader2, Sparkles, User, Bot, PanelLeftClose, PanelLeft,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  sessionId: string;
  role: "user" | "model";
  content: string;
  createdAt: string;
}

/* ─────────────────────────────────────────────────────────────
   Markdown renderer (no external package)
   Handles: **bold**, `code`, bullet lists, numbered lists,
            headers (##), and plain line-breaks.
───────────────────────────────────────────────────────────── */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const inlineParse = (line: string, key: string | number): React.ReactNode => {
    // Split on **bold**, *italic*, `code`
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {parts.map((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={pi} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
          if (part.startsWith("*") && part.endsWith("*"))
            return <em key={pi} className="italic">{part.slice(1, -1)}</em>;
          if (part.startsWith("`") && part.endsWith("`"))
            return (
              <code key={pi} className="px-1.5 py-0.5 rounded-md bg-muted/80 text-[12px] font-mono text-emerald-600 dark:text-emerald-400">
                {part.slice(1, -1)}
              </code>
            );
          return part;
        })}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // ## Heading
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length ?? 2;
      const content = line.replace(/^#+\s/, "");
      const cls = level === 1 ? "text-base font-bold mt-3 mb-1 text-foreground"
        : level === 2 ? "text-[13px] font-semibold mt-2 mb-1 text-foreground"
        : "text-[12px] font-semibold mt-1 text-foreground";
      nodes.push(<p key={i} className={cls}>{inlineParse(content, 0)}</p>);
      i++;
      continue;
    }

    // Bullet list (-, *, •)
    if (/^[\-\*•]\s/.test(line.trim())) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[\-\*•]\s/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^[\-\*•]\s/, "");
        listItems.push(
          <li key={i} className="flex items-start gap-2 mb-1">
            <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-emerald-500/70 shrink-0" />
            <span>{inlineParse(item, i)}</span>
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="my-1 space-y-0.5">{listItems}</ul>);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^\d+\.\s/, "");
        listItems.push(
          <li key={i} className="flex items-start gap-2.5 mb-1">
            <span className="shrink-0 text-emerald-500 font-mono text-[11px] mt-0.5 min-w-[16px]">{num}.</span>
            <span>{inlineParse(item, i)}</span>
          </li>
        );
        i++;
        num++;
      }
      nodes.push(<ol key={`ol-${i}`} className="my-1 space-y-0.5">{listItems}</ol>);
      continue;
    }

    // Normal paragraph
    nodes.push(
      <p key={i} className="leading-7">
        {inlineParse(line, 0)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

/* ─────────────────────────────────────────────────────────────
   Error message detector — sanitize old raw JSON errors
───────────────────────────────────────────────────────────── */
function isRawError(text: string) {
  return (
    text.includes('"code":503') ||
    text.includes('"status":"UNAVAILABLE"') ||
    text.includes('"status":"RESOURCE_EXHAUSTED"') ||
    text.includes("Technical details:")
  );
}

/* ─────────────────────────────────────────────────────────────
   Suggested questions
───────────────────────────────────────────────────────────── */
const SUGGESTIONS = [
  { label: "Check active monitors status", hint: "Current uptime and health" },
  { label: "Review weekly uptime metrics", hint: "Last week's performance" },
  { label: "List expiring SSL certificates", hint: "Certs nearing expiry" },
  { label: "Show recent server downtime logs", hint: "Latest incidents" },
];

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export default function AssistantPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    if (active) loadMessages(active.id);
    else setMessages([]);
  }, [active]);

  /* Focus input on session switch */
  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 50);
  }, [active]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const r = await fetch("/api/assistant/sessions");
      if (r.ok) {
        const data: Session[] = await r.json();
        setSessions(data);
        if (data.length > 0) setActive((prev) => prev ?? data[0]);
      }
    } finally { setLoadingSessions(false); }
  };

  const loadMessages = async (id: string) => {
    setLoadingMessages(true);
    try {
      const r = await fetch(`/api/assistant/sessions/${id}`);
      if (r.ok) setMessages(await r.json());
    } finally { setLoadingMessages(false); }
  };

  const createSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (r.ok) {
        const s: Session = await r.json();
        setSessions((p) => [s, ...p]);
        setActive(s);
        if (window.innerWidth < 768) setSidebarOpen(false);
      }
    } finally { setCreating(false); }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    const r = await fetch(`/api/assistant/sessions/${id}`, { method: "DELETE" });
    if (r.ok) {
      const rest = sessions.filter((s) => s.id !== id);
      setSessions(rest);
      if (active?.id === id) setActive(rest[0] ?? null);
    }
  };

  const startEdit = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditId(s.id);
    setEditText(s.title);
  };

  const saveEdit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editText.trim()) return;
    const r = await fetch(`/api/assistant/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editText.trim() }),
    });
    if (r.ok) {
      const updated: Session = await r.json();
      setSessions((p) => p.map((s) => (s.id === id ? updated : s)));
      if (active?.id === id) setActive(updated);
      setEditId(null);
    }
  };

  const send = useCallback(async (e: React.FormEvent | React.MouseEvent, custom?: string) => {
    e.preventDefault();
    const text = (custom ?? input).trim();
    if (!text || !active || sending) return;
    setInput("");
    setSending(true);

    const tempId = `tmp-${Date.now()}`;
    const userMsg: Message = {
      id: tempId, sessionId: active.id,
      role: "user", content: text, createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);

    try {
      const r = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: active.id, content: text }),
      });

      if (r.ok) {
        const ai: Message = await r.json();
        setMessages((p) => {
          const clean = p.filter((m) => m.id !== tempId);
          return [...clean, { ...userMsg, id: `${ai.id}-u` }, ai];
        });
        loadSessions(); // refresh titles
      } else throw new Error();
    } catch {
      setMessages((p) => [
        ...p.filter((m) => m.id !== tempId),
        userMsg,
        {
          id: `err-${Date.now()}`, sessionId: active.id, role: "model",
          content: "__error__:Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally { setSending(false); }
  }, [input, active, sending]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const SIDEBAR_W = 260;

  return (
    <div
      className="-mx-4 -my-8 sm:-mx-6 lg:-mx-8 flex overflow-hidden bg-background"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {/* ═══════════════════ SIDEBAR ═══════════════════ */}
      <aside
        style={{ width: sidebarOpen ? SIDEBAR_W : 0 }}
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-in-out border-r border-border bg-card z-30 absolute md:relative h-full"
      >
        {/* Sidebar top bar — same height as main header */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0">
          <button
            onClick={createSession}
            disabled={creating}
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/35 text-emerald-600 dark:text-emerald-400"
          >
            {creating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              : <Plus className="h-3.5 w-3.5 shrink-0" />}
            New Chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-none">
          <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.18em] px-2 pb-2">
            Conversations
          </p>

          {loadingSessions ? (
            <div className="flex justify-center pt-12">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-14 text-center px-3">
              <MessageSquare className="h-7 w-7 text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground/60">No conversations yet.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = active?.id === s.id;
              const isEditing = editId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => { setActive(s); if (window.innerWidth < 768) setSidebarOpen(false); }}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-all text-[12px] ${
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <MessageSquare
                    className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-emerald-500" : "text-muted-foreground/40"}`}
                  />
                  {isEditing ? (
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s.id, e as unknown as React.MouseEvent); }}
                      autoFocus
                      className="h-6 px-1 py-0 text-[12px] flex-1 border-emerald-500/30 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  ) : (
                    <span className="truncate flex-1 font-medium">{s.title}</span>
                  )}

                  {/* Action buttons */}
                  <div className={`absolute right-2 flex items-center gap-0.5 ${isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                    {isEditing ? (
                      <>
                        <button onClick={(e) => saveEdit(s.id, e)} className="p-1 rounded-md hover:bg-emerald-500/10 text-emerald-500">
                          <Check className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditId(null); }} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => startEdit(s, e)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => deleteSession(s.id, e)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ═══════════════════ MAIN ═══════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header — perfectly aligned with sidebar top bar */}
        <header className="flex items-center gap-3 px-5 h-14 border-b border-border bg-card shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-[14px] font-semibold text-foreground truncate">
            {active?.title ?? "AI Assistant"}
          </h2>
        </header>

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <div className="px-4 md:px-10 py-6">

            {/* No session selected */}
            {!active && (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-220px)] text-center space-y-5">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">No conversation selected</p>
                  <p className="text-xs text-muted-foreground">Create a new chat to get started.</p>
                </div>
                <button
                  onClick={createSession}
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />New Chat
                </button>
              </div>
            )}

            {/* Session loading */}
            {active && loadingMessages && (
              <div className="flex justify-center pt-20">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            )}

            {/* Welcome screen (empty session) */}
            {active && !loadingMessages && messages.length === 0 && (
              <div className="flex flex-col justify-center h-[calc(100vh-260px)] max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Sparkles className="h-4.5 w-4.5 text-emerald-500" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sentinel AI</span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    How can I help you today?
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
                    Ask me about your monitors, incidents, SSL certificates, uptime reports, or how Sentinel works.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={(e) => send(e, s.label)}
                      className="group p-3.5 rounded-xl text-left transition-all bg-card hover:bg-accent/60 border border-border hover:border-emerald-500/25 active:scale-[0.99]"
                    >
                      <p className="text-[12px] font-semibold text-foreground group-hover:text-foreground leading-snug">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message thread */}
            {active && !loadingMessages && messages.length > 0 && (
              <div className="max-w-3xl mx-auto space-y-7 pb-2">
                {messages.map((msg) => {
                  const isAI = msg.role === "model";
                  const isErr = isAI && (
                    isRawError(msg.content) ||
                    msg.content.startsWith("__error__:")
                  );
                  const displayContent = isErr
                    ? "I'm experiencing high demand. Please try again in a moment."
                    : msg.content.startsWith("__error__:")
                      ? msg.content.replace("__error__:", "")
                      : msg.content;

                  return (
                    <div key={msg.id} className={`flex gap-3 ${isAI ? "" : "flex-row-reverse"}`}>
                      {/* Avatar */}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ring-1 ${
                        isAI
                          ? isErr
                            ? "bg-destructive/10 ring-destructive/20 text-destructive"
                            : "bg-card ring-border/80 text-emerald-500"
                          : "bg-emerald-500 ring-emerald-500/30 text-white"
                      }`}>
                        {isAI
                          ? isErr ? <AlertCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />
                          : <User className="h-4 w-4" />}
                      </div>

                      {/* Content */}
                      <div className={`flex flex-col max-w-[78%] gap-1 ${isAI ? "" : "items-end"}`}>
                        {isAI ? (
                          <div className={`text-[13.5px] leading-7 text-foreground/90 ${isErr ? "text-destructive/80" : ""}`}>
                            {isErr
                              ? <p className="text-destructive/80 text-[13px]">{displayContent}</p>
                              : renderMarkdown(displayContent)}
                          </div>
                        ) : (
                          <div className="bg-accent border border-border/50 rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] font-medium text-foreground leading-relaxed">
                            {msg.content}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums font-mono px-0.5">
                          {fmt(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Typing indicator */}
            {sending && (
              <div className="max-w-3xl mx-auto flex gap-3 mt-7">
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-card ring-1 ring-border/80 text-emerald-500">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 h-8">
                  {[0, 120, 240].map((d) => (
                    <span
                      key={d}
                      className="h-2 w-2 rounded-full bg-emerald-500/50 animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Quick queries ── */}
        {active && messages.length > 0 && (
          <div className="border-t border-border/50 shrink-0 bg-background">
            <div className="overflow-x-auto scrollbar-none px-4 md:px-10 py-2">
              <div className="flex items-center gap-2 min-w-max max-w-3xl mx-auto">
                <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] shrink-0">
                  Suggest:
                </span>
                {SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={(e) => send(e, q.label)}
                    disabled={sending}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium border border-border/60 bg-card hover:bg-accent hover:border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Input box ── */}
        {active && (
          <div className="shrink-0 px-4 md:px-10 py-4 border-t border-border bg-card/30 backdrop-blur-sm">
            <form
              onSubmit={send}
              className="max-w-3xl mx-auto flex items-center gap-3 bg-background border border-border rounded-2xl pl-5 pr-3 py-2.5 transition-all focus-within:border-emerald-500/40 focus-within:ring-4 focus-within:ring-emerald-500/8 shadow-sm"
            >
              <input
                ref={inputRef}
                placeholder="Ask anything about your monitors, incidents, or how Sentinel works..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e as unknown as React.FormEvent); }}
                disabled={sending}
                className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-muted-foreground/40 text-foreground font-normal h-7 min-w-0"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-35 disabled:cursor-not-allowed text-white transition-all active:scale-95"
              >
                {sending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
            <p className="text-[10px] text-center text-muted-foreground/40 mt-2.5">
              AI can make mistakes — verify critical status checks manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
