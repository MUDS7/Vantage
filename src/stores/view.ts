import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ViewType = 'chat' | 'files'

export const useViewStore = defineStore('view', () => {
  const currentView = ref<ViewType>('chat')

  function setView(view: ViewType) {
    currentView.value = view
  }

  return { currentView, setView }
})
