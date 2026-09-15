import { z } from "zod";

const ClauseSchema = z.object({
  risk: z.enum(["high", "medium", "low", "standard"]),
  title: z.string().min(1).max(120),
  quote: z.string().min(1).max(500),
  plainEnglish: z.string().min(1).max(1_200),
});

export const GeneratedAnalysisSchema = z.object({
  summary: z.string().min(1).max(2_000),
  clauses: z.array(ClauseSchema).min(1).max(12),
});

export type ContractAnalysis = z.infer<typeof GeneratedAnalysisSchema> & {
  highRiskCount: number;
  remainingToday: number;
  analysisMode: "ai" | "local";
};

type Risk = "high" | "medium" | "low" | "standard";

type LocalRule = {
  title: string;
  risk: Risk;
  pattern: RegExp;
  explanation: string;
  downgradeWhen?: RegExp;
};

const LOCAL_RULES: LocalRule[] = [
  {
    title: "Selling or sharing personal data",
    risk: "high",
    pattern:
      /\b(sell|share|disclose|transfer|provide)\b[^.!?\n]{0,180}\b(personal (?:data|information)|user data|information about you|data)\b|\b(personal (?:data|information)|user data)\b[^.!?\n]{0,180}\b(third part|partner|advertis|market|affiliate)/i,
    downgradeWhen: /\b(do not|does not|never|will not|won't)\b[^.!?\n]{0,50}\b(sell|share|disclose|transfer)\b/i,
    explanation:
      "This may allow information about you to be given to outside companies or used beyond providing the service. Check exactly what is shared, with whom, why, and whether you can opt out.",
  },
  {
    title: "Broad licence to your content",
    risk: "high",
    pattern:
      /\b(worldwide|royalty[- ]free|perpetual|irrevocable|sublicen[cs]able|transferable)\b[^.!?\n]{0,220}\b(licen[cs]e|content|post|upload|material|submission)|\blicen[cs]e\b[^.!?\n]{0,220}\b(worldwide|royalty[- ]free|perpetual|irrevocable|sublicen[cs]able|transferable)/i,
    explanation:
      "This can give the service wide rights to use content you upload. Check what they may do with it, how long the licence lasts, whether they can sublicense it, and whether the rights end when you delete the content or account.",
  },
  {
    title: "Termination or suspension at the company's discretion",
    risk: "high",
    pattern:
      /\b(terminate|suspend|disable|close|deactivate)\b[^.!?\n]{0,180}\b(without (?:prior )?notice|sole discretion|any reason|no reason|at any time)|\bsole discretion\b[^.!?\n]{0,180}\b(terminate|suspend|disable|close|deactivate)/i,
    explanation:
      "The company may be able to restrict or end your account with little warning or explanation. Check whether notice, reasons, refunds, data access, or an appeal process are provided.",
  },
  {
    title: "Arbitration, jury-trial or class-action waiver",
    risk: "high",
    pattern:
      /\b(binding arbitration|mandatory arbitration|class action waiver|waive[^.!?\n]{0,90}(?:jury|class action|court)|jury trial waiver)\b/i,
    explanation:
      "This can limit how you are allowed to bring a dispute, including whether you can go to court, have a jury, or join a class action. The exact effect depends on the wording and local law.",
  },
  {
    title: "Indemnity obligation",
    risk: "high",
    pattern: /\b(indemnif(?:y|ies|ication)|hold harmless|defend and indemnify)\b/i,
    explanation:
      "This may require you to cover certain losses, claims, or legal costs suffered by the company because of your actions. Check what events trigger it and whether the obligation is unusually broad.",
  },
  {
    title: "Sensitive or biometric data",
    risk: "high",
    pattern:
      /\b(biometric|faceprint|facial recognition|fingerprint|voiceprint|precise location|health data|financial information)\b/i,
    explanation:
      "This involves information that can be especially sensitive or difficult to change if misused. Check why it is collected, how long it is kept, who receives it, and what controls you have.",
  },
  {
    title: "Automatic renewal or recurring charges",
    risk: "medium",
    pattern:
      /\b(auto(?:matic(?:ally)?)?[- ]?renew|recurring (?:payment|subscription|charge|billing)|renew(?:s|ed)? automatically|charged automatically)\b/i,
    explanation:
      "The service may renew or charge you again unless you cancel in time. Check the renewal period, price, cancellation steps, and whether notice is sent before another charge.",
  },
  {
    title: "No-refund or restricted refund policy",
    risk: "medium",
    pattern:
      /\b(no refunds?|non[- ]refundable|all sales (?:are )?final|refund[^.!?\n]{0,100}(?:not available|not provided|sole discretion))\b/i,
    explanation:
      "Getting money back may be limited or impossible in some situations. Check the cancellation deadline, exceptions, trial rules, and what happens if the service itself fails.",
  },
  {
    title: "Limits on the company's liability",
    risk: "medium",
    pattern:
      /\b(limitation of liability|not liable|no liability|disclaim(?:s|er)?|as is|without warranties|consequential damages|indirect damages)\b/i,
    explanation:
      "This tries to limit what the company may owe if something goes wrong. Read which losses are excluded, whether there is a monetary cap, and whether important exceptions are stated.",
  },
  {
    title: "Tracking, cookies or advertising identifiers",
    risk: "medium",
    pattern:
      /\b(cookie|tracking technolog|tracking pixel|pixel tag|device identifier|analytics provider|advertising identifier|cross[- ]site tracking)\b/i,
    explanation:
      "The service may monitor activity or device information. Check whether tracking is necessary for the service, used for advertising, shared with others, or adjustable in privacy settings.",
  },
  {
    title: "Company may change the terms",
    risk: "medium",
    pattern:
      /\b(modify|change|update|revise|amend)\b[^.!?\n]{0,130}\b(terms|agreement|policy)\b[^.!?\n]{0,130}\b(any time|at any time|sole discretion|without notice)|\b(terms|agreement|policy)\b[^.!?\n]{0,130}\b(modify|change|update|revise|amend)\b[^.!?\n]{0,130}\b(any time|at any time|sole discretion|without notice)/i,
    explanation:
      "The company may be able to change the rules later. Check how users are notified, when changes take effect, and whether continued use automatically counts as accepting them.",
  },
  {
    title: "Data kept after account deletion",
    risk: "medium",
    pattern:
      /\b(retain|keep|store|preserve)\b[^.!?\n]{0,160}\b(after (?:you )?(?:delete|close)|after account deletion|following termination|as long as necessary|legal obligations)\b/i,
    explanation:
      "Some information may remain after you delete your account or stop using the service. Check what is retained, for how long, why it is needed, and whether backups are eventually deleted.",
  },
  {
    title: "Content removal or moderation powers",
    risk: "medium",
    pattern:
      /\b(remove|delete|moderate|restrict)\b[^.!?\n]{0,150}\b(content|post|material|submission)\b[^.!?\n]{0,120}\b(discretion|without notice|any reason|violation)|\bcontent\b[^.!?\n]{0,150}\b(remove|delete|moderate)\b/i,
    explanation:
      "The platform may remove or restrict things you post. Check what rules apply, whether decisions can be appealed, and whether removed content can still be retained or used.",
  },
  {
    title: "Fees or prices may change",
    risk: "medium",
    pattern:
      /\b(price|pricing|fee|fees|subscription price)\b[^.!?\n]{0,150}\b(change|increase|modify|adjust)\b|\b(change|increase|modify|adjust)\b[^.!?\n]{0,150}\b(price|pricing|fee|fees)\b/i,
    explanation:
      "The amount you pay may change. Check how much notice is promised, whether the new price applies automatically, and whether you can cancel before it takes effect.",
  },
  {
    title: "Data collection and use",
    risk: "medium",
    pattern:
      /\b(collect|process|use)\b[^.!?\n]{0,150}\b(personal (?:data|information)|usage data|location|device information|information about you)\b/i,
    explanation:
      "The service collects or uses information about you. Check which data is necessary, the stated purposes, how long it is kept, and the choices or access rights available to you.",
  },
  {
    title: "Third-party services or links",
    risk: "low",
    pattern: /\b(third[- ]party (?:service|services|site|sites|website|websites|link|links)|external links?)\b/i,
    explanation:
      "Parts of the experience may depend on companies or websites with their own rules. Their privacy and contract terms may be different, so important third-party services should be checked separately.",
  },
  {
    title: "Security and account responsibility",
    risk: "standard",
    pattern:
      /\b(responsible for|responsibility)\b[^.!?\n]{0,140}\b(password|account|credentials|security)|\bkeep[^.!?\n]{0,100}\b(password|credentials)\b[^.!?\n]{0,100}\b(confidential|secure)/i,
    explanation:
      "You are expected to protect your login details and may be responsible for activity on your account. Use a unique password and check how to report unauthorized access.",
  },
  {
    title: "Intellectual-property ownership",
    risk: "standard",
    pattern:
      /\b(intellectual property|copyright|trademark|proprietary rights|owned by (?:us|the company)|all rights reserved)\b/i,
    explanation:
      "This explains who owns the service's branding, software, or other protected material. It is common, but it matters if you want to copy, reuse, or publish that material elsewhere.",
  },
  {
    title: "Age or parental-consent requirement",
    risk: "standard",
    pattern:
      /\b(parental consent|parent or guardian|under (?:the age of )?1[2368]|minimum age|age requirement|at least 1[2368] years old)\b/i,
    explanation:
      "This sets rules for younger users, such as a minimum age or a need for parent or guardian permission. Make sure the account is allowed for your age group.",
  },
  {
    title: "Governing law or dispute location",
    risk: "standard",
    pattern: /\b(governed by|governing law|exclusive jurisdiction|venue|courts of)\b/i,
    explanation:
      "This says which law or location may apply to disputes. It is common in contracts, but it can matter if the chosen place is far from where you live.",
  },
  {
    title: "Acceptable-use rules",
    risk: "standard",
    pattern:
      /\b(acceptable use|prohibited conduct|you may not|you must not|prohibited from)\b/i,
    explanation:
      "This sets rules about what users are and are not allowed to do. Breaking these rules can lead to content removal or account restrictions, so the prohibited activities are worth reading carefully.",
  },
];

function extractChunks(text: string): string[] {
  const chunks = text
    .split(/(?<=[.!?;:])(?:\s+|\n+)|\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 12);

  if (chunks.length > 0) return chunks;
  const trimmed = text.trim();
  return trimmed ? [trimmed] : [];
}

function shortQuote(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 300) return trimmed;

  const boundary = Math.max(
    trimmed.lastIndexOf(" ", 295),
    trimmed.lastIndexOf("\n", 295),
  );
  const end = boundary >= 180 ? boundary : 295;
  return trimmed.slice(0, end).trimEnd();
}

function normalized(value: string): string {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();
}

function effectiveRisk(rule: LocalRule, chunk: string): Risk {
  if (rule.downgradeWhen?.test(chunk)) {
    return rule.risk === "high" ? "low" : "standard";
  }
  return rule.risk;
}

function riskWeight(risk: Risk): number {
  if (risk === "high") return 4;
  if (risk === "medium") return 3;
  if (risk === "low") return 2;
  return 1;
}

export function basicAnalysis(text: string, remainingToday = 0): ContractAnalysis {
  const chunks = extractChunks(text);
  const clauses: z.infer<typeof ClauseSchema>[] = [];
  const usedChunks = new Set<number>();

  const matches: Array<{
    rule: LocalRule;
    chunk: string;
    chunkIndex: number;
    risk: Risk;
  }> = [];

  for (const rule of LOCAL_RULES) {
    for (let index = 0; index < chunks.length; index += 1) {
      if (usedChunks.has(index)) continue;
      const chunk = chunks[index];
      if (!rule.pattern.test(chunk)) continue;

      matches.push({
        rule,
        chunk,
        chunkIndex: index,
        risk: effectiveRisk(rule, chunk),
      });
      usedChunks.add(index);
      break;
    }
  }

  matches
    .sort((a, b) => riskWeight(b.risk) - riskWeight(a.risk) || a.chunkIndex - b.chunkIndex)
    .slice(0, 12)
    .forEach(({ rule, chunk, risk }) => {
      clauses.push({
        risk,
        title: rule.title,
        quote: shortQuote(chunk),
        plainEnglish: rule.explanation,
      });
    });

  const targetMinimum = Math.min(6, chunks.length);
  if (clauses.length < targetMinimum) {
    for (let index = 0; index < chunks.length && clauses.length < targetMinimum; index += 1) {
      if (usedChunks.has(index)) continue;
      const chunk = chunks[index];
      if (chunk.length < 20) continue;
      clauses.push({
        risk: "standard",
        title: "Other contract term",
        quote: shortQuote(chunk),
        plainEnglish:
          "This term does not match one of the decoder's higher-risk patterns, but it may still matter in context. Read the wording alongside nearby sections and look for deadlines, exceptions, or conditions that change its effect.",
      });
      usedChunks.add(index);
    }
  }

  if (clauses.length === 0) {
    clauses.push({
      risk: "standard",
      title: "General contract text",
      quote: shortQuote(text),
      plainEnglish:
        "The text is too fragmented for the local decoder to classify reliably. Try pasting a complete paragraph, section, or policy with normal punctuation.",
    });
  }

  const highRiskCount = clauses.filter((clause) => clause.risk === "high").length;
  const mediumRiskCount = clauses.filter((clause) => clause.risk === "medium").length;
  const otherCount = clauses.length - highRiskCount - mediumRiskCount;
  const notableTitles = clauses
    .filter((clause) => clause.risk === "high" || clause.risk === "medium")
    .slice(0, 3)
    .map((clause) => clause.title.toLowerCase());

  let summary: string;
  if (highRiskCount > 0 || mediumRiskCount > 0) {
    const focus = notableTitles.length > 0 ? ` The main areas to review are ${notableTitles.join(", ")}.` : "";
    summary = `The decoder found ${highRiskCount} high-risk and ${mediumRiskCount} medium-risk clause${highRiskCount + mediumRiskCount === 1 ? "" : "s"}, plus ${otherCount} lower-risk or standard term${otherCount === 1 ? "" : "s"}.${focus} These labels are a reading aid, not a legal conclusion.`;
  } else {
    summary = `The decoder reviewed ${clauses.length} notable term${clauses.length === 1 ? "" : "s"} and did not detect one of its common higher-risk patterns. That does not mean the contract is risk-free; unusual wording or context can still matter.`;
  }

  return {
    summary,
    clauses,
    highRiskCount,
    remainingToday,
    analysisMode: "local",
  };
}

export function quotesAreGrounded(text: string, clauses: Array<{ quote: string }>): boolean {
  const normalizedText = normalized(text);
  return clauses.every((clause) => {
    const quote = clause.quote.trim();
    return text.includes(quote) || normalizedText.includes(normalized(quote));
  });
}
