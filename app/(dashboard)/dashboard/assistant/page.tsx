"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare, Send, Trash2, Edit2, Check, X, Plus,
  Loader2, Sparkle, User, Bot, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession.id);
    } else {
      setMessages([]);
    }
  }, [activeSession]);

  const fetchSessions = async () => {
    setIsSessionsLoading(true);
    try {
      const res = await fetch("/api/assistant/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    setIsMessagesLoading(true);
    try {
      const res = await fetch(`/api/assistant/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setIsMessagesLoading(false);
    }
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
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSession(newSession);
        if (window.innerWidth < 768) setSidebarOpen(false);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`/api/assistant/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);
        if (activeSession?.id === sessionId) {
          setActiveSession(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const startRenameSession = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleText(session.title);
  };

  const handleRenameSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitleText.trim()) return;
    try {
      const res = await fetch(`/api/assistant/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleText.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
        if (activeSession?.id === sessionId) setActiveSession(updated);
        setEditingSessionId(null);
      }
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent | React.MouseEvent, customText?: string) => {
    if (e) e.preventDefault();
    const queryText = (customText || inputText).trim();
    if (!queryText || !activeSession || isSending) return;

    setInputText("");
    setIsSending(true);

    const tempUserMsg: Message = {
      id: `temp-${Math.random()}`,
      sessionId: activeSession.id,
      role: "user",
      content: queryText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, content: queryText }),
      });

      if (res.ok) {
        const aiMsg = await res.json();
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, { ...tempUserMsg, id: `${aiMsg.id}-user` }, aiMsg];
        });
        // Refresh session titles after first message (for dynamic rename)
        fetchSessions();
      } else {
        throw new Error("Failed to get response.");
      }
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        tempUserMsg,
        {
          id: `err-${Math.random()}`,
          sessionId: activeSession.id,
          role: "model",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full mx-auto overflow-hidden bg-background text-foreground">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <div
        className={`transition-all duration-300 ease-in-out flex flex-col border-r border-border bg-card shrink-0 z-30 ${
          sidebarOpen
            ? "w-64 absolute md:relative h-full"
            : "w-0 overflow-hidden border-r-0"
        }`}
      >
        {/* Sidebar top */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/80 border border-border transition-colors text-foreground"
          >
            {isCreatingSession ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500 shrink-0" />
            ) : (
              <Plus className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
            New Chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-2">
            Recent
          </p>

          {isSessionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            sessions.map((session) => {
              const isSelected = activeSession?.id === session.id;
              const isEditing = editingSessionId === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <MessageSquare
                    className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-emerald-500" : "text-muted-foreground"}`}
                  />
                  {isEditing ? (
                    <Input
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      className="h-5 py-0 px-1 text-xs border-border bg-background rounded focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground flex-1"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate flex-1 font-medium">{session.title}</span>
                  )}

                  <div className="absolute right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button
                          className="p-1 rounded hover:bg-muted text-emerald-500"
                          onClick={(e) => handleRenameSession(session.id, e)}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-muted text-destructive"
                          onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          onClick={(e) => startRenameSession(session, e)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
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
      </div>

      {/* ── Main chat area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header — clean: just toggle + chat name */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0 h-[49px]">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-foreground truncate">
            {activeSession ? activeSession.title : "AI Assistant"}
          </h2>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {activeSession ? (
            isMessagesLoading ? (
              <div className="flex justify-center pt-20">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            ) : messages.length === 0 ? (
              /* Welcome screen */
              <div className="flex flex-col justify-center h-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                    How can I help you?
                  </h1>
                  <p className="text-muted-foreground text-sm mt-2">
                    Ask me about your monitors, incidents, SSL certificates, uptime reports, or anything about how Sentinel works.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestedQuestions.map((card, i) => (
                    <button
                      key={i}
                      onClick={(e) => handleSendMessage(e, card.text)}
                      className="p-4 rounded-xl bg-card hover:bg-muted/50 border border-border hover:border-border/80 text-left transition-all group"
                    >
                      <Bot className="h-4 w-4 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-semibold text-foreground">{card.text}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message thread */
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((msg) => {
                  const isModel = msg.role === "model";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isModel ? "" : "flex-row-reverse"}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          isModel
                            ? "bg-card border border-border text-emerald-500"
                            : "bg-emerald-500 text-white"
                        }`}
                      >
                        {isModel ? (
                          <Sparkle className="h-3.5 w-3.5" />
                        ) : (
                          <User className="h-3.5 w-3.5" />
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`rounded-2xl text-xs leading-relaxed max-w-[78%] ${
                          isModel
                            ? "text-foreground py-0"
                            : "bg-accent text-foreground px-4 py-3 border border-border"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <span className="block text-[10px] text-muted-foreground mt-2 tabular-nums">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* No session selected */
            <div className="flex flex-col items-center justify-center h-full text-center max-w-xs mx-auto space-y-4">
              <Bot className="h-12 w-12 text-emerald-500/60" />
              <div>
                <p className="text-sm font-semibold text-foreground">Select a conversation</p>
                <p className="text-xs text-muted-foreground mt-1">Or start a new one below.</p>
              </div>
              <button
                onClick={handleCreateSession}
                disabled={isCreatingSession}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 border border-border text-xs font-semibold text-foreground transition-colors"
              >
                New Chat
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {isSending && (
            <div className="max-w-3xl mx-auto flex gap-3">
              <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-card border border-border text-emerald-500">
                <Sparkle className="h-3.5 w-3.5 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick queries bar — only when there are messages */}
        {activeSession && messages.length > 0 && (
          <div className="px-5 py-2 border-t border-border/50 overflow-x-auto shrink-0 scrollbar-none">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 select-none">
                Quick:
              </span>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={(e) => handleSendMessage(e, q.text)}
                  disabled={isSending}
                  className="px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        {activeSession && (
          <div className="p-4 border-t border-border bg-card shrink-0">
            <form
              onSubmit={(e) => handleSendMessage(e)}
              className="max-w-3xl mx-auto flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-2 focus-within:border-muted-foreground/40 transition-colors"
            >
              <Input
                placeholder="Ask about monitors, incidents, uptime, SSL..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
                className="flex-1 bg-transparent border-0 text-xs placeholder:text-muted-foreground/50 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 h-8 px-0"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputText.trim() || isSending}
                className="h-7 w-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white p-0 shrink-0 flex items-center justify-center border-0"
              >
                {isSending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </form>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              AI can make mistakes. Verify critical status checks manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
