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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_groups: {
        Row: {
          created_at: string | null
          id: string
          is_fixed: boolean | null
          name: string | null
          role_access: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_fixed?: boolean | null
          name?: string | null
          role_access?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_fixed?: boolean | null
          name?: string | null
          role_access?: string[] | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          group_id: string | null
          id: string
          photo_url: string | null
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          photo_url?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          photo_url?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_status: {
        Row: {
          group_id: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_status_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          phone: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          city: string | null
          company_name: string | null
          contact_email: string | null
          id: string
          phone: string | null
          physical_address: string | null
          setup_completed: boolean | null
          timezone: string | null
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          id?: string
          phone?: string | null
          physical_address?: string | null
          setup_completed?: boolean | null
          timezone?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          id?: string
          phone?: string | null
          physical_address?: string | null
          setup_completed?: boolean | null
          timezone?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string | null
          id: string
          subject: string | null
          template_key: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          id?: string
          subject?: string | null
          template_key: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          id?: string
          subject?: string | null
          template_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          date: string | null
          id: string
          is_federal: boolean | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          id?: string
          is_federal?: boolean | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          id?: string
          is_federal?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
      inspection_item_defaults: {
        Row: {
          area: string
          created_at: string | null
          default_price: number | null
          id: string
          item_name: string
        }
        Insert: {
          area: string
          created_at?: string | null
          default_price?: number | null
          id?: string
          item_name: string
        }
        Update: {
          area?: string
          created_at?: string | null
          default_price?: number | null
          id?: string
          item_name?: string
        }
        Relationships: []
      }
      inspection_items: {
        Row: {
          area: string | null
          id: string
          inspection_id: string | null
          item_name: string | null
          pm_note: string | null
          pm_selected: boolean | null
          quantity: number | null
          status: string | null
          subtotal: number | null
          unit_price: number | null
        }
        Insert: {
          area?: string | null
          id?: string
          inspection_id?: string | null
          item_name?: string | null
          pm_note?: string | null
          pm_selected?: boolean | null
          quantity?: number | null
          status?: string | null
          subtotal?: number | null
          unit_price?: number | null
        }
        Update: {
          area?: string | null
          id?: string
          inspection_id?: string | null
          item_name?: string | null
          pm_note?: string | null
          pm_selected?: boolean | null
          quantity?: number | null
          status?: string | null
          subtotal?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_tickets: {
        Row: {
          created_at: string | null
          id: string
          inspection_id: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_tickets_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          all_good: boolean | null
          bathrooms: number | null
          bedrooms: number | null
          client_id: string | null
          created_at: string | null
          has_exterior: boolean | null
          has_garage: boolean | null
          has_laundry: boolean | null
          id: string
          ins_number: string | null
          link_expires_at: string | null
          link_opened_count: number | null
          living_rooms: number | null
          master_pin_used: string | null
          pm_link_token: string | null
          pm_signature_data: string | null
          pm_submitted_at: string | null
          pm_total_selected: number | null
          property_id: string | null
          status: string | null
          visit_date: string | null
        }
        Insert: {
          all_good?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          client_id?: string | null
          created_at?: string | null
          has_exterior?: boolean | null
          has_garage?: boolean | null
          has_laundry?: boolean | null
          id?: string
          ins_number?: string | null
          link_expires_at?: string | null
          link_opened_count?: number | null
          living_rooms?: number | null
          master_pin_used?: string | null
          pm_link_token?: string | null
          pm_signature_data?: string | null
          pm_submitted_at?: string | null
          pm_total_selected?: number | null
          property_id?: string | null
          status?: string | null
          visit_date?: string | null
        }
        Update: {
          all_good?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          client_id?: string | null
          created_at?: string | null
          has_exterior?: boolean | null
          has_garage?: boolean | null
          has_laundry?: boolean | null
          id?: string
          ins_number?: string | null
          link_expires_at?: string | null
          link_opened_count?: number | null
          living_rooms?: number | null
          master_pin_used?: string | null
          pm_link_token?: string | null
          pm_signature_data?: string | null
          pm_submitted_at?: string | null
          pm_total_selected?: number | null
          property_id?: string | null
          status?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      master_pin: {
        Row: {
          id: string
          pin: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          pin?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          pin?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          current_pm_id: string | null
          id: string
          name: string | null
          pm_changed_at: string | null
          previous_pm_id: string | null
          status: string | null
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          current_pm_id?: string | null
          id?: string
          name?: string | null
          pm_changed_at?: string | null
          previous_pm_id?: string | null
          status?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          current_pm_id?: string | null
          id?: string
          name?: string | null
          pm_changed_at?: string | null
          previous_pm_id?: string | null
          status?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_current_pm_id_fkey"
            columns: ["current_pm_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_previous_pm_id_fkey"
            columns: ["previous_pm_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      technicians_vendors: {
        Row: {
          company_name: string | null
          contact_name: string | null
          email: string | null
          id: string
          insurance_info: string | null
          license_number: string | null
          notes: string | null
          phone: string | null
          specialties: string[] | null
          status: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          email?: string | null
          id?: string
          insurance_info?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          email?: string | null
          id?: string
          insurance_info?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_photos: {
        Row: {
          id: string
          is_pending_sync: boolean | null
          stage: string | null
          technician_id: string | null
          ticket_id: string | null
          uploaded_at: string | null
          url: string | null
        }
        Insert: {
          id?: string
          is_pending_sync?: boolean | null
          stage?: string | null
          technician_id?: string | null
          ticket_id?: string | null
          uploaded_at?: string | null
          url?: string | null
        }
        Update: {
          id?: string
          is_pending_sync?: boolean | null
          stage?: string | null
          technician_id?: string | null
          ticket_id?: string | null
          uploaded_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_photos_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          work_type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          work_type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          work_type?: string | null
        }
        Relationships: []
      }
      ticket_timeline: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          note: string | null
          ticket_id: string | null
          to_status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id?: string | null
          to_status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_timeline_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_timeline_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          accounting_notes: string | null
          appointment_time: string | null
          approved_by: string | null
          billing_status: string | null
          client_id: string | null
          closed_at: string | null
          created_at: string | null
          description: string | null
          fs_number: string | null
          id: string
          internal_note: string | null
          is_draft_auto_saved: boolean | null
          priority: string | null
          property_id: string | null
          qb_invoice_number: string | null
          quote_reference: string | null
          rejection_count: number | null
          related_inspection_id: string | null
          status: string | null
          technician_id: string | null
          unit: string | null
          vendor_id: string | null
          work_started_at: string | null
          work_type: string | null
          zone_id: string | null
        }
        Insert: {
          accounting_notes?: string | null
          appointment_time?: string | null
          approved_by?: string | null
          billing_status?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          description?: string | null
          fs_number?: string | null
          id?: string
          internal_note?: string | null
          is_draft_auto_saved?: boolean | null
          priority?: string | null
          property_id?: string | null
          qb_invoice_number?: string | null
          quote_reference?: string | null
          rejection_count?: number | null
          related_inspection_id?: string | null
          status?: string | null
          technician_id?: string | null
          unit?: string | null
          vendor_id?: string | null
          work_started_at?: string | null
          work_type?: string | null
          zone_id?: string | null
        }
        Update: {
          accounting_notes?: string | null
          appointment_time?: string | null
          approved_by?: string | null
          billing_status?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          description?: string | null
          fs_number?: string | null
          id?: string
          internal_note?: string | null
          is_draft_auto_saved?: boolean | null
          priority?: string | null
          property_id?: string | null
          qb_invoice_number?: string | null
          quote_reference?: string | null
          rejection_count?: number | null
          related_inspection_id?: string | null
          status?: string | null
          technician_id?: string | null
          unit?: string | null
          vendor_id?: string | null
          work_started_at?: string | null
          work_type?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_inspection_id_fkey"
            columns: ["related_inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "technicians_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_saved_filters: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          dark_mode: boolean | null
          email: string | null
          failed_login_attempts: number | null
          full_name: string | null
          id: string
          is_locked: boolean | null
          language: string | null
          last_active_at: string | null
          notifications_enabled: boolean | null
          phone: string | null
          require_password_change: boolean | null
          roles: string[] | null
        }
        Insert: {
          created_at?: string | null
          dark_mode?: boolean | null
          email?: string | null
          failed_login_attempts?: number | null
          full_name?: string | null
          id?: string
          is_locked?: boolean | null
          language?: string | null
          last_active_at?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          require_password_change?: boolean | null
          roles?: string[] | null
        }
        Update: {
          created_at?: string | null
          dark_mode?: boolean | null
          email?: string | null
          failed_login_attempts?: number | null
          full_name?: string | null
          id?: string
          is_locked?: boolean | null
          language?: string | null
          last_active_at?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          require_password_change?: boolean | null
          roles?: string[] | null
        }
        Relationships: []
      }
      work_types: {
        Row: {
          created_at: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_fs_number: { Args: never; Returns: string }
      generate_ins_number: { Args: never; Returns: string }
      get_inspection_master_pin: {
        Args: { inspection_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "technician" | "accounting"
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
      app_role: ["admin", "supervisor", "technician", "accounting"],
    },
  },
} as const
