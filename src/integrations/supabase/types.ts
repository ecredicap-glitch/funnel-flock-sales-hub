export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_enrollments: {
        Row: {
          attempts: number
          cadence_id: string
          contact_id: string
          created_at: string
          id: string
          last_sent_at: string | null
          next_run_at: string
          phone: string
          status: string
          step: number
          stop_reason: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          cadence_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_sent_at?: string | null
          next_run_at?: string
          phone: string
          status?: string
          step?: number
          stop_reason?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          cadence_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_sent_at?: string | null
          next_run_at?: string
          phone?: string
          status?: string
          step?: number
          stop_reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          daily_limit: number
          id: string
          name: string
          steps: Json
          window_days: number[]
          window_end: number
          window_start: number
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          id?: string
          name: string
          steps?: Json
          window_days?: number[]
          window_end?: number
          window_start?: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          id?: string
          name?: string
          steps?: Json
          window_days?: number[]
          window_end?: number
          window_start?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          attempts: number
          body: string
          campaign_id: string
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          external_id: string | null
          id: string
          phone: string
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          workspace_id: string
        }
        Insert: {
          attempts?: number
          body: string
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          external_id?: string | null
          id?: string
          phone: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          workspace_id: string
        }
        Update: {
          attempts?: number
          body?: string
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          external_id?: string | null
          id?: string
          phone?: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          batch_pause_max: number
          batch_pause_min: number
          batch_size: number
          body: string
          created_at: string
          created_by: string | null
          daily_limit: number
          dedupe_days: number
          failed: number
          id: string
          list_id: string | null
          max_interval_s: number
          min_interval_s: number
          name: string
          next_send_at: string | null
          pause_reason: string | null
          sent: number
          sent_in_batch: number
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          total: number
          window_days: number[]
          window_end: number
          window_start: number
          workspace_id: string
        }
        Insert: {
          batch_pause_max?: number
          batch_pause_min?: number
          batch_size?: number
          body: string
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          dedupe_days?: number
          failed?: number
          id?: string
          list_id?: string | null
          max_interval_s?: number
          min_interval_s?: number
          name: string
          next_send_at?: string | null
          pause_reason?: string | null
          sent?: number
          sent_in_batch?: number
          start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total?: number
          window_days?: number[]
          window_end?: number
          window_start?: number
          workspace_id: string
        }
        Update: {
          batch_pause_max?: number
          batch_pause_min?: number
          batch_size?: number
          body?: string
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          dedupe_days?: number
          failed?: number
          id?: string
          list_id?: string | null
          max_interval_s?: number
          min_interval_s?: number
          name?: string
          next_send_at?: string | null
          pause_reason?: string | null
          sent?: number
          sent_in_batch?: number
          start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total?: number
          window_days?: number[]
          window_end?: number
          window_start?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_list_members: {
        Row: {
          added_at: string
          contact_id: string
          list_id: string
          workspace_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          list_id: string
          workspace_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          list_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deal_value: number | null
          email: string | null
          id: string
          last_message_at: string | null
          name: string | null
          opt_in: boolean
          opt_in_at: string | null
          opt_in_source: string | null
          phone: string
          product: string | null
          stage: string
          stage_changed_at: string
          status: Database["public"]["Enums"]["contact_status"]
          status_reason: string | null
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deal_value?: number | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          opt_in?: boolean
          opt_in_at?: string | null
          opt_in_source?: string | null
          phone: string
          product?: string | null
          stage?: string
          stage_changed_at?: string
          status?: Database["public"]["Enums"]["contact_status"]
          status_reason?: string | null
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deal_value?: number | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          opt_in?: boolean
          opt_in_at?: string | null
          opt_in_source?: string | null
          phone?: string
          product?: string | null
          stage?: string
          stage_changed_at?: string
          status?: Database["public"]["Enums"]["contact_status"]
          status_reason?: string | null
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_grants: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_grants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          body: string
          contact_id: string | null
          created_at: string
          direction: string
          external_id: string | null
          id: string
          phone: string
          push_name: string | null
          read: boolean
          source: string | null
          workspace_id: string
        }
        Insert: {
          body?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          phone: string
          push_name?: string | null
          read?: boolean
          source?: string | null
          workspace_id: string
        }
        Update: {
          body?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          phone?: string
          push_name?: string | null
          read?: boolean
          source?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          optout_message: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          optout_message?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          optout_message?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_my_invites: { Args: never; Returns: number }
      campaign_metrics: {
        Args: { _ws: string }
        Returns: {
          c_id: string
          n_delivered: number
          n_failed: number
          n_queued: number
          n_read: number
          n_replied: number
          n_sent: number
          n_skipped: number
        }[]
      }
      create_workspace: { Args: { _name: string }; Returns: string }
      credit_summary: { Args: { _ws: string }; Returns: Json }
      erase_contact: { Args: { _contact_id: string }; Returns: undefined }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["member_role"]
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      log_audit: {
        Args: { _action: string; _details: Json; _entity: string; _ws: string }
        Returns: undefined
      }
      shares_workspace_with: { Args: { _other: string }; Returns: boolean }
      workspace_metrics: {
        Args: { _days?: number; _ws: string }
        Returns: Json
      }
      write_audit: {
        Args: { _action: string; _details: Json; _entity: string; _ws: string }
        Returns: undefined
      }
    }
    Enums: {
      campaign_status:
        | "draft"
        | "running"
        | "paused"
        | "completed"
        | "cancelled"
      contact_status: "active" | "unsubscribed" | "blocked"
      member_role: "admin" | "operator"
      message_status: "queued" | "sent" | "failed" | "skipped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      campaign_status: ["draft", "running", "paused", "completed", "cancelled"],
      contact_status: ["active", "unsubscribed", "blocked"],
      member_role: ["admin", "operator"],
      message_status: ["queued", "sent", "failed", "skipped"],
    },
  },
} as const
