import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const SESSION_KEY = 'pira-public-resume-session-v1';
const DRAFT_KEY = 'pira-public-resume-draft-v1';
const LINKED_KEY = 'pira-public-resume-linked-v1';
const IMPORTED_KEY = 'pira-public-resume-imported-v1';

export function PublicResumeAccountBridge() {
  const { user, profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;
    let active = true;

    const run = async () => {
      try {
        const rawSession = localStorage.getItem(SESSION_KEY);
        if (!rawSession) return;
        const stored = JSON.parse(rawSession) as { id?: string; token?: string };
        if (!stored.id || !stored.token) return;

        if (localStorage.getItem(LINKED_KEY) !== stored.id) {
          await api.post('/public-resume-account/link', {
            sessionId: stored.id,
            token: stored.token,
          });
          if (active) localStorage.setItem(LINKED_KEY, stored.id);
        }

        if (localStorage.getItem(IMPORTED_KEY) === stored.id) return;
        const rawDraft = localStorage.getItem(DRAFT_KEY);
        if (!rawDraft) return;
        const draftEnvelope = JSON.parse(rawDraft) as { profile?: any; pendingAccountImport?: boolean };
        if (draftEnvelope.pendingAccountImport !== true || !draftEnvelope.profile) return;

        const alreadyHasResume = Boolean(
          profile.bio?.trim()
          || profile.experiences?.length
          || profile.education?.length
          || profile.skills?.length,
        );
        if (alreadyHasResume) {
          localStorage.setItem(IMPORTED_KEY, stored.id);
          return;
        }

        const draft = draftEnvelope.profile;
        await api.patch('/users/me', {
          fullName: draft.fullName || profile.fullName,
          phone: draft.phone || profile.phone,
          bio: draft.bio || '',
          experiences: Array.isArray(draft.experiences) ? draft.experiences : [],
          education: Array.isArray(draft.education) ? draft.education : [],
          skills: Array.isArray(draft.skills) ? draft.skills : [],
          courses: Array.isArray(draft.courses) ? draft.courses : [],
          languages: Array.isArray(draft.languages) ? draft.languages : [],
          linkedinURL: draft.linkedinURL || '',
          city: draft.city || '',
          state: draft.state || '',
          address: draft.address || '',
          resumePhotoURL: draft.resumePhotoURL || '',
          resumePreferences: draft.resumePreferences || {},
        });
        if (!active) return;
        localStorage.setItem(IMPORTED_KEY, stored.id);
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draftEnvelope, pendingAccountImport: false }));
        await refreshProfile();
      } catch {
        // A ponte é conveniente, mas nunca deve bloquear login ou navegação.
      }
    };

    void run();
    return () => { active = false; };
  }, [profile, refreshProfile, user]);

  return null;
}
