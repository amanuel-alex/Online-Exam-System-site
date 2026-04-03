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
                question: {
                  include: { options: true }
                }
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
      if (!eq) continue; // Should not happen in data integrity

      const q = eq.question;
      const points = eq.pointsOverride ?? q.points;

      if (q.type === QuestionType.MCQ || q.type === QuestionType.TRUE_FALSE) {
        // Find correct option
        const correctOptionId = q.options.find(o => o.isCorrect)?.id;
        const isCorrect = answer.optionId === correctOptionId;

        gradingWork.push(
          this.prisma.attemptAnswer.update({
            where: { id: answer.id },
            data: {
              score: isCorrect ? points : 0,
              isAutoGraded: true,
              evalComment: isCorrect ? 'Auto-graded: Correct' : 'Auto-graded: Incorrect',
            },
          })
        );
      }
    }

    await Promise.all(gradingWork);

    // After auto-grading, check if we can finalize the overall Result
    return this.finalizeResultIfComplete(attemptId);
  }

  // ─────────────────────────────────────────────
  // MANUAL GRADING (ESSAY / FILE_UPLOAD)
  // ─────────────────────────────────────────────

  async manualGrade(attemptId: string, dto: GradeManualAnswerDto, currentUser: any) {
    this.assertCanGrade(currentUser);

    const answer = await this.prisma.attemptAnswer.findUnique({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: dto.questionId,
        },
      },
      include: { attempt: { include: { exam: true } } },
    });

    if (!answer) throw new NotFoundException('Answer record not found.');
    this.assertOrgAccess(answer.attempt.exam.organizationId, currentUser);

    const eq = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: answer.attempt.examId, questionId: dto.questionId } },
      include: { question: true },
    });

    const maxPoints = eq.pointsOverride ?? eq.question.points;
    if (dto.score > maxPoints) throw new BadRequestException(`Score cannot exceed max points of ${maxPoints}.`);

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
  // RECALCULATE / FINALIZE RESULT
  // ─────────────────────────────────────────────

  async finalizeResultIfComplete(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { examQuestions: { include: { question: true } } } },
        answers: true,
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found.');

    // Check if ALL answers are graded (score is not null)
    // NOTE: If an exam has 10 questions but student only answered 5, 
    // the other 5 don't have records in 'answers' if auto-save wasn't triggered?
    // We must count based on 'examQuestions' count.
    
    if (attempt.answers.length < attempt.exam.examQuestions.length) {
      // Create missing answer records with 0 score (unanswered)
      const missing = attempt.exam.examQuestions.filter(eq => !attempt.answers.some(a => a.questionId === eq.questionId));
      await this.prisma.attemptAnswer.createMany({
        data: missing.map(m => ({
          attemptId,
          questionId: m.questionId,
          score: 0,
          isAutoGraded: true,
          evalComment: 'Unanswered'
        }))
      });
    }

    const allGradedAttempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true, exam: { include: { examQuestions: { include: { question: true } } } } }
    });

    const totalEarned = allGradedAttempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const totalMax = allGradedAttempt.exam.examQuestions.reduce((sum, eq) => sum + (eq.pointsOverride ?? eq.question.points), 0);
    
    const percentage = (totalEarned / (totalMax || 1)) * 100;
    const isPassed = percentage >= allGradedAttempt.exam.passPercentage;

    const result = await this.prisma.result.upsert({
      where: { attemptId },
      update: {
        totalScore: totalEarned,
        maxScore: totalMax,
        percentage,
        isPassed,
      },
      create: {
        attemptId,
        studentId: allGradedAttempt.studentId,
        totalScore: totalEarned,
        maxScore: totalMax,
        percentage,
        isPassed,
      },
    });

    // Mark attempt as GRADED if everything is done
    const pendingManual = allGradedAttempt.answers.some(a => a.score === null);
    if (!pendingManual && allGradedAttempt.status === AttemptStatus.SUBMITTED) {
      await this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.GRADED },
      });
    }

    return { result, isFullyGraded: !pendingManual };
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
      throw new ForbiddenException('Organization mismatch.');
    }
  }
}
