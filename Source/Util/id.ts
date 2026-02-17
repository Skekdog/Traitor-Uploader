import { ulid } from "ulid";

/**
 * utility function to generate an id (its an util function in case we want to change any of the inputs to ULID)
 * @returns a random ID
 */
export function generateId() {
	return ulid();
}
