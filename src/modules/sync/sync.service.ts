import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttemptStatus } from '@prisma/client';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * National Offline Sync Engine (LWW)
   * 
   * Reconciles high-stakes exam answers submitted from rural or low-connectivity zones.
   * Leverages 'Last-Write-Wins' (LWW) conflict resolution based on client-side timestamps.
   */
  async processSyncBatch(attemptId: string, batch: any[]) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.status === AttemptStatus.GRADED) {
      throw new ConflictException('Cannot sync answers to a finalized or missing attempt.');
    }

    const results = { synced: 0, skipped: 0 };

    return this.prisma.$transaction(async (tx) => {
      for (const item of batch) {
        const existing = await tx.attemptAnswer.findUnique({
          where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
        });

        // Conflict Resolution: Only update if the incoming client timestamp is NEWER
        const incomingTimestamp = new Date(item.clientTimestamp).getTime();
        const storedTimestamp = existing?.clientTimestamp.getTime() || 0;

        if (!existing || incomingTimestamp > storedTimestamp) {
          await tx.attemptAnswer.upsert({
            where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
            update: {
              textAnswer: item.textAnswer,
              selectedOptions: item.selectedOptions,
              fileUrl: item.fileUrl,
              clientTimestamp: new Date(item.clientTimestamp),
              syncedAt: new Date(),
            },
            create: {
              attemptId,
              questionId: item.questionId,
              textAnswer: item.textAnswer,
              selectedOptions: item.selectedOptions,
              fileUrl: item.fileUrl,
              clientTimestamp: new Date(item.clientTimestamp),
              syncedAt: new Date(),
            },
          });
          results.synced++;
        } else {
          results.skipped++;
        }
      }

      // Mark the attempt as having participated in offline syncing
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: { isOffline: true },
      });

      return results;
    });
  }
}
