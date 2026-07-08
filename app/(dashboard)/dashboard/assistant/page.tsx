"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Trash2, Edit2, Check, X, Plus, Loader2, Sparkles, User, Brain, Menu, PanelLeftClose, PanelLeft, Bot, Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

export default function AssistantPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Loading states
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Edit session title states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Suggested questions available at all times
  const suggestedQuestions = [
    { text: "Check active monitors status", sub: "Analyze response latency & ping types" },
    { text: "Review weekly uptime metrics", sub: "Generate failure rate report" },
    { text: "List expiring SSL certificates", sub: "Check certificate status warnings" },
    { text: "Show recent server downtime logs", sub: "Investigate downtime duration" }
  ];

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Load messages when active session changes
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
        // Force open sidebar if created on mobile to confirm
        if (window.innerWidth < 768) {
          setSidebarOpen(true);
        }
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      const res = await fetch(`/api/assistant/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSession?.id === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
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
        if (activeSession?.id === sessionId) {
          setActiveSession(updated);
        }
        setEditingSessionId(null);
      }
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const queryText = (customText || inputText).trim();
    if (!queryText || !activeSession || isSending) return;

    setInputText("");
    setIsSending(true);

    const tempUserMsg: Message = {
      id: Math.random().toString(),
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
        body: JSON.stringify({
          sessionId: activeSession.id,
          content: queryText,
        }),
      });

      if (res.ok) {
        const aiMsg = await res.json();
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, { ...tempUserMsg, id: aiMsg.id - 1 }, aiMsg];
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate AI response.");
      }
    } catch (err: any) {
      console.error("Chat dispatch error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sessionId: activeSession.id,
          role: "model",
          content: `⚠️ Failed to fetch response: ${err.message || "Network Timeout."}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
      fetchSessions();
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] w-full max-w-7xl mx-auto rounded-2xl overflow-hidden border border-border bg-card text-card-foreground shadow-sm relative font-sans">
      
      {/* Sidebar: Chat sessions list (Using App Theme colors) */}
      <div className={`transition-all duration-300 ease-in-out flex flex-col border-r border-border bg-card/95 shrink-0 z-30 ${
        sidebarOpen 
          ? "w-72 absolute md:relative h-full" 
          : "w-0 absolute md:relative overflow-hidden border-r-0"
      }`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button 
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-xs font-bold transition-all border border-border flex-1 mr-2 text-foreground"
          >
            {isCreatingSession ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
            ) : (
              <Plus className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span>NEW CHAT</span>
          </button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">Recent</div>
          {isSessionsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground font-semibold">
              No conversations yet.
            </div>
          ) : (
            sessions.map((session) => {
              const isSelected = activeSession?.id === session.id;
              const isEditing = editingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session);
                    // Close sidebar on mobile when session selected
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-xs font-bold ${
                    isSelected
                      ? "bg-accent/65 border-border/80 text-foreground"
                      : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={`h-4 w-4 shrink-0 ${isSelected ? "text-emerald-500" : "text-muted-foreground"}`} />
                    {isEditing ? (
                      <Input
                        value={editTitleText}
                        onChange={(e) => setEditTitleText(e.target.value)}
                        className="h-6 py-0 px-1 border-border bg-background text-xs rounded text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate pr-10">{session.title}</span>
                    )}
                  </div>

                  <div className="absolute right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button
                          className="p-1 hover:bg-muted text-emerald-500 rounded-lg"
                          onClick={(e) => handleRenameSession(session.id, e)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1 hover:bg-muted text-destructive rounded-lg"
                          onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg"
                          onClick={(e) => startRenameSession(session, e)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1 hover:bg-muted text-muted-foreground hover:text-destructive rounded-lg"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Main chat layout */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-card/65 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground mr-2"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Sentinel Space</span>
                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">
                  v2.1
                </span>
              </div>
              <h2 className="text-sm font-bold text-foreground mt-0.5">
                {activeSession ? activeSession.title : "Diagnostics Console"}
              </h2>
            </div>
          </div>
          
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-1">
            <Sparkles className="h-3 w-3 mr-1 text-emerald-500 animate-pulse" /> Diagnostics Active
          </Badge>
        </div>

        {/* Message Log Canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-thin">
          {activeSession ? (
            messages.length === 0 ? (
              <div className="flex flex-col justify-center h-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                    Hello, Operator.
                  </h1>
                  <p className="text-muted-foreground text-sm font-medium mt-2">
                    How can I assist you with Sentinel analytics monitoring today?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {suggestedQuestions.map((card, i) => (
                    <button
                      key={i}
                      onClick={(e) => handleSendMessage(e, card.text)}
                      className="p-4 rounded-2xl bg-card hover:bg-muted/40 border border-border hover:border-muted-foreground/30 text-left transition-all group cursor-pointer"
                    >
                      <Bot className="h-5 w-5 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-bold text-foreground">{card.text}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">{card.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((message) => {
                  const isModel = message.role === "model";
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${isModel ? "self-start" : "self-end flex-row-reverse"}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                        isModel 
                          ? "bg-card border-border text-emerald-500" 
                          : "bg-emerald-500 border-transparent text-white"
                      }`}>
                        {isModel ? <Sparkle className="h-4 w-4 fill-current" /> : <User className="h-4 w-4" />}
                      </div>

                      <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-[80%] ${
                        isModel 
                          ? "bg-transparent text-foreground font-medium" 
                          : "bg-muted text-foreground font-semibold border border-border"
                      }`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <span className="block text-[8px] text-muted-foreground mt-2 font-mono">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto space-y-5">
              <Bot className="h-14 w-14 text-emerald-500 animate-bounce" />
              <div>
                <h4 className="text-sm font-extrabold text-foreground">Select a Conversation</h4>
                <p className="text-muted-foreground text-xs leading-relaxed font-semibold mt-1.5">
                  Choose an active session from the sidebar or click below to start a new diagnostics chat.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/80 text-foreground font-bold rounded-xl px-5 py-4 border border-border"
                onClick={handleCreateSession}
                disabled={isCreatingSession}
              >
                Start New Chat
              </Button>
            </div>
          )}

          {isSending && (
            <div className="max-w-3xl mx-auto flex gap-4 self-start">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-card border-border text-emerald-500">
                <Sparkle className="h-4 w-4 fill-current animate-spin" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Querying database metrics...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested questions drawer available at all times at the bottom of the chat screen */}
        {activeSession && messages.length > 0 && (
          <div className="px-6 py-2 bg-background border-t border-border/40 overflow-x-auto shrink-0 scrollbar-none">
            <div className="flex items-center gap-2 min-w-max max-w-3xl mx-auto py-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mr-2 select-none">Quick Queries:</span>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={(e) => handleSendMessage(e, q.text)}
                  className="px-3 py-1.5 rounded-full border border-border hover:border-emerald-500/30 bg-card hover:bg-accent text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar Section */}
        {activeSession && (
          <div className="p-4 border-t border-border bg-card shrink-0">
            <form onSubmit={(e) => handleSendMessage(e)} className="max-w-3xl mx-auto relative flex items-center bg-background border border-border hover:border-muted-foreground/30 rounded-xl px-4 py-2 transition-all">
              <Input
                placeholder="Ask about active incidents, average latency, or SSL certificate expiration dates..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
                className="flex-1 bg-transparent border-0 text-xs placeholder:text-muted-foreground/60 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputText.trim() || isSending}
                className="h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-0 shrink-0 flex items-center justify-center border-0 ml-2"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="text-[9px] text-center text-muted-foreground mt-2 font-medium">
              Diagnostics Assistant can make errors. Verify status checks manually.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
