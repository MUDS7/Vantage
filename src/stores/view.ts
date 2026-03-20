import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ViewType = 'chat' | 'files'

export interface FilePreviewRequest {
  folderName: string
  fileName: string
  pageNumber?: number
}

export const useViewStore = defineStore('view', () => {
  const currentView = ref<ViewType>('chat')
  const filePreviewRequest = ref<FilePreviewRequest | null>(null)

  function setView(view: ViewType) {
    currentView.value = view
  }

  function requestFilePreview(req: FilePreviewRequest) {
    filePreviewRequest.value = req
    currentView.value = 'files'
  }

  function clearFilePreviewRequest() {
    filePreviewRequest.value = null
  }

  return { currentView, filePreviewRequest, setView, requestFilePreview, clearFilePreviewRequest }
})
