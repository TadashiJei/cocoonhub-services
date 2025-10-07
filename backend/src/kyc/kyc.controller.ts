import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { StorageService } from '../storage/storage.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { SetKycStatusDto } from './dto/set-kyc-status.dto';
import { KycService } from './kyc.service';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly storage: StorageService,
    private readonly kyc: KycService,
  ) {}
  @Post('apply')
  @ApiOperation({ summary: 'Submit KYC application', description: 'Member submits a KYC application with document references.' })
  apply(@Body() body: { userId: string; documents: any }) {
    const docs = Array.isArray(body.documents)
      ? (body.documents as Array<{ type: string; fileRef: string }>)
      : undefined;
    return this.kyc.apply(body.userId, docs);
  }

  @Get('applications')
  @Roles('admin', 'reviewer')
  @ApiOperation({ summary: 'List KYC applications (admin/reviewer)', description: 'List all KYC applications.' })
  list() {
    return this.kyc.list();
  }

  @Get('applications/:id/decisions')
  @Roles('admin', 'reviewer')
  @ApiOperation({ summary: 'List KYC decision log (admin/reviewer)', description: 'View decision history for a KYC application.' })
  listDecisions(@Param('id') id: string) {
    return this.kyc.listDecisions(id);
  }

  // Admin/Reviewer only (RBAC to be added later)
  @Patch('applications/:id/status')
  @Roles('admin', 'reviewer')
  @ApiOperation({ summary: 'Set KYC status (admin/reviewer)', description: 'Approve, reject, or request more info with notes. Records decision log.' })
  setStatus(
    @Param('id') id: string,
    @Body() body: SetKycStatusDto,
    @Req() req: Request,
  ) {
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as
      | string
      | undefined;
    let reviewerUserId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (typeof payload?.sub === 'string') reviewerUserId = payload.sub;
        } catch {
          // ignore
        }
      }
    }
    // Dev fallback
    if (!reviewerUserId && typeof req.headers['x-user-id'] === 'string') {
      reviewerUserId = req.headers['x-user-id'] as string;
    }
    return this.kyc.setStatus(id, body, reviewerUserId);
  }

  // Presign upload URL for KYC documents
  @Post('presign')
  @ApiOperation({ summary: 'Presign upload URL for KYC docs', description: 'Returns a pre-signed URL for uploading KYC documents to storage.' })
  presign(@Body() body: PresignUploadDto) {
    return this.storage.presignUpload({ key: body.key, contentType: body.contentType });
  }
}
