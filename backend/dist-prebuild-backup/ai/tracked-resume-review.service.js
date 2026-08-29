"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackedResumeReviewService = void 0;
const common_1 = require("@nestjs/common");
const settings_service_1 = require("../admin/settings.service");
const resume_review_service_1 = require("./resume-review.service");
function signaturePayload(value) {
    const profile = value && typeof value === 'object'
        ? value
        : {};
    const preferences = profile.resumePreferences && typeof profile.resumePreferences === 'object'
        ? profile.resumePreferences
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
function fnv1a(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
let TrackedResumeReviewService = class TrackedResumeReviewService extends resume_review_service_1.ResumeReviewService {
    constructor(settingsService) {
        super(settingsService);
    }
    resumeSignature(profile) {
        return `resume-v1-${fnv1a(JSON.stringify(signaturePayload(profile)))}`;
    }
    async review(profile) {
        const analysis = await super.review(profile);
        return {
            ...analysis,
            resumeSignature: this.resumeSignature(profile),
        };
    }
};
exports.TrackedResumeReviewService = TrackedResumeReviewService;
exports.TrackedResumeReviewService = TrackedResumeReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], TrackedResumeReviewService);
//# sourceMappingURL=tracked-resume-review.service.js.map