import { BrainCircuit, Loader2, Send, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createSupportRequest } from "@/lib/support.functions";

const topics = [
  ["privacy", "Privacy & personal data"],
  ["social-media", "Social media and platform rules"],
  ["contracts", "Terms, subscriptions and online contracts"],
  ["safety", "Online safety, scams or cyberbullying"],
  ["ai", "AI, deepfakes or algorithms"],
  ["copyright", "Copyright and creator rights"],
  ["general", "Something else"],
] as const;

type Topic = (typeof topics)[number][0];

export function SupportRequestDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void | Promise<void>;
}) {
  const createRequest = useServerFn(createSupportRequest);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [message, setMessage] = useState("");
  const [allowAi, setAllowAi] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, submitting]);

  if (!open) return null;

  function reset() {
    setSubject("");
    setTopic("general");
    setMessage("");
    setAllowAi(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (subject.trim().length < 5 || message.trim().length < 10) return;

    setSubmitting(true);
    try {
      const result = await createRequest({
        data: {
          subject,
          topic,
          message,
          advisorId: null,
          allowAiFallback: allowAi,
        },
      });
      toast.success("Support request created");
      reset();
      onClose();
      await onCreated(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your support request could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-navy-deep/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !submitting) onClose();
      }}
    >
      <form onSubmit={submit} className="mx-auto my-8 w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-teal">New support request</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Ask the advisor team</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your request will appear here in Messages immediately and stay in the advisor queue until someone claims it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-6 block text-sm font-semibold">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            minLength={5}
            maxLength={120}
            required
            autoFocus
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/30"
            placeholder="What do you need help understanding?"
          />
        </label>

        <label className="mt-5 block text-sm font-semibold">
          Topic
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value as Topic)}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/30"
          >
            {topics.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="mt-5 block text-sm font-semibold">
          Your question
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={10}
            maxLength={4000}
            required
            rows={7}
            className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-normal leading-relaxed outline-none focus:ring-2 focus:ring-teal/30"
            placeholder="Give enough context for an advisor to understand the issue, but leave out names, passwords, addresses and other private information."
          />
          <span className="mt-1 block text-right text-xs font-normal text-muted-foreground">{message.length}/4000</span>
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4">
          <input
            type="checkbox"
            checked={allowAi}
            onChange={(event) => setAllowAi(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <BrainCircuit className="h-4 w-4 text-teal" /> Allow limited AI help while waiting
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              The request still stays in the human advisor queue. The AI option is only available when no approved advisor is currently available.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting || subject.trim().length < 5 || message.trim().length < 10}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Creating request…" : "Create support request"}
        </button>
      </form>
    </div>
  );
}
