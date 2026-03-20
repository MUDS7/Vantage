import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { API_BASE_URL } from '../config'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoningContent?: string // 思维链内容（仅 assistant 消息可能有）
  timestamp: number
}

interface ChatApiHistory {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  session_id: string
  title: string
  model: string
  message_count: number
  created_at: string
  updated_at: string
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isTyping = ref(false)
  const thinkingEnabled = ref(false) // 是否开启思考模式
  const sessionId = ref<string | null>(null) // 当前会话 ID
  const sessions = ref<ChatSession[]>([]) // 会话列表
  const sessionsLoading = ref(false) // 会话列表加载状态

  const hasMessages = computed(() => messages.value.length > 0)

  /**
   * 根据当前消息列表构建 API 所需的 history 数组
   * 包含 system prompt + 所有历史对话
   * 注意：按照 DeepSeek 官方要求，history 中只拼接 content（reply），不拼接 reasoning_content
   */
  function buildHistory(): ChatApiHistory[] {
    const history: ChatApiHistory[] = [
      { role: 'system', content: '你是一个专业的AI助手' },
    ]
    for (const msg of messages.value) {
      history.push({
        role: msg.role,
        content: msg.content, // 只传 content，不传 reasoningContent
      })
    }
    return history
  }

  function toggleThinking() {
    thinkingEnabled.value = !thinkingEnabled.value
  }

  async function sendMessage(content: string) {
    // 添加用户消息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    messages.value.push(userMsg)

    // 构建 history（不含本次 message，API 的 message 字段已单独传递）
    const fullHistory = buildHistory()
    // 移除最后一条（当前用户消息），因为 API 的 message 字段已经包含了
    const history = fullHistory.slice(0, -1)

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      message: content,
      history,
      session_id: sessionId.value, // 传入当前会话 ID，null 时后端自动创建新会话
    }

    if (thinkingEnabled.value) {
      // 思考模式方式二：使用 deepseek-chat + thinking: true
      requestBody.model = 'deepseek-chat'
      requestBody.thinking = true
    } else {
      requestBody.model = 'deepseek-chat'
    }

    // 调用 DeepSeek API
    isTyping.value = true
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success && data.reply) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          reasoningContent: data.reasoning_content || undefined,
          timestamp: Date.now(),
        }
        messages.value.push(assistantMsg)

        // 保存后端返回的 session_id
        if (data.session_id) {
          const isNewSession = sessionId.value === null
          sessionId.value = data.session_id
          // 立即刷新会话列表
          fetchSessions()
          // 新建会话时，后端异步生成标题，轮询直到标题更新
          if (isNewSession) {
            pollForTitle(data.session_id)
          }
        }
      } else {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '抱歉，服务暂时出现问题，请稍后再试。',
          timestamp: Date.now(),
        }
        messages.value.push(assistantMsg)
      }
    } catch (error) {
      console.error('Chat API 调用失败:', error)
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '网络连接失败，请检查网络后重试。',
        timestamp: Date.now(),
      }
      messages.value.push(assistantMsg)
    } finally {
      isTyping.value = false
    }
  }

  /**
   * 获取会话列表
   */
  async function fetchSessions() {
    sessionsLoading.value = true
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions`)
      const data = await response.json()
      if (data.success && data.sessions) {
        sessions.value = data.sessions
      }
    } catch (error) {
      console.error('获取会话列表失败:', error)
    } finally {
      sessionsLoading.value = false
    }
  }

  /**
   * 轮询等待后端异步生成的标题更新
   * 每 3 秒拉一次列表，检查标题是否已生成，最多 10 次（30 秒）
   */
  function pollForTitle(targetId: string) {
    let attempts = 0
    const maxAttempts = 10
    const interval = setInterval(async () => {
      attempts++
      await fetchSessions()
      const session = sessions.value.find((s) => s.session_id === targetId)
      // 标题已更新（非空且不是默认占位）或达到上限则停止
      if ((session && session.title && session.title !== '新对话') || attempts >= maxAttempts) {
        clearInterval(interval)
      }
    }, 3000)
  }

  /**
   * 加载指定会话的详情（消息列表）
   */
  async function loadSession(targetSessionId: string) {
    isTyping.value = true
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: targetSessionId }),
      })
      const data = await response.json()
      if (data.success && data.session) {
        sessionId.value = data.session.session_id
        // 将后端返回的 messages 转换为前端 ChatMessage 格式
        messages.value = data.session.messages.map(
          (msg: { role: string; content: string }, index: number) => ({
            id: `${data.session.session_id}-${index}`,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: Date.now(),
          }),
        )
      }
    } catch (error) {
      console.error('加载会话详情失败:', error)
    } finally {
      isTyping.value = false
    }
  }

  /**
   * 删除指定会话
   */
  async function deleteSession(targetSessionId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/session/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: targetSessionId }),
      })
      const data = await response.json()
      if (data.success) {
        // 从列表中移除
        sessions.value = sessions.value.filter((s) => s.session_id !== targetSessionId)
        // 如果删除的是当前会话，则清空聊天区
        if (sessionId.value === targetSessionId) {
          clearMessages()
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  /**
   * 发起新对话：清空当前消息和 sessionId
   */
  function newChat() {
    messages.value = []
    sessionId.value = null
    isTyping.value = false
  }

  function clearMessages() {
    messages.value = []
    sessionId.value = null
    isTyping.value = false
  }

  return {
    messages,
    isTyping,
    hasMessages,
    thinkingEnabled,
    sessionId,
    sessions,
    sessionsLoading,
    sendMessage,
    clearMessages,
    toggleThinking,
    fetchSessions,
    loadSession,
    deleteSession,
    newChat,
  }
})
