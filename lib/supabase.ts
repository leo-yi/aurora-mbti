// Supabase 客户端配置
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// TypeScript 类型定义
export interface TestSession {
  id: string
  user_id: string | null
  session_id: string
  status: 'in_progress' | 'completed'
  current_question: number
  answers: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TestResult {
  id: string
  session_id: string
  user_id: string | null
  mbti_type: string
  scores: Record<string, any>
  analysis: Record<string, any>
  is_paid: boolean
  created_at: string
}

export interface Payment {
  id: string
  result_id: string
  user_id: string | null
  stripe_payment_intent_id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed'
  created_at: string
  updated_at: string
}
