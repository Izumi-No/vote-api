import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("password", "text", (col) => col.notNull())
    .addColumn("refresh_token", "text")
    .execute();

  await db.schema
    .createTable("votings")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("init_date", "timestamp", (col) => col.notNull())
    .addColumn("end_date", "timestamp", (col) => col.notNull())
    .addColumn("open", "boolean", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("participants")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("results")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("voting_id", "uuid", (col) => col.notNull())
    .addColumn("participant_id", "uuid", (col) => col.notNull())
    .addColumn("count", "integer", (col) => col.notNull())
    .addForeignKeyConstraint("votings_fkey", ["voting_id"], "votings", ["id"])
    .addForeignKeyConstraint(
      "participants_fkey",
      ["participant_id"],
      "participants",
      ["id"]
    )
    .execute();

  await db.schema
    .createTable("votes")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("voting_id", "uuid", (col) => col.notNull())
    .addColumn("participant_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addForeignKeyConstraint(
      "participants_fkey",
      ["participant_id"],
      "participants",
      ["id"]
    )
    .addForeignKeyConstraint("votings_fkey", ["voting_id"], "votings", ["id"])
    .addForeignKeyConstraint("users_fkey", ["user_id"], "users", ["id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("votes").execute();
  await db.schema.dropTable("results").execute();
  await db.schema.dropTable("participants").execute();
  await db.schema.dropTable("votings").execute();
  await db.schema.dropTable("users").execute();
}
