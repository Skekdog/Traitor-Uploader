/* eslint-disable @typescript-eslint/no-misused-promises */

import { treaty } from "@elysiajs/eden";
import type { Web } from "../web-server";

const passwordInput = document.getElementById(
	"password-input"
) as HTMLTextAreaElement;
const passwordButton = document.getElementById(
	"password-button"
) as HTMLButtonElement;
const table = document.getElementById(
	"table"
) as HTMLTableSectionElement;
const newEntryButton = document.getElementById(
	"new-entry"
) as HTMLButtonElement;

if (
	!passwordInput ||
	!passwordButton ||
	!table ||
	!newEntryButton
) {
	throw new Error("required DOM elements are missing");
}

const app = treaty<Web>(window.location.origin);

function getHeaders() {
	const headers = {
		Authorization: `Bearer ${passwordInput.value}`,
	};
	return headers;
}

function createTableInput(id: string, value: string | boolean, enabled: boolean, parent: Node) {
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

function createTableButton(id: string, value: string, enabled: boolean, parent: Node) {
	const cell = document.createElement("td");

	const input = document.createElement("button");
	input.id = id;
	input.innerHTML = value;
	input.disabled = !enabled;

	cell.appendChild(input);
	parent.appendChild(cell);

	return input;
}

async function updateKey(e: Event, key: string, field: "assetIds" | "userIds" | "isAdmin") {
	const input = e.target as HTMLInputElement;

	let body;
	if (field === "isAdmin") {
		body = {
			isAdmin: input.checked,
		};
	} else {
		const ids: number[] = [];
		if (input.value) {
			for (const val of input.value.split(",")) {
				const id = Number.parseInt(val);
				if (!Number.isFinite(id)) return alert("Invalid input");
				ids.push(id);
			}
		}

		body = {
			[field]: ids,
		};
	}

	const response = await app.key({key: key}).patch(body, {
		headers: getHeaders(),
	});

	if (response.error) return alert(response.error.value);
}

async function deleteKey(key: string) {
	const confirmation = confirm("Are you sure you want to delete this key?");
	if (!confirmation) return;

	const response = await app.key({key: encodeURIComponent(key)}).delete(undefined, {
		headers: getHeaders(),
	});

	if (response.error) return alert(response.error.value);

	const row = document.getElementById("row-" + key);
	row?.remove();
}

function createTableElement(key: string, data: {userIds: string, assetIds: string, isAdmin: boolean}) {
	const row = document.createElement("tr");
	row.className = "created-table-element";
	row.id = "row-" + key;

	createTableInput("key-" + key, key, false, row);

	createTableInput("userIds-" + key, data.userIds, true, row)
		.addEventListener("focusout", async e => updateKey(e, key, "userIds"));

	createTableInput("assetIds-" + key, data.assetIds, true, row)
		.addEventListener("focusout", async e => updateKey(e, key, "assetIds"));

	createTableInput("isAdmin-" + key, data.isAdmin, true, row)
		.addEventListener("click", async e => updateKey(e, key, "isAdmin"));

	createTableButton("delete-" + key, "-", true, row)
		.addEventListener("click", () => deleteKey(key));

	table.children[0]?.insertAdjacentElement("afterend", row);
}

passwordButton.addEventListener("click", async () => {
	const response = await app.key.get({
		headers: getHeaders(),
	});

	if (response.error) return alert(response.error.value);

	Array.from(document.getElementsByClassName("created-table-element")).forEach(val => {
		val.remove();
	});

	for (const [key, value] of Object.entries(response.data)) {
		createTableElement(key, value);
	}
});

newEntryButton.addEventListener("click", async () => {
	const response = await app.key.post(undefined, {
		headers: getHeaders(),
	});

	if (response.error) return alert(response.error.value);

	createTableElement(response.data, {userIds: "", assetIds: "", isAdmin: false});
});
