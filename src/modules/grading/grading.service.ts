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
      if (!eq) continue;

      const q = eq.question;
      const points = eq.pointsOverride ?? q.points;

      if (q.type === QuestionType.MCQ || q.type === QuestionType.TRUE_FALSE) {
        const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.id);
        const studentSelections = answer.selectedOptions || (answer.optionId ? [answer.optionId] : []);

        let awardedPoints = 0;

        if (correctOptions.length === 1) {
          // Standard single-correct MCQ or TRUE_FALSE
          const isCorrect = studentSelections.includes(correctOptions[0]);
          awardedPoints = isCorrect ? points : 0;
        } else if (correctOptions.length > 1) {
          // Multiple correct MCQ: Partial scoring support
          // Logic: (CorrectSelections - IncorrectSelections) / TotalCorrect
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
              evalComment: `Auto-graded. Correct: ${correctOptions.length}. Selected: ${studentSelections.length}.`,
            },
          })
        );
      }
    }

    await Promise.all(gradingWork);

    return this.finalizeResultIfComplete(attemptId);
  }

  // ─────────────────────────────────────────────
  // MANUAL GRADING (ESSAY / FILE_UPLOAD)
  // ─────────────────────────────────────────────

  async manualGrade(attemptId: string, dto: GradeManualAnswerDto, currentUser: any) {
    this.assertCanGrade(currentUser);

    const answer = await this.prisma.attemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      include: { attempt: { include: { exam: true } } }
    });

    if (!answer) throw new NotFoundException('Answer record not found.');
    this.assertOrgAccess(answer.attempt.exam.organizationId, currentUser);

    const eq = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: answer.attempt.examId, questionId: dto.questionId } },
      include: { question: true },
    });

    const maxPoints = eq.pointsOverride ?? eq.question.points;
    if (dto.score > maxPoints) throw new BadRequestException(`Score of ${dto.score} exceeds max points of ${maxPoints}.`);

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
  // RELEASE RESULTS
  // ─────────────────────────────────────────────

  async releaseResult(attemptId: string, currentUser: any) {
    this.assertCanGrade(currentUser); // only teachers/admins can release grades

    const result = await this.prisma.result.findUnique({
      where: { attemptId },
      include: { attempt: { include: { exam: true } } },
    });

    if (!result) throw new NotFoundException('Result has not been calculated yet.');
    this.assertOrgAccess(result.attempt.exam.organizationId, currentUser);

    return this.prisma.result.update({
      where: { attemptId },
      data: { isReleased: true, releasedAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────
  // FINALIZE & CALCULATE
  // ─────────────────────────────────────────────

  async finalizeResultIfComplete(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { examQuestions: { include: { question: true } } } },
        answers: true,
      },
    });

    if (!attempt) throw new NotFoundException('Attempt session not found.');

    const totalEarned = attempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const totalMax = attempt.exam.examQuestions.reduce((sum, eq) => sum + (eq.pointsOverride ?? eq.question.points), 0);
    
    const percentage = (totalEarned / (totalMax || 1)) * 100;
    const isPassed = percentage >= attempt.exam.passPercentage;

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
        studentId: attempt.studentId,
        totalScore: totalEarned,
        maxScore: totalMax,
        percentage,
        isPassed,
      },
    });

    // Check if every single question has a score.
    const questionsNeeded = attempt.exam.examQuestions.length;
    const questionsGraded = attempt.answers.filter(a => a.score !== null).length;

    if (questionsGraded === questionsNeeded && attempt.status === AttemptStatus.SUBMITTED) {
      await this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.GRADED },
      });
    }

    return { result, isFullyGraded: questionsGraded === questionsNeeded };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private assertCanGrade(currentUser: any) {
    const roles: Role[] = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!roles.includes(currentUser.role)) throw new ForbiddenException('Grading permission denied.');
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Access to restricted organization grading is forbidden.');
    }
  }
}
