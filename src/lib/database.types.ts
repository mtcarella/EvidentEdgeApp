export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sales_people: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          role: 'salesperson' | 'closer' | 'processor' | 'admin' | 'super_admin'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email: string
          role?: 'salesperson' | 'closer' | 'processor' | 'admin' | 'super_admin'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string
          role?: 'salesperson' | 'closer' | 'processor' | 'admin' | 'super_admin'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          name: string
          type: 'buyer' | 'realtor' | 'attorney' | 'lender'
          email: string | null
          phone: string | null
          company: string | null
          branch: string | null
          address: string | null
          paralegal: 'Kristen' | 'Lisa' | 'Raphael' | 'Danielle' | null
          preferred_surveyor: string | null
          preferred_uw: string | null
          preferred_closer: string | null
          birthday: string | null
          drinks: boolean | null
          notes: string | null
          processor_notes: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
          assigned_to: string | null
        }
        Insert: {
          id?: string
          name: string
          type: 'buyer' | 'realtor' | 'attorney' | 'lender'
          email?: string | null
          phone?: string | null
          company?: string | null
          branch?: string | null
          address?: string | null
          paralegal?: 'Kristen' | 'Lisa' | 'Raphael' | 'Danielle' | null
          preferred_surveyor?: string | null
          preferred_uw?: string | null
          preferred_closer?: string | null
          birthday?: string | null
          drinks?: boolean | null
          notes?: string | null
          processor_notes?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          assigned_to?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: 'buyer' | 'realtor' | 'attorney' | 'lender'
          email?: string | null
          phone?: string | null
          company?: string | null
          branch?: string | null
          address?: string | null
          paralegal?: 'Kristen' | 'Lisa' | 'Raphael' | 'Danielle' | null
          preferred_surveyor?: string | null
          preferred_uw?: string | null
          preferred_closer?: string | null
          birthday?: string | null
          drinks?: boolean | null
          notes?: string | null
          processor_notes?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          assigned_to?: string | null
        }
      }
      assignments: {
        Row: {
          id: string
          contact_id: string
          salesperson_id: string
          assigned_at: string
          assigned_by: string | null
        }
        Insert: {
          id?: string
          contact_id: string
          salesperson_id: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Update: {
          id?: string
          contact_id?: string
          salesperson_id?: string
          assigned_at?: string
          assigned_by?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: 'INSERT' | 'UPDATE' | 'DELETE'
          old_data: Json | null
          new_data: Json | null
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: 'INSERT' | 'UPDATE' | 'DELETE'
          old_data?: Json | null
          new_data?: Json | null
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          action?: 'INSERT' | 'UPDATE' | 'DELETE'
          old_data?: Json | null
          new_data?: Json | null
          changed_by?: string | null
          changed_at?: string
        }
      }
    }
  }
}
