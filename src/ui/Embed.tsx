import type { ReactNode } from "react";
import { appRoot } from "../entry.ts";
import { shareHref } from "../share.ts";

type Props = {
  readonly program: string;
  readonly children: ReactNode;
};

export default function Embed({ program, children }: Props) {
  const back = shareHref(`${location.origin}${appRoot()}play`, program);
  return (
    <main className="embed-page">
      <header className="embed-bar">
        <span className="type-label text-text-2">redex</span>
        <a className="embed-link" href={back}>
          Open the full editor
        </a>
      </header>
      {children}
    </main>
  );
}
