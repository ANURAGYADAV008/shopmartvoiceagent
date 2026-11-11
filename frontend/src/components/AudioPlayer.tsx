import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatDuration } from '../lib/audio'

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
      }
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrent(value)
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0

  return (
    <div className="mt-3 flex max-w-[360px] items-center gap-3 rounded-2xl border border-line/80 bg-white/70 p-2 pr-3.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrent(0)
          if (audioRef.current) audioRef.current.currentTime = 0
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => void togglePlayback()}
        aria-label={isPlaying ? 'Pause voice answer' : 'Play voice answer'}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest text-[#fbf7ef] transition hover:bg-[#16251d]"
      >
        {isPlaying ? (
          <Pause size={13} fill="currentColor" />
        ) : (
          <Play size={13} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-muted">
          <span>Voice answer</span>
          <span className="tabular-nums">
            {formatDuration(current)} / {formatDuration(safeDuration)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={Math.min(current, safeDuration)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek voice answer"
          className="mt-1 h-1 w-full cursor-pointer accent-accent"
        />
      </div>
    </div>
  )
}
