import { Migrator } from "kysely";
import { db } from "./connection.ts";
import { FileMigrationProvider } from "kysely";
import * as path from "std/path/mod.ts";

const migrator = new Migrator({
  db: db,
  provider: new FileMigrationProvider({
    fs: {
      readdir: async (path: string) => {
        const files = [];

        for await (const dirEntry of Deno.readDir(path)) {
          files.push(dirEntry.name);
        }

        return files;
      },
    },
    path,
    // This needs to be an absolute path.
    migrationFolder: path.join(Deno.cwd(), "persistence/kysely/migrations"),
  }),
});

const { error, results } = await migrator.migrateToLatest();

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`migration "${it.migrationName}" was executed successfully`);
  } else if (it.status === "Error") {
    console.error(`failed to execute migration "${it.migrationName}"`);
  }
});

if (error) {
  console.error("failed to migrate");
  console.error(error);
  Deno.exit(1);
}

await db.destroy();
