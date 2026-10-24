import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EXAMPLES } from "../lang/examples.ts";

type Props = {
	readonly onPick: (source: string) => void;
};

const wrap: CSSProperties = {
	position: "relative",
};

const panel: CSSProperties = {
	position: "absolute",
	top: "calc(100% + 8px)",
	left: 0,
	zIndex: 20,
	width: "min(560px, calc(100vw - 32px))",
	maxHeight: "min(70vh, 560px)",
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
			<button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
				Examples
			</button>
			{open && (
				<ol style={panel} role="menu" aria-label="Lesson examples">
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
