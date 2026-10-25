import type { CSSProperties, ReactNode } from "react";
import { shareHref } from "../share.ts";

type Props = {
	readonly program: string;
	readonly children: ReactNode;
};

const page: CSSProperties = {
	maxWidth: 760,
	margin: "0 auto",
	padding: 12,
	display: "flex",
	flexDirection: "column",
	gap: 12,
};

const bar: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 12,
	fontSize: 13,
};

const link: CSSProperties = {
	color: "#9db8ff",
};

export default function Embed({ program, children }: Props) {
	const back = shareHref(`${location.origin}${location.pathname}`, program);
	return (
		<main style={page}>
			<header style={bar}>
				<span style={{ letterSpacing: "0.08em", color: "#8b93a7" }}>redex</span>
				<a style={link} href={back}>
					Open the full editor
				</a>
			</header>
			{children}
		</main>
	);
}
