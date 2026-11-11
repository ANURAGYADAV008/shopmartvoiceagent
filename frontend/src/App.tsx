import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartDrawer } from './components/CartDrawer'
import { ChatWorkspace } from './components/ChatWorkspace'
import { Header } from './components/Header'
import { useChat } from './hooks/useChat'
import { checkHealth, checkVoiceHealth } from './lib/api'
import { truncate } from './lib/format'
import type { ApiStatus, Product } from './lib/types'

function App() {
  const {
    messages,
    cart,
    isLoading,
    lastFailedQuery,
    sendMessage,
    sendVoice,
    retryLast,
    startNewChat,
  } = useChat()

  const [cartOpen, setCartOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [voiceAvailable, setVoiceAvailable] = useState(false)

  useEffect(() => {
    let active = true

    const pollHealth = async () => {
      const [healthy, voiceReady] = await Promise.all([
        checkHealth(),
        checkVoiceHealth(),
      ])
      if (active) {
        setApiStatus(healthy ? 'online' : 'offline')
        setVoiceAvailable(voiceReady)
      }
    }

    void pollHealth()
    const intervalId = window.setInterval(() => {
      void pollHealth()
    }, 30_000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  const productMeta = useMemo(() => {
    const map = new Map<string, string>()
    for (const message of messages) {
      for (const product of message.products ?? []) {
        if (product.image_url) map.set(product.image_url, product.description)
      }
    }
    return map
  }, [messages])

  const cartItems = useMemo(
    () => cart.reduce((total, item) => total + (item.quantity || 0), 0),
    [cart],
  )

  const handleOpenCart = useCallback(() => setCartOpen(true), [])
  const handleCloseCart = useCallback(() => setCartOpen(false), [])

  const handleBrowse = useCallback(() => {
    setCartOpen(false)
    window.setTimeout(() => {
      document.getElementById('chat-input')?.focus()
    }, 300)
  }, [])

  const handleNewChat = useCallback(() => {
    setCartOpen(false)
    startNewChat()
  }, [startNewChat])

  const handleAddToCart = useCallback(
    (product: Product) => {
      sendMessage(
        `Please add this item to my cart: "${truncate(product.description, 150)}"`,
      )
    },
    [sendMessage],
  )

  return (
    <div className="app-shell relative flex h-dvh flex-col overflow-hidden text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-10 size-[440px] rounded-full bg-[#f2cdb9]/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/3 size-[380px] rounded-full bg-[#c9d6c4]/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-0 opacity-[0.22]"
      />

      <Header
        cartItems={cartItems}
        apiStatus={apiStatus}
        canStartNewChat={messages.length > 0 && !isLoading}
        onOpenCart={handleOpenCart}
        onNewChat={handleNewChat}
      />

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <ChatWorkspace
          messages={messages}
          isLoading={isLoading}
          canRetry={Boolean(lastFailedQuery)}
          voiceAvailable={voiceAvailable}
          onSend={sendMessage}
          onVoice={sendVoice}
          onAddToCart={handleAddToCart}
          onRetry={retryLast}
        />
      </main>

      <CartDrawer
        open={cartOpen}
        items={cart}
        productMeta={productMeta}
        isLoading={isLoading}
        onClose={handleCloseCart}
        onBrowse={handleBrowse}
      />
    </div>
  )
}

export default App
