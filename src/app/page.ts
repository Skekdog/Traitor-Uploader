import { $fetch } from "ofetch";
import type { EventHandler } from "nitro/h3";

type GetKeysHandler = typeof import("#/routes/api/key/index.get.js").default;
type PostKeyHandler = typeof import("#/routes/api/key/index.post.js").default;

type KeysResponse = Awaited<
	ReturnType<GetKeysHandler extends EventHandler<infer T> ? () => T : never>
>;
type NewKeyResponse = Awaited<
	ReturnType<PostKeyHandler extends EventHandler<infer T> ? () => T : never>
>;

const passwordInput = document.getElementById(
	"password-input",
) as HTMLInputElement;
const passwordButton = document.getElementById(
	"password-button",
) as HTMLButtonElement;
const table = document.getElementById("table") as HTMLTableSectionElement;
const newEntryButton = document.getElementById(
	"new-entry",
) as HTMLButtonElement;

if (!passwordInput || !passwordButton || !table || !newEntryButton) {
	throw new Error("required DOM elements are missing");
}

function getHeaders(): Record<string, string> {
	return {
		Authorization: `Bearer ${passwordInput.value}`,
		"Content-Type": "application/json",
	};
}

function createTableInput(
	id: string,
	value: string | boolean,
	enabled: boolean,
	parent: Node,
): HTMLInputElement {
	const cell = document.createElement("td");
	const input = document.createElement("input");

	input.id = id;
	input.readOnly = !enabled;

	if (typeof value === "string") {
		input.value = value;
		input.type = "text";
	} else {
		input.checked = value;
		input.type = "checkbox";
	}

	cell.appendChild(input);
	parent.appendChild(cell);
	return input;
}

function createTableButton(
	id: string,
	value: string,
	enabled: boolean,
	parent: Node,
): HTMLButtonElement {
	const cell = document.createElement("td");
	const button = document.createElement("button");

	button.id = id;
	button.innerHTML = value;
	button.disabled = !enabled;

	cell.appendChild(button);
	parent.appendChild(button);
	return button;
}

async function updateKey(
	e: Event,
	key: string,
	field: "assetIds" | "userIds" | "isAdmin",
) {
	const input = e.target as HTMLInputElement;

	let body: Record<string, unknown>;
	if (field === "isAdmin") {
		body = { isAdmin: input.checked };
	} else {
		const ids: number[] = [];
		if (input.value) {
			for (const val of input.value.split(",")) {
				const id = Number.parseInt(val.trim(), 10);
				if (!Number.isFinite(id)) return alert("Invalid input");
				ids.push(id);
			}
		}
		body = { [field]: ids };
	}

	try {
		await $fetch(`/api/key/${encodeURIComponent(key)}`, {
			method: "PATCH",
			headers: getHeaders(),
			body,
		});
	} catch (err: any) {
		alert(err?.data?.message || err?.statusMessage || "Update failed");
	}
}

async function deleteKey(key: string) {
	const confirmation = confirm("Are you sure you want to delete this key?");
	if (!confirmation) return;

	try {
		await $fetch(`/api/key/${encodeURIComponent(key)}`, {
			method: "DELETE",
			headers: getHeaders(),
		});

		const row = document.getElementById("row-" + key);
		row?.remove();
	} catch (err: any) {
		alert(err?.data?.message || err?.statusMessage || "Delete failed");
	}
}

function createTableElement(
	key: string,
	data: { userIds: string; assetIds: string; isAdmin: boolean },
) {
	const row = document.createElement("tr");
	row.className = "created-table-element";
	row.id = "row-" + key;

	createTableInput("key-" + key, key, false, row);

	createTableInput(
		"userIds-" + key,
		data.userIds,
		true,
		row,
	).addEventListener("focusout", async (e) => updateKey(e, key, "userIds"));

	createTableInput(
		"assetIds-" + key,
		data.assetIds,
		true,
		row,
	).addEventListener("focusout", async (e) => updateKey(e, key, "assetIds"));

	createTableInput(
		"isAdmin-" + key,
		data.isAdmin,
		true,
		row,
	).addEventListener("click", async (e) => updateKey(e, key, "isAdmin"));

	createTableButton("delete-" + key, "-", true, row).addEventListener(
		"click",
		async () => deleteKey(key),
	);

	table.children[0]?.insertAdjacentElement("afterend", row);
}

passwordButton.addEventListener("click", async (e) => {
	e.preventDefault();

	try {
		const data = await $fetch<KeysResponse>("/api/key", {
			headers: getHeaders(),
		});

		Array.from(
			document.getElementsByClassName("created-table-element"),
		).forEach((val) => {
			val.remove();
		});

		for (const [key, value] of Object.entries(
			data as Record<
				string,
				{ userIds: string; assetIds: string; isAdmin: boolean }
			>,
		)) {
			createTableElement(key, value);
		}
	} catch (err: any) {
		alert(err?.data?.message || err?.statusMessage || "Fetch failed");
	}
});

newEntryButton.addEventListener("click", async () => {
	try {
		const newKey = await $fetch<NewKeyResponse>("/api/key", {
			method: "POST",
			headers: getHeaders(),
		});

		createTableElement(newKey as string, {
			userIds: "",
			assetIds: "",
			isAdmin: false,
		});
	} catch (err: any) {
		alert(err?.data?.message || err?.statusMessage || "Create failed");
	}
});
