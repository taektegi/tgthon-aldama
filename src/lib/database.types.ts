export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string | null; created_at?: string; updated_at?: string };
        Update: { display_name?: string | null; updated_at?: string };
        Relationships: [];
      };
      sources: {
        Row: {
          id: string; user_id: string; type: "ical" | "school_notice" | "pasted_text" | "canvas";
          name: string; status: "active" | "paused" | "error"; credential_ciphertext: string | null;
          last_synced_at: string | null; last_sync_error: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; type: "ical" | "school_notice" | "pasted_text" | "canvas";
          name: string; status?: "active" | "paused" | "error"; credential_ciphertext?: string | null;
          last_synced_at?: string | null; last_sync_error?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string; user_id: string; source_id: string | null; external_uid: string | null; title: string;
          subject: string | null;
          event_type: "assignment" | "exam" | "presentation" | "application" | "event" | "other";
          d_day_basis: "due_at" | "starts_at";
          starts_at: string | null; due_at: string | null; is_all_day: boolean; location: string | null;
          original_text: string | null; source_url: string | null; confidence: number | null;
          is_completed: boolean; completed_at: string | null; reminder_stage: number;
          is_hidden: boolean; override_fields: string[];
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; source_id?: string | null; external_uid?: string | null; title: string;
          subject?: string | null;
          event_type?: "assignment" | "exam" | "presentation" | "application" | "event" | "other";
          d_day_basis?: "due_at" | "starts_at";
          starts_at?: string | null; due_at?: string | null; is_all_day?: boolean; location?: string | null;
          original_text?: string | null; source_url?: string | null; confidence?: number | null;
          is_completed?: boolean; completed_at?: string | null; reminder_stage?: number;
          is_hidden?: boolean; override_fields?: string[];
          created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string; created_at: string;
        };
        Insert: {
          id?: string; user_id: string; endpoint: string; p256dh: string; auth_key: string; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string; user_id: string; source_id: string; status: "running" | "succeeded" | "failed";
          started_at: string; finished_at: string | null; inserted_count: number; updated_count: number;
          error_code: string | null; error_message: string | null;
        };
        Insert: {
          id?: string; user_id: string; source_id: string; status?: "running" | "succeeded" | "failed";
          started_at?: string; finished_at?: string | null; inserted_count?: number; updated_count?: number;
          error_code?: string | null; error_message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
