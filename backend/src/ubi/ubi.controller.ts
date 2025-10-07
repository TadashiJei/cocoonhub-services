import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { UbiService } from './ubi.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { EnrollDto } from './dto/enroll.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';

@ApiTags('ubi')
@Controller()
export class UbiController {
  constructor(private readonly ubi: UbiService) {}

  // Programs
  @Post('ubi/programs')
  @Roles('admin')
  @ApiOperation({ summary: 'Create UBI program (admin)', description: 'Creates a UBI program with rules (amount, currency).' })
  createProgram(@Body() body: CreateProgramDto) {
    return this.ubi.createProgram({
      name: body.name,
      description: body.description,
      amount: body.amount,
      currency: body.currency,
    });
  }

  @Get('ubi/programs')
  @Roles('admin')
  @ApiOperation({ summary: 'List UBI programs (admin)', description: 'Lists configured UBI programs.' })
  listPrograms() {
    return this.ubi.listPrograms();
  }

  @Post('ubi/programs/:id/enroll')
  @Roles('admin')
  @ApiOperation({ summary: 'Enroll user to program (admin)', description: 'Upserts an active enrollment for a user in a UBI program.' })
  enroll(@Param('id') programId: string, @Body() body: EnrollDto) {
    return this.ubi.enrollUser(programId, body.userId);
  }

  // Cycles
  @Post('ubi/cycles')
  @Roles('admin')
  @ApiOperation({ summary: 'Create UBI cycle (admin)', description: 'Creates a payout cycle for a program over a date range.' })
  createCycle(@Body() body: CreateCycleDto) {
    return this.ubi.createCycle({
      programId: body.programId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  @Post('ubi/cycles/:id/compute')
  @Roles('admin')
  @ApiOperation({ summary: 'Compute cycle payouts (admin)', description: 'Computes payouts for enrolled members based on program rules.' })
  compute(@Param('id') id: string) {
    return this.ubi.computeCycle(id);
    }

  @Post('ubi/cycles/:id/submit')
  @Roles('admin')
  @ApiOperation({ summary: 'Submit cycle for approval (admin)', description: 'Moves a computed cycle to pending_approval state.' })
  submit(@Param('id') id: string) {
    return this.ubi.submitCycleForApproval(id);
  }

  @Post('ubi/cycles/:id/approve')
  @Roles('admin')
  @ApiOperation({ summary: 'Approve cycle (admin)', description: 'Approves a pending cycle and creates ledger entries for payouts.' })
  approve(@Param('id') id: string) {
    return this.ubi.approveCycle(id);
  }

  // Member ledger
  @Get('me/ubi/ledger')
  @Roles('member','admin','reviewer','finance')
  @ApiOperation({ summary: 'My UBI ledger', description: 'Returns ledger entries originating from approved UBI payouts for the current user.' })
  myUbiLedger(@Req() req: Request) {
    // Extract userId from verified JWT sub; dev fallback x-user-id
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    let userId: string | undefined;
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
    if (!userId && typeof req.headers['x-user-id'] === 'string') {
      userId = req.headers['x-user-id'] as string;
    }
    if (!userId) {
      // As a fallback, this will return empty array rather than throwing to keep endpoint harmless
      return [];
    }
    return this.ubi.listMemberUbiLedger(userId);
  }
}
