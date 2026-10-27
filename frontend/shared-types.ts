/**
 * Shared Type Definitions for LECO Smart Electricity Meter System
 * Shared contract between Customer Portal and Staff Grid Operations Portal.
 */

export type TariffGroup = 'BLOCK_1' | 'BLOCK_2';

export interface Meter {
  id: number;
  user_id: number;
  meter_number: string;
  account_number: string;
  balance: number | string;
  status: 'Connected' | 'Disconnected';
  name?: string;
  daily_average?: number | string;
  emergency_credit_limit: number | string;
  emergency_credit_active: boolean;
  emergency_credit_activated_at?: string | null;
  created_at: string;
}

export interface ConsumptionLog {
  id: number;
  meter_id: number;
  reading_date: string;
  reading_hour: number;
  consumption: number;
  energy_export: number;
  created_at: string;
}

export interface PaymentTransaction {
  id: number;
  user_id: number;
  meter_id: number;
  amount: number | string;
  payment_method: string;
  transaction_id: string;
  order_id?: string;
  previous_balance: number | string;
  new_balance: number | string;
  status: 'Success' | 'Pending' | 'Failed';
  verified_at?: string | null;
  verified_by?: string | null;
  created_at: string;
}

export interface Complaint {
  id: number;
  user_id: number;
  meter_id?: number | null;
  category: 'Billing' | 'Power Outage' | 'Hardware/Meter' | 'Other';
  subject: string;
  description: string;
  status: 'submitted' | 'in_progress' | 'resolved';
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  phone_number: string;
  low_balance_threshold: number;
  daily_kwh_budget: number;
  monthly_budget_lkr: number;
  auto_emergency_credit: boolean;
  night_curfew_enabled: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  weekly_report: boolean;
  tariff_type?: string;
}
