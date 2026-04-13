import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * National Fairness & Anti-Cheating Engine
   * 
   * Analyzes finalized attempts for abnormal behavior patterns.
   * Calculates a 'Risk Score' and flags suspicious candidates.
   */
  async analyzeAttemptFairness(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { 
        answers: true, 
        exam: { include: { _count: { select: { examQuestions: true } } } } 
      },
    });

    if (!attempt || !attempt.endTime) return;

    let riskScore = 0;
    const riskFlags: string[] = [];

    // 1. Completion Speed Anomaly
    // If a student finishes 5x faster than the suggested time OR < 5sec/question
    const durationSec = (attempt.endTime.getTime() - attempt.startTime.getTime()) / 1000;
    const questionsCount = attempt.exam._count.examQuestions;
    const minPossibleSec = questionsCount * 5; // 5 seconds per question minimum heuristic

    if (durationSec < minPossibleSec) {
      riskScore += 40;
      riskFlags.push('ABNORMAL_COMPLETION_SPEED');
    }

    // 2. Plagiarism Detection (Cross-Student Pattern Matching)
    // Find other students in the same organization for the same exam
    const cohorts = await this.prisma.examAttempt.findMany({
      where: { 
        examId: attempt.examId, 
        organizationId: attempt.organizationId,
        id: { not: attemptId },
        status: 'SUBMITTED' // Only compare finalized ones
      },
      include: { answers: true }
    });

    for (const other of cohorts) {
      const matchCount = this.calculateAnswerSimilarity(attempt.answers, other.answers);
      const similarityPercent = (matchCount / (questionsCount || 1)) * 100;

      if (similarityPercent > 90) { // 90% identical answers
        riskScore += 50;
        riskFlags.push(`PATTERN_MATCH_STUDENT_${other.studentId}`);
      }
    }

    // 3. Finalize Fairness Report
    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        riskScore: Math.min(riskScore, 100),
        riskFlags,
      },
    });
  }

  private calculateAnswerSimilarity(a1: any[], a2: any[]): number {
    let matches = 0;
    a1.forEach(ans1 => {
      const ans2 = a2.find(i => i.questionId === ans1.questionId);
      if (ans2 && ans2.optionId === ans1.optionId && ans2.textAnswer === ans1.textAnswer) {
        matches++;
      }
    });
    return matches;
  }
}
