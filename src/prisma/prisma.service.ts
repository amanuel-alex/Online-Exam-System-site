import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  auditLog: any;
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
              'Result', 'Notification', 'AuditLog'
            ];

            // List of models that support Soft-Delete
            const softDeleteModels = [
              'User', 'Exam', 'Question', 'ExamSession', 'ExamAttempt', 
              'Result', 'Notification'
            ];

            const anyArgs = args as any;

            if (tenantModels.includes(model)) {

              // 1. Handle filters (where clause)
              const filterOperations = [
                'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 
                'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 
                'count', 'aggregate', 'groupBy'
              ];

              if (filterOperations.includes(operation)) {
                anyArgs.where = {
                  ...anyArgs.where,
                  organizationId,
                  ...(softDeleteModels.includes(model) ? { deletedAt: null } : {}),
                };
              }

              // 2. Handle creations (inject organizationId into data)
              if (operation === 'create') {
                anyArgs.data = {
                  ...anyArgs.data,
                  organizationId,
                };
              }

              if (operation === 'createMany') {
                if (Array.isArray(anyArgs.data)) {
                  anyArgs.data = anyArgs.data.map((item: any) => ({
                    ...item,
                    organizationId,
                  }));
                } else if (anyArgs.data && anyArgs.data.data && Array.isArray(anyArgs.data.data)) {
                  anyArgs.data.data = anyArgs.data.data.map((item: any) => ({
                    ...item,
                    organizationId,
                  }));
                }
              }

              // 3. Handle upsert (has both where, create, and update)
              if (operation === 'upsert') {
                anyArgs.where = { ...anyArgs.where, organizationId };
                anyArgs.create = { ...anyArgs.create, organizationId };
                anyArgs.update = { ...anyArgs.update, organizationId };
                
                if (softDeleteModels.includes(model)) {
                  anyArgs.where.deletedAt = null;
                }
              }
            }

            return query(anyArgs);
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
