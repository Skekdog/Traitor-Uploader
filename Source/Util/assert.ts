
export default function assert<T>(value: T, message?: string): NonNullable<T> {
	if (!value) throw new Error(message ?? "Assertion failed!");
	return value;
}
