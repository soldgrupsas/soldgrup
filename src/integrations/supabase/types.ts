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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      electrification_systems: {
        Row: {
          created_at: string | null
          id: string
          proposal_id: string
          system_details: Json | null
          system_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposal_id: string
          system_details?: Json | null
          system_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposal_id?: string
          system_details?: Json | null
          system_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "electrification_systems_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment_details: {
        Row: {
          created_at: string | null
          equipment_name: string
          equipment_specs: Json | null
          id: string
          proposal_id: string
        }
        Insert: {
          created_at?: string | null
          equipment_name: string
          equipment_specs?: Json | null
          id?: string
          proposal_id: string
        }
        Update: {
          created_at?: string | null
          equipment_name?: string
          equipment_specs?: Json | null
          id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_details_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_images: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          image_order: number
          image_url: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          image_order: number
          image_url: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          image_order?: number
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_images_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_tables: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          table_data: Json
          table_order: number
          title: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          table_data?: Json
          table_order: number
          title: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          table_data?: Json
          table_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_tables_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_report_photos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          report_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          report_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          report_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "maintenance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reports: {
        Row: {
          address: string | null
          brand: string | null
          capacity: string | null
          company: string | null
          contact: string | null
          created_at: string
          current_step: number
          data: Json
          end_date: string | null
          equipment: string | null
          id: string
          initial_state: string | null
          location_pg: string | null
          model: string | null
          phone: string | null
          recommendations: string | null
          serial: string | null
          start_date: string | null
          technician_name: string | null
          tests: Json
          updated_at: string
          user_id: string
          voltage: string | null
        }
        Insert: {
          address?: string | null
          brand?: string | null
          capacity?: string | null
          company?: string | null
          contact?: string | null
          created_at?: string
          current_step?: number
          data?: Json
          end_date?: string | null
          equipment?: string | null
          id?: string
          initial_state?: string | null
          location_pg?: string | null
          model?: string | null
          phone?: string | null
          recommendations?: string | null
          serial?: string | null
          start_date?: string | null
          technician_name?: string | null
          tests?: Json
          updated_at?: string
          user_id: string
          voltage?: string | null
        }
        Update: {
          address?: string | null
          brand?: string | null
          capacity?: string | null
          company?: string | null
          contact?: string | null
          created_at?: string
          current_step?: number
          data?: Json
          end_date?: string | null
          equipment?: string | null
          id?: string
          initial_state?: string | null
          location_pg?: string | null
          model?: string | null
          phone?: string | null
          recommendations?: string | null
          serial?: string | null
          start_date?: string | null
          technician_name?: string | null
          tests?: Json
          updated_at?: string
          user_id?: string
          voltage?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_clicks: {
        Row: {
          clicked_at: string | null
          id: string
          ip_address: string | null
          proposal_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          ip_address?: string | null
          proposal_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          id?: string
          ip_address?: string | null
          proposal_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_clicks_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_images: {
        Row: {
          created_at: string | null
          id: string
          image_caption: string | null
          image_order: number
          image_url: string
          proposal_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_caption?: string | null
          image_order: number
          image_url: string
          proposal_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_caption?: string | null
          image_order?: number
          image_url?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_images_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          item_number: number
          proposal_id: string
          quantity: number
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          item_number: number
          proposal_id: string
          quantity: number
          total_price: number
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          item_number?: number
          proposal_id?: string
          quantity?: number
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_observations: {
        Row: {
          created_at: string | null
          id: string
          observation_order: number
          observation_text: string
          proposal_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          observation_order: number
          observation_text: string
          proposal_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          observation_order?: number
          observation_text?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_observations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          click_count: number | null
          client: string | null
          client_contact: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          contact_person: string | null
          created_at: string | null
          delivery_time: string | null
          engineer_name: string | null
          engineer_title: string | null
          id: string
          model_3d_url: string | null
          notes: string | null
          observations: string | null
          offer_details: string | null
          offer_id: string | null
          payment_terms: string | null
          presentation_date: string | null
          project_location: string | null
          project_name: string | null
          proposal_date: string | null
          public_url_slug: string | null
          reference: string | null
          soldgrup_contact: string | null
          status: string | null
          technical_specs_table: Json | null
          terms_conditions: string | null
          total_amount: number | null
          updated_at: string | null
          validity_days: number | null
        }
        Insert: {
          click_count?: number | null
          client?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          contact_person?: string | null
          created_at?: string | null
          delivery_time?: string | null
          engineer_name?: string | null
          engineer_title?: string | null
          id?: string
          model_3d_url?: string | null
          notes?: string | null
          observations?: string | null
          offer_details?: string | null
          offer_id?: string | null
          payment_terms?: string | null
          presentation_date?: string | null
          project_location?: string | null
          project_name?: string | null
          proposal_date?: string | null
          public_url_slug?: string | null
          reference?: string | null
          soldgrup_contact?: string | null
          status?: string | null
          technical_specs_table?: Json | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Update: {
          click_count?: number | null
          client?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          contact_person?: string | null
          created_at?: string | null
          delivery_time?: string | null
          engineer_name?: string | null
          engineer_title?: string | null
          id?: string
          model_3d_url?: string | null
          notes?: string | null
          observations?: string | null
          offer_details?: string | null
          offer_id?: string | null
          payment_terms?: string | null
          presentation_date?: string | null
          project_location?: string | null
          project_name?: string | null
          proposal_date?: string | null
          public_url_slug?: string | null
          reference?: string | null
          soldgrup_contact?: string | null
          status?: string | null
          technical_specs_table?: Json | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Relationships: []
      }
      secure_app_settings: {
        Row: {
          encrypted_value: string
          fingerprint: string | null
          key: string
          key_suffix: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          encrypted_value: string
          fingerprint?: string | null
          key: string
          key_suffix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          encrypted_value?: string
          fingerprint?: string | null
          key?: string
          key_suffix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      technical_specifications: {
        Row: {
          created_at: string | null
          id: string
          proposal_id: string
          specification_type: string
          specification_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposal_id: string
          specification_type: string
          specification_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposal_id?: string
          specification_type?: string
          specification_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_specifications_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      generate_proposal_slug: { Args: never; Returns: string }
      get_openai_api_key: {
        Args: { encryption_secret: string }
        Returns: string
      }
      get_openai_api_key_metadata: {
        Args: never
        Returns: {
          key_exists: boolean
          key_suffix: string
          updated_at: string
          updated_by: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_proposal_clicks: {
        Args: { proposal_slug: string }
        Returns: undefined
      }
      set_openai_api_key: {
        Args: { actor_id: string; encryption_secret: string; new_key: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "mantenimiento"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user", "mantenimiento"],
    },
  },
} as const
