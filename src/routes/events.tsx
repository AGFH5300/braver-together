import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Globe2,
  Loader2,
  Mail,
  MapPin,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { Eyebrow, Section, SiteLayout } from "@/components/SiteLayout";
import { submitChapterInterest } from "@/lib/events.functions";

export const Route = createFileRoute("/events")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://bravertogether.site/events" }],
    meta: [
      { title: "Events & Global Chapters — BraverTogether" },
      {
        name: "description",
        content:
          "Discover upcoming BraverTogether events and register your interest in starting a BraverTogether chapter where you live.",
      },
      { property: "og:title", content: "Events & Global Chapters — BraverTogether" },
      {
        property: "og:description",
        content: "New events are coming soon. Help bring BraverTogether to your community by starting a global chapter.",
      },
    ],
  }),
  component: EventsPage,
});

type FormState = {
  name: string;
  email: string;
  nationality: string;
  location: string;
  age: string;
  interestedPeople: string;
  notes: string;
  website: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  nationality: "",
  location: "",
  age: "",
  interestedPeople: "",
  notes: "",
  website: "",
};

function EventsPage() {
  const submitInterest = useServerFn(submitChapterInterest);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await submitInterest({
        data: {
          name: form.name,
          email: form.email,
          nationality: form.nationality,
          location: form.location,
          age: Number(form.age),
          interestedPeople: Number(form.interestedPeople),
          notes: form.notes,
          website: form.website,
        },
      });

      setSubmitted(true);
      setForm(initialForm);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your interest could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-24 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Eyebrow>
                <CalendarDays className="h-3.5 w-3.5" /> Events
              </Eyebrow>
              <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-tight text-navy-deep sm:text-6xl">
                Learn together. Build something where you live.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-deep/70">
                BraverTogether events bring digital legal literacy into conversations, workshops and communities. New events are on the way — and you can help us expand globally.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#start-chapter"
                  className="inline-flex items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow transition hover:brightness-110"
                >
                  <Globe2 className="h-4 w-4" /> Start a Global Chapter
                </a>
                <a
                  href="#upcoming-events"
                  className="inline-flex items-center gap-2 rounded-full border border-navy-deep/20 bg-white/75 px-6 py-3 font-semibold text-navy-deep backdrop-blur transition hover:bg-white"
                >
                  Upcoming events <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/70 p-7 shadow-[0_28px_80px_-38px_rgba(13,53,73,0.45)] backdrop-blur-xl sm:p-9">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/12 text-teal">
                <UsersRound className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-navy-deep">Bring BraverTogether to your community.</h2>
              <p className="mt-3 text-sm leading-relaxed text-navy-deep/65">
                Interested in building a local chapter with friends, classmates or volunteers? Tell us where you are and how many people are interested.
              </p>
              <a href="#start-chapter" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal">
                Register your interest <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Section>
      </div>

      <Section className="py-16 sm:py-20">
        <div id="upcoming-events" className="scroll-mt-28">
          <Eyebrow>
            <Sparkles className="h-3.5 w-3.5" /> What’s next
          </Eyebrow>
          <div className="mt-5 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <h2 className="text-4xl font-bold">New events coming soon.</h2>
            </div>
            <p className="max-w-2xl text-muted-foreground">
              We’re preparing new BraverTogether workshops, youth discussions and community events. Details, dates and registration links will be published here as they are confirmed.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: CalendarDays,
                title: "Workshops",
                text: "Practical sessions focused on digital rights, online safety and understanding the rules behind the platforms teens use every day.",
              },
              {
                icon: UsersRound,
                title: "Youth discussions",
                text: "Spaces for young people to ask questions, compare experiences and explore how digital law affects everyday online life.",
              },
              {
                icon: Globe2,
                title: "Community events",
                text: "Local and global events created with schools, volunteers and chapter teams as the BraverTogether network grows.",
              },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-teal">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                <div className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-teal">Coming soon</div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <div className="border-y border-border bg-secondary/45">
        <Section className="py-16 sm:py-20">
          <div id="start-chapter" className="scroll-mt-28">
            <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <Eyebrow>
                  <Globe2 className="h-3.5 w-3.5" /> Global chapters
                </Eyebrow>
                <h2 className="mt-5 text-4xl font-bold sm:text-5xl">Start a Global Chapter.</h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  If you want to bring BraverTogether to your school, city or community, register your interest below. You do not need to have everything planned already.
                </p>
                <div className="mt-7 rounded-2xl border border-teal/25 bg-teal/8 p-5">
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                    <p className="text-sm leading-relaxed">
                      <strong>We will contact you.</strong> Once you submit the form, the BraverTogether team will review your interest and use the email you provide to get in touch about next steps.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
                {submitted ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/12 text-teal">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-3xl font-bold">Thank you for your interest.</h3>
                    <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                      Your Global Chapter interest has been received. We will review it and contact you using the email address you provided.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="mt-7 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:border-teal/40 hover:bg-secondary"
                    >
                      Submit another response
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit}>
                    <div className="mb-7">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Chapter interest form</div>
                      <h3 className="mt-2 text-2xl font-bold">Tell us about you and your community.</h3>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Name">
                        <input
                          required
                          minLength={2}
                          maxLength={100}
                          autoComplete="name"
                          value={form.name}
                          onChange={(event) => update("name", event.target.value)}
                          className={inputClass}
                          placeholder="Your full name"
                        />
                      </Field>

                      <Field label="Email">
                        <input
                          required
                          type="email"
                          maxLength={254}
                          autoComplete="email"
                          value={form.email}
                          onChange={(event) => update("email", event.target.value)}
                          className={inputClass}
                          placeholder="you@example.com"
                        />
                      </Field>

                      <Field label="Nationality">
                        <input
                          required
                          minLength={2}
                          maxLength={100}
                          autoComplete="country-name"
                          value={form.nationality}
                          onChange={(event) => update("nationality", event.target.value)}
                          className={inputClass}
                          placeholder="Your nationality"
                        />
                      </Field>

                      <Field label="Where do you live?">
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            required
                            minLength={2}
                            maxLength={160}
                            value={form.location}
                            onChange={(event) => update("location", event.target.value)}
                            className={`${inputClass} pl-10`}
                            placeholder="City, country"
                          />
                        </div>
                      </Field>

                      <Field label="Age">
                        <input
                          required
                          type="number"
                          min={10}
                          max={120}
                          inputMode="numeric"
                          value={form.age}
                          onChange={(event) => update("age", event.target.value)}
                          className={inputClass}
                          placeholder="Your age"
                        />
                      </Field>

                      <Field label="How many people are interested?">
                        <input
                          required
                          type="number"
                          min={1}
                          max={100000}
                          inputMode="numeric"
                          value={form.interestedPeople}
                          onChange={(event) => update("interestedPeople", event.target.value)}
                          className={inputClass}
                          placeholder="Estimated number"
                        />
                      </Field>
                    </div>

                    <Field label="Any other notes or details?" className="mt-5">
                      <textarea
                        rows={6}
                        maxLength={3000}
                        value={form.notes}
                        onChange={(event) => update("notes", event.target.value)}
                        className={`${inputClass} resize-y leading-relaxed`}
                        placeholder="Tell us anything else that would help us understand your idea, school, community or plans."
                      />
                      <div className="mt-1 text-right text-xs text-muted-foreground">{form.notes.length}/3000</div>
                    </Field>

                    <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                      <label>
                        Website
                        <input
                          tabIndex={-1}
                          autoComplete="off"
                          value={form.website}
                          onChange={(event) => update("website", event.target.value)}
                        />
                      </label>
                    </div>

                    <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                      We will use the details you provide to review your chapter interest and contact you about BraverTogether chapter opportunities. Please do not include sensitive personal information in the notes field.
                    </p>

                    {error && (
                      <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-6 py-3.5 font-semibold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {submitting ? "Submitting…" : "Start a Global Chapter"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-teal/50 focus:ring-2 focus:ring-teal/20";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold ${className}`}>
      <span>{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
