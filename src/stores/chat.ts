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

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isTyping = ref(false)
  const thinkingEnabled = ref(false) // 是否开启思考模式

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

  function clearMessages() {
    messages.value = []
    isTyping.value = false
  }

  return { messages, isTyping, hasMessages, thinkingEnabled, sendMessage, clearMessages, toggleThinking }
})
