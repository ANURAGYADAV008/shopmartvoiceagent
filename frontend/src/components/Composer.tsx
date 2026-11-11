import clsx from 'clsx'
import { ArrowUp, Loader2, Mic, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { formatDuration } from '../lib/audio'

interface ComposerProps {
  isLoading: boolean
  voiceAvailable: boolean
  onSend: (message: string) => void
  onVoice: (audio: Blob) => void
}

export function Composer({
  isLoading,
  voiceAvailable,
  onSend,
  onVoice,
}: ComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recorder = useVoiceRecorder(onVoice)
  const canUseVoice = voiceAvailable && recorder.supported

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 156)}px`
  }, [value])

  const submit = () => {
    const message = value.trim()
    if (!message || isLoading || recorder.isRecording) return
    onSend(message)
    setValue('')
  }

  const toggleRecording = () => {
    if (recorder.isRecording) {
      recorder.stop()
      return
    }
    void recorder.start()
  }

  const voiceTitle = !voiceAvailable
    ? 'Voice chat is not available. Set GNANI_API_KEY on the server and restart the API.'
    : !recorder.supported
      ? 'Voice recording is not supported in this browser.'
      : isLoading
        ? 'Wait for the current answer to finish.'
        : recorder.isRecording
          ? 'Stop and send the voice message'
          : 'Ask with your voice'

  return (
    <div className="shrink-0 border-t border-line/60 bg-surface/85 px-3 pb-3 pt-2.5 backdrop-blur sm:px-5 sm:pb-4">
      <form
        className="mx-auto max-w-[860px]"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div
          className={clsx(
            'flex items-end gap-1.5 rounded-[24px] border border-line bg-white p-1.5 shadow-[0_10px_35px_-24px_rgba(52,42,29,0.5)] transition focus-within:border-accent/35 focus-within:ring-4 focus-within:ring-accent/10',
            recorder.isRecording &&
              'border-accent/45 ring-4 ring-accent/10',
          )}
        >
          <button
            type="button"
            onClick={toggleRecording}
            disabled={!canUseVoice || isLoading || recorder.isBusy}
            title={voiceTitle}
            aria-label={
              recorder.isRecording
                ? 'Stop recording and send'
                : 'Record a voice message'
            }
            aria-pressed={recorder.isRecording}
            className={clsx(
              'mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full transition duration-200',
              recorder.isRecording
                ? 'bg-accent text-white shadow-[0_0_0_4px_rgba(226,94,43,0.16)] hover:bg-accent-dark'
                : 'text-muted hover:bg-ink/5 hover:text-ink',
              (!canUseVoice || isLoading || recorder.isBusy) &&
                'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted',
            )}
          >
            {recorder.isBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : recorder.isRecording ? (
              <Square size={12} fill="currentColor" />
            ) : (
              <Mic size={17} strokeWidth={1.9} />
            )}
          </button>

          <textarea
            ref={textareaRef}
            id="chat-input"
            value={value}
            rows={1}
            maxLength={2000}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={
              recorder.isRecording
                ? 'Listening… tap the stop button to send'
                : 'Ask about electronics, specs, or what to buy…'
            }
            aria-label="Message ShopSmart"
            className="scrollbar-thin min-h-[42px] max-h-[156px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-muted/55"
          />
          <button
            type="submit"
            disabled={!value.trim() || isLoading || recorder.isRecording}
            aria-label={isLoading ? 'Assistant is working' : 'Send message'}
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-[#fbf7ef] transition duration-200 hover:bg-[#16251d] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted/50"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowUp size={17} strokeWidth={2.1} />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-2 pt-2">
          {recorder.isRecording ? (
            <p
              aria-live="polite"
              className="flex items-center gap-1.5 text-[10.5px] font-medium text-accent-dark"
            >
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              Recording {formatDuration(recorder.elapsedMs / 1000)} · tap stop
              to send
            </p>
          ) : recorder.error ? (
            <p
              role="alert"
              className="text-[10.5px] leading-relaxed text-[#8e351c]"
            >
              {recorder.error}
            </p>
          ) : (
            <p className="hidden text-[10px] text-muted/55 sm:block">
              Enter to send · Shift + Enter for a new line
            </p>
          )}
          <p className="ml-auto text-right text-[10px] text-muted/55">
            ShopSmart can make mistakes. Check product details before buying.
          </p>
        </div>
      </form>
    </div>
  )
}
