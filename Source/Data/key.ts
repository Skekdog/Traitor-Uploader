import { isValid } from "ulid";
import { generateId } from "../Util/id";

export function generate(): string {
	return generateId();
}

export function isValidKey(key: string): boolean {
	return isValid(key);
}
