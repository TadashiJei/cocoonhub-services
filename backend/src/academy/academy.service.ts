import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
}

@Injectable()
export class AcademyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listCourses(params: ListParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 10));
    const skip = (page - 1) * limit;
    const where = {
      status: 'published' as const,
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' as const } },
              { description: { contains: params.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip, take: limit }),
      this.prisma.course.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async listCohorts(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.cohort.findMany({ where: { courseId }, orderBy: [{ startAt: 'asc' }] });
  }

  async enrollCohort(cohortId: string, userId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (cohort.status !== 'active' && cohort.status !== 'planned') {
      throw new BadRequestException('Cohort is not open for enrollment');
    }
    let status: 'enrolled' | 'waitlisted' = 'enrolled';
    if (typeof cohort.capacity === 'number' && cohort.capacity >= 0) {
      const enrolledCount = await this.prisma.academyEnrollment.count({ where: { cohortId, status: 'enrolled' } });
      if (enrolledCount >= cohort.capacity) status = 'waitlisted';
    }
    return this.prisma.academyEnrollment.upsert({
      where: { cohortId_userId: { cohortId, userId } },
      update: { status },
      create: { cohortId, userId, status },
    });
  }

  async updateProgress(enrollmentId: string, userId: string, progress: number, asAdmin = false) {
    const enrollment = await this.prisma.academyEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (!asAdmin && enrollment.userId !== userId) throw new ForbiddenException('Not allowed');
    const p = Math.max(0, Math.min(100, Math.floor(progress)));
    return this.prisma.academyEnrollment.update({ where: { id: enrollmentId }, data: { progress: p, status: p >= 100 ? 'completed' : enrollment.status } });
  }

  async issueCertificate(enrollmentId: string, requesterRole: 'admin' | 'member', fileName?: string) {
    const enrollment = await this.prisma.academyEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (requesterRole !== 'admin' && enrollment.progress < 100) {
      throw new BadRequestException('Certificate can be issued only when completed');
    }
    // Ensure single certificate per enrollment
    const existing = await this.prisma.certificate.findUnique({ where: { enrollmentId } });
    if (existing) return { certificate: existing, presign: null };

    const safeFile = (fileName || 'certificate.docx').replace(/[^a-zA-Z0-9_.-]+/g, '_');
    const key = `certificates/${enrollmentId}/${Date.now()}-${safeFile}`;
    const presign = this.storage.presignUpload({ key, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const cert = await this.prisma.certificate.create({
      data: {
        enrollmentId,
        userId: enrollment.userId,
        format: 'docx',
        key: presign.key,
      },
    });
    return { certificate: cert, presign };
  }
}
