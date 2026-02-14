import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ProjectsService } from './projects.service';

@Controller('projects') // ✅ NOT "api/projects" because globalPrefix is already "api"
@UseGuards(JwtGuard)
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  list() {
    return this.svc.listProjects();
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.createProject(body);
  }

  @Get(':id/members')
  members(@Param('id') id: string) {
    return this.svc.listMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: any) {
    return this.svc.addMember(id, body);
  }
}
