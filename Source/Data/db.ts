import * as fs from "node:fs/promises";
import { isValidKey } from "./key";
import assert from "../Util/assert";

const filePath = "db.txt";

if (!await fs.exists(filePath)) {
	await fs.writeFile(filePath, []);
}

// Each line of db is a utf8 string in the form "KEY:USERID,USERID,USERID,...:ASSETID,ASSETID,ASSETID"

// JS strings are utf16, but we won't use that because what
// if we want to use a different language in the future
// (and also utf8 strings are shorter in this case, yay efficiency)

function getKeyLine(key: string, text: string): string | undefined {
	const lines = text.split("\n");
	const line = lines.find((value) => {
		return value.split(":")[0] === key;
	});

	return line;
}

export async function saveKey(key: string, userIds: number[], authorisedAssets: number[]): Promise<void> {
	if (!isValidKey(key)) return new Promise(reject => reject());

	let fileText: string;
	return fs.readFile(filePath, "utf8").then(text => {
		fileText = text;
		return getKeyLine(key, text);
	}).then(line => {
		const lines = fileText.split("\n");
		if (lines[0] === "") lines.shift();

		const newLine = key + ":" + userIds.join(",") + ":" + authorisedAssets.join(",");
		if (line) {
			const index = lines.findIndex(l => l === line);
			if (index !== -1) {
				lines[index] = newLine;
			}
		} else {
			lines.push(newLine);
		}

		return fs.writeFile(filePath, lines.join("\n"));
	});
}

export async function getUsers(key: string): Promise<number[] | undefined> {
	return new Promise(resolve => {
		if (!isValidKey(key)) return resolve(undefined);

		void fs.readFile(filePath, "utf8").then(text => {
			return getKeyLine(key, text);
		}).then(line => {
			if (!line) return resolve(undefined);

			const users: number[] = [];
			line.split(":")[1]?.split(",").forEach(id => {
				users.push(Number.parseInt(id));
			});

			resolve(users);
		});
	});
}

export async function getAuthorisedAssets(key: string): Promise<number[] | undefined> {
	return new Promise(resolve => {
		if (!isValidKey(key)) return resolve(undefined);

		void fs.readFile(filePath, "utf8").then(text => {
			return getKeyLine(key, text);
		}).then(line => {
			if (!line) return resolve(undefined);

			const authorisedAssets: number[] = [];
			line.split(":")[2]?.split(",").forEach(id => {
				authorisedAssets.push(Number.parseInt(id));
			});

			resolve(authorisedAssets);
		});
	});
}

export async function doesKeyExist(key: string): Promise<boolean> {
	return new Promise(resolve => {
		if (!isValidKey(key)) return resolve(false);

		void fs.readFile(filePath, "utf8").then(text => {
			return resolve(!!getKeyLine(key, text));
		});
	});
}

export async function getAllKeys(): Promise<{[key: string]: {userIds: string, assetIds: string}}> {
	return new Promise(resolve => {
		void fs.readFile(filePath, "utf8").then(text => {
			const result: {[key: string]: {userIds: string, assetIds: string}} = {};
			const lines = text.split("\n");
			lines.forEach(line => {
				const split = line.split(":");

				const key = split[0];
				if (!key) return;

				const userIds = assert(split[1]);
				const assetIds = assert(split[2]);

				result[key] = {userIds: userIds, assetIds: assetIds};
			});

			resolve(result);
		});
	});
}
