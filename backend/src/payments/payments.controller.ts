import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { SetBankConfigDto } from './dto/set-bank-config.dto';
import { SetBankConfigBulkDto } from './dto/set-bank-config-bulk.dto';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';
import { CreateManualRequestDto } from './dto/create-manual-request.dto';
import { ApproveManualRequestDto } from './dto/approve-manual-request.dto';
import { RejectManualRequestDto } from './dto/reject-manual-request.dto';
import { ReviewManualRequestDto } from './dto/review-manual-request.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
  ) {}

  @Get('banks')
  @ApiOperation({ summary: 'List supported banks', description: 'Returns supported banks and current configs.' })
  listBanks() {
    return this.payments.listBanks();
  }

  // Placeholder for Admin-only endpoint; RBAC will be added later
  @Post('banks/config')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Set bank config (admin/finance)', description: 'Enable/disable a bank and set daily limits.' })
  setBankConfig(
    @Body() body: SetBankConfigDto,
  ) {
    return this.payments.setBankConfig(body);
  }

  @Get('banks/:code')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Get bank config (admin/finance)', description: 'Fetch a single bank and its current configuration.' })
  getBank(@Param('code') code: string) {
    return this.payments.getBank(code);
  }

  @Post('banks/config/bulk')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Bulk set bank configs (admin/finance)', description: 'Bulk enable/disable banks and set daily limits in a single request.' })
  setBankConfigBulk(@Body() body: SetBankConfigBulkDto) {
    return this.payments.setBankConfigBulk(body.items);
  }

  // -------- Stripe (card) payments --------
  @Post('stripe/checkout')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Create Stripe Checkout Session', description: 'Creates a Stripe Checkout session for an existing order (USD/EUR/PHP/MYR supported by your Stripe account).' })
  createStripeCheckout(@Body() body: CreateStripeCheckoutDto) {
    // The DTO must include requesterUserId (from JWT on real auth). Here we accept it for simplicity or infer in a future auth guard.
    return this.stripe.createCheckoutSession({
      orderId: body.orderId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      customerEmail: body.customerEmail,
      requesterUserId: body.requesterUserId,
    });
  }

  @Get('stripe/session/:id')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Get Stripe Checkout Session', description: 'Retrieves a Stripe Checkout session to check payment status.' })
  getStripeSession(@Param('id') id: string) {
    return this.stripe.confirmCheckoutSession(id);
  }

  // -------- Manual Payment Requests --------

  // Member submits a manual request
  @Post('manual-requests')
  @ApiOperation({ summary: 'Submit manual payment request', description: 'Member submits a manual payment request for review.' })
  createManualRequest(@Body() body: CreateManualRequestDto) {
    return this.payments.createManualRequest(body);
  }

  // Finance/Admin list pending/under_review requests
  @Get('manual-requests')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'List manual payment requests (admin/finance)', description: 'List submitted/under_review manual requests.' })
  listManualRequests() {
    return this.payments.listPendingManualRequests();
  }

  // Approve
  @Post('manual-requests/:id/approve')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Approve manual request (admin/finance)', description: 'Approve a manual payment request and create a ledger entry.' })
  approveManualRequest(@Param('id') id: string, @Body() body: ApproveManualRequestDto) {
    const { ref, notes } = body;
    return this.payments.approveManualRequest(id, { ref, notes });
  }

  // Reject
  @Post('manual-requests/:id/reject')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Reject manual request (admin/finance)', description: 'Reject a manual payment request with a reason.' })
  rejectManualRequest(@Param('id') id: string, @Body() body: RejectManualRequestDto) {
    return this.payments.rejectManualRequest(id, body);
  }

  // Move to under_review (Finance/Admin)
  @Post('manual-requests/:id/review')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Move manual request to under_review (admin/finance)', description: 'Set status to under_review with optional notes.' })
  reviewManualRequest(@Param('id') id: string, @Body() body: ReviewManualRequestDto) {
    return this.payments.reviewManualRequest(id, body);
  }
}
