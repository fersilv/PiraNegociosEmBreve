import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JobsOAuthService } from './jobs-oauth.service';
export declare class JobsOAuthGuard implements CanActivate {
    private readonly oauth;
    private readonly windows;
    constructor(oauth: JobsOAuthService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
