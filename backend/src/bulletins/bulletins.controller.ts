import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CreateBulletinDto } from './dto/create-bulletin.dto';
import { BulletinsService } from './bulletins.service';
import { PublishBulletinDto } from './dto/publish-bulletin.dto';
import { UnpublishBulletinDto } from './dto/unpublish-bulletin.dto';
import { ListBulletinsQueryDto } from './dto/list-bulletins.query';
import { RevertBulletinDto } from './dto/revert-bulletin.dto';

@ApiTags('bulletins')
@Controller('bulletins')
export class BulletinsController {
  constructor(private readonly bulletins: BulletinsService) {}
  @Get()
  @ApiOperation({ summary: 'List published bulletins', description: 'Public feed of published bulletins with optional pagination and search.' })
  list(@Query() query: ListBulletinsQueryDto) {
    return this.bulletins.listPublishedPaginated(query);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create bulletin (admin)', description: 'Create a new bulletin as draft or published.' })
  create(@Body() body: CreateBulletinDto) {
    return this.bulletins.create(body);
  }

  @Post(':id/publish')
  @Roles('admin')
  @ApiOperation({ summary: 'Publish bulletin (admin)', description: 'Mark a bulletin as published.' })
  publish(@Param('id') id: string, @Body() _body: PublishBulletinDto) {
    return this.bulletins.publish(id);
  }

  @Post(':id/unpublish')
  @Roles('admin')
  @ApiOperation({ summary: 'Unpublish bulletin (admin)', description: 'Revert a bulletin to draft.' })
  unpublish(@Param('id') id: string, @Body() _body: UnpublishBulletinDto) {
    return this.bulletins.unpublish(id);
  }

  // Versions
  @Get(':id/versions')
  @Roles('admin')
  @ApiOperation({ summary: 'List bulletin versions (admin)', description: 'View version history for a bulletin.' })
  listVersions(@Param('id') id: string) {
    return this.bulletins.listVersions(id);
  }

  @Post(':id/revert')
  @Roles('admin')
  @ApiOperation({ summary: 'Revert bulletin to version (admin)', description: 'Revert bulletin content/status to a previous version.' })
  revert(@Param('id') id: string, @Body() body: RevertBulletinDto) {
    return this.bulletins.revertToVersion(id, body.version);
  }
}
