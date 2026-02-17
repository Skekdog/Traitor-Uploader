import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const db = drizzle("db.sqlite", { relations: schema.relations, schema: schema });
