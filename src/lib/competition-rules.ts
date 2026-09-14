export type CompetitionRules = {
  status: string; is_public?: boolean; opens_at: string | null; closes_at: string | null;
  minimum_age: number | null; maximum_age: number;
  minimum_words: number | null; maximum_words: number | null;
};
export function competitionIsOpen(c: Pick<CompetitionRules, 'status' | 'is_public' | 'opens_at' | 'closes_at'>, now = Date.now()) {
  return c.is_public !== false && c.status === 'open'
    && (!c.opens_at || Date.parse(c.opens_at) <= now)
    && (!c.closes_at || Date.parse(c.closes_at) > now);
}
export function validateEligibility(c: CompetitionRules, age: number, words: number) {
  if (!Number.isInteger(age) || age < 0 || age > c.maximum_age || (c.minimum_age !== null && age < c.minimum_age)) throw new Error(c.minimum_age === null ? `Entrants must be ${c.maximum_age} years old or under.` : `Entrants must be between ${c.minimum_age} and ${c.maximum_age} years old.`);
  if (!Number.isInteger(words) || words < 0 || (c.minimum_words !== null && words < c.minimum_words) || (c.maximum_words !== null && words > c.maximum_words)) throw new Error('The declared word count does not meet this competition’s limits.');
}
