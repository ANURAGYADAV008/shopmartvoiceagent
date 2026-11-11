/** Decode base64 audio from the voice API into a playable Blob URL. */
export function base64ToObjectUrl(
  base64: string,
  contentType: string,
): string | null {
  try {
    const binary = window.atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return URL.createObjectURL(new Blob([bytes], { type: contentType }))
  } catch {
    return null
  }
}

/** Format seconds as m:ss for the recording timer and audio player. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const seconds = Math.floor(totalSeconds)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

/** Gnani STT accepts WAV, so recordings are downsampled before upload. */
const WAV_SAMPLE_RATE = 16_000

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

function createAudioContext(): AudioContext {
  const Context = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext
  if (!Context) {
    throw new Error('This browser cannot process audio recordings.')
  }
  return new Context()
}

async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const context = createAudioContext()
  try {
    const data = await blob.arrayBuffer()
    return await context.decodeAudioData(data)
  } finally {
    void context.close().catch(() => {
      // Closing is best-effort; decoding has already finished.
    })
  }
}

async function resample(audio: AudioBuffer, sampleRate: number): Promise<AudioBuffer> {
  if (audio.sampleRate === sampleRate) return audio

  const frames = Math.max(1, Math.ceil(audio.duration * sampleRate))
  const offline = new OfflineAudioContext(1, frames, sampleRate)
  const source = offline.createBufferSource()
  source.buffer = audio
  source.connect(offline.destination)
  source.start()
  return offline.startRendering()
}

function encodeWav(audio: AudioBuffer): Blob {
  const samples = audio.getChannelData(0)
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, audio.sampleRate, true)
  view.setUint32(28, audio.sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * MediaRecorder produces WebM in Chrome/Edge, which Gnani's STT rejects.
 * Decode the clip and re-encode it as 16 kHz mono PCM WAV before uploading.
 */
export async function transcodeToWav(audio: Blob): Promise<Blob> {
  if (audio.size === 0) {
    throw new Error('The recording was empty. Please try again.')
  }
  if (audio.type.includes('wav')) return audio

  let decoded: AudioBuffer
  try {
    decoded = await decodeAudio(audio)
  } catch {
    throw new Error(
      'This browser could not read the recording. Please try again or use a text message.',
    )
  }

  if (decoded.duration === 0) {
    throw new Error('The recording was empty. Please try again.')
  }

  return encodeWav(await resample(decoded, WAV_SAMPLE_RATE))
}
