import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111222553 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "classified_lead" add column if not exists "customer_id" text not null, add column if not exists "product_id" text not null, add column if not exists "seller_id" text not null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_classified_lead_customer_id" ON "classified_lead" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_classified_lead_seller_id" ON "classified_lead" ("seller_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "reservation_request" add column if not exists "customer_id" text not null, add column if not exists "product_id" text not null, add column if not exists "seller_id" text not null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_request_customer_id" ON "reservation_request" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_request_seller_id" ON "reservation_request" ("seller_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_classified_lead_customer_id";`);
    this.addSql(`drop index if exists "IDX_classified_lead_seller_id";`);
    this.addSql(`alter table if exists "classified_lead" drop column if exists "customer_id", drop column if exists "product_id", drop column if exists "seller_id";`);

    this.addSql(`drop index if exists "IDX_reservation_request_customer_id";`);
    this.addSql(`drop index if exists "IDX_reservation_request_seller_id";`);
    this.addSql(`alter table if exists "reservation_request" drop column if exists "customer_id", drop column if exists "product_id", drop column if exists "seller_id";`);
  }

}
