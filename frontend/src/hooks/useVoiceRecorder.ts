import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'error'

const MAX_RECORDING_MS = 60_000

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Microphone access was blocked. Allow it in your browser settings, then try again.'
      case 'NotFoundError':
        return 'No microphone was found on this device.'
      case 'NotReadableError':
        return 'The microphone is being used by another app.'
      case 'SecurityError':
        return 'Microphone access needs a secure (https or localhost) page.'
    }
  }
  return 'Could not start recording. Please try again.'
}

/**
 * Records a single voice note with MediaRecorder and hands the finished Blob
 * to `onComplete`. Recordings stop automatically after 60 seconds.
 */
export function useVoiceRecorder(onComplete: (audio: Blob) => void) {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(canRecord)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const autoStopRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const discardRef = useRef(false)
  const mountedRef = useRef(true)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const start = useCallback(async () => {
    if (status === 'requesting' || status === 'recording') return

    if (!canRecord()) {
      setSupported(false)
      setStatus('error')
      setError('Voice recording is not supported in this browser.')
      return
    }

    setError(null)
    setElapsedMs(0)
    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      discardRef.current = false

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        clearTimers()
        releaseStream()
        recorderRef.current = null

        const type = recorder.mimeType || mimeType || 'audio/webm'
        const audio = new Blob(chunksRef.current, { type })
        chunksRef.current = []

        if (!mountedRef.current) return

        setStatus('idle')
        setElapsedMs(0)

        if (!discardRef.current && audio.size > 0) {
          onCompleteRef.current(audio)
        }
      }

      recorder.onerror = () => {
        discardRef.current = true
        clearTimers()
        releaseStream()
        recorderRef.current = null
        if (!mountedRef.current) return
        setStatus('error')
        setElapsedMs(0)
        setError('The recording stopped unexpectedly. Please try again.')
      }

      recorder.start()
      startedAtRef.current = Date.now()
      setStatus('recording')

      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 200)

      autoStopRef.current = window.setTimeout(() => {
        const recorderAtLimit = recorderRef.current
        if (recorderAtLimit && recorderAtLimit.state !== 'inactive') {
          recorderAtLimit.stop()
        }
      }, MAX_RECORDING_MS)
    } catch (caught) {
      releaseStream()
      if (!mountedRef.current) return
      setStatus('error')
      setError(describeError(caught))
    }
  }, [clearTimers, releaseStream, status])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      discardRef.current = true
      clearTimers()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      releaseStream()
    }
  }, [clearTimers, releaseStream])

  return {
    status,
    isRecording: status === 'recording',
    isBusy: status === 'requesting',
    elapsedMs,
    error,
    supported,
    start,
    stop,
  }
}
