import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { MobileUploadSessionsService } from './mobile-upload-sessions.service';

@Injectable()
export class MobileUploadTokenGuard implements CanActivate {
  constructor(private readonly sessions: MobileUploadSessionsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const id = String(request.params?.id || '');
    const token = String(request.headers?.['x-upload-token'] || '');
    request.mobileUploadSession = await this.sessions.authorizeUpload(id, token);
    return true;
  }
}
