import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111222554 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_claim_key_unique";`);
    this.addSql(`create table if not exists "wishlist_item" ("id" text not null, "customer_id" text not null, "product_id" text not null, "claim_key" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_claim_key_unique" ON "wishlist_item" ("claim_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_deleted_at" ON "wishlist_item" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_customer_id" ON "wishlist_item" ("customer_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "wishlist_item" cascade;`);
  }

}
