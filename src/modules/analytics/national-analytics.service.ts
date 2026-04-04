import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class NationalAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * National Government Overview
   * 
   * Provides high-level metrics across the entire platform's national grid.
   * Access: SYSTEM_ADMIN only.
   */
  async getNationalOverview(currentUser: any) {
    this.ensureSystemAdmin(currentUser);

    const [totalOrgs, totalUsers, totalExams, totalResults] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.exam.count(),
      this.prisma.result.count(),
    ]);

    const passRate = await this.prisma.result.aggregate({
      _avg: { percentage: true },
      where: { isPassed: true },
    });

    return { totalOrgs, totalUsers, totalExams, totalResults, passRate: passRate._avg.percentage || 0 };
  }

  /**
   * Regional Performance Breakdown (Ethiopia Districts)
   * 
   * Groups performance data by the 'region' defined on organizations.
   * Essential for national resource allocation across education zones.
   */
  async getRegionalPerformance(currentUser: any) {
    this.ensureSystemAdmin(currentUser);

    const regions = await this.prisma.organization.findMany({
      select: { 
        region: true,
        _count: { select: { results: true } },
        results: { select: { isPassed: true, percentage: true } }
      },
    });

    // Grouping & Aggregation Logic for Regional Clusters
    const report: Record<string, any> = {};
    regions.forEach((org: any) => {
      const r = org.region || 'UNKNOWN';
      if (!report[ r]) report[ r] = { totalResults: 0, passed: 0, avgScore: 0 };
      
      report[ r].totalResults += org._count?.results || 0;
      report[ r].passed += (org.results || []).filter((res: any) => res.isPassed).length;
      report[ r].avgScore += (org.results || []).reduce((s: any, curr: any) => s + curr.percentage, 0);
    });

    return report;
  }

  /**
   * Side-by-Side Institutional Comparison
   */
  async compareInstitutions(orgIds: string[], currentUser: any) {
    this.ensureSystemAdmin(currentUser);

    return this.prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: {
        name: true,
        region: true,
        _count: { select: { users: true, exams: true, results: true } },
        results: { 
          where: { isPassed: true },
          select: { id: true }
        }
      }
    }) as any;
  }

  private ensureSystemAdmin(user: any) {
    if (user.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('National Analytics are reserved for System Administrators.');
    }
  }
}
