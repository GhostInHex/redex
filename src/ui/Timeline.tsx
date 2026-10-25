import { useEffect } from "react";
import { Button } from "../components/glaze/ui/button.tsx";

type Props = {
  readonly index: number;
  readonly last: number;
  readonly playing: boolean;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onSeek: (index: number) => void;
  readonly onPlay: () => void;
  readonly onPause: () => void;
};

export default function Timeline({
  index,
  last,
  playing,
  onBack,
  onNext,
  onSeek,
  onPlay,
  onPause,
}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector("dialog:modal")) return;
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        target?.closest(
          ".cm-editor, input, textarea, select, button, a[href], [contenteditable], [role='button'], [role='menuitem'], [role='dialog']",
        )
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onBack();
      } else if (event.key === " ") {
        event.preventDefault();
        if (playing) onPause();
        else onPlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, onBack, onNext, onPlay, onPause]);

  return (
    <section className="timeline" aria-label="Playback controls">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={onBack}
        aria-label="Back one frame"
      >
        &lt;
      </Button>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={playing ? onPause : onPlay}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "Pause" : "Play"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={onNext}
        aria-label="Forward one frame"
      >
        &gt;
      </Button>
      <input
        type="range"
        min={0}
        max={last}
        value={index}
        aria-label="Frame"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <span className="counter">
        {index} / {last}
      </span>
    </section>
  );
}
