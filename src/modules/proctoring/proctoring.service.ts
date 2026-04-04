import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProctoringEventDto } from './dto/log-proctoring-event.dto';
import { ProctoringEventType, Prisma } from '@prisma/client';

@Injectable()
export class ProctoringService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(dto: LogProctoringEventDto, currentUser: any) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: dto.attemptId },
      include: { 
        exam: true,
        proctoringEvents: true 
      },
    });

    if (!attempt) {
      throw new NotFoundException('Exam attempt not found.');
    }

    // Security Gate: Ensure the student owns this attempt
    if (attempt.studentId !== currentUser.id && currentUser.role !== 'SYSTEM_ADMIN') {
      throw new BadRequestException('Unauthorized event logging.');
    }

    // 1. Store the event
    const event = await this.prisma.proctoringEvent.create({
      data: {
        attemptId: dto.attemptId,
        userId: attempt.studentId,
        examId: attempt.examId,
        organizationId: attempt.organizationId,
        eventType: dto.eventType,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    // 2. Recalculate Risk Score
    // Logic: Weight events based on severity
    const updatedEvents = [...attempt.proctoringEvents, event];
    const riskScore = this.calculateRiskScore(updatedEvents);
    
    // 3. Generate Risk Flags
    const riskFlags = this.generateRiskFlags(updatedEvents, riskScore);

    // 4. Update the Attempt
    await this.prisma.examAttempt.update({
      where: { id: dto.attemptId },
      data: {
        riskScore,
        riskFlags,
      },
    });

    return { eventId: event.id, currentRiskScore: riskScore };
  }

  private calculateRiskScore(events: any[]): number {
    let score = 0;
    
    events.forEach(event => {
      switch (event.eventType) {
        case ProctoringEventType.FULLSCREEN_EXIT:
          score += 15;
          break;
        case ProctoringEventType.TAB_SWITCH:
          score += 10;
          break;
        case ProctoringEventType.WINDOW_BLUR:
          score += 5;
          break;
        default:
          score += 1;
      }
    });

    // Cap at 100
    return Math.min(score, 100);
  }

  private generateRiskFlags(events: any[], currentScore: number): string[] {
    const flags = new Set<string>();

    if (currentScore > 70) flags.add('CRITICAL_RISK');
    else if (currentScore > 40) flags.add('HIGH_RISK');
    else if (currentScore > 20) flags.add('MODERATE_RISK');

    const typeCounts = events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {});

    if (typeCounts[ProctoringEventType.TAB_SWITCH] > 3) flags.add('FREQUENT_TAB_SWITCH');
    if (typeCounts[ProctoringEventType.FULLSCREEN_EXIT] > 1) flags.add('FULLSCREEN_VIOLATION');
    if (typeCounts[ProctoringEventType.WINDOW_BLUR] > 5) flags.add('MULTIPLE_WINDOW_BLUR');

    return Array.from(flags);
  }

  async getAttemptAnalysis(attemptId: string, currentUser: any) {
    const analysis = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        proctoringEvents: {
          orderBy: { timestamp: 'asc' }
        },
        student: {
          select: { firstName: true, lastName: true, email: true }
        },
        exam: {
          select: { title: true }
        }
      }
    });

    if (!analysis) throw new NotFoundException('Analysis not found');
    
    // Multi-tenancy check
    if (currentUser.organizationId && analysis.organizationId !== currentUser.organizationId) {
      throw new BadRequestException('Access denied');
    }

    return analysis;
  }
}
