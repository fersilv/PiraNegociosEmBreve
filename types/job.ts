export interface Job {
  id: string;
  title: string;
  companyName: string;
  location: string;
  salary?: string;
  type: string;
  workModel?: string;
  isSponsored?: boolean;
  postedAt: string;
  description: string;
  ownerId?: string;
  isConfidential?: boolean;
  isCompanyVerified?: boolean;
  isTalentPool?: boolean;
  active?: boolean;
  acceptsPlatformApplications?: boolean;
  externalApplicationInstructions?: string;
}
