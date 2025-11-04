# Aurora MBTI - 用户管理和支付集成指南

本指南将帮助您将 Supabase 认证和 Stripe 支付功能集成到 Aurora MBTI 项目中。

## 📋 目录

- [前置要求](#前置要求)
- [数据库设置](#数据库设置)
- [环境变量配置](#环境变量配置)
- [安装依赖](#安装依赖)
- [代码集成](#代码集成)
- [OAuth 提供商配置](#oauth-提供商配置)
- [测试流程](#测试流程)
- [部署注意事项](#部署注意事项)

## 🔧 前置要求

### Supabase 配置

本项目的 Supabase 数据库和 Edge Functions 已经配置完成：

- **Supabase URL**: `https://ghvyturzcjwvrjfxzlpu.supabase.co`
- **Edge Functions**:
  - `create-payment-intent`: 创建 Stripe 支付意图
  - `unlock-result`: 验证支付并解锁测试结果

### 数据库表

以下表已在 Supabase 中创建并配置了 RLS 策略：

1. **profiles** - 用户档案信息
2. **test_sessions** - 测试会话记录
3. **test_results** - 测试结果数据
4. **payments** - 支付交易记录

所有表都启用了行级安全（RLS），确保用户只能访问自己的数据。

## 🌐 环境变量配置

在项目根目录创建或更新 `.env.local` 文件：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://ghvyturzcjwvrjfxzlpu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe 配置
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Edge Functions 环境变量（在 Supabase Dashboard 中配置）
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# STRIPE_SECRET_KEY=your_stripe_secret_key
```

> **注意**: Edge Functions 的环境变量需要在 Supabase Dashboard 的 Edge Functions 设置中配置，不要将 service role key 暴露在客户端代码中。

## 📦 安装依赖

```bash
npm install @supabase/supabase-js @stripe/stripe-js @stripe/react-stripe-js
```

## 🔌 代码集成

### 1. 修改根布局 (app/layout.tsx)

使用 `AuthProvider` 包裹整个应用：

```tsx
import { AuthProvider } from '@/contexts/AuthContext'

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

### 2. 修改结果页面 (app/result/page.tsx)

集成支付墙功能，显示免费预览和付费解锁选项。查看完整示例代码请参考源文件。

### 3. 保存测试结果到 Supabase

在测试完成后，将结果保存到数据库：

```tsx
import { supabase } from '@/lib/supabase'

async function saveTestResult(sessionId: string, mbtiType: string, scores: any, analysis: any) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('test_results')
    .insert({
      session_id: sessionId,
      user_id: user?.id || null,
      mbti_type: mbtiType,
      scores: scores,
      analysis: analysis,
      is_paid: false,
    })
    .select()
    .single()

  if (error) {
    console.error('保存测试结果失败:', error)
    return null
  }

  return data
}
```

## 🔐 OAuth 提供商配置

### Google OAuth

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 进入项目设置 → Authentication → Providers
3. 启用 Google 提供商
4. 配置 OAuth 回调 URL: `https://ghvyturzcjwvrjfxzlpu.supabase.co/auth/v1/callback`
5. 在 [Google Cloud Console](https://console.cloud.google.com) 创建 OAuth 2.0 凭据
6. 将 Client ID 和 Client Secret 填入 Supabase

### GitHub OAuth

1. 在 Supabase Dashboard 启用 GitHub 提供商
2. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
3. 创建新的 OAuth App
4. 设置 Authorization callback URL: `https://ghvyturzcjwvrjfxzlpu.supabase.co/auth/v1/callback`
5. 将 Client ID 和 Client Secret 填入 Supabase

## 🧪 测试流程

### 1. 本地开发测试

```bash
npm run dev
```

访问 `http://localhost:3000` 并测试以下流程：

1. **注册/登录**
   - 邮箱注册
   - Google 登录
   - GitHub 登录

2. **测试流程**
   - 完成 MBTI 测试
   - 查看免费预览
   - 尝试支付解锁

3. **支付测试**
   - 使用 Stripe 测试卡号: `4242 4242 4242 4242`
   - 任意未来日期
   - 任意 3 位 CVC

## 🚀 部署注意事项

### Vercel 部署

1. 在 Vercel 项目设置中添加环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

2. 更新 OAuth 重定向 URL 为生产域名：
   - `https://your-domain.com/auth/callback`

### Edge Functions 环境变量

在 Supabase Dashboard 中配置 Edge Functions 的机密环境变量：

1. 进入 Edge Functions → Settings
2. 添加以下变量：
   - `STRIPE_SECRET_KEY`: Stripe 密钥
   - `SUPABASE_SERVICE_ROLE_KEY`: 已自动配置

## 🔍 故障排查

### 支付失败

1. 检查 Stripe API 密钥是否正确配置
2. 查看 Edge Functions 日志
3. 确认测试结果存在且未支付

### 认证问题

1. 验证 Supabase URL 和 Anon Key
2. 检查 OAuth 回调 URL 配置
3. 查看浏览器控制台错误

### 数据库访问被拒绝

1. 确认 RLS 策略已启用
2. 检查用户是否已登录
3. 验证数据所有权（user_id 匹配）

## 📚 相关资源

- [Supabase 文档](https://supabase.com/docs)
- [Stripe 文档](https://stripe.com/docs)
- [Next.js 文档](https://nextjs.org/docs)

## 🆘 获取帮助

如有问题，请检查：

1. Supabase Dashboard 的日志
2. 浏览器开发者工具的网络和控制台
3. Edge Functions 的实时日志

---

**注意**: 所有 Supabase 数据库和 Edge Functions 已配置完成，您只需要完成前端集成部分。