import { Migration } from '@mikro-orm/migrations';

export class Migration20260417000000InitialDemoSchema extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "users" (
        "id" serial primary key,
        "email" varchar(255) not null unique,
        "phone" varchar(255) not null default '',
        "profile_url" varchar(255) not null default '',
        "role" varchar(32) not null,
        "password_hash" varchar(255) not null,
        "active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table if not exists "orders" (
        "id" serial primary key,
        "number" varchar(255) not null unique,
        "order_date" date not null,
        "delivery_time" time null,
        "fulfillment_at" timestamptz null,
        "user_id" integer not null,
        "status" varchar(32) not null,
        "total" numeric(10, 2) not null,
        "internal_note" text not null default '',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table if not exists "categories" (
        "id" serial primary key,
        "name" varchar(255) not null unique,
        "description" text not null default '',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table if not exists "products" (
        "id" serial primary key,
        "sku" varchar(255) not null unique,
        "name" varchar(255) not null,
        "unit_price" numeric(10, 2) not null,
        "units_in_stock" integer not null default 0,
        "discontinued" boolean not null default false,
        "deleted_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table if not exists "product_categories" (
        "product_id" integer not null,
        "category_id" integer not null,
        primary key ("product_id", "category_id")
      );
    `);

    this.addSql(`
      create table if not exists "order_details" (
        "id" serial primary key,
        "order_id" integer not null,
        "product_id" integer not null,
        "unit_price" numeric(10, 2) not null,
        "quantity" integer not null,
        "discount" numeric(4, 2) not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table if not exists "admin_audit_logs" (
        "id" varchar(255) primary key,
        "timestamp" timestamptz not null,
        "action" varchar(64) not null,
        "actor_id" varchar(255) not null,
        "actor_role" varchar(255) not null,
        "actor_email" varchar(255) null,
        "summary" text not null,
        "resource_name" varchar(255) null,
        "resource_label" varchar(255) null,
        "object_id" varchar(255) null,
        "object_label" varchar(255) null,
        "action_label" varchar(255) null,
        "count" integer null
      );
    `);

    this.addSql('alter table "orders" add constraint "orders_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;');
    this.addSql('alter table "product_categories" add constraint "product_categories_product_id_foreign" foreign key ("product_id") references "products" ("id") on delete cascade on update cascade;');
    this.addSql('alter table "product_categories" add constraint "product_categories_category_id_foreign" foreign key ("category_id") references "categories" ("id") on delete cascade on update cascade;');
    this.addSql('alter table "order_details" add constraint "order_details_order_id_foreign" foreign key ("order_id") references "orders" ("id") on update cascade;');
    this.addSql('alter table "order_details" add constraint "order_details_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade;');
  }
}
