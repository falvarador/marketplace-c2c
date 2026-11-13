import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111220832 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "classified_lead" ("id" text not null, "message" text null, "status" text check ("status" in ('open', 'closed')) not null default 'open', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "classified_lead_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_classified_lead_deleted_at" ON "classified_lead" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "reservation_request" ("id" text not null, "variant_id" text not null, "claim_key" text not null, "message" text null, "status" text check ("status" in ('pending', 'confirmed', 'declined')) not null default 'pending', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "reservation_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_request_deleted_at" ON "reservation_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_reservation_request_active_claim" ON "reservation_request" ("claim_key") WHERE deleted_at IS NULL AND status IN ('pending', 'confirmed');`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "classified_lead" cascade;`);

    this.addSql(`drop table if exists "reservation_request" cascade;`);
  }

}
