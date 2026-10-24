import { useEffect } from "react";

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

export default function Timeline({ index, last, playing, onBack, onNext, onSeek, onPlay, onPause }: Props) {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest(".cm-editor, input, textarea")) return;
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
			<button type="button" onClick={onBack} aria-label="Back one frame">
				&lt;
			</button>
			<button type="button" onClick={playing ? onPause : onPlay} aria-label={playing ? "Pause" : "Play"}>
				{playing ? "Pause" : "Play"}
			</button>
			<button type="button" onClick={onNext} aria-label="Forward one frame">
				&gt;
			</button>
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