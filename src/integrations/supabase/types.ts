export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          advisor_id: string
          created_at: string
          id: string
          last_message_at: string
          status: string
          teen_id: string
        }
        Insert: {
          advisor_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          teen_id: string
        }
        Update: {
          advisor_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          teen_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepting_messages: boolean
          avatar_url: string | null
          bio: string | null
          calendly_url: string | null
          created_at: string
          display_name: string
          focus_areas: string[]
          headline: string | null
          id: string
          is_advisor: boolean
          is_public: boolean
          updated_at: string
        }
        Insert: {
          accepting_messages?: boolean
          avatar_url?: string | null
          bio?: string | null
          calendly_url?: string | null
          created_at?: string
          display_name?: string
          focus_areas?: string[]
          headline?: string | null
          id: string
          is_advisor?: boolean
          is_public?: boolean
          updated_at?: string
        }
        Update: {
          accepting_messages?: boolean
          avatar_url?: string | null
          bio?: string | null
          calendly_url?: string | null
          created_at?: string
          display_name?: string
          focus_areas?: string[]
          headline?: string | null
          id?: string
          is_advisor?: boolean
          is_public?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "advisor" | "teen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "advisor", "teen"],
    },
  },
} as const
