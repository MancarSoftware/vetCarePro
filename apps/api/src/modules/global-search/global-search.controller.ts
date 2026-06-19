import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import { GlobalSearchService } from './global-search.service';

@Controller('global-search')
@UseGuards(JwtAuthGuard)
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GlobalSearchQueryDto,
  ) {
    return this.globalSearchService.search(user, query);
  }
}
