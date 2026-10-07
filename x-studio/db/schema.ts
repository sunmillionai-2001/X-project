import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const records=sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()},t=>[index('idx_records_kind_updated').on(t.kind,t.updatedAt)]);
export const cache=sqliteTable('cache',{id:text('id').primaryKey(),payload:text('payload').notNull(),expiresAt:integer('expires_at').notNull(),etag:text('etag')});
export const connections=sqliteTable('connections',{id:text('id').primaryKey(),payload:text('payload').notNull(),expiresAt:integer('expires_at').notNull()});
