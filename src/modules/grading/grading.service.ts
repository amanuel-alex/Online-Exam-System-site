import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeManualAnswerDto } from './dto/grade-manual-answer.dto';
import { Prisma, QuestionType, Role, AttemptStatus } from '@prisma/client';

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // AUTO-GRADE MCQ & TRUE/FALSE
  // ─────────────────────────────────────────────

  async autoGradeAttempt(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: {
                question: { include: { versions: { include: { options: true } } } },
                version: { include: { options: true } }
              }
            }
          }
        },
        answers: true,
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found.');

    const gradingWork = [];

    for (const answer of attempt.answers) {
      const eq = attempt.exam.examQuestions.find(i => i.questionId === answer.questionId);
      if (!eq) continue;

      // Use the point-in-time version captured for this exam
      const v = eq.version; 
      if (!v) continue;

      const points = eq.pointsOverride ?? v.points;

      if (v.type === QuestionType.MCQ || v.type === QuestionType.TRUE_FALSE) {
        const correctOptions = v.options.filter(o => o.isCorrect).map(o => o.id);
        const studentSelections = answer.selectedOptions || (answer.optionId ? [answer.optionId] : []);

        let awardedPoints = 0;

        if (correctOptions.length === 1) {
          const isCorrect = studentSelections.includes(correctOptions[0]);
          awardedPoints = isCorrect ? points : 0;
        } else if (correctOptions.length > 1) {
          const correctSelections = studentSelections.filter(s => correctOptions.includes(s));
          const incorrectSelections = studentSelections.filter(s => !correctOptions.includes(s));
          awardedPoints = Math.max(0, (correctSelections.length - incorrectSelections.length) / correctOptions.length) * points;
        }

        gradingWork.push(
          this.prisma.attemptAnswer.update({
            where: { id: answer.id },
            data: {
              score: awardedPoints,
              isAutoGraded: true,
              evalComment: `Auto-graded. Version: ${v.versionNumber}`,
            },
          })
        );
      }
    }

    await Promise.all(gradingWork);
    return this.finalizeResultIfComplete(attemptId);
  }

  // ─────────────────────────────────────────────
  // FINALIZE & CALCULATE (CRITICAL TRANSACTION)
  // ─────────────────────────────────────────────

  async finalizeResultIfComplete(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { examQuestions: { include: { question: true, version: true } } } },
        answers: true,
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found.');

    const totalEarned = attempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    // Use versioned points or overrides
    const totalMax = attempt.exam.examQuestions.reduce((sum, eq) => sum + (eq.pointsOverride ?? eq.version?.points ?? 1), 0);
    
    const percentage = (totalEarned / (totalMax || 1)) * 100;
    const isPassed = percentage >= attempt.exam.passPercentage;

    const questionsNeeded = attempt.exam.examQuestions.length;
    const questionsGradedCount = attempt.answers.filter(a => a.score !== null).length;
    const isFullyGraded = (questionsGradedCount === questionsNeeded && attempt.status === AttemptStatus.SUBMITTED);

    // ATOMIC UPDATE: Result + Attempt Status
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.result.upsert({
        where: { attemptId },
        update: {
          totalScore: totalEarned,
          maxScore: totalMax,
          percentage,
          isPassed,
          organizationId: attempt.organizationId,
        },
        create: {
          attemptId,
          studentId: attempt.studentId,
          organizationId: attempt.organizationId,
          totalScore: totalEarned,
          maxScore: totalMax,
          percentage,
          isPassed,
        },
      });

      if (isFullyGraded) {
        await tx.examAttempt.update({
          where: { id: attemptId },
          data: { status: AttemptStatus.GRADED },
        });

        // Trigger notification
        await tx.notification.create({
          data: {
            userId: attempt.studentId,
            organizationId: attempt.organizationId,
            title: 'Exam Results Available',
            message: `Your results for "${attempt.exam.title}" are now available for review.`,
            type: 'RESULT_PUBLISHED',
            metadata: { attemptId, examId: attempt.examId },
          },
        });
      }

      return { result, isFullyGraded };
    });
  }

  // ─────────────────────────────────────────────
  // MANUAL GRADING (ESSAY / FILE_UPLOAD)
  // ─────────────────────────────────────────────

  async manualGrade(attemptId: string, dto: GradeManualAnswerDto, currentUser: any) {
    this.assertCanGrade(currentUser);

    const answer = await this.prisma.attemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      include: { attempt: { include: { exam: true } }, version: true }
    });

    if (!answer) throw new NotFoundException('Answer not found.');
    this.assertOrgAccess(answer.attempt.organizationId, currentUser);

    const eq = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: answer.attempt.examId, questionId: dto.questionId } },
      include: { version: true },
    });

    const maxPoints = eq.pointsOverride ?? eq.version?.points ?? 1;
    if (dto.score > maxPoints) throw new BadRequestException(`Exceeds max points (${maxPoints}).`);

    await this.prisma.attemptAnswer.update({
      where: { id: answer.id },
      data: {
        score: dto.score,
        evalComment: dto.evalComment,
        isAutoGraded: false,
        gradedById: currentUser.id,
      },
    });

    return this.finalizeResultIfComplete(attemptId);
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private assertCanGrade(currentUser: any) {
    const roles: Role[] = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!roles.includes(currentUser.role)) throw new ForbiddenException('Grading denied.');
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Cross-organization access forbidden.');
    }
  }
}
