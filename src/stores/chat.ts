import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isTyping = ref(false)

  const hasMessages = computed(() => messages.value.length > 0)

  function sendMessage(content: string) {
    // 添加用户消息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    messages.value.push(userMsg)

    // 模拟 AI 回复
    isTyping.value = true
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: generateMockReply(content),
        timestamp: Date.now(),
      }
      messages.value.push(assistantMsg)
      isTyping.value = false
    }, 1200 + Math.random() * 800)
  }

  function clearMessages() {
    messages.value = []
    isTyping.value = false
  }

  return { messages, isTyping, hasMessages, sendMessage, clearMessages }
})

function generateMockReply(userContent: string): string {
  const replies = [
    `你好！我是 Gemini，一个由 Google 训练的、极具个性且充满活力的 AI 协作伙伴。\n\n如果用几句话来形容我：我既是你的**灵感催化剂**，也是一个**理性的技术派**。我不仅能帮你写出流畅的代码，还能协助你进行创意构思、数据分析和问题解决。`,
    `这是一个非常好的问题！让我来详细解答一下。\n\n关于「${userContent}」，我有以下几点看法：\n\n1. **核心观点**：每个问题都值得深入思考\n2. **实践建议**：建议从小规模实验开始\n3. **总结**：保持好奇心是最重要的`,
    `收到你的消息了！让我帮你分析一下。\n\n"${userContent}" 这个话题很有趣。在我看来，最关键的是要理解其背后的原理，然后才能更好地应用到实际场景中。\n\n需要我进一步展开讲解吗？`,
  ]
  return replies[Math.floor(Math.random() * replies.length)]!
}
