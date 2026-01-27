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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      couriers: {
        Row: {
          address: string
          approved_at: string | null
          approved_by: string | null
          city: string
          created_at: string
          current_lat: number | null
          current_lng: number | null
          district: string
          email: string | null
          id: string
          is_available: boolean
          ktp_image_url: string
          ktp_number: string
          last_location_update: string | null
          name: string
          phone: string
          photo_url: string
          province: string
          registered_at: string | null
          registration_status: string
          rejection_reason: string | null
          status: string
          subdistrict: string
          updated_at: string
          user_id: string | null
          vehicle_image_url: string
          vehicle_plate: string | null
          vehicle_type: string
          village_id: string | null
        }
        Insert: {
          address: string
          approved_at?: string | null
          approved_by?: string | null
          city: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          district: string
          email?: string | null
          id?: string
          is_available?: boolean
          ktp_image_url: string
          ktp_number: string
          last_location_update?: string | null
          name: string
          phone: string
          photo_url: string
          province: string
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          status?: string
          subdistrict: string
          updated_at?: string
          user_id?: string | null
          vehicle_image_url: string
          vehicle_plate?: string | null
          vehicle_type?: string
          village_id?: string | null
        }
        Update: {
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          city?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          district?: string
          email?: string | null
          id?: string
          is_available?: boolean
          ktp_image_url?: string
          ktp_number?: string
          last_location_update?: string | null
          name?: string
          phone?: string
          photo_url?: string
          province?: string
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          status?: string
          subdistrict?: string
          updated_at?: string
          user_id?: string | null
          vehicle_image_url?: string
          vehicle_plate?: string | null
          vehicle_type?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          badge: string | null
          business_category: string | null
          business_description: string | null
          city: string | null
          classification_price: string | null
          close_time: string | null
          created_at: string
          district: string | null
          id: string
          image_url: string | null
          is_open: boolean
          name: string
          open_time: string | null
          order_mode: string
          phone: string | null
          province: string | null
          rating_avg: number | null
          rating_count: number | null
          registered_at: string | null
          registration_status: string
          rejection_reason: string | null
          status: string
          subdistrict: string | null
          trade_group: string | null
          updated_at: string
          user_id: string | null
          verifikator_code: string | null
          verifikator_id: string | null
          village_id: string | null
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          badge?: string | null
          business_category?: string | null
          business_description?: string | null
          city?: string | null
          classification_price?: string | null
          close_time?: string | null
          created_at?: string
          district?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          name: string
          open_time?: string | null
          order_mode?: string
          phone?: string | null
          province?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          status?: string
          subdistrict?: string | null
          trade_group?: string | null
          updated_at?: string
          user_id?: string | null
          verifikator_code?: string | null
          verifikator_id?: string | null
          village_id?: string | null
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          badge?: string | null
          business_category?: string | null
          business_description?: string | null
          city?: string | null
          classification_price?: string | null
          close_time?: string | null
          created_at?: string
          district?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          name?: string
          open_time?: string | null
          order_mode?: string
          phone?: string | null
          province?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          status?: string
          subdistrict?: string | null
          trade_group?: string | null
          updated_at?: string
          user_id?: string | null
          verifikator_code?: string | null
          verifikator_id?: string | null
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_at: string | null
          buyer_id: string
          courier_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_name: string | null
          delivery_phone: string | null
          delivery_type: string
          handled_by: string
          id: string
          merchant_id: string | null
          notes: string | null
          picked_up_at: string | null
          shipping_cost: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          buyer_id: string
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_type?: string
          handled_by?: string
          id?: string
          merchant_id?: string | null
          notes?: string | null
          picked_up_at?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          buyer_id?: string
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_type?: string
          handled_by?: string
          id?: string
          merchant_id?: string | null
          notes?: string | null
          picked_up_at?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_promo: boolean
          merchant_id: string
          name: string
          price: number
          stock: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_promo?: boolean
          merchant_id: string
          name: string
          price: number
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_promo?: boolean
          merchant_id?: string
          name?: string
          price?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address_detail: string | null
          avatar_url: string | null
          city_id: string | null
          city_name: string | null
          created_at: string
          district_id: string | null
          district_name: string | null
          full_name: string
          id: string
          phone: string | null
          province_id: string | null
          province_name: string | null
          updated_at: string
          user_id: string
          village: string | null
          village_id: string | null
          village_name: string | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          avatar_url?: string | null
          city_id?: string | null
          city_name?: string | null
          created_at?: string
          district_id?: string | null
          district_name?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          province_id?: string | null
          province_name?: string | null
          updated_at?: string
          user_id: string
          village?: string | null
          village_id?: string | null
          village_name?: string | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          avatar_url?: string | null
          city_id?: string | null
          city_name?: string | null
          created_at?: string
          district_id?: string | null
          district_name?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          province_id?: string | null
          province_name?: string | null
          updated_at?: string
          user_id?: string
          village?: string | null
          village_id?: string | null
          village_name?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          advertiser_id: string | null
          advertiser_type: string | null
          click_count: number | null
          created_at: string
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_approved: boolean | null
          is_paid: boolean | null
          link_id: string | null
          link_type: string | null
          link_url: string | null
          price: number | null
          sort_order: number | null
          start_date: string
          subtitle: string | null
          title: string
          type: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          advertiser_id?: string | null
          advertiser_type?: string | null
          click_count?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          is_paid?: boolean | null
          link_id?: string | null
          link_type?: string | null
          link_url?: string | null
          price?: number | null
          sort_order?: number | null
          start_date?: string
          subtitle?: string | null
          title: string
          type: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          advertiser_id?: string | null
          advertiser_type?: string | null
          click_count?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          is_paid?: boolean | null
          link_id?: string | null
          link_type?: string | null
          link_url?: string | null
          price?: number | null
          sort_order?: number | null
          start_date?: string
          subtitle?: string | null
          title?: string
          type?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      tourism: {
        Row: {
          created_at: string
          description: string | null
          facilities: string[] | null
          id: string
          image_url: string | null
          is_active: boolean
          location_lat: number | null
          location_lng: number | null
          name: string
          sosmed_link: string | null
          view_count: number
          village_id: string
          wa_link: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          facilities?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_lat?: number | null
          location_lng?: number | null
          name: string
          sosmed_link?: string | null
          view_count?: number
          village_id: string
          wa_link?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          facilities?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          sosmed_link?: string | null
          view_count?: number
          village_id?: string
          wa_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tourism_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verifikator_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_usage: number | null
          trade_group: string
          usage_count: number
          verifikator_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_usage?: number | null
          trade_group: string
          usage_count?: number
          verifikator_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_usage?: number | null
          trade_group?: string
          usage_count?: number
          verifikator_id?: string
        }
        Relationships: []
      }
      villages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          district: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          regency: string
          registered_at: string | null
          registration_status: string
          rejection_reason: string | null
          subdistrict: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          district: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          regency: string
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          subdistrict?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          district?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          regency?: string
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          subdistrict?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: { Args: { _user_id: string }; Returns: string[] }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_desa: { Args: never; Returns: boolean }
      is_courier: { Args: never; Returns: boolean }
      is_merchant: { Args: never; Returns: boolean }
      is_verifikator: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "buyer"
        | "verifikator"
        | "merchant"
        | "courier"
        | "admin_desa"
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
      app_role: [
        "admin",
        "buyer",
        "verifikator",
        "merchant",
        "courier",
        "admin_desa",
      ],
    },
  },
} as const
