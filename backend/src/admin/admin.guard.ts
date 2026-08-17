import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.users.findOne({ where: { id: request.user?.uid } });
    if (user?.type !== UserType.ADMIN) {
      throw new ForbiddenException('Esta operação é restrita à administração da plataforma.');
    }
    return true;
  }
}
