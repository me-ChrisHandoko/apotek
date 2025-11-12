import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UuidService } from '../../common/services/uuid.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class PrescriptionService {
  constructor(
    private prisma: PrismaService,
    private uuid: UuidService,
  ) {}

  /**
   * Create new prescription with items
   */
  async createPrescription(dto: CreatePrescriptionDto, tenantId: string) {
    // Validate customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    // Validate all products exist and require prescription
    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      if (!product.requiresPrescription) {
        throw new BadRequestException(
          `Product "${product.name}" does not require a prescription`,
        );
      }

      // Check for DEA Schedule substances
      if (product.deaSchedule && !dto.doctorLicenseNumber) {
        throw new BadRequestException(
          `Doctor license number required for DEA Schedule ${product.deaSchedule} substance: ${product.name}`,
        );
      }
    }

    // Validate and calculate dates
    const issueDate = new Date(dto.issueDate);
    const today = new Date();

    if (issueDate > today) {
      throw new BadRequestException('Issue date cannot be in the future');
    }

    // Calculate validUntil if not provided (default: issueDate + 30 days)
    let validUntil: Date;
    if (dto.validUntil) {
      validUntil = new Date(dto.validUntil);
      if (validUntil <= issueDate) {
        throw new BadRequestException(
          'Valid until date must be after issue date',
        );
      }
    } else {
      validUntil = new Date(issueDate);
      validUntil.setDate(validUntil.getDate() + 30); // Default 30 days validity
    }

    return this.prisma.$transaction(async (tx) => {
      // Generate prescription number: RX-YYYYMMDD-XXX
      const dateStr = issueDate.toISOString().split('T')[0].replace(/-/g, '');
      const dayStart = new Date(issueDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(issueDate);
      dayEnd.setHours(23, 59, 59, 999);

      const todayCount = await tx.prescription.count({
        where: {
          tenantId,
          issueDate: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      const prescriptionNumber = `RX-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`;

      // Create prescription with UUID v7
      const prescriptionId = this.uuid.generateV7();

      const prescription = await tx.prescription.create({
        data: {
          id: prescriptionId,
          prescriptionNumber,
          customerId: dto.customerId,
          doctorName: dto.doctorName,
          doctorLicense: dto.doctorLicenseNumber,
          issueDate,
          validUntil,
          status: PrescriptionStatus.ACTIVE,
          notes: dto.notes,
          tenantId,
        },
      });

      // Create prescription items
      const itemIds = this.uuid.generateV7Batch(dto.items.length);
      const itemsData = dto.items.map((item, index) => ({
        id: itemIds[index],
        prescriptionId: prescription.id,
        productId: item.productId,
        quantity: item.prescribedQuantity,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        notes: item.notes,
      }));

      await tx.prescriptionItem.createMany({
        data: itemsData,
      });

      // Return prescription with items and relations
      return tx.prescription.findUnique({
        where: { id: prescription.id },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              phone: true,
            },
          },
          prescriptionItems: {
            include: {
              product: {
                select: {
                  name: true,
                  genericName: true,
                  deaSchedule: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Find all prescriptions with filtering
   */
  async findAllPrescriptions(
    filters: {
      customerId?: string;
      status?: PrescriptionStatus;
      doctorName?: string;
      isExpiring?: boolean;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    tenantId: string,
  ) {
    const {
      customerId,
      status,
      doctorName,
      isExpiring,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { tenantId };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (doctorName) {
      where.doctorName = { contains: doctorName, mode: 'insensitive' };
    }

    if (isExpiring) {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      where.validUntil = {
        gte: today,
        lte: futureDate,
      };
      where.status = PrescriptionStatus.ACTIVE;
    }

    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate);
      if (endDate) where.issueDate.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        include: {
          customer: {
            select: { name: true },
          },
          prescriptionItems: {
            include: {
              product: {
                select: { deaSchedule: true },
              },
            },
          },
        },
        orderBy: { issueDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    const data = prescriptions.map((p) => ({
      id: p.id,
      prescriptionNumber: p.prescriptionNumber,
      customerName: p.customer.name,
      doctorName: p.doctorName,
      issueDate: p.issueDate,
      validUntil: p.validUntil,
      status: p.status,
      itemCount: p.prescriptionItems.length,
      hasControlledSubstances: p.prescriptionItems.some((i) => i.product.deaSchedule !== null),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find prescription by ID
   */
  async findPrescriptionById(id: string, tenantId: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, tenantId },
      include: {
        customer: {
          select: {
            code: true,
            name: true,
            phone: true,
            allergies: true,
          },
        },
        prescriptionItems: {
          include: {
            product: {
              select: {
                code: true,
                name: true,
                genericName: true,
                deaSchedule: true,
                requiresPrescription: true,
              },
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    // Note: Current schema doesn't track dispensedQuantity
    // All items show full quantity as available
    return prescription;
  }

  /**
   * Update prescription
   */
  async updatePrescription(
    id: string,
    dto: UpdatePrescriptionDto,
    tenantId: string,
  ) {
    const prescription = await this.findPrescriptionById(id, tenantId);

    // Validate status transitions
    if (dto.status) {
      if (
        prescription.status === PrescriptionStatus.DISPENSED &&
        dto.status === PrescriptionStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Cannot change status from DISPENSED to ACTIVE',
        );
      }

      if (
        prescription.status === PrescriptionStatus.EXPIRED &&
        dto.status === PrescriptionStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Cannot change status from EXPIRED to ACTIVE',
        );
      }
    }

    // Validate validUntil extension
    if (dto.validUntil && prescription.validUntil) {
      const newValidUntil = new Date(dto.validUntil);
      if (newValidUntil < prescription.validUntil) {
        throw new BadRequestException('Cannot shorten validity period');
      }
    }

    return this.prisma.prescription.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
      },
    });
  }

  /**
   * Validate prescription for dispensing (DEA compliance included)
   */
  async validatePrescription(id: string, tenantId: string) {
    const prescription = await this.findPrescriptionById(id, tenantId);

    const errors: string[] = [];

    // Check status
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      errors.push(`Prescription status is ${prescription.status}, not ACTIVE`);
    }

    // Check expiry
    if (prescription.validUntil && prescription.validUntil < new Date()) {
      errors.push('Prescription has expired');
    }

    // Check customer - validation already done in findPrescriptionById
    // Customer is always included in the result

    // DEA compliance validation
    const deaItems = prescription.prescriptionItems.filter(
      (item) => item.product.deaSchedule !== null,
    );

    if (deaItems.length > 0) {
      // Require doctor license
      if (!prescription.doctorLicense) {
        errors.push('Doctor license required for controlled substances');
      }

      // Check patient info complete
      if (!prescription.customer.name || !prescription.customer.phone) {
        errors.push(
          'Complete patient information required for DEA substances',
        );
      }

      // Schedule II specific rules
      const scheduleIIItems = deaItems.filter(
        (i) => i.product.deaSchedule === 'SCHEDULE_II',
      );
      if (scheduleIIItems.length > 0) {
        const daysSinceIssue = Math.floor(
          (new Date().getTime() - prescription.issueDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysSinceIssue > 7) {
          errors.push(
            'Schedule II prescriptions older than 7 days cannot be filled',
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      prescriptionNumber: prescription.prescriptionNumber,
      status: prescription.status,
      validUntil: prescription.validUntil,
    };
  }

  /**
   * Expire old prescriptions (cron job)
   */
  async expireOldPrescriptions(tenantId: string) {
    const result = await this.prisma.prescription.updateMany({
      where: {
        tenantId,
        status: PrescriptionStatus.ACTIVE,
        validUntil: { lt: new Date() },
      },
      data: {
        status: PrescriptionStatus.EXPIRED,
      },
    });

    return {
      expiredCount: result.count,
    };
  }
}
