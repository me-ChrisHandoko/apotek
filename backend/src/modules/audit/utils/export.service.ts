import { Injectable, Logger } from '@nestjs/common';
import { AuditLog, User } from '@prisma/client';

type AuditLogWithUser = AuditLog & {
  user: Pick<User, 'id' | 'username' | 'fullName' | 'role'>;
};

/**
 * ExportService
 *
 * Handles export of audit logs to various formats:
 * - CSV: For Excel, regulatory submissions
 * - JSON: For system integration, backup
 * - PDF: Future implementation with pdfkit
 */
@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  /**
   * Export audit logs to CSV format
   */
  async exportToCSV(logs: AuditLogWithUser[]): Promise<string> {
    if (logs.length === 0) {
      return 'No audit logs to export';
    }

    // CSV header
    const headers = [
      'ID',
      'Timestamp',
      'Tenant ID',
      'User ID',
      'Username',
      'User Role',
      'Entity Type',
      'Entity ID',
      'Action',
      'IP Address',
      'Old Values',
      'New Values',
    ];

    // CSV rows
    const rows = logs.map((log) => {
      return [
        log.id,
        log.createdAt.toISOString(),
        log.tenantId,
        log.userId,
        log.user?.username || 'UNKNOWN',
        log.user?.role || 'UNKNOWN',
        log.entityType,
        log.entityId,
        log.action,
        log.ipAddress || '',
        this.jsonToString(log.oldValues),
        this.jsonToString(log.newValues),
      ];
    });

    // Build CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Export audit logs to JSON format
   */
  async exportToJSON(logs: AuditLogWithUser[]): Promise<string> {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecords: logs.length,
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        tenantId: log.tenantId,
        user: {
          id: log.userId,
          username: log.user?.username || 'UNKNOWN',
          role: log.user?.role || 'UNKNOWN',
        },
        entity: {
          type: log.entityType,
          id: log.entityId,
        },
        action: log.action,
        ipAddress: log.ipAddress,
        oldValues: log.oldValues,
        newValues: log.newValues,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export audit logs to PDF format
   * Note: This is a placeholder. Full implementation requires pdfkit
   */
  async exportToPDF(logs: AuditLogWithUser[]): Promise<Buffer> {
    // TODO: Implement PDF generation with pdfkit
    // For now, return JSON as buffer
    const json = await this.exportToJSON(logs);
    return Buffer.from(json, 'utf-8');
  }

  /**
   * Helper: Convert JSON to string for CSV
   */
  private jsonToString(json: any): string {
    if (json === null || json === undefined) {
      return '';
    }
    return JSON.stringify(json);
  }

  /**
   * Helper: Escape CSV cell content
   */
  private escapeCsvCell(cell: any): string {
    const str = String(cell);

    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Generate audit report summary
   */
  generateSummary(logs: AuditLogWithUser[]): {
    totalLogs: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
    dateRange: { start: Date; end: Date };
  } {
    if (logs.length === 0) {
      return {
        totalLogs: 0,
        byAction: {},
        byEntityType: {},
        byUser: {},
        dateRange: { start: new Date(), end: new Date() },
      };
    }

    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const log of logs) {
      // Count by action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // Count by entity type
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;

      // Count by user
      const username = log.user?.username || log.userId;
      byUser[username] = (byUser[username] || 0) + 1;
    }

    // Sort logs by date to get range
    const sortedLogs = [...logs].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return {
      totalLogs: logs.length,
      byAction,
      byEntityType,
      byUser,
      dateRange: {
        start: sortedLogs[0].createdAt,
        end: sortedLogs[sortedLogs.length - 1].createdAt,
      },
    };
  }
}
