import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  LogOut,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type InvitePreview = {
  invite: {
    id: string;
    status: string;
    expiresAt: string;
    recipientEmailMasked?: string | null;
  };
  company: { id: string; name: string };
  job: { title: string; isInternal: boolean };
};

type InviteJob = {
  id: string;
  title: string;
  description: string;
  requirements?: string | null;
  skills?: string[];
  location?: string | null;
  type?: string | null;
  workModel?: string | null;
  salary?: string | null;
  deadlineDate?: string | null;
  companyName?: string | null;
};

const apiMessage = (error: any) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  'Não foi possível abrir este convite.';

export default function TalentInvitePage() {
  const { token = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [job, setJob] = useState<InviteJob | null>(null);
  const [inviteId, setInviteId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimAttempted, setClaimAttempted] = useState(false);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState('');

  const returnTo = useMemo(
    () => `/convites/vaga/${encodeURIComponent(token)}`,
    [token],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    void api
      .get(`/public/talent-invites/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!active) return;
        setPreview(response.data);
        setStatus(response.data?.invite?.status || 'PENDING');
        setError('');
      })
      .catch(() => {
        if (active) setError('Vaga não encontrada.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;
    if (authLoading || !user || !preview || job || claimAttempted) return;
    setClaimAttempted(true);
    setClaiming(true);
    void api
      .post('/talent-invites/claim', { token })
      .then(async (response) => {
        const claimedInviteId = response.data?.invite?.id;
        const jobId = response.data?.jobId;
        if (!claimedInviteId || !jobId)
          throw new Error('Convite incompleto.');
        const jobResponse = await api.get(`/jobs/${jobId}`);
        await api
          .post(`/talent-invites/${claimedInviteId}/view`)
          .catch(() => undefined);
        if (!active) return;
        setInviteId(claimedInviteId);
        setStatus(response.data?.invite?.status || 'PENDING');
        setJob(jobResponse.data);
        setError('');
      })
      .catch((claimError) => {
        if (active) setError(apiMessage(claimError));
      })
      .finally(() => {
        if (active) setClaiming(false);
      });
    return () => {
      active = false;
    };
  }, [authLoading, claimAttempted, job, preview, token, user]);

  const respond = async (decision: 'accept' | 'decline') => {
    if (!inviteId) return;
    setResponding(true);
    setError('');
    try {
      await api.post(`/talent-invites/${inviteId}/${decision}`);
      setStatus(decision === 'accept' ? 'ACCEPTED' : 'DECLINED');
    } catch (responseError) {
      setError(apiMessage(responseError));
    } finally {
      setResponding(false);
    }
  };

  const useAnotherAccount = async () => {
    await signOut(auth).catch(() => undefined);
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  if (loading || authLoading) {
    return (
      <InviteShell>
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-terracotta-600" />
        </div>
      </InviteShell>
    );
  }

  if (!preview) {
    return (
      <InviteShell>
        <div className="px-6 py-20 text-center sm:px-10">
          <XCircle className="mx-auto h-12 w-12 text-stone-300" />
          <h1 className="mt-5 font-serif text-3xl font-bold text-stone-950">
            Vaga não encontrada.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
            O convite pode ter expirado, sido encerrado ou não estar disponível
            para esta conta.
          </p>
        </div>
      </InviteShell>
    );
  }

  if (!user) {
    return (
      <InviteShell>
        <div className="px-6 py-10 sm:px-10 sm:py-14">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta-100 text-terracotta-700">
            <BriefcaseBusiness className="h-6 w-6" />
          </span>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">
            Convite para processo seletivo
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-stone-950 sm:text-4xl">
            {preview.company.name} convidou você para conhecer uma vaga.
          </h1>
          <div className="mt-7 rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">
              Oportunidade
            </p>
            <p className="mt-2 font-serif text-xl font-bold text-stone-900">
              {preview.job.title}
            </p>
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              A vaga completa é privada. Entre ou cadastre-se com o e-mail{' '}
              <strong>{preview.invite.recipientEmailMasked}</strong> para ler todos
              os detalhes antes de aceitar.
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-5 py-3.5 text-sm font-black text-stone-800"
            >
              Já tenho conta
            </Link>
            <Link
              to={`/login?mode=register&returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-terracotta-600 px-5 py-3.5 text-sm font-black text-white"
            >
              Criar conta <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </InviteShell>
    );
  }

  if (!job) {
    return (
      <InviteShell>
        <div className="px-6 py-16 text-center sm:px-10">
          {claiming ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-terracotta-600" />
          ) : (
            <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
          )}
          <h1 className="mt-5 font-serif text-2xl font-bold text-stone-950">
            {claiming ? 'Validando seu convite...' : 'Use o e-mail convidado'}
          </h1>
          {error && <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-red-700">{error}</p>}
          {!claiming && (
            <button
              type="button"
              onClick={() => void useAnotherAccount()}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white"
            >
              <LogOut className="h-4 w-4" /> Entrar com outra conta
            </button>
          )}
        </div>
      </InviteShell>
    );
  }

  return (
    <InviteShell wide>
      <div className="border-b border-stone-200 px-6 py-7 sm:px-10">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.15em] text-terracotta-600">
          <ShieldCheck className="h-4 w-4" /> Vaga privada · convite validado
        </div>
        <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-stone-950 sm:text-4xl">
          {job.title}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-stone-600">
          <Building2 className="h-4 w-4" /> {preview.company.name}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-stone-600">
          {job.location && <JobTag icon={<MapPin className="h-3.5 w-3.5" />} text={job.location} />}
          {job.type && <JobTag icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} text={job.type} />}
          {job.workModel && <JobTag icon={<Building2 className="h-3.5 w-3.5" />} text={job.workModel} />}
          {job.deadlineDate && <JobTag icon={<CalendarDays className="h-3.5 w-3.5" />} text={`Até ${new Date(`${job.deadlineDate}T12:00:00`).toLocaleDateString('pt-BR')}`} />}
        </div>
      </div>

      <div className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_290px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-serif text-xl font-bold text-stone-950">Sobre a vaga</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">{job.description}</p>
          </section>
          {job.requirements && (
            <section>
              <h2 className="font-serif text-xl font-bold text-stone-950">Requisitos</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">{job.requirements}</p>
            </section>
          )}
          {job.skills && job.skills.length > 0 && (
            <section>
              <h2 className="font-serif text-xl font-bold text-stone-950">Habilidades</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-700">{skill}</span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside>
          <div className="sticky top-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            {job.salary && (
              <div className="mb-5 border-b border-stone-200 pb-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Remuneração</p>
                <p className="mt-1 font-bold text-stone-900">{job.salary}</p>
              </div>
            )}
            {status === 'PENDING' ? (
              <>
                <p className="text-sm font-bold text-stone-900">Deseja participar?</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">Seu aceite será registrado e a empresa verá sua candidatura.</p>
                {error && <p className="mt-3 text-xs font-semibold text-red-700">{error}</p>}
                <button
                  type="button"
                  disabled={responding}
                  onClick={() => void respond('accept')}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aceitar convite
                </button>
                <button
                  type="button"
                  disabled={responding}
                  onClick={() => void respond('decline')}
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-600 disabled:opacity-50"
                >
                  Não tenho interesse
                </button>
              </>
            ) : status === 'ACCEPTED' ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <p className="mt-3 font-bold text-stone-900">Convite aceito</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">Sua participação já foi enviada para a empresa.</p>
                <Link to={`/user/vaga/${job.id}`} className="mt-5 inline-flex items-center gap-2 text-xs font-black text-terracotta-700">Acompanhar candidatura <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            ) : (
              <div className="text-center">
                <Clock3 className="mx-auto h-9 w-9 text-stone-400" />
                <p className="mt-3 font-bold text-stone-900">Convite recusado</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </InviteShell>
  );
}

function InviteShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-[#f5efe8] px-4 py-8 text-stone-900 sm:py-12">
      <div className={`mx-auto ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <Link to="/" className="mb-6 inline-flex items-center">
          <img src="/brand/logo-horizontal-burgundy.png" alt="PiraNegócios" className="h-8 w-auto max-w-[210px] object-contain" />
        </Link>
        <div className="overflow-hidden rounded-[32px] border border-[#ddcfc3] bg-[#fffdfa] shadow-[0_30px_90px_rgba(73,45,28,.10)]">{children}</div>
      </div>
    </main>
  );
}

function JobTag({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5">{icon}{text}</span>;
}
