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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          company: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_invitations: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          invited_by: string
          role: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      filament_stock: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          initial_weight_g: number
          material_id: string | null
          material_name: string
          remaining_weight_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          initial_weight_g?: number
          material_id?: string | null
          material_name: string
          remaining_weight_g?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          initial_weight_g?: number
          material_id?: string | null
          material_name?: string
          remaining_weight_g?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filament_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filament_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_records: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          active: boolean
          category: string | null
          company_id: string | null
          created_at: string
          due_day: number | null
          id: string
          monthly_amount: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          company_id?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          monthly_amount?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string | null
          company_id?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          monthly_amount?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          brand: string | null
          color: string | null
          company_id: string | null
          cost_per_kg: number
          created_at: string
          density: number | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          company_id?: string | null
          cost_per_kg?: number
          created_at?: string
          density?: number | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          company_id?: string | null
          cost_per_kg?: number
          created_at?: string
          density?: number | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_name: string | null
          company_id: string | null
          created_at: string
          final_price: number | null
          id: string
          piece_name: string | null
          quote_id: string | null
          quote_number: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          final_price?: number | null
          id?: string
          piece_name?: string | null
          quote_id?: string | null
          quote_number?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          final_price?: number | null
          id?: string
          piece_name?: string | null
          quote_id?: string | null
          quote_number?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          avg_print_time_hours: number | null
          avg_weight_grams: number | null
          company_id: string
          created_at: string
          default_material_id: string | null
          default_material_name: string | null
          id: string
          name: string
          stl_file_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_print_time_hours?: number | null
          avg_weight_grams?: number | null
          company_id: string
          created_at?: string
          default_material_id?: string | null
          default_material_name?: string | null
          id?: string
          name: string
          stl_file_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_print_time_hours?: number | null
          avg_weight_grams?: number | null
          company_id?: string
          created_at?: string
          default_material_id?: string | null
          default_material_name?: string | null
          id?: string
          name?: string
          stl_file_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_default_material_id_fkey"
            columns: ["default_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          company_id: string | null
          cost_per_hour: number | null
          created_at: string
          energy_cost_per_kwh: number
          id: string
          lifespan_hours: number
          maintenance_cost_per_hour: number
          name: string
          power_consumption_watts: number
          purchase_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          cost_per_hour?: number | null
          created_at?: string
          energy_cost_per_kwh?: number
          id?: string
          lifespan_hours?: number
          maintenance_cost_per_hour?: number
          name: string
          power_consumption_watts?: number
          purchase_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          cost_per_hour?: number | null
          created_at?: string
          energy_cost_per_kwh?: number
          id?: string
          lifespan_hours?: number
          maintenance_cost_per_hour?: number
          name?: string
          power_consumption_watts?: number
          purchase_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_labore: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_labore_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_id: string | null
          company_logo_url: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          default_margin: number | null
          hourly_rate: number | null
          id: string
          modeling_hourly_rate: number | null
          owner_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_id?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_margin?: number | null
          hourly_rate?: number | null
          id?: string
          modeling_hourly_rate?: number | null
          owner_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_id?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_margin?: number | null
          hourly_rate?: number | null
          id?: string
          modeling_hourly_rate?: number | null
          owner_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_distribution: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_distribution_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          base_price: number | null
          client_id: string | null
          client_name: string | null
          company_id: string | null
          created_at: string
          delivery_days: number | null
          discount: number | null
          final_price: number | null
          finishing: string | null
          has_modeling: boolean | null
          id: string
          labor_cost: number | null
          machine_cost: number | null
          margin: number | null
          material_cost: number | null
          material_id: string | null
          material_name: string | null
          modeling_cost: number | null
          modeling_hours: number | null
          payment_method: string | null
          piece_name: string
          post_processing_hours: number
          print_time_hours: number
          printer_id: string | null
          printer_name: string | null
          quote_data: Json | null
          quote_number: string
          quote_type: string
          shipping_cost: number | null
          status: Database["public"]["Enums"]["quote_status"]
          stl_file_url: string | null
          total_cost: number | null
          updated_at: string
          user_id: string
          weight_grams: number
        }
        Insert: {
          base_price?: number | null
          client_id?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          delivery_days?: number | null
          discount?: number | null
          final_price?: number | null
          finishing?: string | null
          has_modeling?: boolean | null
          id?: string
          labor_cost?: number | null
          machine_cost?: number | null
          margin?: number | null
          material_cost?: number | null
          material_id?: string | null
          material_name?: string | null
          modeling_cost?: number | null
          modeling_hours?: number | null
          payment_method?: string | null
          piece_name: string
          post_processing_hours?: number
          print_time_hours?: number
          printer_id?: string | null
          printer_name?: string | null
          quote_data?: Json | null
          quote_number: string
          quote_type?: string
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          stl_file_url?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
          weight_grams?: number
        }
        Update: {
          base_price?: number | null
          client_id?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          delivery_days?: number | null
          discount?: number | null
          final_price?: number | null
          finishing?: string | null
          has_modeling?: boolean | null
          id?: string
          labor_cost?: number | null
          machine_cost?: number | null
          margin?: number | null
          material_cost?: number | null
          material_id?: string | null
          material_name?: string | null
          modeling_cost?: number | null
          modeling_hours?: number | null
          payment_method?: string | null
          piece_name?: string
          post_processing_hours?: number
          print_time_hours?: number
          printer_id?: string | null
          printer_name?: string | null
          quote_data?: Json | null
          quote_number?: string
          quote_type?: string
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          stl_file_url?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      software: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          id: string
          monthly_cost: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_expenses: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string
          date: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variable_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invitations: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      get_all_users_for_admin: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      order_status:
        | "queue"
        | "printing"
        | "post_processing"
        | "finished"
        | "delivered"
      quote_status: "draft" | "sent" | "approved" | "rejected"
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
      order_status: [
        "queue",
        "printing",
        "post_processing",
        "finished",
        "delivered",
      ],
      quote_status: ["draft", "sent", "approved", "rejected"],
    },
  },
} as const
