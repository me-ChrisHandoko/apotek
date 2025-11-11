import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { Customer, Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, tenantId: string): Promise<Customer> {
    // Check if customer code already exists for this tenant
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(`Customer code '${dto.code}' already exists`);
    }

    return this.prisma.customer.create({
      data: {
        ...dto,
        allergies: dto.allergies ? (dto.allergies as unknown as Prisma.InputJsonValue) : undefined,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, filter?: SearchCustomerDto) {
    const {
      search,
      insuranceProvider,
      hasActiveInsurance,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filter || {};

    const where: any = { tenantId };

    // Multi-field search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by insurance provider
    if (insuranceProvider) {
      where.insuranceProvider = { contains: insuranceProvider, mode: 'insensitive' };
    }

    // Filter by active insurance
    if (hasActiveInsurance) {
      where.insuranceExpiry = { gte: new Date() };
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            sales: true,
            prescriptions: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, tenantId: string): Promise<Customer> {
    // Verify customer exists and belongs to tenant
    await this.findOne(id, tenantId);

    // If code is being updated, check for duplicates
    if (dto.code) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          tenantId,
          code: dto.code,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Customer code '${dto.code}' already exists`);
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        allergies: dto.allergies ? (dto.allergies as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    // Verify customer exists and belongs to tenant
    const customer = await this.findOne(id, tenantId);

    // Check dependencies
    const [salesCount, prescriptionCount] = await Promise.all([
      this.prisma.sale.count({ where: { customerId: id, tenantId } }),
      this.prisma.prescription.count({ where: { customerId: id, tenantId } }),
    ]);

    if (salesCount > 0) {
      throw new ConflictException(
        `Cannot delete customer with ${salesCount} associated sale(s). Customer has purchase history.`,
      );
    }

    if (prescriptionCount > 0) {
      throw new ConflictException(
        `Cannot delete customer with ${prescriptionCount} associated prescription(s).`,
      );
    }

    await this.prisma.customer.delete({
      where: { id },
    });
  }

  async generateCustomerCode(tenantId: string): Promise<string> {
    // Find the last customer code for this tenant
    const lastCustomer = await this.prisma.customer.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    if (!lastCustomer) {
      return 'CUST-0001';
    }

    // Extract number from code (assuming format CUST-XXXX)
    const match = lastCustomer.code.match(/\d+$/);
    if (!match) {
      return 'CUST-0001';
    }

    const lastNumber = parseInt(match[0], 10);
    const nextNumber = lastNumber + 1;
    return `CUST-${String(nextNumber).padStart(4, '0')}`;
  }

  async validateInsurance(customerId: string, tenantId: string): Promise<boolean> {
    const customer = await this.findOne(customerId, tenantId);

    if (!customer.insurancePolicyNo) {
      return false;
    }

    if (!customer.insuranceExpiry) {
      return true; // Has insurance but no expiry date set
    }

    return customer.insuranceExpiry >= new Date();
  }

  async getPurchaseHistory(customerId: string, tenantId: string) {
    await this.findOne(customerId, tenantId); // Verify customer exists

    return this.prisma.sale.findMany({
      where: { customerId, tenantId },
      include: {
        saleItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });
  }

  async getPrescriptionHistory(customerId: string, tenantId: string) {
    await this.findOne(customerId, tenantId); // Verify customer exists

    return this.prisma.prescription.findMany({
      where: { customerId, tenantId },
      include: {
        prescriptionItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllergyWarnings(
    customerId: string,
    productIds: string[],
    tenantId: string,
  ): Promise<any[]> {
    const customer = await this.findOne(customerId, tenantId);

    if (!customer.allergies) {
      return [];
    }

    const allergies = customer.allergies as any[];

    // Get products
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
    });

    // Check for potential allergen matches
    const warnings: any[] = [];
    for (const allergy of allergies) {
      for (const product of products) {
        // Simple string matching - can be enhanced with more sophisticated logic
        const productNameLower = product.name.toLowerCase();
        const genericNameLower = product.genericName?.toLowerCase() || '';
        const allergenLower = allergy.allergen.toLowerCase();

        if (
          productNameLower.includes(allergenLower) ||
          genericNameLower.includes(allergenLower)
        ) {
          warnings.push({
            allergen: allergy.allergen,
            severity: allergy.severity,
            product: {
              id: product.id,
              name: product.name,
              genericName: product.genericName,
            },
            notes: allergy.notes,
          });
        }
      }
    }

    return warnings;
  }

  async checkDependencies(id: string, tenantId: string) {
    const [salesCount, prescriptionCount] = await Promise.all([
      this.prisma.sale.count({ where: { customerId: id, tenantId } }),
      this.prisma.prescription.count({ where: { customerId: id, tenantId } }),
    ]);

    return {
      hasSales: salesCount > 0,
      salesCount,
      hasPrescriptions: prescriptionCount > 0,
      prescriptionCount,
    };
  }
}
