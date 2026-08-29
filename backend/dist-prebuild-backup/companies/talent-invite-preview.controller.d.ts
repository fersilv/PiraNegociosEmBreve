import { TalentInvitesService } from './talent-invites.service';
export declare class TalentInvitePreviewController {
    private readonly talentInvites;
    constructor(talentInvites: TalentInvitesService);
    preview(token: string): Promise<{
        invite: {
            id: string;
            status: string;
            expiresAt: Date | null;
            recipientEmailMasked: string | null;
        };
        company: {
            id: string;
            name: string;
            logoURL: string;
        };
        job: {
            title: string;
            isInternal: boolean;
        };
    }>;
}
