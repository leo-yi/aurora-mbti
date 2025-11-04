# 用户管理和支付功能集成

此分支包含了 Aurora MBTI 项目的用户管理和 Stripe 支付功能集成。

## ✨ 新功能

- **用户认证**: Supabase Auth（邮箱注册/登录 + Google/GitHub OAuth）
- **支付系统**: Stripe 集成，免费测试，付费查看完整结果（$9.99）
- **数据持久化**: 测试结果保存到 Supabase 数据库
- **安全保护**: 完整的 RLS（行级安全）策略

## 📂 新增文件说明

由于 GitHub API 限制，本分支仅包含部分示例文件。完整的集成需要以下文件：

### 后端 (Supabase Edge Functions)
```
supabase/functions/create-payment-intent/index.ts
supabase/functions/unlock-result/index.ts
```

### 前端组件
```
lib/supabase.ts                          # Supabase 客户端配置
contexts/AuthContext.tsx                  # 认证上下文管理
components/payment/PaymentWall.tsx        # 支付墙组件
app/auth/login/page.tsx                   # 登录/注册页面
app/auth/callback/route.ts                # OAuth 回调处理
```

### 文档
```
INTEGRATION_GUIDE.md                      # 完整的集成指南（已上传）
DATABASE_SCHEMA.sql                       # 数据库表结构
README_INTEGRATION.md                     # 本文件
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install @supabase/supabase-js @stripe/stripe-js @stripe/react-stripe-js
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://ghvyturzcjwvrjfxzlpu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdodnl0dXJ6Y2p3dnJqZnh6bHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzg1NTEsImV4cCI6MjA3NzgxNDU1MX0.clfhgbRvASmzYMwM5e7cYzqIYB5kq1GDQkqXRdh0-JY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RCGUlCWKWe1Z6B6DAJcI94baztpuvvI4aYtL4VwLMFcouRuMNgy1tDpGtHqxDECeHvqg0JIC79HObjpTOp17k5d00Yw0YwNB5
```

### 3. 创建缺失的集成文件

根据 `INTEGRATION_GUIDE.md` 中的代码示例，创建以下文件：

#### lib/supabase.ts
```typescript
// Supabase 客户端配置
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// TypeScript 类型定义
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
```

#### contexts/AuthContext.tsx
```typescript
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, signInWithGitHub }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内部使用')
  return context
}
```

#### app/auth/callback/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/', request.url))
}
```

### 4. 修改现有文件

#### app/layout.tsx
在根布局中包裹 AuthProvider：

```typescript
import { AuthProvider } from '@/contexts/AuthContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

## 💾 数据库状态

所有必要的数据库表和 RLS 策略已在 Supabase 项目中配置完成：

- ✅ `profiles` - 用户档案
- ✅ `test_sessions` - 测试会话
- ✅ `test_results` - 测试结果
- ✅ `payments` - 支付记录

Edge Functions 已部署并处于活跃状态：
- ✅ `create-payment-intent` (ID: c09ceb2b-a8e1-4907-b9f0-6baf215d35ff)
- ✅ `unlock-result` (ID: bc29c715-d043-4a6e-b0a7-b5e6d816cc19)

## 📋 待办事项

- [ ] 配置 Google OAuth 提供商（Supabase Dashboard）
- [ ] 配置 GitHub OAuth 提供商（Supabase Dashboard）
- [ ] 创建所有缺失的集成文件
- [ ] 修改 `app/layout.tsx` 包裹 AuthProvider
- [ ] 修改 `app/result/page.tsx` 集成支付墙
- [ ] 测试完整的用户流程
- [ ] 生产环境部署配置

## 📖 文档

- [集成指南](./INTEGRATION_GUIDE.md) - 完整的集成步骤和配置说明

## 🔧 技术栈

- **认证**: Supabase Auth
- **数据库**: Supabase (PostgreSQL)
- **支付**: Stripe Payment Intents
- **后端**: Supabase Edge Functions (Deno)
- **前端**: Next.js 15 + React 18 + TypeScript

## 🆘 需要帮助？

查看 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) 中的故障排查部分。

---

**注意**: 由于 GitHub API 限制，部分文件未能自动上传。请根据上述代码示例手动创建缺失的文件，或从本地集成目录复制。所有 Supabase 后端服务（数据库、Edge Functions）已配置完成并正常运行。