-- LibRo single-user schema for Supabase/PostgreSQL
-- WARNING: this script recreates tables and removes old user-based structure.

create extension if not exists pgcrypto;

-- Drop old objects in safe order
DROP TABLE IF EXISTS "Review" CASCADE;
DROP TABLE IF EXISTS "UserBook" CASCADE;
DROP TABLE IF EXISTS "Book" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TYPE IF EXISTS "Status";

CREATE TYPE "Status" AS ENUM ('FAVORITE', 'TO_READ', 'READ');

CREATE TABLE "Book" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "externalId" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "author" text NOT NULL,
  "coverImage" text NOT NULL,
  "publishedYear" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "UserBook" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bookId" uuid NOT NULL UNIQUE,
  "status" "Status" NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UserBook_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE
);

CREATE TABLE "Review" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bookId" uuid NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Review_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE
);

-- Indexes aligned with Prisma schema
CREATE INDEX "Book_title_idx" ON "Book" ("title");
CREATE INDEX "Book_author_idx" ON "Book" ("author");
CREATE INDEX "Book_createdAt_idx" ON "Book" ("createdAt");

CREATE INDEX "UserBook_bookId_idx" ON "UserBook" ("bookId");
CREATE INDEX "UserBook_status_idx" ON "UserBook" ("status");
CREATE INDEX "UserBook_createdAt_idx" ON "UserBook" ("createdAt");

CREATE INDEX "Review_bookId_idx" ON "Review" ("bookId");
CREATE INDEX "Review_createdAt_idx" ON "Review" ("createdAt");

-- Trigger to keep updatedAt in sync
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_updated_at ON "Review";
CREATE TRIGGER trg_review_updated_at
BEFORE UPDATE ON "Review"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
