import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('DATABASE_URL is not set!');
      super();
    } else {
      const pool = new Pool({ connectionString });
      const adapter = new PrismaPg(pool);
      super({ adapter });
    }
  }

  /**
   * National-Scale Multi-Tenant Enforcement Engine
   * 
   * Provides a scoped Prisma Client that automatically filters all operations 
   * by organizationId and excludes deleted records (Soft-Delete enforcement).
   * Ensuring strict isolation at the database-query level.
   */
  tenantClient(organizationId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Apply filtering for multi-tenant models
            const tenantModels = [
              'User', 'Exam', 'Question', 'ExamSession', 'ExamAttempt', 
              'Result', 'Notification', 'AuditLog', 'IdempotencyKey'
            ];

            if (tenantModels.includes(model)) {
              args.where = {
                ...args.where,
                organizationId: organizationId,
                deletedAt: null, // Global Soft-Delete Enforcement
              } as any;
            }

            return query(args);
          },
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
