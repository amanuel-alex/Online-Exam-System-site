import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getInbox(@CurrentUser() currentUser: any) {
    return this.notificationService.findAllForUser(currentUser.id);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() currentUser: any) {
    return this.notificationService.getUnreadCount(currentUser.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.notificationService.markAsRead(id, currentUser.id);
  }
}
