import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Send,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, Section } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { askSupportAi, claimConversation, closeConversation } from "@/lib/support.functions";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  calendly_url: string | null;
  is_advisor: boolean;
};

type Conversation = {
  id: string;
  teen_id: string;
  advisor_id: string | null;
  subject: string;
  topic: string;
  status: string;
  last_message_at: string;
  ai_fallback_enabled: boolean;
  ai_handoff_required: boolean;
  claimed_at: string | null;
  created_at: string;
  other: Profile | null;
  unread: boolean;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_kind: "human" | "ai" | "system";
  body: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type MeProfile = {
  id: string;
  is_advisor: boolean;
  display_name: string;
};

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({ c: typeof search.c === "string" ? search.c : undefined }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c: activeId } = Route.useSearch();
  const navigate = useNavigate();
  const claim = useServerFn(claimConversation);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [tab, setTab] = useState<"mine" | "queue">("mine");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      const { data: profile } = await supabase.from("profiles").select("id, is_advisor, display_name").eq("id", auth.user.id).maybeSingle();
      if (!cancelled) setMe({ id: auth.user.id, is_advisor: profile?.is_advisor ?? false, display_name: profile?.display_name || "Member" });
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!me) return;
    void loadConversations();
    const channel = supabase.channel(`support-inbox-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void loadConversations())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [me]);

  async function loadConversations() {
    if (!me) return;
    const { data: rows, error } = await supabase.from("conversations")
      .select("id, teen_id, advisor_id, subject, topic, status, last_message_at, ai_fallback_enabled, ai_handoff_required, claimed_at, created_at")
      .order("last_message_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const profileIds = Array.from(new Set((rows ?? []).flatMap((row) => [row.teen_id, row.advisor_id].filter(Boolean) as string[])));
    const [{ data: profiles }, { data: reads }] = await Promise.all([
      profileIds.length
        ? supabase.from("profiles").select("id, display_name, avatar_url, headline, calendly_url, is_advisor").in("id", profileIds)
        : Promise.resolve({ data: [] as Profile[], error: null }),
      supabase.from("conversation_reads").select("conversation_id, last_read_at").eq("user_id", me.id),
    ]);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as Profile]));
    const readMap = new Map((reads ?? []).map((read) => [read.conversation_id, read.last_read_at]));

    setConversations((rows ?? []).map((row) => {
      const otherId = row.teen_id === me.id ? row.advisor_id : row.teen_id;
      const lastRead = readMap.get(row.id);
      return {
        ...row,
        other: otherId ? profileMap.get(otherId) ?? null : null,
        unread: !lastRead || Date.parse(row.last_message_at) > Date.parse(lastRead),
      } as Conversation;
    }));
    setLoading(false);
  }

  const visible = useMemo(() => conversations.filter((conversation) => {
    const queued = conversation.advisor_id === null && conversation.teen_id !== me?.id;
    return tab === "queue" ? queued : !queued;
  }), [conversations, me?.id, tab]);

  const active = conversations.find((conversation) => conversation.id === activeId);
  const activeIsQueueItem = Boolean(active && active.advisor_id === null && active.teen_id !== me?.id);

  async function claimActive() {
    if (!active) return;
    setClaiming(true);
    try {
      await claim({ data: { conversationId: active.id } });
      toast.success("Request claimed");
      setTab("mine");
      await loadConversations();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <SiteLayout>
      <Section className="py-8 sm:py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-teal">Support inbox</div>
            <h1 className="mt-1 font-display text-3xl font-bold">Messages</h1>
          </div>
          <button onClick={() => navigate({ to: "/advisors" })} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">New request</button>
        </div>

        <div className="grid min-h-[650px] gap-5 lg:h-[calc(100vh-11rem)] lg:grid-cols-[340px_1fr]">
          <aside className={cn("overflow-hidden rounded-2xl border border-border bg-card flex-col", activeId ? "hidden lg:flex" : "flex")}>
            {me?.is_advisor && (
              <div className="grid grid-cols-2 border-b border-border p-2">
                <button onClick={() => setTab("mine")} className={cn("rounded-lg px-3 py-2 text-sm font-semibold", tab === "mine" ? "bg-navy text-white" : "text-muted-foreground hover:bg-secondary")}>My inbox</button>
                <button onClick={() => setTab("queue")} className={cn("rounded-lg px-3 py-2 text-sm font-semibold", tab === "queue" ? "bg-navy text-white" : "text-muted-foreground hover:bg-secondary")}>Open queue</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-teal" /></div>
              ) : visible.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Inbox className="mx-auto mb-3 h-9 w-9 opacity-35" />
                  {tab === "queue" ? "There are no unclaimed requests." : "No conversations yet."}
                </div>
              ) : visible.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => navigate({ to: "/messages", search: { c: conversation.id } })}
                  className={cn("w-full border-b border-border px-4 py-4 text-left transition hover:bg-secondary/60", activeId === conversation.id && "bg-secondary")}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mesh text-sm font-bold text-white">
                      {conversation.other?.display_name?.[0]?.toUpperCase() ?? (conversation.advisor_id ? "?" : "Q")}
                      {conversation.unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-teal" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{conversation.subject}</div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelative(conversation.last_message_at)}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {conversation.advisor_id === null
                          ? conversation.teen_id === me?.id ? "Waiting for a human advisor" : `Unclaimed · ${conversation.topic}`
                          : conversation.other?.display_name || "Advisor conversation"}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {conversation.status === "closed" && <Badge>Closed</Badge>}
                        {conversation.ai_handoff_required && <Badge ai>AI handoff</Badge>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className={cn("overflow-hidden rounded-2xl border border-border bg-card flex-col", activeId ? "flex" : "hidden lg:flex")}>
            {!active || !me ? (
              <EmptyThread />
            ) : activeIsQueueItem ? (
              <QueuePreview conversation={active} claiming={claiming} onClaim={claimActive} onBack={() => navigate({ to: "/messages", search: { c: undefined } })} />
            ) : (
              <Thread conversation={active} me={me} onChanged={loadConversations} />
            )}
          </main>
        </div>
      </Section>
    </SiteLayout>
  );
}

function QueuePreview({ conversation, claiming, onClaim, onBack }: { conversation: Conversation; claiming: boolean; onClaim: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded p-1 hover:bg-secondary lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
        <div><div className="text-xs font-bold uppercase tracking-widest text-teal">Open advisor queue</div><div className="font-semibold">{conversation.subject}</div></div>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <UserRoundCheck className="mx-auto h-12 w-12 text-teal" />
          <h2 className="mt-5 text-2xl font-bold">Claim this support request</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">For privacy, the question itself becomes visible after you claim it. Claiming assigns the conversation to you and tells the user that a human advisor has joined.</p>
          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4 text-left text-sm">
            <div><span className="font-semibold">Topic:</span> {conversation.topic}</div>
            <div className="mt-2"><span className="font-semibold">Submitted:</span> {new Date(conversation.created_at).toLocaleString()}</div>
            {conversation.ai_handoff_required && <div className="mt-2 flex items-center gap-2 text-teal"><Bot className="h-4 w-4" /> AI activity requires human review</div>}
          </div>
          <button onClick={onClaim} disabled={claiming} className="mt-6 inline-flex items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white disabled:opacity-50">
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {claiming ? "Claiming…" : "Claim request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <MessageCircle className="mb-3 h-11 w-11 opacity-30" />
      <div className="font-semibold text-foreground">Choose a conversation</div>
      <div className="mt-1 max-w-sm text-xs">Messages, advisor handoffs and limited AI responses will appear here in one continuous thread.</div>
    </div>
  );
}

function Thread({ conversation, me, onChanged }: { conversation: Conversation; me: MeProfile; onChanged: () => Promise<void> }) {
  const navigate = useNavigate();
  const askAi = useServerFn(askSupportAi);
  const close = useServerFn(closeConversation);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [askingAi, setAskingAi] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const isTeen = conversation.teen_id === me.id;
  const aiAvailable = isTeen && conversation.advisor_id === null && conversation.ai_fallback_enabled && conversation.status === "open";

  useEffect(() => {
    void loadMessages();
    void markRead();
    const channel = supabase.channel(`thread-${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        setMessages((previous) => previous.some((message) => message.id === (payload.new as Message).id) ? previous : [...previous, payload.new as Message]);
        void markRead();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversation.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadMessages() {
    const { data, error } = await supabase.from("messages").select("id, conversation_id, sender_id, sender_kind, body, metadata, created_at")
      .eq("conversation_id", conversation.id).order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setMessages((data ?? []) as Message[]);
  }

  async function markRead() {
    await supabase.from("conversation_reads").upsert({ conversation_id: conversation.id, user_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: "conversation_id,user_id" });
  }

  async function insertHumanMessage(text: string) {
    const { error } = await supabase.from("messages").insert({ conversation_id: conversation.id, sender_id: me.id, sender_kind: "human", body: text });
    if (error) throw new Error(error.message);
    setBody("");
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try { await insertHumanMessage(text); } catch (error) { toast.error((error as Error).message); } finally { setSending(false); }
  }

  async function sendToAi() {
    const text = body.trim();
    if (!text) return;
    setAskingAi(true);
    try {
      await insertHumanMessage(text);
      const result = await askAi({ data: { conversationId: conversation.id, message: text } });
      if (!result.configured) toast.info(result.message);
      else toast.success(`AI helper replied · ${result.remaining} uses remaining today`);
      await loadMessages();
      await onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setAskingAi(false);
    }
  }

  async function closeThread() {
    setClosing(true);
    try {
      await close({ data: { conversationId: conversation.id } });
      toast.success("Conversation closed");
      await onChanged();
    } catch (error) { toast.error((error as Error).message); } finally { setClosing(false); }
  }

  const other = conversation.other;
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/messages", search: { c: undefined } })} className="rounded p-1 hover:bg-secondary lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mesh text-sm font-semibold text-white">{other?.display_name?.[0]?.toUpperCase() ?? (conversation.advisor_id ? "?" : "Q")}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-sm">{conversation.subject}</div>
          <div className="truncate text-xs text-muted-foreground">{conversation.advisor_id ? other?.display_name || "Human advisor" : "Waiting in the human advisor queue"}</div>
        </div>
        {other?.calendly_url && <a href={other.calendly_url} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold sm:inline-flex"><Calendar className="h-3 w-3" /> Book call</a>}
        {conversation.status === "open" && <button onClick={closeThread} disabled={closing} title="Close conversation" className="p-1.5 text-muted-foreground hover:text-danger">{closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}</button>}
        <button onClick={() => setReportOpen(true)} title="Report conversation" className="p-1.5 text-muted-foreground hover:text-warn"><AlertTriangle className="h-4 w-4" /></button>
      </div>

      {conversation.ai_handoff_required && conversation.advisor_id && (
        <div className="flex items-center gap-2 border-b border-teal/20 bg-teal/10 px-4 py-2 text-xs text-navy-deep"><Bot className="h-4 w-4 text-teal" /> A limited AI helper replied earlier. The human advisor should review the full context.</div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-4">
        {messages.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">No messages yet.</div>}
        {messages.map((message) => <MessageBubble key={message.id} message={message} mine={message.sender_id === me.id} />)}
        <div ref={endRef} />
      </div>

      {conversation.status === "closed" ? (
        <div className="flex items-center justify-center gap-2 border-t border-border p-4 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-teal" /> This conversation is closed.</div>
      ) : (
        <form onSubmit={send} className="border-t border-border p-3">
          <div className="flex gap-2">
            <input value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Write a message without personal or confidential information…" className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal/40" />
            <button type="submit" disabled={sending || askingAi || !body.trim()} className="inline-flex items-center justify-center rounded-full bg-mesh px-4 py-2 text-white disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
          </div>
          {aiAvailable && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-teal/5 px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 text-teal" /> No advisor is assigned. The optional AI is deliberately limited and the request remains queued.</div>
              <button type="button" onClick={sendToAi} disabled={askingAi || sending || !body.trim()} className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 px-3 py-1.5 text-xs font-semibold text-teal disabled:opacity-50">{askingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />} Ask limited AI</button>
            </div>
          )}
        </form>
      )}

      {reportOpen && <ReportDialog conversationId={conversation.id} me={me.id} onClose={() => setReportOpen(false)} />}
    </>
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  if (message.sender_kind === "system") {
    return <div className="flex justify-center"><div className="rounded-full border border-border bg-card px-4 py-2 text-center text-[11px] text-muted-foreground">{message.body}</div></div>;
  }
  const ai = message.sender_kind === "ai";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[72%]", mine ? "bg-mesh text-white" : ai ? "border border-teal/25 bg-teal/10 text-foreground" : "border border-border bg-card")}>
        {ai && <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-teal"><Bot className="h-3.5 w-3.5" /> Limited educational AI · not a lawyer</div>}
        <div className="whitespace-pre-wrap break-words">{message.body}</div>
        <div className={cn("mt-2 text-right text-[9px]", mine ? "text-white/60" : "text-muted-foreground")}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
    </div>
  );
}

function Badge({ children, ai = false }: { children: React.ReactNode; ai?: boolean }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", ai ? "bg-teal/10 text-teal" : "bg-secondary text-muted-foreground")}>{children}</span>;
}

function formatRelative(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short" });
}

function ReportDialog({ conversationId, me, onClose }: { conversationId: string; me: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({ conversation_id: conversationId, reporter_id: me, reason: reason.trim() });
    if (error) toast.error(error.message);
    else { toast.success("Report submitted for review"); onClose(); }
    setSubmitting(false);
  }
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-deep/65 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warn" /><h2 className="font-display text-xl font-bold">Report this conversation</h2></div>
        <p className="mt-2 text-sm text-muted-foreground">An admin can review the conversation and take appropriate action.</p>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1000} placeholder="What happened?" className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40" />
        <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button onClick={submit} disabled={submitting || !reason.trim()} className="rounded-full bg-warn px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit report"}</button></div>
      </div>
    </div>
  );
}
