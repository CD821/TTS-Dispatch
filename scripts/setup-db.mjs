import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Pull it from Vercel or add it to .env.local first.");
}

const sql = neon(process.env.DATABASE_URL);
const schema = await fs.readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
for (const statement of schema.split(";").map((value) => value.trim()).filter(Boolean)) {
  await sql.query(statement, []);
}

console.log("Neon jobs table is ready.");
