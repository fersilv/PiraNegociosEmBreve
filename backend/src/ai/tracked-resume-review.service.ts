import { Injectable } from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';
import { ResumeReviewService, type ResumeReviewResult } from './resume-review.service';

export type TrackedResumeReviewResult = ResumeReviewResult & {
  resumeSignature: string;
};

function signaturePayload(value: unknown) {
  const profile = value && typeof value === 'object'
    ? value as Record<string, any>
    : {};
  const preferences = profile.resumePreferences && typeof profile.resumePreferences === 'object'
    ? profile.resumePreferences as Record<string, unknown>
    : {};

  return {
    headline: String(preferences.headline || '').trim(),
    bio: String(profile.bio || '').trim(),
    experiences: Array.isArray(profile.experiences) ? profile.experiences : [],
    education: Array.isArray(profile.education) ? profile.education : [],
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    courses: Array.isArray(profile.courses) ? profile.courses : [],
    languages: Array.isArray(profile.languages) ? profile.languages : [],
  };
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

@Injectable()
export class TrackedResumeReviewService extends ResumeReviewService {
  constructor(settingsService: SettingsService) {
    super(settingsService);
  }

  resumeSignature(profile: unknown) {
    return `resume-v1-${fnv1a(JSON.stringify(signaturePayload(profile)))}`;
  }

  async review(profile: unknown): Promise<TrackedResumeReviewResult> {
    const analysis = await super.review(profile);
    return {
      ...analysis,
      resumeSignature: this.resumeSignature(profile),
    };
  }
}
