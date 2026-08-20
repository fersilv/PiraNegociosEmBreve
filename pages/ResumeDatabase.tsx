import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";
import {
  Lock,
  FileText,
  Search,
  User,
  Sparkles,
  Loader2,
  MapPin,
  Phone,
  MessageSquare,
  Filter,
  RefreshCw,
} from "lucide-react";
import { openBase64InNewTab } from "../lib/fileViewer";
import { CandidateProfileModal } from "../components/CandidateProfileModal";

const STOP_WORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "para",
  "com",
  "e",
]);
const normalizeSearch = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const tokens = (value: unknown) =>
  normalizeSearch(value)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
const stem = (word: string) =>
  word.replace(/(oes|aes|ais)$/, "ao").replace(/s$/, "");
const distance = (a: string, b: string) => {
  const row = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let col = 1; col <= b.length; col += 1) {
    let diagonal = row[0];
    row[0] = col;
    for (let line = 1; line <= a.length; line += 1) {
      const old = row[line];
      row[line] = Math.min(
        row[line] + 1,
        row[line - 1] + 1,
        diagonal + (a[line - 1] === b[col - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return row[a.length];
};
const candidateRelevance = (candidate: any, query: string) => {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return 1;
  const name = normalizeSearch(
    candidate.name || candidate.fullName || candidate.socialName,
  );
  const source = [
    candidate.bio,
    candidate.skills,
    candidate.experiences,
    candidate.courses,
    candidate.education,
    candidate.aiAnalysis,
    candidate.role,
    candidate.headline,
  ]
    .map((item) =>
      typeof item === "string" ? item : JSON.stringify(item || ""),
    )
    .join(" ");
  const haystack = tokens(`${name} ${source}`);
  let hits = 0;
  let score = 0;
  for (const token of queryTokens) {
    const exact = haystack.some(
      (word) =>
        stem(word) === stem(token) ||
        word.startsWith(stem(token)) ||
        stem(token).startsWith(stem(word)),
    );
    const fuzzy =
      !exact &&
      token.length >= 5 &&
      haystack.some(
        (word) =>
          Math.abs(word.length - token.length) <= 1 &&
          distance(word, token) <= 1,
      );
    if (exact || fuzzy) {
      hits += 1;
      score += name.includes(token) ? 20 : fuzzy ? 5 : 10;
    }
  }
  return hits >= Math.max(1, Math.ceil(queryTokens.length * 0.6)) ? score : 0;
};

export function ResumeDatabase() {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyVerified, setCompanyVerified] = useState<boolean | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [companyJobs, setCompanyJobs] = useState<any[]>([]);
  const [inviteJobId, setInviteJobId] = useState("");

  // Search & Filter state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  useEffect(() => {
    fetchCandidates();
  }, [profile?.type, profile?.companyId]);

  const fetchCandidates = async () => {
    if (profile?.type !== "COMPANY" || !profile?.companyId) {
      setCompanyVerified(false);
      setCandidates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setCompanyVerified(null);
    try {
      const companyResponse = await api.get(`/companies/${profile.companyId}`);
      const isCompanyVerified = Boolean(companyResponse.data?.isVerified);
      setCompanyVerified(isCompanyVerified);

      if (!isCompanyVerified) {
        setCandidates([]);
        setFolders([]);
        setCompanyJobs([]);
        return;
      }

      const [candidatesResponse, foldersResponse, jobsResponse] =
        await Promise.all([
          api.get("/candidates"),
          api.get(`/companies/${profile.companyId}/talent-folders`),
          api.get(`/companies/${profile.companyId}/talent-jobs`),
        ]);

      setCandidates(asArray(candidatesResponse.data));
      setFolders(asArray(foldersResponse.data));
      setCompanyJobs(asArray(jobsResponse.data));
    } catch (err) {
      console.error(err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };
  const createFolder = async () => {
    if (!profile?.companyId || !newFolder.trim()) return;
    const response = await api.post(
      `/companies/${profile.companyId}/talent-folders`,
      { name: newFolder },
    );
    setFolders([...folders, response.data]);
    setNewFolder("");
  };
  const saveCandidate = async (candidateId: string) => {
    if (!profile?.companyId) return;
    await api.post(`/companies/${profile.companyId}/talent-records`, {
      candidateId,
      folderIds: selectedFolderId ? [selectedFolderId] : [],
    });
    alert("Candidato salvo no seu banco de talentos.");
  };
  const inviteCandidate = async (candidateId: string) => {
    if (!profile?.companyId || !inviteJobId)
      return alert("Selecione uma vaga antes de convidar.");
    await api.post(`/companies/${profile.companyId}/talent-invites`, {
      candidateId,
      jobId: inviteJobId,
    });
    alert("Convite enviado. O candidato decidirá se quer participar.");
  };

  if (profile?.type !== "COMPANY") {
    return (
      <div className="p-8 text-center text-stone-500">
        Acesso restrito a empresas.
      </div>
    );
  }

  if (companyVerified === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (!companyVerified) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-stone-50 border border-stone-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-500">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">
            Acesso Restrito (LGPD)
          </h2>
          <p className="text-stone-600 mb-8 leading-relaxed">
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD), o
            acesso ao banco de currículos é restrito exclusivamente a empresas{" "}
            <strong>verificadas e aprovadas</strong> por nossa equipe.
          </p>
          <p className="text-stone-500 text-sm">
            Esta empresa está atualmente em análise. Nossa equipe entrará em
            contato em breve para concluir a verificação.
          </p>
        </div>
      </div>
    );
  }

  // Filter candidates locally
  const filteredCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: candidateRelevance(candidate, searchKeyword),
    }))
    .filter(({ candidate, score }) => {
      const location = normalizeSearch(
        candidate.city
          ? `${candidate.city} ${candidate.state || ""}`
          : candidate.location,
      );
      const locationTokens = tokens(searchLocation);
      return (
        score > 0 && locationTokens.every((token) => location.includes(token))
      );
    })
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
        <strong className="mr-2 text-stone-700">Salvar em:</strong>
        <select
          value={selectedFolderId}
          onChange={(e) => setSelectedFolderId(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2"
        >
          <option value="">Banco geral</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <input
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          placeholder="Nova pasta, ex.: Atendimento"
          className="rounded-lg border border-stone-200 px-3 py-2"
        />
        <button
          onClick={createFolder}
          className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-bold"
        >
          Criar pasta
        </button>
        <select
          value={inviteJobId}
          onChange={(e) => setInviteJobId(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2"
        >
          <option value="">Selecionar vaga para convite...</option>
          {companyJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 flex items-center gap-3">
            <FileText className="text-terracotta-600 w-8 h-8" />
            Banco de Currículos
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Pesquise e filtre talentos cadastrados em nossa plataforma por
            competências, palavras-chave e localização.
          </p>
        </div>

        <button
          onClick={fetchCandidates}
          className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Pesquisar por nome, palavra-chave, competência ou cargo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-terracotta-500"
          />
        </div>

        <div className="relative">
          <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            placeholder="Filtrar por cidade ou estado (ex: São Paulo, PR)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-terracotta-500"
          />
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 space-y-2">
          <Search className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="font-bold text-stone-700">
            Nenhum candidato encontrado
          </p>
          <p className="text-xs text-stone-400">
            Tente ajustar seus filtros de busca por palavra-chave ou
            localização.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80">
                  <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Candidato
                  </th>
                  <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Localização
                  </th>
                  <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Resumo / Competências
                  </th>
                  <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCandidates.map((cand) => {
                  const phoneFormatted = cand.phone
                    ? cand.phone.replace(/\D/g, "")
                    : "";
                  const cityState = cand.city
                    ? `${cand.city}${cand.state ? " - " + cand.state : ""}`
                    : cand.location || "Não informada";

                  return (
                    <tr
                      key={cand.id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="px-5 py-4 min-w-[200px]">
                        <div className="font-bold text-stone-900 text-sm flex items-center gap-2">
                          {cand.name}
                          {cand.aiAnalysis && (
                            <span className="text-[9px] bg-stone-900 text-white font-mono uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                              IA
                            </span>
                          )}
                        </div>
                        {cand.email && (
                          <div className="text-xs text-stone-500 mt-0.5">
                            {cand.email}
                          </div>
                        )}
                        {cand.phone && (
                          <a
                            href={`https://wa.me/${phoneFormatted}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-bold mt-1"
                          >
                            <Phone className="w-3 h-3" />
                            {cand.phone} (WhatsApp)
                          </a>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-stone-700 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          {cityState}
                        </div>
                      </td>

                      <td className="px-5 py-4 max-w-md">
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed mb-1.5">
                          {cand.bio || "Sem resumo cadastrado."}
                        </p>
                        {cand.skills && cand.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cand.skills.map((skill: string, idx: number) => (
                              <span
                                key={idx}
                                className="bg-stone-100 text-stone-700 text-[10px] px-2 py-0.5 rounded font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCandidate(cand);
                              setIsModalOpen(true);
                            }}
                            className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <User className="w-3 h-3" /> Perfil
                          </button>

                          {cand.resumeURL && (
                            <button
                              type="button"
                              onClick={() =>
                                openBase64InNewTab(
                                  cand.resumeURL,
                                  `Currículo_${cand.name}`,
                                )
                              }
                              className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                              PDF
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              saveCandidate(cand.id).catch(() =>
                                alert("Não foi possível salvar o candidato."),
                              )
                            }
                            className="bg-terracotta-600 hover:bg-terracotta-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            Salvar talento
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              inviteCandidate(cand.id).catch(() =>
                                alert("Não foi possível enviar o convite."),
                              )
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            Convidar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Candidate Profile Modal */}
      <CandidateProfileModal
        candidate={selectedCandidate}
        isOpen={isModalOpen}
        onClose={() => {
          setSelectedCandidate(null);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
