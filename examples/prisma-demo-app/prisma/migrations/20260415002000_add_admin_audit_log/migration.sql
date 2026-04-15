CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "actorEmail" TEXT,
  "summary" TEXT NOT NULL,
  "resourceName" TEXT,
  "resourceLabel" TEXT,
  "objectId" TEXT,
  "objectLabel" TEXT,
  "actionLabel" TEXT,
  "count" INTEGER,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_timestamp_id_idx" ON "AdminAuditLog"("timestamp", "id");
