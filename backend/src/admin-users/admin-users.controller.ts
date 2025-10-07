import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import type { Role } from '../auth/roles.enum';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin/users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List users (admin)' })
  list(@Query('q') q?: string, @Query('status') status?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.listUsers({ query: q, status, skip: skip ? Number(skip) : undefined, take: take ? Number(take) : undefined });
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user (admin)' })
  get(@Param('id') id: string) {
    return this.service.getUser(id);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Set user status (admin)' })
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.setStatus(id, body.status);
  }

  @Get(':id/roles')
  @Roles('admin')
  @ApiOperation({ summary: 'List user roles (admin)' })
  listRoles(@Param('id') id: string) {
    return this.service.listRoles(id);
  }

  @Post(':id/roles')
  @Roles('admin')
  @ApiOperation({ summary: 'Add role (admin)' })
  addRole(@Param('id') id: string, @Body() body: { role: Role }) {
    return this.service.addRole(id, body.role);
  }

  @Delete(':id/roles/:role')
  @Roles('admin')
  @ApiOperation({ summary: 'Remove role (admin)' })
  removeRole(@Param('id') id: string, @Param('role') role: Role) {
    return this.service.removeRole(id, role);
  }

  @Post(':id/dev-token')
  @Roles('admin')
  @ApiOperation({ summary: 'Reissue dev JWT with DB roles (admin)' })
  devToken(@Param('id') id: string, @Body() body: { expSeconds?: number }) {
    return this.service.reissueDevToken(id, body.expSeconds);
  }
}
