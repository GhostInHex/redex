import { useRef, type CSSProperties } from "react";
import { EXAMPLES } from "../lang/examples.ts";

type Props = {
	readonly onPick: (source: string) => void;
};

const summary: CSSProperties = {
	cursor: "pointer",
	padding: "6px 14px",
	borderRadius: 8,
	border: "1px solid #3a3f4f",
	background: "#1b1e28",
	listStyle: "none",
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
	const menu = useRef<HTMLDetailsElement>(null);
	return (
		<details ref={menu} style={{ position: "relative" }}>
			<summary style={summary}>Examples</summary>
			<ol style={panel} aria-label="Lesson examples">
				{EXAMPLES.map((example) => (
					<li key={example.id}>
						<button
							type="button"
							style={item}
							onClick={() => {
								onPick(example.source);
								if (menu.current) menu.current.open = false;
							}}
						>
							<span>{example.title}</span>
							<span style={lesson}>{example.lesson}</span>
						</button>
					</li>
				))}
			</ol>
		</details>
	);
}
