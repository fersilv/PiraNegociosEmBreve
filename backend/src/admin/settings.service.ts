import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async findAll(): Promise<Setting[]> {
    return this.settingRepository.find();
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settingRepository.findOne({ where: { key } });
  }

  async getValue(key: string, defaultValue?: string): Promise<string | undefined> {
    const setting = await this.findByKey(key);
    return setting ? setting.value : defaultValue;
  }

  async createOrUpdate(key: string, value: string, description?: string, isPublic: boolean = false): Promise<Setting> {
    let setting = await this.findByKey(key);
    if (!setting) {
      setting = this.settingRepository.create({ key, value, description, isPublic });
    } else {
      setting.value = value;
      if (description !== undefined) setting.description = description;
      setting.isPublic = isPublic;
    }
    return this.settingRepository.save(setting);
  }
}
