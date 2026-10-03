export interface StaffMeter {
  id: number
  meter_number: string
  account_number: string
  name: string
  balance: string | number
  status: string // 'Connected' | 'Disconnected'
  emergency_credit_limit: string | number
  emergency_credit_active: boolean
  emergency_credit_activated_at?: string
  created_at: string
  customer_id: number
  customer_email: string
  customer_role: string
  customer_since: string
  phone_number: string
  tariff_type: string
  low_balance_threshold: number
  daily_kwh_budget: number
  today_kwh: number | string
  total_kwh: number | string
  open_complaints_count: number
  last_payment_amount: number | string
  last_payment_date?: string
}

export interface StaffComplaint {
  id: number
  ticket_number: string
  user_id: number
  meter_id?: number
  complaint_type: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'submitted' | 'in_review' | 'investigating' | 'resolved' | 'closed'
  resolution_notes?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  customer_email?: string
  meter_number?: string
  meter_name?: string
}

export interface StaffUser {
  id: number
  email: string
  role: string
}
