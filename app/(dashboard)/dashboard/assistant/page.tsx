"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare, Send, Trash2, Edit2, Check, X, Plus,
  Loader2, Sparkle, User, Bot, PanelLeftClose, PanelLeft,
  Cpu,
} from "lucide-react";
import { Input } from "@/components/ui/input";

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

const suggestedQuestions = [
  { text: "Check active monitors status", sub: "View current uptime and health" },
  { text: "Review weekly uptime metrics", sub: "Summary of last week's performance" },
  { text: "List expiring SSL certificates", sub: "Certificates nearing expiry" },
  { text: "Show recent server downtime logs", sub: "Latest incidents and durations" },
];

export default function AssistantPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    if (activeSession) fetchMessages(activeSession.id);
    else setMessages([]);
  }, [activeSession]);

  const fetchSessions = async () => {
    setIsSessionsLoading(true);
    try {
      const res = await fetch("/api/assistant/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSession) setActiveSession(data[0]);
      }
    } catch (err) { console.error(err); }
    finally { setIsSessionsLoading(false); }
  };

  const fetchMessages = async (sessionId: string) => {
    setIsMessagesLoading(true);
    try {
      const res = await fetch(`/api/assistant/sessions/${sessionId}`);
      if (res.ok) setMessages(await res.json());
    } catch (err) { console.error(err); }
    finally { setIsMessagesLoading(false); }
  };

  const handleCreateSession = async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      const res = await fetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const s = await res.json();
        setSessions((p) => [s, ...p]);
        setActiveSession(s);
        if (window.innerWidth < 768) setSidebarOpen(false);
      }
    } catch (err) { console.error(err); }
    finally { setIsCreatingSession(false); }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`/api/assistant/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.id !== id);
        setSessions(remaining);
        if (activeSession?.id === id) setActiveSession(remaining[0] ?? null);
      }
    } catch (err) { console.error(err); }
  };

  const startRename = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitleText(s.title);
  };

  const handleRename = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitleText.trim()) return;
    try {
      const res = await fetch(`/api/assistant/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleText.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions((p) => p.map((s) => (s.id === id ? updated : s)));
        if (activeSession?.id === id) setActiveSession(updated);
        setEditingSessionId(null);
      }
    } catch (err) { console.error(err); }
  };

  const sendMessage = async (e: React.FormEvent | React.MouseEvent, customText?: string) => {
    e.preventDefault();
    const text = (customText ?? inputText).trim();
    if (!text || !activeSession || isSending) return;
    setInputText("");
    setIsSending(true);

    const tempId = `temp-${Math.random()}`;
    const tempMsg: Message = {
      id: tempId, sessionId: activeSession.id,
      role: "user", content: text, createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, tempMsg]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, content: text }),
      });
      if (res.ok) {
        const ai = await res.json();
        setMessages((p) => {
          const filtered = p.filter((m) => m.id !== tempId);
          return [...filtered, { ...tempMsg, id: `${ai.id}-user` }, ai];
        });
        fetchSessions();
      } else throw new Error();
    } catch {
      setMessages((p) => [
        ...p.filter((m) => m.id !== tempId),
        tempMsg,
        { id: `err-${Math.random()}`, sessionId: activeSession.id, role: "model",
          content: "Something went wrong. Please try again.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    /*
      The dashboard layout wraps children in max-w-7xl px-4 py-8.
      We use -mx-4 -my-8 sm:-mx-6 lg:-mx-8 to "bleed" out of that padding,
      then lock the height exactly to viewport minus the 64px navbar.
    */
    <div className="-mx-4 -my-8 sm:-mx-6 lg:-mx-8 h-[calc(100vh-64px)] flex overflow-hidden bg-background">

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside
        className={`
          flex flex-col border-r border-border bg-card shrink-0 z-30
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "w-64 absolute md:relative h-full" : "w-0 overflow-hidden"}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <button
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="
              flex items-center gap-2 flex-1 px-3 py-2 rounded-lg
              text-xs font-semibold transition-all
              bg-emerald-500/10 hover:bg-emerald-500/20
              border border-emerald-500/20 hover:border-emerald-500/40
              text-emerald-600 dark:text-emerald-400
            "
          >
            {isCreatingSession
              ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              : <Plus className="h-3.5 w-3.5 shrink-0" />}
            New Chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Sidebar body */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] px-2 pb-2">
            Recent
          </p>

          {isSessionsLoading ? (
            <div className="flex justify-center pt-10">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-10 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No conversations yet.</p>
            </div>
          ) : (
            sessions.map((session) => {
              const active = activeSession?.id === session.id;
              const editing = editingSessionId === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`
                    group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                    cursor-pointer transition-all text-[13px]
                    ${active
                      ? "bg-accent/80 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}
                  `}
                >
                  <MessageSquare
                    className={`h-3.5 w-3.5 shrink-0 transition-colors ${active ? "text-emerald-500" : "text-muted-foreground/50"}`}
                  />

                  {editing ? (
                    <Input
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      className="h-6 px-1 py-0 text-xs flex-1 border-emerald-500/40 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate flex-1 font-medium leading-none">{session.title}</span>
                  )}

                  <div className={`
                    absolute right-2 flex items-center gap-0.5
                    transition-opacity duration-150
                    ${editing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                  `}>
                    {editing ? (
                      <>
                        <button onClick={(e) => handleRename(session.id, e)}
                          className="p-1 rounded-md hover:bg-muted text-emerald-500">
                          <Check className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                          className="p-1 rounded-md hover:bg-muted text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => startRename(session, e)}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive">
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

        {/* Sidebar footer */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Cpu className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium">Powered by Gemini</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN PANEL ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Chat header — name only */}
        <header className="flex items-center gap-3 px-5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0 h-12">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-foreground truncate">
            {activeSession?.title ?? "AI Assistant"}
          </h2>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 md:px-8 py-6">
            {activeSession ? (
              isMessagesLoading ? (
                <div className="flex justify-center pt-16">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                </div>
              ) : messages.length === 0 ? (
                /* Welcome */
                <div className="flex flex-col justify-center min-h-[calc(100vh-260px)] max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                      How can I help you?
                    </h1>
                    <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                      Ask me about your monitors, incidents, SSL certs, weekly reports, or anything about how Sentinel works.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestedQuestions.map((card, i) => (
                      <button
                        key={i}
                        onClick={(e) => sendMessage(e, card.text)}
                        className="
                          group p-4 rounded-xl text-left transition-all
                          bg-card hover:bg-accent/50
                          border border-border hover:border-emerald-500/30
                        "
                      >
                        <Bot className="h-4 w-4 text-emerald-500 mb-2.5 group-hover:scale-110 transition-transform" />
                        <div className="text-[13px] font-semibold text-foreground leading-snug">{card.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Thread */
                <div className="max-w-3xl mx-auto space-y-6 pb-4">
                  {messages.map((msg) => {
                    const isModel = msg.role === "model";
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isModel ? "" : "flex-row-reverse"}`}>
                        {/* Avatar */}
                        <div className={`
                          h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5
                          ${isModel
                            ? "bg-card border border-border/80 text-emerald-500"
                            : "bg-emerald-500 text-white"}
                        `}>
                          {isModel ? <Sparkle className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        {/* Bubble */}
                        <div className={`
                          max-w-[76%] rounded-2xl
                          ${isModel
                            ? "text-foreground"
                            : "bg-accent border border-border/60 px-4 py-3"}
                        `}>
                          <p className={`
                            whitespace-pre-wrap leading-7
                            ${isModel
                              ? "text-[14px] text-foreground/90 font-normal"
                              : "text-[13px] text-foreground font-medium"}
                          `}>
                            {msg.content}
                          </p>
                          <span className="block text-[10px] text-muted-foreground/60 mt-2 tabular-nums font-mono">
                            {fmt(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* No session */
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-260px)] text-center max-w-xs mx-auto space-y-4">
                <Bot className="h-12 w-12 text-emerald-500/40" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Select a conversation</p>
                  <p className="text-xs text-muted-foreground mt-1">Or start a new one.</p>
                </div>
                <button
                  onClick={handleCreateSession}
                  disabled={isCreatingSession}
                  className="px-5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors"
                >
                  New Chat
                </button>
              </div>
            )}

            {/* Typing indicator */}
            {isSending && (
              <div className="max-w-3xl mx-auto flex gap-3 mt-6">
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-card border border-border/80 text-emerald-500">
                  <Sparkle className="h-4 w-4 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 h-8">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 rounded-full bg-emerald-500/60 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Quick queries — only when in active chat */}
        {activeSession && messages.length > 0 && (
          <div className="px-4 md:px-8 py-2 border-t border-border/40 overflow-x-auto shrink-0 scrollbar-none">
            <div className="flex items-center gap-2 min-w-max max-w-3xl mx-auto">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider shrink-0">
                Quick:
              </span>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={(e) => sendMessage(e, q.text)}
                  disabled={isSending}
                  className="
                    px-3 py-1.5 rounded-full text-[11px] font-medium transition-all
                    border border-border bg-card
                    hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-foreground
                    text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed
                  "
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        {activeSession && (
          <div className="px-4 md:px-8 py-4 border-t border-border bg-card/50 backdrop-blur-sm shrink-0">
            <form
              onSubmit={sendMessage}
              className="
                max-w-3xl mx-auto flex items-center gap-3
                bg-background border border-border rounded-2xl
                px-4 py-3
                focus-within:border-emerald-500/40
                focus-within:ring-2 focus-within:ring-emerald-500/10
                transition-all shadow-sm
              "
            >
              <Input
                placeholder="Ask about monitors, incidents, uptime, SSL..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
                className="
                  flex-1 bg-transparent border-0 shadow-none
                  text-[13px] placeholder:text-muted-foreground/40
                  text-foreground focus-visible:ring-0 focus-visible:ring-offset-0
                  h-7 px-0 font-normal
                "
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="
                  h-8 w-8 rounded-xl flex items-center justify-center shrink-0
                  bg-emerald-600 hover:bg-emerald-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  text-white transition-colors
                "
              >
                {isSending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
            <p className="text-[10px] text-center text-muted-foreground/50 mt-2.5 font-medium">
              AI can make mistakes — verify critical status checks manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
