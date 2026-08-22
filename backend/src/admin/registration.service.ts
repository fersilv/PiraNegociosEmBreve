import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';
import { RegistrationInterest, RegistrationInterestSource } from './entities/registration-interest.entity';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(RegistrationInterest)
    private readonly interestsRepository: Repository<RegistrationInterest>,
    private readonly settingsService: SettingsService,
  ) {}

  async isOpen() {
    return (await this.settingsService.getValue('ALLOW_NEW_REGISTRATIONS', 'true')) === 'true';
  }

  async setOpen(open: boolean) {
    await this.settingsService.createOrUpdate(
      'ALLOW_NEW_REGISTRATIONS',
      open ? 'true' : 'false',
      'Controla se novos membros podem concluir o cadastro na plataforma.',
    );
    return { open };
  }

  async joinWaitlist(input: { name?: unknown; email?: unknown; source?: unknown }) {
    const name = String(input?.name || '').trim().slice(0, 180);
    const email = String(input?.email || '').trim().toLowerCase().slice(0, 255);
    const source = String(input?.source || 'EMAIL').toUpperCase() as RegistrationInterestSource;

    if (!name) throw new BadRequestException('Informe seu nome para entrar na lista de espera.');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Informe um e-mail válido.');
    if (!['EMAIL', 'GOOGLE'].includes(source)) throw new BadRequestException('Origem de pré-cadastro inválida.');

    const existing = await this.interestsRepository.findOne({ where: { email } });
    if (existing) {
      existing.name = name || existing.name;
      existing.source = source;
      if (existing.status === 'CONVERTED') existing.status = 'WAITING';
      return this.interestsRepository.save(existing);
    }

    return this.interestsRepository.save(this.interestsRepository.create({
      name,
      email,
      source,
      status: 'WAITING',
    }));
  }

  async list() {
    return this.interestsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async countWaiting() {
    return this.interestsRepository.count({ where: { status: 'WAITING' } });
  }
}
