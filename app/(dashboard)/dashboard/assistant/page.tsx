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
    <div className="flex h-[calc(100vh-100px)] w-full max-w-7xl mx-auto rounded-3xl overflow-hidden border border-border bg-[#131314] text-[#e3e3e3] shadow-2xl relative font-sans">
      
      {/* Sidebar: Chat sessions list (Gemini Style) */}
      <div className={`transition-all duration-300 ease-in-out flex flex-col border-r border-[#2d2f31] bg-[#1e1f20] shrink-0 z-20 ${
        sidebarOpen 
          ? "w-72 absolute md:relative h-full" 
          : "w-0 absolute md:relative overflow-hidden border-r-0"
      }`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2d2f31]/60">
          <button 
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#2a2b2d] hover:bg-[#333537] text-sm font-semibold transition-all border border-[#444746]/50 shadow-sm flex-1 mr-2"
          >
            {isCreatingSession ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            ) : (
              <Plus className="h-4 w-4 text-blue-400" />
            )}
            <span>New Chat</span>
          </button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-[#333537] text-[#c4c7c5]"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          <div className="text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider px-3 mb-2">Recent</div>
          {isSessionsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-[#9aa0a6] gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#9aa0a6] font-medium">
              No conversations yet.
            </div>
          ) : (
            sessions.map((session) => {
              const isSelected = activeSession?.id === session.id;
              const isEditing = editingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => !isEditing && setActiveSession(session)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-full transition-all cursor-pointer text-xs font-semibold ${
                    isSelected
                      ? "bg-[#004a77]/20 text-[#c2e7ff] border border-[#004a77]/40"
                      : "bg-transparent text-[#e3e3e3] hover:bg-[#282a2c]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MessageSquare className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#7fcfff]" : "text-[#9aa0a6]"}`} />
                    {isEditing ? (
                      <Input
                        value={editTitleText}
                        onChange={(e) => setEditTitleText(e.target.value)}
                        className="h-6 py-0 px-1 border-[#444746] bg-[#1e1f20] text-xs rounded text-[#e3e3e3] focus-visible:ring-0 focus-visible:ring-offset-0"
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
                          className="p-1 hover:bg-[#333537] text-emerald-400 rounded-full"
                          onClick={(e) => handleRenameSession(session.id, e)}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 hover:bg-[#333537] text-red-400 rounded-full"
                          onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="p-1 hover:bg-[#333537] text-[#9aa0a6] hover:text-[#e3e3e3] rounded-full"
                          onClick={(e) => startRenameSession(session, e)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 hover:bg-[#333537] text-[#9aa0a6] hover:text-red-400 rounded-full"
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

      {/* Main chat layout */}
      <div className="flex-1 flex flex-col bg-[#131314] overflow-hidden h-full">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#2d2f31] px-6 py-3.5 bg-[#131314]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 rounded-full hover:bg-[#282a2c] text-[#c4c7c5] mr-2"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#a8c7fa] text-xs font-bold uppercase tracking-wider">Sentinel Space</span>
                <span className="bg-[#a8c7fa]/10 text-[#a8c7fa] border border-[#a8c7fa]/20 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">
                  v2.1
                </span>
              </div>
              <h2 className="text-sm font-bold text-[#e3e3e3] mt-0.5">
                {activeSession ? activeSession.title : "Gemini Diagnostics"}
              </h2>
            </div>
          </div>
          
          <Badge className="bg-[#004a77]/30 text-[#7fcfff] border border-[#004a77]/50 text-[10px] font-bold px-2.5 py-1">
            <Sparkles className="h-3 w-3 mr-1 text-[#7fcfff] animate-pulse" /> Gemini Pro
          </Badge>
        </div>

        {/* Message Log Canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-thin">
          {activeSession ? (
            messages.length === 0 ? (
              <div className="flex flex-col justify-center h-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#4285f4] via-[#9b51e0] to-[#e06c75] bg-clip-text text-transparent">
                    Hello, Operator.
                  </h1>
                  <p className="text-[#9aa0a6] text-sm font-medium mt-2">
                    How can I assist you with Sentinel analytics monitoring today?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    { text: "Check active monitors status", sub: "Analyze response latency & ping types" },
                    { text: "Review weekly uptime metrics", sub: "Generate failure rate report" },
                    { text: "List expiring SSL certificates", sub: "Check certificate status warnings" },
                    { text: "Show recent server downtime logs", sub: "Investigate downtime duration" }
                  ].map((card, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(card.text)}
                      className="p-4 rounded-2xl bg-[#1e1f20] hover:bg-[#2a2b2d] border border-[#2d2f31] hover:border-[#444746] text-left transition-all group"
                    >
                      <Bot className="h-5 w-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-bold text-[#e3e3e3]">{card.text}</div>
                      <div className="text-[10px] text-[#9aa0a6] mt-0.5 font-medium">{card.sub}</div>
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
                          ? "bg-[#1e1f20] border-[#2d2f31] text-[#7fcfff]" 
                          : "bg-blue-600 border-transparent text-white"
                      }`}>
                        {isModel ? <Sparkle className="h-4 w-4 fill-current" /> : <User className="h-4 w-4" />}
                      </div>

                      <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-[80%] ${
                        isModel 
                          ? "bg-transparent text-[#e3e3e3] font-medium" 
                          : "bg-[#2e3135] text-[#f2f2f2] font-semibold border border-[#3e4246]"
                      }`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <span className="block text-[8px] text-[#9aa0a6] mt-2 font-mono">
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
              <Bot className="h-14 w-14 text-blue-400 animate-bounce" />
              <div>
                <h4 className="text-sm font-extrabold text-[#e3e3e3]">Select a Conversation</h4>
                <p className="text-[#9aa0a6] text-xs leading-relaxed font-semibold mt-1.5">
                  Choose an active session from the sidebar or click below to start a new diagnostics chat.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-[#004a77] hover:bg-[#005c95] text-[#c2e7ff] font-bold rounded-full px-5 py-4 border border-[#004a77]/50"
                onClick={handleCreateSession}
                disabled={isCreatingSession}
              >
                Start New Chat
              </Button>
            </div>
          )}

          {isSending && (
            <div className="max-w-3xl mx-auto flex gap-4 self-start">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-[#1e1f20] border-[#2d2f31] text-[#7fcfff]">
                <Sparkle className="h-4 w-4 fill-current animate-spin" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9aa0a6] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                Querying database metrics...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar Section */}
        {activeSession && (
          <div className="p-4 border-t border-[#2d2f31] bg-[#131314]">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-center bg-[#1e1f20] border border-[#2d2f31] hover:border-[#444746] rounded-full px-4 py-2 transition-all">
              <Input
                placeholder="Ask about active incidents, average latency, or SSL certificate expiration dates..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
                className="flex-1 bg-transparent border-0 text-xs placeholder:text-[#9aa0a6] text-[#e3e3e3] focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputText.trim() || isSending}
                className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-0 shrink-0 flex items-center justify-center border-0 ml-2"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="text-[10px] text-center text-[#9aa0a6] mt-2 font-medium">
              Gemini can make errors. Verify important status checks manually.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
