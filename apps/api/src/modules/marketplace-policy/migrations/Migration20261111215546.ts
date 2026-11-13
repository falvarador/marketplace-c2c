import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111215546 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "category_marketplace_policy" ("id" text not null, "transaction_mode" text check ("transaction_mode" in ('checkout', 'lead')) null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_marketplace_policy_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_category_marketplace_policy_deleted_at" ON "category_marketplace_policy" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_marketplace_data" ("id" text not null, "country_code" text null, "region" text null, "locality" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_marketplace_data_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_marketplace_data_deleted_at" ON "product_marketplace_data" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_marketplace_data_country" ON "product_marketplace_data" ("country_code") WHERE deleted_at IS NULL AND country_code IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_marketplace_data_region" ON "product_marketplace_data" ("region") WHERE deleted_at IS NULL AND region IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_marketplace_data_locality" ON "product_marketplace_data" ("locality") WHERE deleted_at IS NULL AND locality IS NOT NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "category_marketplace_policy" cascade;`);

    this.addSql(`drop table if exists "product_marketplace_data" cascade;`);
  }

}
