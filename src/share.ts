import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

const HASH_PREFIX = "#p=";
const PAYLOAD_PREFIX = "redex1:";

export const encodeProgram = (program: string): string => compressToEncodedURIComponent(`${PAYLOAD_PREFIX}${program}`);

export const decodeProgram = (code: string): string | null => {
	if (code.length === 0) return null;
	try {
		const text = decompressFromEncodedURIComponent(code);
		if (text === null || !text.startsWith(PAYLOAD_PREFIX)) return null;
		return text.slice(PAYLOAD_PREFIX.length);
	} catch {
		return null;
	}
};

export type HashProgram =
	| { readonly kind: "program"; readonly program: string }
	| { readonly kind: "bad" }
	| { readonly kind: "none" };

export const readHash = (hash: string): HashProgram => {
	if (!hash.startsWith(HASH_PREFIX)) return { kind: "none" };
	const program = decodeProgram(hash.slice(HASH_PREFIX.length));
	return program === null ? { kind: "bad" } : { kind: "program", program };
};

export const shareHref = (base: string, program: string): string => `${base}${HASH_PREFIX}${encodeProgram(program)}`;

export const embedSnippet = (href: string): string =>
	`<iframe src="${href}" width="720" height="420" style="border:0" title="Redex stepper"></iframe>`;
