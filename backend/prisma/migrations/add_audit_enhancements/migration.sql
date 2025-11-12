-- Migration: Add metadata and deletedAt to AuditLog
-- Phase 6: Audit & Compliance Module Enhancements

-- Add metadata field for additional context
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Rename timestamp to createdAt for consistency
ALTER TABLE "AuditLog" RENAME COLUMN "timestamp" TO "createdAt";

-- Add deletedAt for soft delete (retention policy)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Create index on deletedAt for retention queries
CREATE INDEX IF NOT EXISTS "AuditLog_deletedAt_idx" ON "AuditLog"("deletedAt");

-- Drop old timestamp index if exists
DROP INDEX IF EXISTS "AuditLog_timestamp_idx";

-- Create new createdAt index
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ============================================
-- IMMUTABILITY ENFORCEMENT (CRITICAL)
-- ============================================

-- Function to prevent audit log modification
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted. Operation: %', TG_OP
    USING HINT = 'Audit logs are append-only for compliance. Contact system administrator if you believe this is an error.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability on UPDATE
DROP TRIGGER IF EXISTS audit_log_immutable_update ON "AuditLog";
CREATE TRIGGER audit_log_immutable_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
WHEN (OLD.deletedAt IS NULL) -- Allow updates only for soft delete
EXECUTE FUNCTION prevent_audit_modification();

-- Trigger to enforce immutability on DELETE
DROP TRIGGER IF EXISTS audit_log_immutable_delete ON "AuditLog";
CREATE TRIGGER audit_log_immutable_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_modification();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN "AuditLog"."metadata" IS 'Additional context for compliance: DEA schedule, batch info, prescription numbers, etc.';
COMMENT ON COLUMN "AuditLog"."deletedAt" IS 'Soft delete timestamp for retention policy (7 years). NULL = active record.';
COMMENT ON TRIGGER "audit_log_immutable_update" ON "AuditLog" IS 'Prevents modification of audit logs for regulatory compliance (DEA, HIPAA, Pharmacy Board)';
COMMENT ON TRIGGER "audit_log_immutable_delete" ON "AuditLog" IS 'Prevents deletion of audit logs for regulatory compliance';
