import { Test, TestingModule } from '@nestjs/testing';
import { UuidService } from './uuid.service';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';

describe('UuidService', () => {
  let service: UuidService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UuidService],
    }).compile();

    service = module.get<UuidService>(UuidService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateV7', () => {
    it('should generate valid UUID v7', () => {
      const uuid = service.generateV7();

      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuidValidate(uuid)).toBe(true);
      expect(uuidVersion(uuid)).toBe(7);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = service.generateV7();
      const uuid2 = service.generateV7();

      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate chronologically ordered UUIDs', () => {
      const uuid1 = service.generateV7();
      // Small delay to ensure different timestamps
      const uuid2 = service.generateV7();

      // UUID v7 has timestamp in first 48 bits, so string comparison works
      expect(uuid1 < uuid2).toBe(true);
    });
  });

  describe('generateV7WithTimestamp', () => {
    it('should generate UUID v7 with custom timestamp', () => {
      const customTime = new Date('2024-01-01T00:00:00Z').getTime();
      const uuid = service.generateV7WithTimestamp(customTime);

      expect(uuidValidate(uuid)).toBe(true);
      expect(uuidVersion(uuid)).toBe(7);

      // Extract and verify timestamp
      const extractedTime = service.extractTimestamp(uuid);
      expect(extractedTime).toBe(customTime);
    });

    it('should generate different UUIDs for different timestamps', () => {
      const time1 = new Date('2024-01-01T00:00:00Z').getTime();
      const time2 = new Date('2024-01-02T00:00:00Z').getTime();

      const uuid1 = service.generateV7WithTimestamp(time1);
      const uuid2 = service.generateV7WithTimestamp(time2);

      expect(uuid1).not.toBe(uuid2);
      expect(uuid1 < uuid2).toBe(true); // Earlier timestamp should be "less than"
    });
  });

  describe('generateV7Batch', () => {
    it('should generate specified number of UUIDs', () => {
      const count = 10;
      const uuids = service.generateV7Batch(count);

      expect(uuids).toHaveLength(count);
    });

    it('should generate all valid UUID v7s', () => {
      const uuids = service.generateV7Batch(5);

      uuids.forEach((uuid) => {
        expect(uuidValidate(uuid)).toBe(true);
        expect(uuidVersion(uuid)).toBe(7);
      });
    });

    it('should generate unique UUIDs in batch', () => {
      const uuids = service.generateV7Batch(100);
      const uniqueUuids = new Set(uuids);

      expect(uniqueUuids.size).toBe(100);
    });

    it('should throw error for invalid count', () => {
      expect(() => service.generateV7Batch(0)).toThrow(
        'Count must be a positive integer',
      );
      expect(() => service.generateV7Batch(-5)).toThrow(
        'Count must be a positive integer',
      );
    });

    it('should generate chronologically ordered UUIDs in batch', () => {
      const uuids = service.generateV7Batch(10);

      for (let i = 0; i < uuids.length - 1; i++) {
        expect(uuids[i] <= uuids[i + 1]).toBe(true);
      }
    });
  });

  describe('extractTimestamp', () => {
    it('should extract correct timestamp from UUID v7', () => {
      const now = Date.now();
      const uuid = service.generateV7WithTimestamp(now);
      const extracted = service.extractTimestamp(uuid);

      expect(extracted).toBe(now);
    });

    it('should extract timestamp from generated UUID v7', () => {
      const beforeGeneration = Date.now();
      const uuid = service.generateV7();
      const afterGeneration = Date.now();

      const extracted = service.extractTimestamp(uuid);

      // Timestamp should be between before and after
      expect(extracted).toBeGreaterThanOrEqual(beforeGeneration);
      expect(extracted).toBeLessThanOrEqual(afterGeneration);
    });

    it('should work with UUIDs from batch generation', () => {
      const uuids = service.generateV7Batch(5);
      const timestamps = uuids.map((uuid) => service.extractTimestamp(uuid));

      // All timestamps should be valid numbers
      timestamps.forEach((ts) => {
        expect(typeof ts).toBe('number');
        expect(ts).toBeGreaterThan(0);
      });

      // Timestamps should be in chronological order
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
      }
    });
  });

  describe('Performance characteristics', () => {
    it('should generate 1000 UUIDs in reasonable time', () => {
      const start = Date.now();
      service.generateV7Batch(1000);
      const duration = Date.now() - start;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should maintain chronological order under rapid generation', () => {
      const uuids: string[] = [];
      for (let i = 0; i < 100; i++) {
        uuids.push(service.generateV7());
      }

      // Verify chronological ordering
      for (let i = 0; i < uuids.length - 1; i++) {
        expect(uuids[i] <= uuids[i + 1]).toBe(true);
      }
    });
  });
});
