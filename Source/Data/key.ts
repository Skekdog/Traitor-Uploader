
export function generate(): string {
	const bytes = new Uint8Array(32);
	return crypto.getRandomValues(bytes).toBase64();
}

export function isValidKey(key: string): boolean {
	try {
		atob(key);
		return true;
	} catch {
		return false;
	}
}
