import type { Database } from "@/integrations/supabase/types";

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type CompetitionRow = {
  closes_at: string | null;
  created_at: string;
  id: string;
  is_public: boolean;
  maximum_age: number;
  maximum_words: number | null;
  minimum_age: number;
  minimum_words: number | null;
  opens_at: string | null;
  prize_text: string | null;
  rules_url: string | null;
  slug: string;
  status: string;
  summary: string;
  title: string;
  updated_at: string;
};

type EssaySubmissionRow = {
  admin_note: string | null;
  competition_id: string;
  country: string;
  created_at: string;
  declared_word_count: number;
  essay_title: string;
  file_path: string | null;
  file_sha256: string | null;
  file_size: number | null;
  id: string;
  mime_type: string | null;
  original_filename: string | null;
  originality_confirmed_at: string | null;
  participant_age: number;
  participant_name: string;
  pending_file_path: string | null;
  pending_file_sha256: string | null;
  pending_file_size: number | null;
  pending_mime_type: string | null;
  pending_original_filename: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  revision_number: number;
  rules_accepted_at: string | null;
  school_name: string | null;
  status: string;
  submission_code: string;
  submitted_at: string | null;
  updated_at: string;
  user_id: string;
};

type EssaySubmissionEventRow = {
  action: string;
  actor_id: string | null;
  created_at: string;
  id: string;
  note: string | null;
  submission_id: string;
};

type AdvisorApplicationRow = {
  admin_note: string | null;
  availability_note: string | null;
  cv_file_path: string | null;
  cv_file_sha256: string | null;
  cv_file_size: number | null;
  cv_mime_type: string | null;
  cv_original_filename: string | null;
  email: string;
  experience: string;
  focus_areas: string[];
  full_name: string;
  id: string;
  location: string | null;
  motivation: string;
  organization: string | null;
  pending_cv_file_path: string | null;
  pending_cv_file_sha256: string | null;
  pending_cv_file_size: number | null;
  pending_cv_mime_type: string | null;
  pending_cv_original_filename: string | null;
  pending_previous_status: string | null;
  profile_url: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  role_title: string | null;
  status: string;
  submitted_at: string;
  updated_at: string;
  user_id: string;
};

type AdvisorOnboardingIntentRow = {
  completed_at: string | null;
  started_at: string;
  updated_at: string;
  user_id: string;
};

type AdvisorOnboardingIntentInsert = {
  [key: string]: string | null | undefined;
  completed_at?: string | null;
  started_at?: string;
  updated_at?: string;
  user_id: string;
};

type AdditionalTables = {
  competitions: Table<
    CompetitionRow,
    Partial<Omit<CompetitionRow, "slug" | "title">> & Pick<CompetitionRow, "slug" | "title">,
    Partial<CompetitionRow>
  >;
  essay_submissions: Table<
    EssaySubmissionRow,
    Partial<Omit<EssaySubmissionRow, "competition_id" | "country" | "declared_word_count" | "essay_title" | "participant_age" | "participant_name" | "submission_code" | "user_id">>
      & Pick<EssaySubmissionRow, "competition_id" | "country" | "declared_word_count" | "essay_title" | "participant_age" | "participant_name" | "submission_code" | "user_id">,
    Partial<EssaySubmissionRow>
  >;
  essay_submission_events: Table<
    EssaySubmissionEventRow,
    Partial<Omit<EssaySubmissionEventRow, "action" | "submission_id">> & Pick<EssaySubmissionEventRow, "action" | "submission_id">,
    Partial<EssaySubmissionEventRow>
  >;
  advisor_applications: Table<
    AdvisorApplicationRow,
    Partial<Omit<AdvisorApplicationRow, "email" | "experience" | "full_name" | "motivation" | "user_id">>
      & Pick<AdvisorApplicationRow, "email" | "experience" | "full_name" | "motivation" | "user_id">,
    Partial<AdvisorApplicationRow>
  >;
  advisor_onboarding_intents: Table<
    AdvisorOnboardingIntentRow,
    AdvisorOnboardingIntentInsert,
    Partial<AdvisorOnboardingIntentRow>
  >;
};

type BaseTables = Omit<
  Database["public"]["Tables"],
  "advisor_applications" | "competitions" | "essay_submissions" | "essay_submission_events"
>;

export type CompetitionDatabase = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: BaseTables & AdditionalTables;
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};
