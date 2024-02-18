import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const client = createClient(options);

await client.sync();

export const db = drizzle(client, { schema, logger: true });

export function getTenantDb();
