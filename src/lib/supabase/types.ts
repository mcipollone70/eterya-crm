export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type GeocodeStatus =
  | "not_geocoded"
  | "geocoded"
  | "pending"
  | "failed"
  | "processing"
  | "completed"
  | "needs_review";
export type CompanyStatus = "active" | "inactive" | "prospect" | "lead" | "archived";
export type CommercialStatus =
  | "prospect"
  | "cliente"
  | "ex_cliente"
  | "da_ricontattare"
  | "non_interessato";
export type UserRole = "super_admin" | "org_admin" | "manager" | "agent" | "viewer";
export type ActivityStatus = "todo" | "in_progress" | "done" | "cancelled";
export type FollowUpStatus = "todo" | "completed" | "postponed" | "cancelled";
export type ActivityPriority = "low" | "medium" | "high";
export type ActivityType =
  | "call"
  | "email"
  | "task"
  | "follow_up"
  | "meeting"
  | "whatsapp"
  | "visit"
  | "quote"
  | "note";
export type VisitStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";
export type VisitTourStatus = "draft" | "planned" | "completed" | "cancelled";
export type VoiceNoteStatus = "recorded" | "transcribing" | "transcribed" | "processed" | "failed";
export type OpportunityStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";
export type OpportunityStage =
  | "new"
  | "contact_started"
  | "site_visit"
  | "quote_sent"
  | "negotiation"
  | "won"
  | "lost";
export type ProductFamily =
  | "zanzariere"
  | "tapparelle"
  | "vepa"
  | "tende_cristal"
  | "tende_tecniche_rullo";
export type ProductInterestLevel = "low" | "medium" | "high";
export type CompanyProductRelation = "interest" | "purchased";
export type AttachmentEntityType =
  | "company"
  | "contact"
  | "activity"
  | "visit"
  | "voice_note"
  | "opportunity"
  | "product";

/** Slot posizionali Excel (001–076) — preservano ogni colonna dell'import senza perdita dati. */
export type ExcelColumnSlots = {
  excel_col_001: string | null;
  excel_col_002: string | null;
  excel_col_003: string | null;
  excel_col_004: string | null;
  excel_col_005: string | null;
  excel_col_006: string | null;
  excel_col_007: string | null;
  excel_col_008: string | null;
  excel_col_009: string | null;
  excel_col_010: string | null;
  excel_col_011: string | null;
  excel_col_012: string | null;
  excel_col_013: string | null;
  excel_col_014: string | null;
  excel_col_015: string | null;
  excel_col_016: string | null;
  excel_col_017: string | null;
  excel_col_018: string | null;
  excel_col_019: string | null;
  excel_col_020: string | null;
  excel_col_021: string | null;
  excel_col_022: string | null;
  excel_col_023: string | null;
  excel_col_024: string | null;
  excel_col_025: string | null;
  excel_col_026: string | null;
  excel_col_027: string | null;
  excel_col_028: string | null;
  excel_col_029: string | null;
  excel_col_030: string | null;
  excel_col_031: string | null;
  excel_col_032: string | null;
  excel_col_033: string | null;
  excel_col_034: string | null;
  excel_col_035: string | null;
  excel_col_036: string | null;
  excel_col_037: string | null;
  excel_col_038: string | null;
  excel_col_039: string | null;
  excel_col_040: string | null;
  excel_col_041: string | null;
  excel_col_042: string | null;
  excel_col_043: string | null;
  excel_col_044: string | null;
  excel_col_045: string | null;
  excel_col_046: string | null;
  excel_col_047: string | null;
  excel_col_048: string | null;
  excel_col_049: string | null;
  excel_col_050: string | null;
  excel_col_051: string | null;
  excel_col_052: string | null;
  excel_col_053: string | null;
  excel_col_054: string | null;
  excel_col_055: string | null;
  excel_col_056: string | null;
  excel_col_057: string | null;
  excel_col_058: string | null;
  excel_col_059: string | null;
  excel_col_060: string | null;
  excel_col_061: string | null;
  excel_col_062: string | null;
  excel_col_063: string | null;
  excel_col_064: string | null;
  excel_col_065: string | null;
  excel_col_066: string | null;
  excel_col_067: string | null;
  excel_col_068: string | null;
  excel_col_069: string | null;
  excel_col_070: string | null;
  excel_col_071: string | null;
  excel_col_072: string | null;
  excel_col_073: string | null;
  excel_col_074: string | null;
  excel_col_075: string | null;
  excel_col_076: string | null;
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          assigned_user_id: string | null;
          name: string;
          legal_name: string | null;
          vat_number: string | null;
          tax_code: string | null;
          rea_number: string | null;
          cciaa: string | null;
          legal_form: string | null;
          address: string | null;
          street: string | null;
          street_number: string | null;
          postal_code: string | null;
          city: string | null;
          province: string | null;
          region: string | null;
          country: string;
          phone: string | null;
          phone_secondary: string | null;
          fax: string | null;
          mobile: string | null;
          email: string | null;
          pec: string | null;
          website: string | null;
          contact_name: string | null;
          contact_role: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          status: CompanyStatus;
          commercial_status: CommercialStatus;
          category: string | null;
          subcategory: string | null;
          sector: string | null;
          ateco_code: string | null;
          ateco_description: string | null;
          agent_code: string | null;
          zone: string | null;
          area: string | null;
          price_list: string | null;
          discount: number | null;
          credit_limit: number | null;
          revenue: number | null;
          employees: number | null;
          founding_date: string | null;
          notes: string | null;
          internal_notes: string | null;
          last_visit_at: string | null;
          last_visit_outcome: string | null;
          last_visit_notes: string | null;
          last_visit_duration_minutes: number | null;
          next_callback_at: string | null;
          last_contact_at: string | null;
          last_contact_type: string | null;
          last_contact_outcome: string | null;
          latitude: number | null;
          longitude: number | null;
          geocode_status: GeocodeStatus;
          geocoding_accuracy: string | null;
          geocoding_provider: string | null;
          geocoded_at: string | null;
          geocoding_error: string | null;
          geocoding_normalized_address: string | null;
          import_source: string | null;
          import_file_name: string | null;
          import_row_index: number | null;
          import_headers: string[];
          import_payload: Json;
          import_column_count: number;
          search_vector: unknown | null;
          created_at: string;
          updated_at: string;
        } & ExcelColumnSlots;
        Insert: Partial<Database["public"]["Tables"]["companies"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "companies_assigned_user_id_fkey";
            columns: ["assigned_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          id: string;
          company_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          mobile: string | null;
          role: string | null;
          is_primary: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          mobile?: string | null;
          role?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      agenda_reminders: {
        Row: {
          id: string;
          user_id: string;
          company_id: string | null;
          contact_id: string | null;
          opportunity_id: string | null;
          title: string;
          notes: string | null;
          scheduled_at: string;
          status: FollowUpStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id?: string | null;
          contact_id?: string | null;
          opportunity_id?: string | null;
          title: string;
          notes?: string | null;
          scheduled_at: string;
          status?: FollowUpStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agenda_reminders"]["Insert"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          company_id: string | null;
          user_id: string;
          visit_id: string | null;
          type: ActivityType;
          title: string;
          description: string | null;
          status: ActivityStatus;
          priority: string;
          due_at: string | null;
          completed_at: string | null;
          outcome: string | null;
          next_follow_up_at: string | null;
          occurred_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          user_id: string;
          visit_id?: string | null;
          type?: ActivityType;
          title: string;
          description?: string | null;
          status?: ActivityStatus;
          priority?: string;
          due_at?: string | null;
          completed_at?: string | null;
          outcome?: string | null;
          next_follow_up_at?: string | null;
          occurred_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [];
      };
      follow_ups: {
        Row: {
          id: string;
          company_id: string;
          contact_id: string | null;
          user_id: string;
          activity_type: string;
          description: string | null;
          priority: ActivityPriority;
          status: FollowUpStatus;
          scheduled_at: string;
          postponed_to: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          contact_id?: string | null;
          user_id: string;
          activity_type: string;
          description?: string | null;
          priority?: ActivityPriority;
          status?: FollowUpStatus;
          scheduled_at: string;
          postponed_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["follow_ups"]["Insert"]>;
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          scheduled_at: string;
          completed_at: string | null;
          status: VisitStatus;
          outcome: string | null;
          notes: string | null;
          duration_minutes: number | null;
          next_callback_at: string | null;
          check_in_latitude: number | null;
          check_in_longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          scheduled_at: string;
          completed_at?: string | null;
          status?: VisitStatus;
          outcome?: string | null;
          notes?: string | null;
          duration_minutes?: number | null;
          next_callback_at?: string | null;
          check_in_latitude?: number | null;
          check_in_longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
        Relationships: [];
      };
      visit_tours: {
        Row: {
          id: string;
          user_id: string;
          tour_date: string;
          mode: string;
          origin: Json;
          destination: Json;
          constraints: Json;
          stops: Json;
          total_distance_km: number | null;
          estimated_minutes: number | null;
          deviation_km: number | null;
          status: VisitTourStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tour_date?: string;
          mode?: string;
          origin: Json;
          destination: Json;
          constraints?: Json;
          stops?: Json;
          total_distance_km?: number | null;
          estimated_minutes?: number | null;
          deviation_km?: number | null;
          status?: VisitTourStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["visit_tours"]["Insert"]>;
        Relationships: [];
      };
      dashboard_layouts: {
        Row: {
          user_id: string;
          widget_order: string[];
          hidden_widgets: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          widget_order?: string[];
          hidden_widgets?: string[];
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dashboard_layouts"]["Insert"]>;
        Relationships: [];
      };
      voice_notes: {
        Row: {
          id: string;
          company_id: string | null;
          user_id: string;
          activity_id: string | null;
          visit_id: string | null;
          title: string;
          storage_path: string | null;
          duration_seconds: number | null;
          status: VoiceNoteStatus;
          transcription: string | null;
          ai_summary: Json | null;
          recorded_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          user_id: string;
          activity_id?: string | null;
          visit_id?: string | null;
          title: string;
          storage_path?: string | null;
          duration_seconds?: number | null;
          status?: VoiceNoteStatus;
          transcription?: string | null;
          ai_summary?: Json | null;
          recorded_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["voice_notes"]["Insert"]>;
        Relationships: [];
      };
      opportunities: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          number: string | null;
          title: string;
          status: OpportunityStatus;
          total_amount: number;
          currency: string;
          valid_until: string | null;
          sent_at: string | null;
          accepted_at: string | null;
          notes: string | null;
          contact_id: string | null;
          product_interest: string | null;
          probability: number | null;
          stage: OpportunityStage;
          opened_at: string;
          expected_close_at: string | null;
          product_family: ProductFamily;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          number?: string | null;
          title: string;
          status?: OpportunityStatus;
          total_amount?: number;
          currency?: string;
          valid_until?: string | null;
          sent_at?: string | null;
          accepted_at?: string | null;
          notes?: string | null;
          contact_id?: string | null;
          product_interest?: string | null;
          probability?: number | null;
          stage?: OpportunityStage;
          opened_at?: string;
          expected_close_at?: string | null;
          product_family?: ProductFamily;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opportunities"]["Insert"]>;
        Relationships: [];
      };
      opportunity_stage_history: {
        Row: {
          id: string;
          opportunity_id: string;
          from_stage: OpportunityStage | null;
          to_stage: OpportunityStage;
          changed_at: string;
          changed_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          opportunity_id: string;
          from_stage?: OpportunityStage | null;
          to_stage: OpportunityStage;
          changed_at?: string;
          changed_by?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["opportunity_stage_history"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string | null;
          name: string;
          description: string | null;
          category: string | null;
          unit_price: number;
          currency: string;
          is_active: boolean;
          family: ProductFamily;
          price_range_min: number | null;
          price_range_max: number | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku?: string | null;
          name: string;
          description?: string | null;
          category?: string | null;
          unit_price?: number;
          currency?: string;
          is_active?: boolean;
          family?: ProductFamily;
          price_range_min?: number | null;
          price_range_max?: number | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      company_products: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          custom_price: number | null;
          discount_percent: number | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          product_id: string;
          custom_price?: number | null;
          discount_percent?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_products"]["Insert"]>;
        Relationships: [];
      };
      company_product_interests: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          relation_type: CompanyProductRelation;
          interest_level: ProductInterestLevel | null;
          last_interest_at: string | null;
          commercial_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          product_id: string;
          relation_type?: CompanyProductRelation;
          interest_level?: ProductInterestLevel | null;
          last_interest_at?: string | null;
          commercial_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_product_interests"]["Insert"]>;
        Relationships: [];
      };
      company_product_interest_history: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          relation_type: CompanyProductRelation;
          interest_level: ProductInterestLevel | null;
          event_type: string;
          notes: string | null;
          occurred_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          product_id: string;
          relation_type: CompanyProductRelation;
          interest_level?: ProductInterestLevel | null;
          event_type: string;
          notes?: string | null;
          occurred_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["company_product_interest_history"]["Insert"]>;
        Relationships: [];
      };
      opportunity_products: {
        Row: {
          opportunity_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          opportunity_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opportunity_products"]["Insert"]>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          uploaded_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attachments"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export const EXCEL_COLUMN_COUNT = 76;

export const EXCEL_COLUMN_NAMES = Array.from(
  { length: EXCEL_COLUMN_COUNT },
  (_, i) => `excel_col_${String(i + 1).padStart(3, "0")}`
) as (keyof ExcelColumnSlots)[];
