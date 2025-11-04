'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface LocalTestData {
  sessionId: string
  answers: Record<string, any>
  result?: {
    mbtiType: string
    scores: Record<string, any>
    analysis: Record<string, any>
  }
  timestamp: string
}

export function useMigrateLocalData() {
  const { user } = useAuth()
  const [migrating, setMigrating] = useState(false)
  const [migrated, setMigrated] = useState(false)

  useEffect(() => {
    if (user && !migrated) {
      checkAndMigrateData()
    }
  }, [user])

  const checkAndMigrateData = async () => {
    if (!user || migrated || migrating) return

    try {
      // 检查 localStorage 中是否有测试数据
      const localData = getLocalTestData()
      if (!localData || localData.length === 0) {
        setMigrated(true)
        return
      }

      setMigrating(true)

      // 迁移每个测试会话
      for (const data of localData) {
        await migrateSession(data)
      }

      // 清理 localStorage
      clearLocalTestData()
      setMigrated(true)
      
      console.log('数据迁移完成')
    } catch (error) {
      console.error('数据迁移失败:', error)
    } finally {
      setMigrating(false)
    }
  }

  const getLocalTestData = (): LocalTestData[] => {
    try {
      // 从 localStorage 获取测试数据
      const sessions: LocalTestData[] = []
      
      // 检查常见的 localStorage 键名
      const keys = ['mbti_test_session', 'mbti_result', 'test_data', 'mbti_answers']
      
      for (const key of keys) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            const parsed = JSON.parse(data)
            sessions.push({
              sessionId: parsed.sessionId || `local_${Date.now()}`,
              answers: parsed.answers || parsed,
              result: parsed.result,
              timestamp: parsed.timestamp || new Date().toISOString()
            })
          } catch (e) {
            console.error(`解析 ${key} 失败:`, e)
          }
        }
      }

      return sessions
    } catch (error) {
      console.error('读取本地数据失败:', error)
      return []
    }
  }

  const migrateSession = async (data: LocalTestData) => {
    try {
      // 1. 创建测试会话
      const { data: session, error: sessionError } = await supabase
        .from('test_sessions')
        .insert({
          user_id: user!.id,
          session_id: data.sessionId,
          status: data.result ? 'completed' : 'in_progress',
          answers: data.answers,
          created_at: data.timestamp,
        })
        .select()
        .single()

      if (sessionError) {
        console.error('创建会话失败:', sessionError)
        return
      }

      // 2. 如果有测试结果，创建结果记录
      if (data.result && session) {
        const { error: resultError } = await supabase
          .from('test_results')
          .insert({
            session_id: session.id,
            user_id: user!.id,
            mbti_type: data.result.mbtiType,
            scores: data.result.scores,
            analysis: data.result.analysis,
            is_paid: false,
            created_at: data.timestamp,
          })

        if (resultError) {
          console.error('创建结果失败:', resultError)
        }
      }
    } catch (error) {
      console.error('迁移会话失败:', error)
    }
  }

  const clearLocalTestData = () => {
    const keys = ['mbti_test_session', 'mbti_result', 'test_data', 'mbti_answers']
    keys.forEach(key => localStorage.removeItem(key))
  }

  const manualMigrate = async () => {
    if (!user) {
      alert('请先登录')
      return
    }

    setMigrated(false)
    await checkAndMigrateData()
  }

  return {
    migrating,
    migrated,
    manualMigrate,
  }
}
