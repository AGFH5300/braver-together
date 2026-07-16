export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      advisor_application_events: Table<
        { action: string; actor_id: string | null; application_id: string; created_at: string; id: string; note: string | null },
        { action: string; actor_id?: string | null; application_id: string; created_at?: string; id?: string; note?: string | null },
        { action?: string; actor_id?: string | null; application_id?: string; created_at?: string; id?: string; note?: string | null }
      >;
      advisor_applications: Table<
        {
          admin_note: string | null;
          availability_note: string | null;
          email: string;
          experience: string;
          focus_areas: string[];
          full_name: string;
          id: string;
          location: string | null;
          motivation: string;
          organization: string | null;
          profile_url: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          role_title: string | null;
          status: string;
          submitted_at: string;
          updated_at: string;
          user_id: string;
        },
        {
          admin_note?: string | null;
          availability_note?: string | null;
          email: string;
          experience: string;
          focus_areas?: string[];
          full_name: string;
          id?: string;
          location?: string | null;
          motivation: string;
          organization?: string | null;
          profile_url?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          role_title?: string | null;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id: string;
        },
        {
          admin_note?: string | null;
          availability_note?: string | null;
          email?: string;
          experience?: string;
          focus_areas?: string[];
          full_name?: string;
          id?: string;
          location?: string | null;
          motivation?: string;
          organization?: string | null;
          profile_url?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          role_title?: string | null;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id?: string;
        }
      >;
      ai_usage_daily: Table<
        { actor_key: string; feature: string; request_count: number; updated_at: string; usage_date: string },
        { actor_key: string; feature: string; request_count?: number; updated_at?: string; usage_date?: string },
        { actor_key?: string; feature?: string; request_count?: number; updated_at?: string; usage_date?: string }
      >;
      conversation_reads: Table<
        { conversation_id: string; last_read_at: string; user_id: string },
        { conversation_id: string; last_read_at?: string; user_id: string },
        { conversation_id?: string; last_read_at?: string; user_id?: string }
      >;
      conversations: Table<
        {
          advisor_id: string | null;
          ai_fallback_enabled: boolean;
          ai_handoff_required: boolean;
          claimed_at: string | null;
          closed_at: string | null;
          created_at: string;
          id: string;
          last_message_at: string;
          status: string;
          subject: string;
          teen_id: string;
          topic: string;
          updated_at: string;
        },
        {
          advisor_id?: string | null;
          ai_fallback_enabled?: boolean;
          ai_handoff_required?: boolean;
          claimed_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          last_message_at?: string;
          status?: string;
          subject?: string;
          teen_id: string;
          topic?: string;
          updated_at?: string;
        },
        {
          advisor_id?: string | null;
          ai_fallback_enabled?: boolean;
          ai_handoff_required?: boolean;
          claimed_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          last_message_at?: string;
          status?: string;
          subject?: string;
          teen_id?: string;
          topic?: string;
          updated_at?: string;
        }
      >;
      meeting_proposals: Table<
        {
          conversation_id: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          meeting_url: string;
          note: string | null;
          proposed_start: string;
          proposer_id: string;
          responded_at: string | null;
          responded_by: string | null;
          status: string;
          timezone: string;
          title: string;
          updated_at: string;
        },
        {
          conversation_id: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          meeting_url: string;
          note?: string | null;
          proposed_start: string;
          proposer_id: string;
          responded_at?: string | null;
          responded_by?: string | null;
          status?: string;
          timezone: string;
          title?: string;
          updated_at?: string;
        },
        {
          conversation_id?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          meeting_url?: string;
          note?: string | null;
          proposed_start?: string;
          proposer_id?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          status?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
        }
      >;
      messages: Table<
        { body: string; conversation_id: string; created_at: string; id: string; metadata: Json; sender_id: string | null; sender_kind: string },
        { body: string; conversation_id: string; created_at?: string; id?: string; metadata?: Json; sender_id?: string | null; sender_kind?: string },
        { body?: string; conversation_id?: string; created_at?: string; id?: string; metadata?: Json; sender_id?: string | null; sender_kind?: string }
      >;
      news_posts: Table<
        { author: string; cover_image: string | null; excerpt: string; external_id: string; id: string; link: string; pub_date: string | null; synced_at: string; title: string },
        { author?: string; cover_image?: string | null; excerpt?: string; external_id: string; id?: string; link: string; pub_date?: string | null; synced_at?: string; title: string },
        { author?: string; cover_image?: string | null; excerpt?: string; external_id?: string; id?: string; link?: string; pub_date?: string | null; synced_at?: string; title?: string }
      >;
      profiles: Table<
        {
          accepting_messages: boolean;
          availability_status: string;
          avatar_url: string | null;
          bio: string | null;
          calendly_url: string | null;
          created_at: string;
          display_name: string;
          focus_areas: string[];
          headline: string | null;
          id: string;
          is_advisor: boolean;
          is_public: boolean;
          last_seen_at: string | null;
          max_active_conversations: number;
          updated_at: string;
        },
        {
          accepting_messages?: boolean;
          availability_status?: string;
          avatar_url?: string | null;
          bio?: string | null;
          calendly_url?: string | null;
          created_at?: string;
          display_name?: string;
          focus_areas?: string[];
          headline?: string | null;
          id: string;
          is_advisor?: boolean;
          is_public?: boolean;
          last_seen_at?: string | null;
          max_active_conversations?: number;
          updated_at?: string;
        },
        {
          accepting_messages?: boolean;
          availability_status?: string;
          avatar_url?: string | null;
          bio?: string | null;
          calendly_url?: string | null;
          created_at?: string;
          display_name?: string;
          focus_areas?: string[];
          headline?: string | null;
          id?: string;
          is_advisor?: boolean;
          is_public?: boolean;
          last_seen_at?: string | null;
          max_active_conversations?: number;
          updated_at?: string;
        }
      >;
      reports: Table<
        { conversation_id: string; created_at: string; id: string; reason: string; reporter_id: string },
        { conversation_id: string; created_at?: string; id?: string; reason: string; reporter_id: string },
        { conversation_id?: string; created_at?: string; id?: string; reason?: string; reporter_id?: string }
      >;
      resource_categories: Table<
        { created_at: string; description: string | null; id: string; label: string; sort_order: number },
        { created_at?: string; description?: string | null; id: string; label: string; sort_order?: number },
        { created_at?: string; description?: string | null; id?: string; label?: string; sort_order?: number }
      >;
      resource_videos: Table<
        {
          category_id: string | null;
          comments_enabled: boolean;
          created_at: string;
          description: string;
          duration_text: string | null;
          id: string;
          is_published: boolean;
          sort_order: number;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
          youtube_video_id: string;
        },
        {
          category_id?: string | null;
          comments_enabled?: boolean;
          created_at?: string;
          description?: string;
          duration_text?: string | null;
          id?: string;
          is_published?: boolean;
          sort_order?: number;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
          youtube_video_id: string;
        },
        {
          category_id?: string | null;
          comments_enabled?: boolean;
          created_at?: string;
          description?: string;
          duration_text?: string | null;
          id?: string;
          is_published?: boolean;
          sort_order?: number;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
          youtube_video_id?: string;
        }
      >;
      user_roles: Table<
        { created_at: string; id: string; role: Database["public"]["Enums"]["app_role"]; user_id: string },
        { created_at?: string; id?: string; role: Database["public"]["Enums"]["app_role"]; user_id: string },
        { created_at?: string; id?: string; role?: Database["public"]["Enums"]["app_role"]; user_id?: string }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      has_role: { Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }; Returns: boolean };
    };
    Enums: { app_role: "admin" | "advisor" | "teen" };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals["public"];

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never;
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never;
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never;
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T];

export const Constants = { public: { Enums: { app_role: ["admin", "advisor", "teen"] } } } as const;
