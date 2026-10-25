import { appRoot } from "../entry.ts";
export default function Brand() {
  return (
    <a className="brand" href={appRoot()} aria-label="Redex home">
      <span className="brand-mark" aria-hidden="true">
        r.
      </span>
      <span>redex</span>
    </a>
  );
}
