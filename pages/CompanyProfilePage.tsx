import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Globe,
  MapPin,
  Phone,
  FileText,
  FileSignature,
  Users,
  UserPlus,
  UserCheck,
  Shield,
  Instagram,
  Linkedin,
  Facebook,
  Trash2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { FileUpload } from "../components/FileUpload";
import { CityStateSelector } from "../components/CityStateSelector";

export function CompanyProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Company details state
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [currentCompanySlug, setCurrentCompanySlug] = useState("");
  const [pendingCompanySlug, setPendingCompanySlug] = useState("");
  const [slugIsCustom, setSlugIsCustom] = useState(false);
  const [slugChangeStatus, setSlugChangeStatus] = useState("NONE");
  const [slugRollback, setSlugRollback] = useState<{
    previousSlug: string;
    expiresAt: string;
  } | null>(null);
  const [slugAvailability, setSlugAvailability] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyDocumentFile, setCompanyDocumentFile] = useState("");
  const [documentType, setDocumentType] = useState<"CNPJ" | "CPF">("CNPJ");
  const [companyDocument, setCompanyDocument] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCityState, setCompanyCityState] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  // Social media state
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");

  const [companyStatus, setCompanyStatus] = useState<
    "DRAFT" | "PENDING" | "VERIFIED" | "REJECTED"
  >("DRAFT");
  const [rejectionReason, setRejectionReason] = useState("");

  // Employees list state
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [accessRequest, setAccessRequest] = useState<any | null>(null);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [reviewingAccessRequest, setReviewingAccessRequest] = useState<
    string | null
  >(null);

  // Invite employee form state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "colaborador">(
    "colaborador",
  );
  const [inviting, setInviting] = useState(false);

  const hasBasicInfoForJob = () => {
    return (
      companyName.trim() !== "" &&
      companyAddress.trim() !== "" &&
      companyPhone.trim() !== ""
    );
  };

  const isCompanyComplete = () => {
    return (
      companyName.trim() !== "" &&
      companyDescription.trim() !== "" &&
      companyDocument.trim() !== "" &&
      companyAddress.trim() !== "" &&
      companyCityState.trim() !== "" &&
      companyPhone.trim() !== "" &&
      companyDocumentFile.trim() !== ""
    );
  };

  const fetchEmployees = async (cid: string) => {
    setLoadingEmployees(true);
    try {
      const response = await api.get(`/companies/${cid}/employees`);
      setEmployees(response.data);
    } catch (err) {
      console.error("Erro ao buscar funcionários:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchAccessRequests = async (cid: string) => {
    try {
      const response = await api.get(`/companies/${cid}/access-requests`);
      setAccessRequests(asArray(response.data));
    } catch (err) {
      console.error("Erro ao buscar solicitações de acesso:", err);
    }
  };

  useEffect(() => {
    const initCompanyProfile = async () => {
      if (!user || !profile) return;

      try {
        let currentCompanyId = profile.companyId || null;

        if (!currentCompanyId) {
          const requestResponse = await api
            .get("/companies/access-requests/me")
            .catch(() => null);
          setAccessRequest(requestResponse?.data || null);
          return;
        }

        setCompanyId(currentCompanyId);

        if (currentCompanyId) {
          const compResp = await api
            .get(`/companies/${currentCompanyId}`)
            .catch(() => null);
          if (compResp && compResp.data) {
            const compData = compResp.data;
            setCompanyName(compData.name || "");
            setCurrentCompanySlug(compData.slug || "");
            setPendingCompanySlug(compData.pendingSlug || "");
            setCompanySlug(compData.pendingSlug || compData.slug || "");
            setSlugIsCustom(Boolean(compData.slugIsCustom));
            setSlugChangeStatus(compData.slugChangeStatus || "NONE");
            setSlugRollback(compData.slugRollback || null);
            setCompanyDescription(compData.description || "");
            setDocumentType(compData.documentType || "CNPJ");
            setCompanyDocument(compData.cnpj || compData.cpf || "");
            setCompanyWebsite(compData.website || "");
            setCompanyAddress(compData.address || "");
            setCompanyCityState(compData.cityState || "");
            setCompanyPhone(compData.phone || "");
            setCompanyStatus(
              compData.verificationStatus ||
                (compData.isVerified ? "VERIFIED" : "DRAFT"),
            );
            setRejectionReason(compData.rejectionReason || "");
            setSocialInstagram(compData.socialInstagram || "");
            setSocialLinkedin(compData.socialLinkedin || "");
            setSocialFacebook(compData.socialFacebook || "");
            setCompanyLogo(compData.logoURL || compData.companyLogo || "");
            setCompanyDocumentFile(
              compData.documentURL || compData.companyDocumentFile || "",
            );

            await fetchEmployees(currentCompanyId);
            await fetchAccessRequests(currentCompanyId);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados da empresa:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    initCompanyProfile();
  }, [user, profile]);

  useEffect(() => {
    if (companyStatus !== "VERIFIED") {
      setSlugAvailability("idle");
      return;
    }
    if (!companySlug.trim()) {
      setSlugAvailability("idle");
      return;
    }
    const timeout = window.setTimeout(async () => {
      setSlugAvailability("checking");
      try {
        const response = await api.get(
          `/companies/slug-availability?slug=${encodeURIComponent(companySlug)}`,
        );
        setSlugAvailability(
          response.data?.available ? "available" : "unavailable",
        );
      } catch {
        setSlugAvailability("unavailable");
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [companySlug, companyStatus]);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    try {
      const companyUpdates: any = {
        name: companyName,
        slug: companySlug,
        description: companyDescription,
        documentType: documentType,
        cnpj: documentType === "CNPJ" ? companyDocument : "",
        cpf: documentType === "CPF" ? companyDocument : "",
        website: companyWebsite,
        address: companyAddress,
        cityState: companyCityState,
        phone: companyPhone,
        socialInstagram,
        socialLinkedin,
        socialFacebook,
        logoURL: companyLogo,
        documentURL: companyDocumentFile,
      };

      const response = await api.put(`/companies/${companyId}`, companyUpdates);
      const savedCompany = response.data;
      setCurrentCompanySlug(savedCompany.slug || "");
      setPendingCompanySlug(savedCompany.pendingSlug || "");
      setCompanySlug(savedCompany.pendingSlug || savedCompany.slug || "");
      setSlugIsCustom(Boolean(savedCompany.slugIsCustom));
      setSlugChangeStatus(savedCompany.slugChangeStatus || "NONE");
      setSlugRollback(savedCompany.slugRollback || null);

      if (user) {
        await api.post("/users/me", {
          companyName: companyName,
          companyLogo: companyLogo,
        });
        await refreshProfile();
      }

      alert(
        savedCompany.slugChangeStatus === "PENDING"
          ? "Dados salvos. A alteração da URL foi enviada para aprovação; a URL atual continua funcionando."
          : "Dados da empresa salvos com sucesso!",
      );
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar dados da empresa.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendForReview = async () => {
    if (!companyId) return;
    if (!isCompanyComplete()) {
      alert(
        "Por favor, preencha todos os dados obrigatórios da empresa antes de enviar para análise.",
      );
      return;
    }

    setLoading(true);
    try {
      await api.put(`/companies/${companyId}`, {
        verificationStatus: "PENDING",
        isVerified: false,
      });
      setCompanyStatus("PENDING");

      await refreshProfile();

      alert(
        "Perfil enviado para análise da administração com sucesso! Você receberá uma notificação quando for verificado.",
      );
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar para análise.");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!inviteName.trim() || !inviteEmail.trim()) {
      alert("Por favor, preencha o nome e e-mail do colaborador.");
      return;
    }

    setInviting(true);
    try {
      await api.post(`/companies/${companyId}/employees`, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      alert(`Colaborador ${inviteName} cadastrado com sucesso!`);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("colaborador");

      await fetchEmployees(companyId);
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar colaborador");
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (empId: string, isAdminRole: boolean) => {
    if (!companyId) return;
    try {
      await api.put(`/companies/${companyId}/employees/${empId}/role`, {
        isCompanyAdmin: isAdminRole,
      });
      alert("Cargo do colaborador atualizado com sucesso!");
      await fetchEmployees(companyId);
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar cargo");
    }
  };

  const handleRemoveEmployee = async (empId: string, empName: string) => {
    if (empId === user?.uid) {
      alert("Você não pode remover a si mesmo da empresa!");
      return;
    }
    if (
      !window.confirm(
        `Tem certeza que deseja remover ${empName} desta empresa?`,
      )
    ) {
      return;
    }

    try {
      await api.delete(`/companies/${companyId}/employees/${empId}`);
      alert("Colaborador removido com sucesso!");
      if (companyId) await fetchEmployees(companyId);
    } catch (err) {
      console.error(err);
      alert("Erro ao remover colaborador");
    }
  };

  const handleSlugRollback = async () => {
    if (!companyId || !slugRollback) return;
    if (
      !window.confirm(
        `Voltar para /${slugRollback.previousSlug}? Essa opção só pode ser usada uma vez e a URL atual será liberada.`,
      )
    )
      return;
    setLoading(true);
    try {
      const response = await api.post(`/companies/${companyId}/slug-rollback`);
      setCurrentCompanySlug(response.data.slug || "");
      setPendingCompanySlug("");
      setCompanySlug(response.data.slug || "");
      setSlugChangeStatus(response.data.slugChangeStatus || "ROLLED_BACK");
      setSlugRollback(null);
      alert("A URL anterior foi restaurada. A URL substituída foi liberada.");
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          "Não foi possível restaurar a URL anterior.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAccessRequest = async (
    requestId: string,
    action: "approve" | "reject",
    role: "admin" | "colaborador" = "colaborador",
  ) => {
    if (!companyId) return;
    setReviewingAccessRequest(requestId);
    try {
      await api.put(`/companies/${companyId}/access-requests/${requestId}`, {
        action,
        role,
      });
      await Promise.all([
        fetchAccessRequests(companyId),
        fetchEmployees(companyId),
      ]);
    } catch (err) {
      console.error(err);
      alert("Não foi possível processar a solicitação de acesso.");
    } finally {
      setReviewingAccessRequest(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-500">
        <Clock className="w-8 h-8 animate-spin text-terracotta-500 mb-2" />
        <p className="text-sm font-medium">Carregando dados da empresa...</p>
      </div>
    );
  }

  if (!companyId) {
    const isRejected = accessRequest?.status === "REJECTED";
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm text-center">
          <Clock
            className={`w-10 h-10 mx-auto mb-4 ${isRejected ? "text-red-500" : "text-terracotta-500"}`}
          />
          <h1 className="text-2xl font-serif font-bold text-stone-900">
            {isRejected
              ? "Solicitação não aprovada"
              : "Aguardando vínculo com empresa"}
          </h1>
          <p className="text-stone-500 mt-3 leading-relaxed">
            {isRejected
              ? `A solicitação para ${accessRequest?.companyName || "a empresa"} não foi aprovada. Você pode entrar em contato com a empresa ou falar com o suporte.`
              : accessRequest
                ? `Sua solicitação para ${accessRequest.companyName} foi enviada. Um administrador da empresa ou da plataforma poderá aprovar e definir seu nível de acesso.`
                : "Você ainda não está vinculado a uma empresa. Refaça o cadastro empresarial para buscar ou cadastrar sua empresa."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Profile Title and Verification Status Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-terracotta-600">
            Configurações Corporativas
          </span>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mt-1">
            Perfil da Empresa
          </h1>
          <p className="text-stone-500 mt-1">
            Gerencie as informações comerciais, analise e equipe da sua empresa.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-stone-100 bg-stone-50/50">
            <span className="text-xs font-bold text-stone-500">Status:</span>
            {companyStatus === "VERIFIED" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verificada
              </span>
            ) : companyStatus === "PENDING" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                Aguardando Análise
              </span>
            ) : companyStatus === "REJECTED" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                Recusada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
                <FileSignature className="w-3.5 h-3.5" />
                Rascunho
              </span>
            )}
          </div>

          {(companyStatus === "DRAFT" || companyStatus === "REJECTED") && (
            <button
              onClick={handleSendForReview}
              disabled={!isCompanyComplete() || loading}
              className="bg-terracotta-600 hover:bg-terracotta-700 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md text-sm shrink-0"
            >
              <Send className="w-4 h-4" />
              Enviar para Análise
            </button>
          )}
        </div>
      </div>

      {/* Rejection Notification banner */}
      {companyStatus === "REJECTED" && rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-900 text-sm">
              O cadastro de sua empresa precisa de correções
            </h4>
            <p className="text-red-700 text-sm mt-1 leading-relaxed">
              <strong>Motivo da recusa:</strong> {rejectionReason}
            </p>
            <p className="text-xs text-red-600 mt-2">
              Por favor, faça as alterações necessárias abaixo nos dados da
              empresa e clique em "Enviar para Análise" novamente.
            </p>
          </div>
        </div>
      )}

      {/* Main Form container */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm">
        <form onSubmit={handleUpdateCompany} className="space-y-6">
          <div className="flex justify-between items-center border-b border-stone-100 pb-3">
            <h3 className="text-lg font-serif font-bold text-stone-900">
              Informações Comerciais
            </h3>
            {!isCompanyComplete() && (
              <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 border border-amber-200/50">
                <AlertTriangle className="w-3 h-3" />
                Perfil Incompleto
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
            <div className="col-span-full">
              <FileUpload
                label="Logotipo da Empresa (Opcional)"
                accept="image/*"
                value={companyLogo}
                onChange={(base64) => setCompanyLogo(base64)}
                type="avatar"
                placeholder="Arraste o logotipo da empresa ou clique para buscar"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Nome Comercial da Empresa *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Endereço público da empresa
              </label>
              <div className="flex overflow-hidden rounded-xl border border-stone-200 focus-within:border-terracotta-500 bg-white">
                <span className="shrink-0 px-3 py-3 text-sm text-stone-400 bg-stone-50 border-r border-stone-100">
                  piranegocios.com.br/
                </span>
                <input
                  type="text"
                  value={companySlug}
                  onChange={(e) =>
                    setCompanySlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  disabled={
                    companyStatus !== "VERIFIED" ||
                    slugChangeStatus === "PENDING"
                  }
                  className="min-w-0 flex-1 px-3 py-3 outline-none disabled:bg-stone-100 disabled:text-stone-500"
                  placeholder="sua-empresa"
                  minLength={3}
                  maxLength={72}
                />
              </div>
              {companyStatus !== "VERIFIED" ? (
                <p className="mt-1.5 text-xs text-amber-700">
                  A escolha da URL será habilitada após a verificação da
                  empresa.
                </p>
              ) : slugChangeStatus === "PENDING" && pendingCompanySlug ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>Alteração aguardando aprovação:</strong> /
                  {pendingCompanySlug}. A URL atual /{currentCompanySlug}{" "}
                  continua funcionando.
                </div>
              ) : (
                <p
                  className={`mt-1.5 text-xs ${slugAvailability === "available" ? "text-green-700" : slugAvailability === "unavailable" ? "text-red-600" : "text-stone-400"}`}
                >
                  {slugAvailability === "checking" &&
                    "Verificando disponibilidade…"}
                  {slugAvailability === "available" &&
                    (slugIsCustom
                      ? "Endereço disponível. A alteração será enviada ao administrador."
                      : "Endereço disponível. Esta será sua primeira URL personalizada.")}
                  {slugAvailability === "unavailable" &&
                    "Este endereço não está disponível, está reservado ou em redirecionamento."}
                  {slugAvailability === "idle" &&
                    "Use letras, números e hífens."}
                </p>
              )}
              {slugRollback && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <p>
                    A URL anterior <strong>/{slugRollback.previousSlug}</strong>{" "}
                    redireciona para a atual até{" "}
                    {new Date(slugRollback.expiresAt).toLocaleDateString(
                      "pt-BR",
                    )}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={handleSlugRollback}
                    disabled={loading}
                    className="mt-2 font-bold underline disabled:opacity-50"
                  >
                    Voltar uma única vez para a URL anterior
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Tipo de Documento
              </label>
              <div className="flex rounded-xl border border-stone-200 p-1 bg-stone-50">
                <button
                  type="button"
                  onClick={() => setDocumentType("CNPJ")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${documentType === "CNPJ" ? "bg-white shadow-xs text-stone-900 border border-stone-200/50" : "text-stone-500"}`}
                >
                  CNPJ
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType("CPF")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${documentType === "CPF" ? "bg-white shadow-xs text-stone-900 border border-stone-200/50" : "text-stone-500"}`}
                >
                  CPF
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                {documentType} *
              </label>
              <input
                type="text"
                required
                value={companyDocument}
                onChange={(e) => setCompanyDocument(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all"
                placeholder={
                  documentType === "CNPJ"
                    ? "Ex: 00.000.000/0001-00"
                    : "Ex: 000.000.000-00"
                }
              />
              {documentType === "CPF" && (
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  💡 Cadastros com CPF têm liberações mais restritas no portal,
                  mas você poderá migrar para CNPJ posteriormente.
                </p>
              )}
            </div>

            <div className="col-span-full border-t border-stone-100 pt-4">
              <FileUpload
                label={`Comprovante de Inscrição do ${documentType} * (PDF ou Imagem)`}
                accept=".pdf,.png,.jpg,.jpeg"
                value={companyDocumentFile}
                onChange={(base64) => setCompanyDocumentFile(base64)}
                type="document"
                placeholder={`Arraste seu cartão ${documentType} ou comprovante aqui`}
              />
              <p className="text-xs text-stone-400 mt-1.5">
                A verificação documental garante o selo de Empresa Verificada e
                acesso ilimitado ao Banco de Currículos.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Telefone Comercial / Contato *
              </label>
              <input
                type="text"
                required
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all"
                placeholder="Ex: (19) 3561-1234"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Website da Empresa (Opcional)
              </label>
              <input
                type="text"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all"
                placeholder="Ex: www.empresa.com.br"
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                  Endereço Comercial (Rua, Número, Bairro) *
                </label>
                <input
                  type="text"
                  required
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all"
                  placeholder="Ex: Av. Principal, 1000 - Centro"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                  Cidade e Estado *
                </label>
                <CityStateSelector
                  onLocationChange={setCompanyCityState}
                  initialValue={companyCityState}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Redes Sociais da Empresa (Opcionais)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Instagram className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="@usuario"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={socialLinkedin}
                    onChange={(e) => setSocialLinkedin(e.target.value)}
                    placeholder="linkedin.com/company/..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Facebook className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={socialFacebook}
                    onChange={(e) => setSocialFacebook(e.target.value)}
                    placeholder="facebook.com/..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Descrição / Apresentação da Empresa *
              </label>
              <textarea
                required
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all min-h-[120px]"
                placeholder="Conte um pouco sobre a atuação da empresa no mercado, cultura e valores..."
              />
            </div>
          </div>

          {/* Validation warning section before analysis */}
          {!isCompanyComplete() && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/50 flex gap-3 text-amber-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="leading-relaxed">
                <span className="font-bold block mb-1">
                  Por que preencher tudo?
                </span>
                Para poder enviar a sua empresa para análise e aprovação
                documental, todos os campos marcados com asterisco (*) são
                obrigatórios. Depois de preencher tudo, o botão{" "}
                <strong>"Enviar para Análise"</strong> no topo da página será
                liberado.
              </div>
            </div>
          )}

          {isCompanyComplete() &&
            (companyStatus === "DRAFT" || companyStatus === "REJECTED") && (
              <div className="bg-green-50 rounded-2xl p-4 border border-green-200/50 flex gap-3 text-green-800 text-xs">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div className="leading-relaxed">
                  <span className="font-bold block mb-1">Tudo Pronto!</span>
                  Todos os dados necessários foram preenchidos de forma
                  consistente. Salve o perfil abaixo e clique no botão{" "}
                  <strong>"Enviar para Análise"</strong> no topo para liberar o
                  acesso total ao banco de currículos e certificar suas vagas.
                </div>
              </div>
            )}

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <button
              type="submit"
              disabled={loading}
              className="bg-stone-900 hover:bg-stone-850 text-white px-8 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Dados da Empresa"}
            </button>
          </div>
        </form>
      </div>

      {profile?.isCompanyAdmin && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <UserCheck className="text-terracotta-600 w-5 h-5" /> Solicitações
              de acesso
            </h3>
            <p className="text-stone-500 text-sm mt-1">
              Aprove somente pessoas que realmente pertencem à empresa. Você
              define se entram como colaborador ou administrador.
            </p>
          </div>
          {accessRequests.length === 0 ? (
            <p className="text-sm text-stone-500">
              Nenhuma solicitação pendente.
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {accessRequests.map((request) => (
                <div
                  key={request.id}
                  className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold text-stone-900 text-sm">
                      {request.requesterName}
                    </p>
                    <p className="text-xs text-stone-500">
                      {request.requesterEmail}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={reviewingAccessRequest === request.id}
                      onClick={() =>
                        handleReviewAccessRequest(
                          request.id,
                          "approve",
                          "colaborador",
                        )
                      }
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50"
                    >
                      Aprovar como colaborador
                    </button>
                    <button
                      disabled={reviewingAccessRequest === request.id}
                      onClick={() =>
                        handleReviewAccessRequest(
                          request.id,
                          "approve",
                          "admin",
                        )
                      }
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-terracotta-600 text-white hover:bg-terracotta-700 disabled:opacity-50"
                    >
                      Aprovar como admin
                    </button>
                    <button
                      disabled={reviewingAccessRequest === request.id}
                      onClick={() =>
                        handleReviewAccessRequest(request.id, "reject")
                      }
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employees / Team Management Module */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm space-y-8">
        <div>
          <h3 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
            <Users className="text-terracotta-600 w-5 h-5" />
            Gestão de Funcionários / Colaboradores
          </h3>
          <p className="text-stone-500 text-sm mt-1">
            Cadastre, convide e atribua permissões administrativas para outras
            pessoas da sua equipe.
          </p>
        </div>

        {/* Invite Employee Form */}
        <form
          onSubmit={handleInviteEmployee}
          className="bg-stone-50/50 border border-stone-200 p-6 rounded-2xl space-y-4"
        >
          <h4 className="font-bold text-sm text-stone-800 flex items-center gap-1.5 uppercase tracking-wide">
            <UserPlus className="w-4 h-4 text-terracotta-600" />
            Adicionar ou Convidar Novo Colaborador
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome do colaborador"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 outline-none bg-white focus:border-terracotta-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                E-mail Corporativo
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colaborador@empresa.com"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 outline-none bg-white focus:border-terracotta-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                Cargo / Nível de Acesso
              </label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "admin" | "colaborador")
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 outline-none bg-white focus:border-terracotta-500 font-medium"
              >
                <option value="colaborador">Colaborador (Visualizador)</option>
                <option value="admin">
                  Administrador (Anunciar Vagas / Editar Perfil)
                </option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={inviting}
              className="bg-terracotta-600 hover:bg-terracotta-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {inviting ? "Convidando..." : "Cadastrar / Convidar"}
            </button>
          </div>
        </form>

        {/* Current Employees List */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-stone-400 uppercase tracking-wider">
            Colaboradores Associados
          </h4>

          {loadingEmployees ? (
            <p className="text-stone-500 text-sm italic">
              Carregando lista de colaboradores...
            </p>
          ) : employees.length === 0 ? (
            <p className="text-stone-500 text-sm">
              Nenhum outro funcionário cadastrado no momento.
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">
                        {emp.name}
                      </span>
                      {emp.isCompanyAdmin ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          <Shield className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
                          Colaborador
                        </span>
                      )}

                      {emp.status === "INVITED" && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Convidado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500">{emp.email}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={emp.isCompanyAdmin ? "admin" : "colaborador"}
                      onChange={(e) =>
                        handleChangeRole(emp.id, e.target.value === "admin")
                      }
                      className="px-2 py-1 rounded-lg border border-stone-200 text-xs font-medium outline-none bg-white"
                    >
                      <option value="colaborador">Colaborador</option>
                      <option value="admin">Administrador</option>
                    </select>

                    <button
                      onClick={() => handleRemoveEmployee(emp.id, emp.name)}
                      disabled={emp.id === user?.uid}
                      className="text-stone-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 hover:bg-stone-100 rounded-lg transition-all"
                      title="Remover colaborador da empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
