import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // STUDENT PERFORMANCE (By Subject/Topic)
  // ─────────────────────────────────────────────

  async getStudentPerformance(studentId: string, currentUser: any) {
    // Only student can see their own, or teachers/admins
    if (currentUser.role === Role.STUDENT && currentUser.id !== studentId) {
      throw new ForbiddenException('Access denied to other student performance data.');
    }

    const results = await this.prisma.result.findMany({
      where: { studentId },
      include: {
        attempt: {
          include: {
            answers: {
              include: { question: true, version: true }
            }
          }
        }
      }
    });

    // Topic/Subject breakdown logic
    const performance = {
      subjects: {} as Record<string, { earned: number; total: number; count: number }>,
      topics: {} as Record<string, { earned: number; total: number; count: number }>,
    };

    for (const res of results) {
      for (const ans of res.attempt.answers) {
        const q = ans.question;
        const v = ans.version;
        const score = ans.score ?? 0;
        const max = v?.points ?? 1; // Use point-in-time points from the versioned record

        if (q.subject) {
          if (!performance.subjects[q.subject]) performance.subjects[q.subject] = { earned: 0, total: 0, count: 0 };
          performance.subjects[q.subject].earned += score;
          performance.subjects[q.subject].total += max;
          performance.subjects[q.subject].count += 1;
        }

        if (q.topic) {
          if (!performance.topics[q.topic]) performance.topics[q.topic] = { earned: 0, total: 0, count: 0 };
          performance.topics[q.topic].earned += score;
          performance.topics[q.topic].total += max;
          performance.topics[q.topic].count += 1;
        }
      }
    }

    return {
      studentId,
      overall: {
        totalExams: results.length,
        avgPercentage: results.reduce((sum, r) => sum + r.percentage, 0) / (results.length || 1),
      },
      ...performance,
    };
  }

  // ─────────────────────────────────────────────
  // EXAM ANALYTICS (For Teachers/Admins)
  // ─────────────────────────────────────────────

  async getExamAnalytics(examId: string, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { 
        _count: { select: { attempts: true } },
        organization: true 
      }
    });

    if (!exam) throw new NotFoundException('Exam not found.');
    this.assertOrgAccess(exam.organizationId, currentUser);

    const results = await this.prisma.result.findMany({
      where: { attempt: { examId } }
    });

    if (results.length === 0) return { examTitle: exam.title, stats: 'No results yet.' };

    const totalStudents = results.length;
    const passed = results.filter(r => r.isPassed).length;
    const scores = results.map(r => r.totalScore);
    const percentages = results.map(r => r.percentage);

    return {
      examId,
      examTitle: exam.title,
      summary: {
        totalParticipants: totalStudents,
        passRate: (passed / totalStudents) * 100,
        avgScore: scores.reduce((a, b) => a + b, 0) / totalStudents,
        avgPercentage: percentages.reduce((a, b) => a + b, 0) / totalStudents,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
      }
    };
  }

  // ─────────────────────────────────────────────
  // ORG ANALYTICS (DASHBOARD HIGHLIGHTS)
  // ─────────────────────────────────────────────

  async getOrgAnalytics(currentUser: any, providedOrgId?: string) {
    let organizationId = currentUser.role === Role.SYSTEM_ADMIN ? providedOrgId : currentUser.organizationId;
    
    // Fallback for SYSTEM_ADMIN if no ID provided via query
    if (currentUser.role === Role.SYSTEM_ADMIN && !organizationId) {
      const firstOrg = await this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      organizationId = firstOrg?.id;
    }

    if (!organizationId) throw new BadRequestException('Organization ID missing.');

    const [totalExams, totalStudents, totalAttempts, results] = await Promise.all([
      this.prisma.exam.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId, role: Role.STUDENT } }),
      this.prisma.examAttempt.count({ where: { exam: { organizationId } } }),
      this.prisma.result.findMany({ 
        where: { attempt: { exam: { organizationId } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ]);

    const passRate = results.length > 0 
      ? (results.filter(r => r.isPassed).length / results.length) * 100 
      : 0;

    return {
      organizationId,
      kpis: {
        totalExams,
        totalStudents,
        totalAttempts,
        avgPassRate: passRate,
      },
      recentResults: results.slice(0, 5) // Return newest 5
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Resource belongs to another organization.');
    }
  }
}
