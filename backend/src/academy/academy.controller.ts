import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { AcademyService } from './academy.service';
import { ListCoursesQueryDto } from './dto/list-courses.dto';
import { EnrollCohortDto } from './dto/enroll-cohort.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { IssueCertificateDto } from './dto/issue-certificate.dto';

@ApiTags('academy')
@Controller('academy')
export class AcademyController {
  constructor(private readonly academy: AcademyService) {}

  @Get('courses')
  @ApiOperation({ summary: 'List published courses', description: 'Public list of published courses with pagination and search.' })
  listCourses(@Query() query: ListCoursesQueryDto) {
    return this.academy.listCourses(query);
  }

  @Get('courses/:id/cohorts')
  @ApiOperation({ summary: 'List cohorts for a course', description: 'List available cohorts for the given course.' })
  listCohorts(@Param('id') id: string) {
    return this.academy.listCohorts(id);
  }

  @Post('cohorts/:id/enroll')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Enroll to cohort', description: 'Enroll current user or provided userId to a cohort; may be waitlisted depending on capacity.' })
  enroll(@Param('id') cohortId: string, @Body() body: EnrollCohortDto, @Req() req: Request) {
    let userId = body.userId;
    if (!userId) {
      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length);
        const parts = token.split('.')
        if (parts.length === 3) {
          try {
            const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
            const payload = JSON.parse(payloadJson);
            if (typeof payload?.sub === 'string') userId = payload.sub;
          } catch {}
        }
      }
      if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    }
    if (!userId) return { ok: false, error: 'userId required' };
    return this.academy.enrollCohort(cohortId, userId);
  }

  @Patch('enrollments/:id/progress')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Update enrollment progress', description: 'Update progress 0..100; member can only update their own enrollment.' })
  updateProgress(@Param('id') enrollmentId: string, @Body() body: UpdateProgressDto, @Req() req: Request) {
    let userId: string | undefined;
    let asAdmin = false;
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (typeof payload?.sub === 'string') userId = payload.sub;
          if (Array.isArray(payload?.roles) && payload.roles.includes('admin')) asAdmin = true;
        } catch {}
      }
    }
    if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    return this.academy.updateProgress(enrollmentId, userId!, body.progress, asAdmin);
  }

  @Post('enrollments/:id/issue-certificate')
  @Roles('admin','member')
  @ApiOperation({ summary: 'Issue certificate (DOCX) with presign', description: 'Creates a certificate record and returns a presigned PUT for DOCX upload to R2.' })
  issueCertificate(@Param('id') enrollmentId: string, @Body() body: IssueCertificateDto, @Req() req: Request) {
    // Infer requester role crudely from JWT roles
    let isAdmin = false;
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (Array.isArray(payload?.roles) && payload.roles.includes('admin')) isAdmin = true;
        } catch {}
      }
    }
    return this.academy.issueCertificate(enrollmentId, isAdmin ? 'admin' : 'member', body.fileName);
  }
}
