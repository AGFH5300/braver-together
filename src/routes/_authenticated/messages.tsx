import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout, Section } from "@/components/SiteLayout";
import { toast } from "sonner";
import { Send, MessageCircle, AlertTriangle, Loader2, ArrowLeft, Calendar } from "lucide-react";

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
  advisor_id: string;
  last_message_at: string;
  status: string;
  other: Profile | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : undefined }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c: activeId } = Route.useSearch();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!me) return;
    loadConversations();
    const ch = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me]);

  async function loadConversations() {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, teen_id, advisor_id, last_message_at, status")
      .order("last_message_at", { ascending: false });
    if (!convs || !me) { setLoading(false); return; }
    const otherIds = Array.from(new Set(convs.map((c) => (c.teen_id === me ? c.advisor_id : c.teen_id))));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, headline, calendly_url, is_advisor")
      .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
    setConversations(convs.map((c) => ({ ...c, other: byId.get(c.teen_id === me ? c.advisor_id : c.teen_id) ?? null })));
    setLoading(false);
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <SiteLayout>
      <Section className="py-10">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
          <aside className={`rounded-2xl border border-border bg-card overflow-hidden flex flex-col ${activeId ? "hidden lg:flex" : "flex"}`}>
            <div className="p-4 border-b border-border">
              <div className="text-xs uppercase tracking-widest text-teal font-bold">Inbox</div>
              <h1 className="font-display text-xl font-bold mt-1">Messages</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No conversations yet. Browse advisors to start one.
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate({ to: "/messages", search: { c: c.id } })}
                    className={`w-full text-left px-4 py-3 border-b border-border hover:bg-secondary/50 transition ${activeId === c.id ? "bg-secondary" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-mesh text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {c.other?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{c.other?.display_name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.other?.headline ?? (c.other?.is_advisor ? "Advisor" : "Member")}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className={`rounded-2xl border border-border bg-card overflow-hidden flex flex-col ${activeId ? "flex" : "hidden lg:flex"}`}>
            {active && me ? <Thread conversation={active} me={me} /> : <EmptyThread />}
          </main>
        </div>
      </Section>
    </SiteLayout>
  );
}

function EmptyThread() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
      <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
      <div className="font-semibold text-foreground">Pick a conversation</div>
      <div className="text-xs mt-1">Or browse advisors to start a new one.</div>
    </div>
  );
}

function Thread({ conversation, me }: { conversation: Conversation; me: string }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const ch = supabase
      .channel(`thread-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversation.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: me,
      body: text,
    });
    if (error) toast.error(error.message);
    else setBody("");
    setSending(false);
  }

  const other = conversation.other;

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate({ to: "/messages", search: { c: undefined } })} className="lg:hidden p-1 hover:bg-secondary rounded">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-9 w-9 rounded-full bg-mesh text-white flex items-center justify-center text-sm font-semibold">
          {other?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{other?.display_name}</div>
          <div className="text-xs text-muted-foreground truncate">{other?.headline}</div>
        </div>
        {other?.calendly_url && (
          <a href={other.calendly_url} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90">
            <Calendar className="h-3 w-3" /> Book a call
          </a>
        )}
        <button onClick={() => setReportOpen(true)} title="Report this conversation" className="p-1.5 text-muted-foreground hover:text-warn">
          <AlertTriangle className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-secondary/30">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hi 👋</div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-mesh text-white" : "bg-card border border-border"}`}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="p-3 border-t border-border flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <button type="submit" disabled={sending || !body.trim()} className="inline-flex items-center justify-center rounded-full bg-mesh text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {reportOpen && <ReportDialog conversationId={conversation.id} me={me} onClose={() => setReportOpen(false)} />}
    </>
  );
}

function ReportDialog({ conversationId, me, onClose }: { conversationId: string; me: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({ conversation_id: conversationId, reporter_id: me, reason });
    if (error) toast.error(error.message);
    else { toast.success("Report submitted. Our team will review it."); onClose(); }
    setSubmitting(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl border border-border max-w-md w-full p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-warn" />
          <h2 className="font-display text-xl font-bold">Report this conversation</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Tell us what went wrong. Our admins will review the conversation.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="What happened?"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={submit} disabled={submitting || !reason.trim()} className="rounded-full bg-warn text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Submit report</button>
        </div>
      </div>
    </div>
  );
}
