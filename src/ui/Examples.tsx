import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { EXAMPLES } from "../lang/examples.ts";

type Props = {
	readonly onPick: (source: string) => void;
};

const wrap: CSSProperties = {
	position: "relative",
};

const panel: CSSProperties = {
	position: "fixed",
	boxSizing: "border-box",
	zIndex: 20,
	width: "min(560px, calc(100vw - 32px))",
	overflowY: "auto",
	margin: 0,
	padding: "8px 0",
	borderRadius: 10,
	border: "1px solid #3a3f4f",
	background: "#1b1e28",
	boxShadow: "0 18px 40px rgba(0, 0, 0, 0.5)",
	listStyle: "none",
};

const item: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 2,
	width: "100%",
	boxSizing: "border-box",
	padding: "8px 14px",
	border: 0,
	borderRadius: 0,
	background: "transparent",
	textAlign: "left",
};

const lesson: CSSProperties = {
	color: "#8b93a7",
	fontSize: 13,
	lineHeight: 1.4,
};

export default function Examples({ onPick }: Props) {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [position, setPosition] = useState({ left: 16, top: 0, maxHeight: 0 });

	useLayoutEffect(() => {
		if (!open) return;
		const place = () => {
			const trigger = triggerRef.current;
			if (!trigger) return;
			const bounds = trigger.getBoundingClientRect();
			const width = Math.min(560, window.innerWidth - 32);
			const top = Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - 16));
			setPosition({
				left: Math.max(16, Math.min(bounds.left, window.innerWidth - width - 16)),
				top,
				maxHeight: Math.max(0, Math.min(560, window.innerHeight * 0.7, window.innerHeight - top - 16)),
			});
		};
		place();
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		const onPointer = (event: PointerEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onPointer);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onPointer);
		};
	}, [open]);

	return (
		<div ref={wrapRef} style={wrap}>
			<button ref={triggerRef} type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
				Examples
			</button>
			{open && (
				<ol style={{ ...panel, ...position }} role="menu" aria-label="Lesson examples">
					{EXAMPLES.map((example) => (
						<li key={example.id} role="none">
							<button
								type="button"
								role="menuitem"
								style={item}
								onClick={() => {
									onPick(example.source);
									setOpen(false);
								}}
							>
								<span>{example.title}</span>
								<span style={lesson}>{example.lesson}</span>
							</button>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}
