import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get('search')
  async search(@Query('q') query: string) {
    return this.institutionsService.search(query || '');
  }

  @Post()
  async findOrCreate(@Body('name') name: string) {
    if (!name) return null;
    return this.institutionsService.findOrCreate(name);
  }
}
