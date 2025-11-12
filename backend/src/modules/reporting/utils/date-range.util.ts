import { BadRequestException } from '@nestjs/common';
import { DateRangeDto, DateRangePeriod } from '../dto/date-range.dto';

export interface ResolvedDateRange {
  startDate: Date;
  endDate: Date;
}

export class DateRangeUtil {
  /**
   * Resolve date range from DTO
   * Converts predefined periods to actual dates or validates custom date range
   */
  static resolveDateRange(dto: DateRangeDto): ResolvedDateRange {
    const now = new Date();

    // Default to LAST_30_DAYS if no period specified
    const period = dto.period || DateRangePeriod.LAST_30_DAYS;

    if (period === DateRangePeriod.CUSTOM) {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException(
          'startDate and endDate are required when period is CUSTOM',
        );
      }

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);

      if (startDate > endDate) {
        throw new BadRequestException('startDate cannot be after endDate');
      }

      // Limit to 1 year maximum range for performance
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      if (endDate.getTime() - startDate.getTime() > maxRange) {
        throw new BadRequestException(
          'Date range cannot exceed 1 year for performance reasons',
        );
      }

      return { startDate, endDate };
    }

    return this.getPredefinedRange(period, now);
  }

  /**
   * Get predefined date range
   */
  private static getPredefinedRange(
    period: DateRangePeriod,
    now: Date,
  ): ResolvedDateRange {
    const startOfDay = (date: Date): Date => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfDay = (date: Date): Date => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const startOfWeek = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const startOfMonth = (date: Date): Date => {
      const d = new Date(date);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfMonth = (date: Date): Date => {
      const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const startOfQuarter = (date: Date): Date => {
      const d = new Date(date);
      const quarter = Math.floor(d.getMonth() / 3);
      d.setMonth(quarter * 3, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const startOfYear = (date: Date): Date => {
      const d = new Date(date);
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    switch (period) {
      case DateRangePeriod.TODAY:
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now),
        };

      case DateRangePeriod.YESTERDAY: {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: startOfDay(yesterday),
          endDate: endOfDay(yesterday),
        };
      }

      case DateRangePeriod.THIS_WEEK:
        return {
          startDate: startOfWeek(now),
          endDate: endOfDay(now),
        };

      case DateRangePeriod.LAST_WEEK: {
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(startOfWeek(now));
        lastWeekEnd.setMilliseconds(-1);
        return {
          startDate: startOfWeek(lastWeekStart),
          endDate: lastWeekEnd,
        };
      }

      case DateRangePeriod.THIS_MONTH:
        return {
          startDate: startOfMonth(now),
          endDate: endOfDay(now),
        };

      case DateRangePeriod.LAST_MONTH: {
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
        };
      }

      case DateRangePeriod.THIS_QUARTER:
        return {
          startDate: startOfQuarter(now),
          endDate: endOfDay(now),
        };

      case DateRangePeriod.THIS_YEAR:
        return {
          startDate: startOfYear(now),
          endDate: endOfDay(now),
        };

      case DateRangePeriod.LAST_7_DAYS: {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return {
          startDate: startOfDay(sevenDaysAgo),
          endDate: endOfDay(now),
        };
      }

      case DateRangePeriod.LAST_30_DAYS: {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        return {
          startDate: startOfDay(thirtyDaysAgo),
          endDate: endOfDay(now),
        };
      }

      case DateRangePeriod.LAST_90_DAYS: {
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
        return {
          startDate: startOfDay(ninetyDaysAgo),
          endDate: endOfDay(now),
        };
      }

      default:
        throw new BadRequestException(`Invalid date range period: ${period}`);
    }
  }

  /**
   * Format date for SQL queries
   */
  static formatForSql(date: Date): string {
    return date.toISOString();
  }

  /**
   * Calculate pagination offset
   */
  static calculateOffset(page: number, pageSize: number): number {
    return (page - 1) * pageSize;
  }

  /**
   * Calculate total pages
   */
  static calculateTotalPages(totalRecords: number, pageSize: number): number {
    return Math.ceil(totalRecords / pageSize);
  }
}
