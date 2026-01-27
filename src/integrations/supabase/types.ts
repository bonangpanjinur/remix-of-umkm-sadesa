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
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
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
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          merchant_id: string
          status: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          merchant_id: string
          status?: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          merchant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "trade_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_fund: {
        Row: {
          amount: number
          claim_reason: string | null
          created_at: string | null
          evidence_urls: string[] | null
          id: string
          merchant_id: string
          order_id: string | null
          processed_at: string | null
          processed_by: string | null
          status: string | null
          type: string
        }
        Insert: {
          amount: number
          claim_reason?: string | null
          created_at?: string | null
          evidence_urls?: string[] | null
          id?: string
          merchant_id: string
          order_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          type: string
        }
        Update: {
          amount?: number
          claim_reason?: string | null
          created_at?: string | null
          evidence_urls?: string[] | null
          id?: string
          merchant_id?: string
          order_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_fund_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_fund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kas_payments: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          group_id: string
          id: string
          merchant_id: string
          notes: string | null
          payment_date: string | null
          payment_month: number
          payment_year: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          collected_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          merchant_id: string
          notes?: string | null
          payment_date?: string | null
          payment_month: number
          payment_year: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          merchant_id?: string
          notes?: string | null
          payment_date?: string | null
          payment_month?: number
          payment_year?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kas_payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "trade_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kas_payments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscriptions: {
        Row: {
          created_at: string
          expired_at: string
          id: string
          merchant_id: string
          package_id: string
          paid_at: string | null
          payment_amount: number
          payment_status: string
          started_at: string
          status: string
          transaction_quota: number
          updated_at: string
          used_quota: number
        }
        Insert: {
          created_at?: string
          expired_at: string
          id?: string
          merchant_id: string
          package_id: string
          paid_at?: string | null
          payment_amount?: number
          payment_status?: string
          started_at?: string
          status?: string
          transaction_quota?: number
          updated_at?: string
          used_quota?: number
        }
        Update: {
          created_at?: string
          expired_at?: string
          id?: string
          merchant_id?: string
          package_id?: string
          paid_at?: string | null
          payment_amount?: number
          payment_status?: string
          started_at?: string
          status?: string
          transaction_quota?: number
          updated_at?: string
          used_quota?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "transaction_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          available_balance: number | null
          badge: string | null
          business_category: string | null
          business_description: string | null
          city: string | null
          classification_price: string | null
          close_time: string | null
          cod_max_amount: number | null
          cod_max_distance_km: number | null
          created_at: string
          current_subscription_id: string | null
          district: string | null
          id: string
          image_url: string | null
          is_open: boolean
          name: string
          open_time: string | null
          order_mode: string
          pending_balance: number | null
          phone: string | null
          province: string | null
          rating_avg: number | null
          rating_count: number | null
          registered_at: string | null
          registration_status: string
          rejection_reason: string | null
          status: string
          subdistrict: string | null
          total_withdrawn: number | null
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
          available_balance?: number | null
          badge?: string | null
          business_category?: string | null
          business_description?: string | null
          city?: string | null
          classification_price?: string | null
          close_time?: string | null
          cod_max_amount?: number | null
          cod_max_distance_km?: number | null
          created_at?: string
          current_subscription_id?: string | null
          district?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          name: string
          open_time?: string | null
          order_mode?: string
          pending_balance?: number | null
          phone?: string | null
          province?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          status?: string
          subdistrict?: string | null
          total_withdrawn?: number | null
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
          available_balance?: number | null
          badge?: string | null
          business_category?: string | null
          business_description?: string | null
          city?: string | null
          classification_price?: string | null
          close_time?: string | null
          cod_max_amount?: number | null
          cod_max_distance_km?: number | null
          created_at?: string
          current_subscription_id?: string | null
          district?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          name?: string
          open_time?: string | null
          order_mode?: string
          pending_balance?: number | null
          phone?: string | null
          province?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          registered_at?: string | null
          registration_status?: string
          rejection_reason?: string | null
          status?: string
          subdistrict?: string | null
          total_withdrawn?: number | null
          trade_group?: string | null
          updated_at?: string
          user_id?: string | null
          verifikator_code?: string | null
          verifikator_id?: string | null
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_current_subscription_id_fkey"
            columns: ["current_subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          buyer_distance_km: number | null
          buyer_id: string
          cod_service_fee: number | null
          confirmation_deadline: string | null
          confirmed_at: string | null
          courier_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_name: string | null
          delivery_phone: string | null
          delivery_type: string
          flash_sale_discount: number | null
          handled_by: string
          id: string
          is_flash_sale: boolean | null
          merchant_id: string | null
          notes: string | null
          payment_channel: string | null
          payment_invoice_id: string | null
          payment_invoice_url: string | null
          payment_method: string | null
          payment_paid_at: string | null
          payment_status: string | null
          picked_up_at: string | null
          rejection_reason: string | null
          shipping_cost: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          buyer_distance_km?: number | null
          buyer_id: string
          cod_service_fee?: number | null
          confirmation_deadline?: string | null
          confirmed_at?: string | null
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_type?: string
          flash_sale_discount?: number | null
          handled_by?: string
          id?: string
          is_flash_sale?: boolean | null
          merchant_id?: string | null
          notes?: string | null
          payment_channel?: string | null
          payment_invoice_id?: string | null
          payment_invoice_url?: string | null
          payment_method?: string | null
          payment_paid_at?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          rejection_reason?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          buyer_distance_km?: number | null
          buyer_id?: string
          cod_service_fee?: number | null
          confirmation_deadline?: string | null
          confirmed_at?: string | null
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_type?: string
          flash_sale_discount?: number | null
          handled_by?: string
          id?: string
          is_flash_sale?: boolean | null
          merchant_id?: string | null
          notes?: string | null
          payment_channel?: string | null
          payment_invoice_id?: string | null
          payment_invoice_url?: string | null
          payment_method?: string | null
          payment_paid_at?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          rejection_reason?: string | null
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
          discount_end_date: string | null
          discount_percent: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_promo: boolean
          merchant_id: string
          min_stock_alert: number | null
          name: string
          order_count: number | null
          price: number
          stock: number
          updated_at: string
          view_count: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          discount_end_date?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_promo?: boolean
          merchant_id: string
          min_stock_alert?: number | null
          name: string
          order_count?: number | null
          price: number
          stock?: number
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          discount_end_date?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_promo?: boolean
          merchant_id?: string
          min_stock_alert?: number | null
          name?: string
          order_count?: number | null
          price?: number
          stock?: number
          updated_at?: string
          view_count?: number | null
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
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          city_id: string | null
          city_name: string | null
          cod_enabled: boolean | null
          cod_fail_count: number | null
          created_at: string
          district_id: string | null
          district_name: string | null
          full_name: string
          id: string
          is_blocked: boolean | null
          is_verified_buyer: boolean | null
          phone: string | null
          province_id: string | null
          province_name: string | null
          trust_score: number | null
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
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          city_id?: string | null
          city_name?: string | null
          cod_enabled?: boolean | null
          cod_fail_count?: number | null
          created_at?: string
          district_id?: string | null
          district_name?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean | null
          is_verified_buyer?: boolean | null
          phone?: string | null
          province_id?: string | null
          province_name?: string | null
          trust_score?: number | null
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
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          city_id?: string | null
          city_name?: string | null
          cod_enabled?: boolean | null
          cod_fail_count?: number | null
          created_at?: string
          district_id?: string | null
          district_name?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean | null
          is_verified_buyer?: boolean | null
          phone?: string | null
          province_id?: string | null
          province_name?: string | null
          trust_score?: number | null
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
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string | null
          id: string
          image_urls: string[] | null
          is_visible: boolean | null
          merchant_id: string
          merchant_replied_at: string | null
          merchant_reply: string | null
          order_id: string | null
          product_id: string
          rating: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          is_visible?: boolean | null
          merchant_id: string
          merchant_replied_at?: string | null
          merchant_reply?: string | null
          order_id?: string | null
          product_id: string
          rating: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          is_visible?: boolean | null
          merchant_id?: string
          merchant_replied_at?: string | null
          merchant_reply?: string | null
          order_id?: string | null
          product_id?: string
          rating?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      trade_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          monthly_fee: number
          name: string
          updated_at: string
          verifikator_id: string
          village_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_fee?: number
          name: string
          updated_at?: string
          verifikator_id: string
          village_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_fee?: number
          name?: string
          updated_at?: string
          verifikator_id?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_groups_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_packages: {
        Row: {
          classification_price: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kas_fee: number
          name: string
          price_per_transaction: number
          transaction_quota: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          classification_price: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kas_fee?: number
          name: string
          price_per_transaction?: number
          transaction_quota?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          classification_price?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kas_fee?: number
          name?: string
          price_per_transaction?: number
          transaction_quota?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
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
      withdrawal_requests: {
        Row: {
          account_holder: string
          account_number: string
          admin_notes: string | null
          amount: number
          bank_name: string
          created_at: string | null
          id: string
          merchant_id: string
          processed_at: string | null
          processed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          account_holder: string
          account_number: string
          admin_notes?: string | null
          amount: number
          bank_name: string
          created_at?: string | null
          id?: string
          merchant_id: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          account_holder?: string
          account_number?: string
          admin_notes?: string | null
          amount?: number
          bank_name?: string
          created_at?: string | null
          id?: string
          merchant_id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_cancel_pending_orders: { Args: never; Returns: undefined }
      check_cod_eligibility: {
        Args: {
          p_buyer_id: string
          p_distance_km?: number
          p_merchant_id: string
          p_total_amount: number
        }
        Returns: Json
      }
      check_merchant_quota: { Args: { p_merchant_id: string }; Returns: Json }
      generate_monthly_kas: {
        Args: { p_group_id: string; p_month: number; p_year: number }
        Returns: number
      }
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
      send_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      use_merchant_quota: { Args: { p_merchant_id: string }; Returns: boolean }
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
