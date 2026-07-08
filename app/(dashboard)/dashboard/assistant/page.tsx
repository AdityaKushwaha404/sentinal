"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Trash2, Edit2, Check, X, Plus, Loader2, Sparkles, User, Brain, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  
  // Loading states
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Edit session title states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

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
    setIsCreatingSession(true);
    try {
      const res = await fetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSession(newSession);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSession || isSending) return;

    const userText = inputText.trim();
    setInputText("");
    setIsSending(true);

    // Optimistically add user's message
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      sessionId: activeSession.id,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          content: userText,
        }),
      });

      if (res.ok) {
        const aiMsg = await res.json();
        setMessages((prev) => {
          // Replace temp message or just add the verified assistant message
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, { ...tempUserMsg, id: aiMsg.id - 1 }, aiMsg];
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate AI response.");
      }
    } catch (err: any) {
      console.error("Chat dispatch error:", err);
      // Append warning message in history block
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
      fetchSessions(); // Refresh list to update title sorting if desired
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] gap-4 md:gap-6 w-full max-w-7xl mx-auto items-stretch overflow-hidden">
      {/* Sidebar: Chat sessions list */}
      <div className="w-full md:w-80 flex flex-col border border-border/80 bg-card rounded-2xl p-4 overflow-hidden shrink-0 shadow-sm max-h-[220px] md:max-h-none">
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            Conversations
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 rounded-lg p-0 flex items-center justify-center border-border hover:bg-muted"
            onClick={handleCreateSession}
            disabled={isCreatingSession}
          >
            {isCreatingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {isSessionsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-xs font-semibold text-muted-foreground">
              No conversations started yet.
            </div>
          ) : (
            sessions.map((session) => {
              const isSelected = activeSession?.id === session.id;
              const isEditing = editingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => !isEditing && setActiveSession(session)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-semibold ${
                    isSelected
                      ? "bg-muted/80 border-border text-foreground shadow-sm"
                      : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-blue-500" : "text-muted-foreground/60"}`} />
                    {isEditing ? (
                      <Input
                        value={editTitleText}
                        onChange={(e) => setEditTitleText(e.target.value)}
                        className="h-6 py-0 px-1 border-border text-xs rounded"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate pr-8">{session.title}</span>
                    )}
                  </div>

                  <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 hover:bg-emerald-500/10 hover:text-emerald-500"
                          onClick={(e) => handleRenameSession(session.id, e)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          onClick={(e) => startRenameSession(session, e)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
      <div className="flex-1 flex flex-col border border-border/80 bg-card rounded-2xl overflow-hidden shadow-sm">
        {activeSession ? (
          <>
            {/* Header */}
            <div className="border-b border-border/80 px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-500 animate-pulse" />
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">{activeSession.title}</h4>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">Sentinel AI context-bound analytics console.</p>
                </div>
              </div>
              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5 mr-1" /> Gemini Powered
              </Badge>
            </div>

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isMessagesLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  Loading message logs...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-3.5">
                  <Brain className="h-10 w-10 text-muted-foreground/45" />
                  <div>
                    <h5 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Ask anything about Sentinel</h5>
                    <p className="text-muted-foreground text-xs leading-relaxed font-medium mt-1">
                      Sentinel AI can answer questions about server response times, active/past downtime incidents, SSL certificate expirations, or worst-performing check parameters.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full pt-4">
                    {[
                      "Which monitor is slow?",
                      "Uptime issues this week?",
                      "SSL certificate expiry dates?",
                      "Incident count yesterday?"
                    ].map((example, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant="outline"
                        className="text-[10px] font-bold text-muted-foreground text-left py-2 h-auto block truncate"
                        onClick={() => setInputText(example)}
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isModel = message.role === "model";
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 max-w-[85%] ${isModel ? "self-start" : "self-end flex-row-reverse"}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                        isModel ? "bg-blue-500/10 border-blue-500/20 text-blue-500" : "bg-muted border-border text-muted-foreground"
                      }`}>
                        {isModel ? <Brain className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>

                      <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed font-medium ${
                        isModel
                          ? "bg-card border-border text-foreground"
                          : "bg-blue-600 border-transparent text-white shadow-sm"
                      }`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <span className={`block text-[8px] mt-1.5 text-right font-mono ${isModel ? "text-muted-foreground/60" : "text-white/60"}`}>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              {isSending && (
                <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-blue-500/10 border-blue-500/20 text-blue-500">
                    <Brain className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="p-3.5 rounded-2xl border border-border bg-card text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
                    Analyzing database contexts...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border/80 flex gap-2 shrink-0 bg-muted/20">
              <Input
                placeholder="Ask about active incidents, average latency, or SSL certificate expiration dates..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
                className="bg-background border-border text-foreground rounded-xl text-xs placeholder:text-muted-foreground/60"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputText.trim() || isSending}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 text-xs flex items-center gap-1.5"
              >
                Send <Send className="h-3 w-3" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto space-y-4">
            <Brain className="h-12 w-12 text-muted-foreground/35 animate-bounce" />
            <div>
              <h4 className="text-sm font-extrabold text-foreground">Select a Conversation</h4>
              <p className="text-muted-foreground text-xs leading-relaxed font-semibold mt-1.5">
                Choose an active session from the sidebar or initialize a new conversation to query Sentinel data snapshots.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              onClick={handleCreateSession}
              disabled={isCreatingSession}
            >
              Start New Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
