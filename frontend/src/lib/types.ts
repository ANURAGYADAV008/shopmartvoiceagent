export interface Product {
  image_url: string
  price: number | null
  description: string
}

export interface CartItem {
  product_id?: string | null
  price: number | null
  quantity: number
  currency: string
  product_image_url: string
  total_price: number | null
}

export interface ChatResponse {
  request_id: string
  answer: string
  used_context: Product[]
  trace_id?: string | null
  shopping_cart?: CartItem[]
}

export interface VoiceChatResponse {
  request_id: string
  transcript: string
  answer: string
  spoken_answer: string
  used_context: Product[]
  trace_id?: string | null
  shopping_cart?: CartItem[]
  audio_base64?: string | null
  audio_content_type?: string | null
  language_code: string
}

export interface VoiceHealth {
  status: string
  configured: boolean
  stt_model?: string
  tts_model?: string
  tts_voice?: string
  default_language?: string
  supported_languages?: string[]
}

export type MessageStatus = 'loading' | 'complete' | 'error'
export type MessageModality = 'text' | 'voice'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
  status: MessageStatus
  error?: string
  /** How the user sent this turn. Persisted; used for the voice badge. */
  modality?: MessageModality
  /** Transient Blob URL for the spoken answer. Never persisted. */
  audioUrl?: string
  createdAt: number
}

export interface PersistedChat {
  threadId: string
  messages: ChatMessage[]
  cart: CartItem[]
}

export type ApiStatus = 'checking' | 'online' | 'offline'
