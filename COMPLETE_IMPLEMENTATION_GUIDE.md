# Aurora MBTI 用户管理和支付功能 - 完整实现指南

## 📊 项目完成状态

### ✅ 已完成的工作

#### 1. **后端基础设施** (100%)
- ✅ Supabase 数据库表已创建（profiles, test_sessions, test_results, payments）
- ✅ RLS 策略已配置完成
- ✅ Edge Functions 已部署（create-payment-intent, unlock-result）

#### 2. **前端集成代码** (已创建)
- ✅ lib/supabase.ts - Supabase 客户端配置
- ✅ contexts/AuthContext.tsx - 认证上下文
- ✅ hooks/useMigrateLocalData.ts - 数据迁移钩子
- ✅ app/auth/callback/route.ts - OAuth 回调

#### 3. **核心功能**
- ✅ 用户认证（邮箱/Google/GitHub）
- ✅ Stripe 支付集成（$9.99解锁测试结果）
- ✅ localStorage 到 Supabase 数据迁移
- ✅ 行级安全（RLS）保护

## 🚀 快速开始

### 步骤 1：安装依赖

```bash
npm install @supabase/supabase-js @stripe/stripe-js @stripe/react-stripe-js
```

### 步骤 2：配置环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://ghvyturzcjwvrjfxzlpu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdodnl0dXJ6Y2p3dnJqZnh6bHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzg1NTEsImV4cCI6MjA3NzgxNDU1MX0.clfhgbRvASmzYMwM5e7cYzqIYB5kq1GDQkqXRdh0-JY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RCGUlCWKWe1Z6B6DAJcI94baztpuvvI4aYtL4VwLMFcouRuMNgy1tDpGtHqxDECeHvqg0JIC79HObjpTOp17k5d00Yw0YwNB5
```

### 步骤 3：创建缺失的组件文件

#### 3.1 PaymentWall 组件

创建 `components/payment/PaymentWall.tsx`:

```typescript
'use client'

import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentFormProps {
  testResultId: string
  onSuccess: () => void
}

function PaymentForm({ testResultId, onSuccess }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !user) return

    setLoading(true)
    setError(null)

    try {
      // 1. 创建支付意图
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('未找到认证令牌')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ test_result_id: testResultId }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '创建支付失败')
      }

      const { clientSecret, paymentIntentId } = await response.json()

      // 2. 确认支付
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('未找到卡片元素')

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: cardElement } }
      )

      if (stripeError) throw new Error(stripeError.message)

      if (paymentIntent?.status === 'succeeded') {
        // 3. 解锁结果
        const unlockResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/unlock-result`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ payment_intent_id: paymentIntentId }),
          }
        )

        if (!unlockResponse.ok) {
          const errorData = await unlockResponse.json()
          throw new Error(errorData.error || '解锁结果失败')
        }

        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '支付失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-gray-300 rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' },
              },
              invalid: { color: '#9e2146' },
            },
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '处理中...' : '支付 $9.99'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        安全支付由 Stripe 提供支持
      </p>
    </form>
  )
}

interface PaymentWallProps {
  testResultId: string
  onSuccess: () => void
}

export default function PaymentWall({ testResultId, onSuccess }: PaymentWallProps) {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">请先登录</h2>
        <p className="text-gray-600 text-center mb-6">
          您需要登录才能查看完整的测试结果
        </p>
        <a
          href="/auth/login"
          className="block w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-center transition-colors"
        >
          前往登录
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">解锁完整分析</h2>
        <p className="text-gray-600">获取您的详细 MBTI 性格分析报告</p>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">包含内容：</h3>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>✓ 完整性格类型分析</li>
          <li>✓ 详细维度得分解读</li>
          <li>✓ 个性化职业建议</li>
          <li>✓ 人际关系指南</li>
          <li>✓ 成长发展建议</li>
        </ul>
      </div>

      <div className="mb-6 text-center">
        <span className="text-3xl font-bold">$9.99</span>
        <span className="text-gray-500 ml-2">一次性付费</span>
      </div>

      <Elements stripe={stripePromise}>
        <PaymentForm testResultId={testResultId} onSuccess={onSuccess} />
      </Elements>
    </div>
  )
}
```

#### 3.2 登录页面

创建 `app/auth/login/page.tsx`:

```typescript
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signUp, signInWithGoogle, signInWithGitHub } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password)

      if (error) throw error

      if (isSignUp) {
        alert('注册成功！请检查您的邮箱以验证账户。')
      } else {
        router.push('/')
      }
    } catch (err: any) {
      setError(err.message || '认证失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      if (provider === 'google') {
        await signInWithGoogle()
      } else {
        await signInWithGitHub()
      }
    } catch (err: any) {
      setError(err.message || '登录失败')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {isSignUp ? '创建账户' : '欢迎回来'}
          </h1>
          <p className="text-gray-600">
            {isSignUp ? '注册以保存您的测试结果' : '登录以访问您的测试结果'}
          </p>
        </div>

        {/* 社交登录按钮 */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
          >
            <span>使用 Google 登录</span>
          </button>

          <button
            onClick={() => handleSocialLogin('github')}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
          >
            <span>使用 GitHub 登录</span>
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">或使用邮箱</span>
          </div>
        </div>

        {/* 邮箱登录表单 */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '处理中...' : (isSignUp ? '注册' : '登录')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {isSignUp ? '已有账户？点击登录' : '没有账户？点击注册'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 步骤 4：修改现有文件

#### 4.1 修改 app/layout.tsx

用 AuthProvider 包裹整个应用：

```typescript
import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

#### 4.2 修改测试结果页面

在结果页面中集成支付墙和数据迁移：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMigrateLocalData } from '@/hooks/useMigrateLocalData'
import { supabase } from '@/lib/supabase'
import PaymentWall from '@/components/payment/PaymentWall'

export default function ResultPage() {
  const { user } = useAuth()
  const { migrating } = useMigrateLocalData()
  const [testResult, setTestResult] = useState<any>(null)
  const [isPaid, setIsPaid] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTestResult()
  }, [])

  const loadTestResult = async () => {
    try {
      const resultId = new URLSearchParams(window.location.search).get('id')
      
      if (!resultId) {
        const localResult = localStorage.getItem('mbti_result')
        if (localResult) {
          setTestResult(JSON.parse(localResult))
        }
        return
      }

      const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('id', resultId)
        .single()

      if (error) throw error

      setTestResult(data)
      setIsPaid(data.is_paid)
    } catch (error) {
      console.error('加载测试结果失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    setIsPaid(true)
    loadTestResult()
  }

  if (loading || migrating) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (!testResult) {
    return <div className="text-center py-8">未找到测试结果</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">您的 MBTI 测试结果</h1>
      
      {/* 免费预览部分 */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">
          您的性格类型: {testResult.mbti_type}
        </h2>
        <p className="text-gray-600">
          这是您性格类型的简要介绍...
        </p>
      </div>

      {/* 如果未支付，显示支付墙 */}
      {!isPaid && (
        <PaymentWall
          testResultId={testResult.id}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* 如果已支付，显示完整分析 */}
      {isPaid && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">详细分析</h3>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(testResult.analysis, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

## 🔐 配置 OAuth 提供商

### Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"
4. 创建 OAuth 2.0 客户端 ID：
   - 应用类型：Web应用
   - 授权重定向 URI：`https://ghvyturzcjwvrjfxzlpu.supabase.co/auth/v1/callback`
5. 复制 Client ID 和 Client Secret
6. 在 [Supabase Dashboard](https://app.supabase.com/project/ghvyturzcjwvrjfxzlpu) → Authentication → Providers：
   - 启用 Google
   - 粘贴 Client ID 和 Client Secret

### GitHub OAuth

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: Aurora MBTI
   - Homepage URL: https://your-domain.com
   - Authorization callback URL: `https://ghvyturzcjwvrjfxzlpu.supabase.co/auth/v1/callback`
4. 复制 Client ID 和 Client Secret
5. 在 Supabase Dashboard → Authentication → Providers：
   - 启用 GitHub
   - 粘贴 Client ID 和 Client Secret

## 🧪 测试流程

### 测试清单

- [ ] **安装依赖**：确认所有包已安装
- [ ] **环境变量**：验证 .env.local 配置正确
- [ ] **用户注册**：测试邮箱注册功能
- [ ] **用户登录**：测试邮箱登录功能
- [ ] **Google 登录**：配置并测试 Google OAuth
- [ ] **GitHub 登录**：配置并测试 GitHub OAuth
- [ ] **数据迁移**：验证 localStorage 数据自动迁移
- [ ] **测试流程**：完成一次完整的 MBTI 测试
- [ ] **数据保存**：确认结果保存到 Supabase
- [ ] **支付测试**：使用 Stripe 测试卡 `4242 4242 4242 4242` 进行支付
- [ ] **结果解锁**：验证支付成功后结果正确解锁
- [ ] **Edge Functions 日志**：检查 Supabase Dashboard 中的日志

### Stripe 测试卡号

- **卡号**: 4242 4242 4242 4242
- **过期日期**: 任意未来日期（如 12/25）
- **CVC**: 任意3位数字（如 123）
- **邮编**: 任意5位数字（如 12345）

## 📊 系统架构

```
用户注册/登录
    ↓
完成 MBTI 测试
    ↓
测试结果保存到 Supabase (is_paid: false)
    ↓
查看免费预览
    ↓
点击支付 $9.99
    ↓
Edge Function: create-payment-intent
    ↓
Stripe 支付确认
    ↓
Edge Function: unlock-result (设置 is_paid: true)
    ↓
查看完整分析报告
```

## 🔗 重要链接

- **GitHub 分支**: https://github.com/leo-yi/aurora-mbti/tree/feature/user-management-payment
- **Supabase Project**: https://app.supabase.com/project/ghvyturzcjwvrjfxzlpu
- **Edge Functions**:
  - create-payment-intent: `c09ceb2b-a8e1-4907-b9f0-6baf215d35ff`
  - unlock-result: `bc29c715-d043-4a6e-b0a7-b5e6d816cc19`

## 🆘 故障排查

### 支付失败
1. 检查 Stripe API 密钥配置
2. 查看 Edge Functions 日志
3. 确认测试结果存在且未支付

### 认证问题
1. 验证环境变量配置
2. 检查 OAuth 回调 URL
3. 查看浏览器控制台错误

### 数据迁移问题
1. 检查浏览器控制台日志
2. 确认 localStorage 中有数据
3. 验证用户已登录

## 📝 注意事项

1. 所有 Supabase 后端服务已完全配置并处于活跃状态
2. Edge Functions 已部署，无需重新部署
3. 数据库表和 RLS 策略已就绪
4. 仅需完成前端集成和 OAuth 配置

---

**完成度：后端100% + 前端代码80% (需创建组件文件)**
**生产就绪：需完成 OAuth 配置和测试验证**