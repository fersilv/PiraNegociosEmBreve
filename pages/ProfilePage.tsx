import React, { useState, useEffect } from 'react';
import { useAuth, ProfessionalExperience, ExtraCourse, AcademicEducation, ResumeAIAnalysis } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { 
  User, 
  Phone, 
  FileText, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  Briefcase,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  BookOpen,
  GraduationCap,
  Award,
  Check,
  Loader2,
  ChevronDown,
  Info
} from 'lucide-react';
import { FileUpload } from '../components/FileUpload';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // User details state
  const [userName, setUserName] = useState('');
  const [userSocialName, setUserSocialName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userTreatment, setUserTreatment] = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState('');

  // Candidate details state
  const [candidateBio, setCandidateBio] = useState('');
  const [candidateResumeUrl, setCandidateResumeUrl] = useState('');

  // LinkedIn-style fields state
  const [linkedinURL, setLinkedinURL] = useState('');
  const [additionalPhones, setAdditionalPhones] = useState<string[]>([]);
  const [experiences, setExperiences] = useState<ProfessionalExperience[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [courses, setCourses] = useState<ExtraCourse[]>([]);
  const [education, setEducation] = useState<AcademicEducation[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<ResumeAIAnalysis | null>(null);

  // Editing indices
  const [editingExpIndex, setEditingExpIndex] = useState<number | null>(null);
  const [editingEduIndex, setEditingEduIndex] = useState<number | null>(null);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);

  // In-form creation states for new items
  const [newPhone, setNewPhone] = useState('');
  const [newSkill, setNewSkill] = useState('');

  // Form toggles and states for Experiences
  const [showExpForm, setShowExpForm] = useState(false);
  const [expCompany, setExpCompany] = useState('');
  const [expRole, setExpRole] = useState('');
  const [expStartDate, setExpStartDate] = useState('');
  const [expEndDate, setExpEndDate] = useState('');
  const [expCurrent, setExpCurrent] = useState(false);
  const [expDescription, setExpDescription] = useState('');
  const [expSkills, setExpSkills] = useState<string[]>([]);
  const [newExpSkill, setNewExpSkill] = useState('');

  // Form toggles and states for Education
  const [showEduForm, setShowEduForm] = useState(false);
  const [eduInstitution, setEduInstitution] = useState('');
  const [eduDegree, setEduDegree] = useState('');
  const [eduFieldOfStudy, setEduFieldOfStudy] = useState('');
  const [eduStartYear, setEduStartYear] = useState('');
  const [eduEndYear, setEduEndYear] = useState('');
  const [eduCurrent, setEduCurrent] = useState(false);
  const [eduStatus, setEduStatus] = useState<'CONCLUIDO' | 'EM_ANDAMENTO' | 'TRANCADO' | 'INTERROMPIDO'>('CONCLUIDO');

  // Form toggles and states for Courses
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseInstitution, setCourseInstitution] = useState('');
  const [courseYear, setCourseYear] = useState('');

  // AI Assistant states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingStep, setAiLoadingStep] = useState('');
  const [aiResult, setAiResult] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    
    setUserName(profile.displayName || profile.fullName || profile.name || '');
    setUserSocialName(profile.socialName || '');
    setUserPhone(profile.phone || '');
    setUserTreatment(profile.treatment || '');
    setUserPhotoUrl(profile.photoURL || '');

    if (profile.type === 'CANDIDATE') {
      setCandidateBio(profile.bio || '');
      setCandidateResumeUrl(profile.resumeURL || '');
      setLinkedinURL(profile.linkedinURL || '');
      setAdditionalPhones(profile.additionalPhones || []);
      setExperiences(profile.experiences || []);
      setSkills(profile.skills || []);
      setCourses(profile.courses || []);
      setEducation(profile.education || []);
      setAiAnalysis(profile.aiAnalysis || null);
    }
    setInitialLoading(false);
  }, [user, profile]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const updates: any = {
        displayName: userName,
        fullName: userName,
        socialName: userSocialName,
        phone: userPhone,
        treatment: userTreatment,
        photoURL: userPhotoUrl,
      };

      if (profile?.type === 'CANDIDATE') {
        updates.bio = candidateBio;
        updates.resumeURL = candidateResumeUrl;
        updates.additionalPhones = additionalPhones;
        updates.experiences = experiences;
        updates.skills = skills;
        updates.courses = courses;
        updates.education = education;
        updates.aiAnalysis = aiAnalysis;
        updates.hasAiAnalyzed = !!aiAnalysis;
        updates.linkedinURL = linkedinURL;
      }

      await api.post('/users/me', updates);
      await refreshProfile();
      alert('Seu perfil foi atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to manage array states in local UI
  const addAdditionalPhone = () => {
    if (!newPhone.trim()) return;
    if (additionalPhones.includes(newPhone.trim())) {
      alert('Este telefone já foi adicionado.');
      return;
    }
    setAdditionalPhones([...additionalPhones, newPhone.trim()]);
    setNewPhone('');
  };

  const removeAdditionalPhone = (index: number) => {
    setAdditionalPhones(additionalPhones.filter((_, idx) => idx !== index));
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    if (skills.includes(newSkill.trim())) {
      setNewSkill('');
      return;
    }
    setSkills([...skills, newSkill.trim()]);
    setNewSkill('');
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const editExperience = (index: number) => {
    const exp = experiences[index];
    setEditingExpIndex(index);
    setExpCompany(exp.company);
    setExpRole(exp.role);
    setExpStartDate(exp.startDate);
    setExpEndDate(exp.current ? '' : exp.endDate === 'Não informada' ? '' : exp.endDate);
    setExpCurrent(exp.current);
    setExpDescription(exp.description || '');
    setExpSkills(exp.skills || []);
    setShowExpForm(true);
  };

  const addExperience = () => {
    if (!expCompany.trim() || !expRole.trim() || !expStartDate.trim()) {
      alert('Preencha os campos obrigatórios da experiência.');
      return;
    }
    const newExp: ProfessionalExperience = {
      company: expCompany.trim(),
      role: expRole.trim(),
      startDate: expStartDate.trim(),
      endDate: expCurrent ? 'Atual' : expEndDate.trim() || 'Não informada',
      current: expCurrent,
      description: expDescription.trim(),
      skills: expSkills
    };

    if (editingExpIndex !== null) {
      const updated = [...experiences];
      updated[editingExpIndex] = newExp;
      setExperiences(updated);
      setEditingExpIndex(null);
    } else {
      setExperiences([...experiences, newExp]);
    }
    
    // Reset experience form
    setExpCompany('');
    setExpRole('');
    setExpStartDate('');
    setExpEndDate('');
    setExpCurrent(false);
    setExpDescription('');
    setExpSkills([]);
    setNewExpSkill('');
    setShowExpForm(false);
  };

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, idx) => idx !== index));
    if (editingExpIndex === index) {
      setEditingExpIndex(null);
    }
  };

  const editEducation = (index: number) => {
    const edu = education[index];
    setEditingEduIndex(index);
    setEduInstitution(edu.institution);
    setEduDegree(edu.degree);
    setEduFieldOfStudy(edu.fieldOfStudy || '');
    setEduStartYear(edu.startYear);
    setEduEndYear(edu.status === 'EM_ANDAMENTO' ? '' : edu.endYear === 'Não informado' ? '' : edu.endYear);
    setEduStatus(edu.status || 'CONCLUIDO');
    setShowEduForm(true);
  };

  const addEducation = () => {
    if (!eduInstitution.trim() || !eduDegree.trim() || !eduStartYear.trim()) {
      alert('Preencha os campos obrigatórios da formação acadêmica.');
      return;
    }
    const newEdu: AcademicEducation = {
      institution: eduInstitution.trim(),
      degree: eduDegree.trim(),
      fieldOfStudy: eduFieldOfStudy.trim(),
      startYear: eduStartYear.trim(),
      endYear: eduStatus === 'EM_ANDAMENTO' ? 'Em andamento' : eduEndYear.trim() || 'Não informado',
      current: eduStatus === 'EM_ANDAMENTO',
      status: eduStatus
    };

    if (editingEduIndex !== null) {
      const updated = [...education];
      updated[editingEduIndex] = newEdu;
      setEducation(updated);
      setEditingEduIndex(null);
    } else {
      setEducation([...education, newEdu]);
    }

    // Reset education form
    setEduInstitution('');
    setEduDegree('');
    setEduFieldOfStudy('');
    setEduStartYear('');
    setEduEndYear('');
    setEduCurrent(false);
    setEduStatus('CONCLUIDO');
    setShowEduForm(false);
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, idx) => idx !== index));
    if (editingEduIndex === index) {
      setEditingEduIndex(null);
    }
  };

  const editCourse = (index: number) => {
    const course = courses[index];
    setEditingCourseIndex(index);
    setCourseName(course.name);
    setCourseInstitution(course.institution === 'Não informada' ? '' : course.institution || '');
    setCourseYear(course.year === 'Não informado' ? '' : course.year || '');
    setShowCourseForm(true);
  };

  const addCourse = () => {
    if (!courseName.trim()) {
      alert('O nome do curso/certificação é obrigatório.');
      return;
    }
    const newCourse: ExtraCourse = {
      name: courseName.trim(),
      institution: courseInstitution.trim() || 'Não informada',
      year: courseYear.trim() || 'Não informado'
    };

    if (editingCourseIndex !== null) {
      const updated = [...courses];
      updated[editingCourseIndex] = newCourse;
      setCourses(updated);
      setEditingCourseIndex(null);
    } else {
      setCourses([...courses, newCourse]);
    }

    // Reset course form
    setCourseName('');
    setCourseInstitution('');
    setCourseYear('');
    setShowCourseForm(false);
  };

  const removeCourse = (index: number) => {
    setCourses(courses.filter((_, idx) => idx !== index));
    if (editingCourseIndex === index) {
      setEditingCourseIndex(null);
    }
  };

  // Run AI Resume Extraction & Optimization
  const runAiResumeAnalysis = async () => {
    if (!user) return;
    if (!candidateResumeUrl) {
      alert('Faça o upload do seu currículo primeiro para que a IA possa analisá-lo.');
      return;
    }

    setAiLoading(true);
    setAiResult(null);

    // Fetch and check limits
    let globalLimit = 1; // Default to 1 free analysis
    try {
      const aiConfigResponse = await api.get('/configs/ai').catch(() => null);
      if (aiConfigResponse && aiConfigResponse.data) {
        if (aiConfigResponse.data.limit !== undefined) {
          globalLimit = Number(aiConfigResponse.data.limit);
        }
      }
    } catch (err) {
      console.warn('Could not fetch global AI limit:', err);
    }

    const userLimit = profile?.aiAnalysisLimit !== undefined ? Number(profile.aiAnalysisLimit) : globalLimit;
    const currentCount = Number(profile?.aiAnalysisCount || 0);

    // Check if limit exceeded (assuming positive limits are active, negative limits like -1 mean unlimited)
    if (userLimit >= 0 && currentCount >= userLimit) {
      alert(`Você atingiu o limite de uso gratuito da assistente de IA (${currentCount} de ${userLimit} análises). Entre em contato com o administrador para aumentar o seu limite.`);
      setAiLoading(false);
      return;
    }

    const steps = [
      'Lendo o arquivo do currículo...',
      'Analisando histórico profissional...',
      'Identificando competências e cursos...',
      'Formatando escolaridade...',
      'Gerando sugestões de otimização profissional...',
      'Quase pronto...'
    ];

    let stepIndex = 0;
    setAiLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setAiLoadingStep(steps[stepIndex]);
      }
    }, 4000);

    try {
      // Determine probable mime type
      let mimeType = 'application/pdf';
      if (candidateResumeUrl.startsWith('data:image/')) {
        mimeType = candidateResumeUrl.split(';')[0].split(':')[1];
      }

      const response = await fetch('/api/gemini/analyze-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          base64File: candidateResumeUrl,
          mimeType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao analisar currículo.');
      }

      const parsedData = await response.json();
      setAiResult(parsedData);

      // O consumo é controlado pelo servidor; o navegador não pode alterar a cota.
    } catch (err: any) {
      console.error(err);
      alert('Erro na análise da IA: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      clearInterval(stepInterval);
      setAiLoading(false);
    }
  };

  // Apply parsed AI data directly into form states
  const applyAiResult = () => {
    if (!aiResult) return;

    if (aiResult.name) setUserName(aiResult.name);
    if (aiResult.socialName) setUserSocialName(aiResult.socialName);
    if (aiResult.phone) setUserPhone(aiResult.phone);
    if (aiResult.treatment) setUserTreatment(aiResult.treatment);
    if (aiResult.bio) setCandidateBio(aiResult.bio);
    if (aiResult.additionalPhones) setAdditionalPhones(aiResult.additionalPhones);
    if (aiResult.experiences) setExperiences(aiResult.experiences);
    if (aiResult.skills) setSkills(aiResult.skills);
    if (aiResult.courses) setCourses(aiResult.courses);
    if (aiResult.education) setEducation(aiResult.education);
    if (aiResult.aiAnalysis) setAiAnalysis(aiResult.aiAnalysis);

    setAiResult(null);
    alert('Dados da IA aplicados! Não se esqueça de clicar em "Salvar Meu Perfil Completo" ao final da página para gravar os dados permanentemente.');
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-500">
        <Clock className="w-8 h-8 animate-spin text-terracotta-500 mb-2" />
        <p className="text-sm font-medium">Carregando dados pessoais...</p>
      </div>
    );
  }

  const isCandidate = profile?.type === 'CANDIDATE';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header Profile Title */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-terracotta-600">Configurações Pessoais</span>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mt-1">Meus Dados Pessoais</h1>
          <p className="text-stone-500 text-sm max-w-xl">
            Mantenha suas informações de contato, currículo profissional, competências e escolaridade atualizados.
          </p>
        </div>
      </div>

      {/* AI Resume Assistant (for Candidate only) */}
      {isCandidate && (
        <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-3xl p-6 md:p-8 border border-stone-800 shadow-md space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-terracotta-500 text-white rounded-2xl shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                Assistente de Currículo com Inteligência Artificial
                <span className="text-[10px] bg-terracotta-600 text-white px-2 py-0.5 rounded-full font-sans uppercase font-bold tracking-wider">Mágica da IA</span>
              </h3>
              <p className="text-sm text-stone-300 mt-1">
                Fazer o preenchimento manual de experiências e cursos é coisa do passado. Use nossa Inteligência Artificial para ler seu documento de currículo, preencher todo o seu perfil de forma automática e ainda indicar sugestões de melhorias no seu currículo!
              </p>
            </div>
          </div>

          {!candidateResumeUrl ? (
            <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 flex gap-3 text-sm text-stone-300">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold text-white">Currículo necessário:</span> Por favor, faça o upload do seu currículo em arquivo no formulário abaixo. Uma vez anexado, você poderá usar a inteligência artificial para ler e organizar seu perfil automaticamente.
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {aiLoading ? (
                <div className="bg-stone-800/50 border border-stone-700 rounded-2xl p-8 text-center space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-terracotta-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">{aiLoadingStep}</p>
                    <p className="text-xs text-stone-400">Extraindo dados profissionais. Isso levará cerca de 20 segundos...</p>
                  </div>
                </div>
              ) : aiResult ? (
                <div className="space-y-6 bg-stone-800/30 border border-stone-700/50 p-6 rounded-2xl">
                  {/* AI Preview Alert */}
                  <div className="bg-terracotta-600/20 border border-terracotta-500/30 rounded-xl p-4 text-sm text-stone-200">
                    <h4 className="font-bold flex items-center gap-1.5 text-white">
                      <CheckCircle2 className="w-5 h-5 text-terracotta-400 shrink-0" />
                      Análise concluída com sucesso!
                    </h4>
                    <p className="text-xs text-stone-300 mt-1">
                      A IA analisou seu currículo profissional. Veja a análise rápida abaixo e clique em <strong>"Aplicar dados ao meu Perfil"</strong> para atualizar automaticamente todas as seções abaixo de uma vez só!
                    </p>
                  </div>

                  {/* Suggestions Feedback */}
                  <div className="space-y-4 text-stone-200">
                    <div>
                      <span className="text-xs font-bold text-terracotta-400 uppercase tracking-wider block">Crítica Construtiva (Light Analysis):</span>
                      <p className="text-sm text-stone-300 mt-1.5 leading-relaxed bg-stone-900/60 p-4 rounded-xl border border-stone-800 italic">
                        "{aiResult.aiAnalysis?.feedbackText || 'Sem feedback disponível.'}"
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-terracotta-400 uppercase tracking-wider block mb-2">Sugestões de Otimização e Melhorias:</span>
                      <ul className="space-y-2">
                        {aiResult.aiAnalysis?.suggestions?.map((suggestion: string, idx: number) => (
                          <li key={idx} className="flex gap-2.5 text-sm text-stone-300">
                            <Check className="w-4 h-4 text-terracotta-400 shrink-0 mt-0.5" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={applyAiResult}
                      className="flex-1 bg-terracotta-600 hover:bg-terracotta-700 text-white py-3 px-6 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Check className="w-4.5 h-4.5" />
                      Aplicar dados ao meu Perfil
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiResult(null)}
                      className="bg-stone-800 hover:bg-stone-700 text-stone-300 py-3 px-6 rounded-xl font-bold transition-all text-sm cursor-pointer"
                    >
                      Descartar e Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={runAiResumeAnalysis}
                    className="w-full bg-terracotta-600 hover:bg-terracotta-700 text-white py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer text-sm"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    Analisar Currículo & Preencher Perfil com IA
                  </button>

                  {aiAnalysis && (
                    <div className="bg-stone-900/80 border border-stone-800 p-5 rounded-2xl space-y-4 text-stone-300">
                      <div className="flex justify-between items-center border-b border-stone-800 pb-2">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-terracotta-500" />
                          Análise Light Salva da IA
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">Processado</span>
                      </div>
                      <div className="space-y-3.5 text-sm">
                        <div>
                          <span className="text-xs font-bold text-stone-400 uppercase">Feedback Geral do Especialista:</span>
                          <p className="text-stone-300 mt-1 leading-relaxed italic bg-stone-950/40 p-3.5 rounded-xl border border-stone-800">
                            "{aiAnalysis.feedbackText}"
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-stone-400 uppercase block mb-1.5">Recomendações Práticas:</span>
                          <ul className="space-y-1.5 text-xs text-stone-400">
                            {aiAnalysis.suggestions.map((sug, idx) => (
                              <li key={idx} className="flex gap-2 items-start">
                                <Check className="w-3.5 h-3.5 text-terracotta-500 shrink-0 mt-0.5" />
                                <span>{sug}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Profile Form */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm">
        <form onSubmit={handleUpdateUser} className="space-y-8">
          
          {/* Section 1: Account Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-terracotta-600" />
              Informações da Conta do Usuário
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
              <div className="col-span-full">
                <FileUpload
                  label="Foto de Perfil (Opcional)"
                  accept="image/*"
                  value={userPhotoUrl}
                  onChange={(base64) => setUserPhotoUrl(base64)}
                  type="avatar"
                  placeholder="Selecione ou arraste sua foto de perfil"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Tratamento (Ex: Sr., Sra., Dr.)</label>
                <input 
                  type="text" 
                  value={userTreatment} 
                  onChange={(e) => setUserTreatment(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm" 
                  placeholder="Como gostaria de ser chamado"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Nome Completo *</label>
                <input 
                  type="text" 
                  required 
                  value={userName} 
                  onChange={(e) => setUserName(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Nome Social (Opcional)</label>
                <input 
                  type="text" 
                  value={userSocialName} 
                  onChange={(e) => setUserSocialName(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm" 
                  placeholder="Se houver, prefira usar este nome"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">E-mail (Inalterável)</label>
                <input 
                  type="email" 
                  disabled 
                  value={profile?.email || user?.email || ''} 
                  className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50 text-stone-400 outline-none cursor-not-allowed text-sm" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Telefone Principal / WhatsApp *</label>
                <input 
                  type="text" 
                  required 
                  value={userPhone} 
                  onChange={(e) => setUserPhone(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm" 
                  placeholder="Ex: (19) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Candidate-specific rich fields */}
          {isCandidate && (
            <div className="space-y-8 pt-6 border-t border-stone-100">
              
              {/* Core Resume & Bio */}
              <div className="space-y-4">
                <h3 className="text-lg font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-terracotta-600" />
                  Currículo e Biografia
                </h3>
                
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Resumo Profissional / Biografia *</label>
                  <textarea 
                    required 
                    value={candidateBio} 
                    onChange={(e) => setCandidateBio(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all min-h-[100px] text-sm" 
                    placeholder="Conte sobre sua experiência, habilidades principais e objetivos profissionais..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Link do perfil do LinkedIn (Opcional)</label>
                  <input
                    type="url"
                    value={linkedinURL}
                    onChange={(e) => setLinkedinURL(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none transition-all text-sm"
                    placeholder="Ex: https://www.linkedin.com/in/seu-perfil/"
                  />
                </div>

                <div>
                  <FileUpload
                    label="Arquivo de Currículo (opcional; necessário para se candidatar)"
                    accept=".pdf,.png,.jpg,.jpeg"
                    value={candidateResumeUrl}
                    onChange={(base64) => setCandidateResumeUrl(base64)}
                    type="resume"
                    placeholder="Envie seu currículo para liberar o preenchimento automático por IA"
                  />
                  {candidateResumeUrl && (
                    <div className="mt-3 flex justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          import('../lib/fileViewer').then(m => {
                            m.openBase64InNewTab(candidateResumeUrl, `Currículo_${userName}`);
                          });
                        }}
                        className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                      >
                        <FileText className="w-4 h-4 text-terracotta-400" />
                        Visualizar PDF do Meu Currículo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra Phones Editor */}
              <div className="space-y-4 pt-4">
                <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                  <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-terracotta-600" />
                    Outros Telefones de Contato (Opcional)
                  </h3>
                  <span className="text-xs font-mono text-stone-400">Total: {additionalPhones.length}</span>
                </div>

                {/* Additional phones list */}
                {additionalPhones.length > 0 && (
                  <div className="flex flex-wrap gap-2.5">
                    {additionalPhones.map((phoneItem, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl border border-stone-200">
                        <span>{phoneItem}</span>
                        <button
                          type="button"
                          onClick={() => removeAdditionalPhone(idx)}
                          className="text-stone-400 hover:text-red-500 transition-colors p-0.5"
                          title="Remover telefone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Phone Form */}
                <div className="flex gap-3 max-w-md">
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Ex: (19) 98888-7777"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={addAdditionalPhone}
                    className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Skills Editor */}
              <div className="space-y-4 pt-4">
                <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                  <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-terracotta-600" />
                    Habilidades e Competências
                  </h3>
                  <span className="text-xs font-mono text-stone-400">Total: {skills.length}</span>
                </div>

                {/* Skills render */}
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skillItem, idx) => (
                      <div key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-terracotta-50 text-terracotta-800 text-xs font-bold rounded-lg border border-terracotta-100/70">
                        <span>{skillItem}</span>
                        <button
                          type="button"
                          onClick={() => removeSkill(skillItem)}
                          className="text-terracotta-400 hover:text-terracotta-700 transition-colors ml-1 p-0.5"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">Nenhuma competência registrada ainda. Adicione abaixo ou extraia do currículo usando IA.</p>
                )}

                {/* Add Skill Field */}
                <div className="flex gap-3 max-w-md">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Ex: Excel Avançado, TypeScript, Negociação..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Experiences Section */}
              <div className="space-y-4 pt-4">
                <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                  <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-terracotta-600" />
                    Experiência Profissional
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExpIndex(null);
                      setExpCompany('');
                      setExpRole('');
                      setExpStartDate('');
                      setExpEndDate('');
                      setExpCurrent(false);
                      setExpDescription('');
                      setExpSkills([]);
                      setNewExpSkill('');
                      setShowExpForm(!showExpForm);
                    }}
                    className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nova Experiência
                  </button>
                </div>

                {/* Experiences List */}
                {experiences.length > 0 ? (
                  <div className="space-y-4">
                    {experiences.map((expItem, idx) => (
                      <div key={idx} className="bg-stone-50 border border-stone-200/80 p-5 rounded-2xl relative group">
                        <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => editExperience(idx)}
                            className="p-1.5 bg-white text-stone-600 hover:text-stone-950 rounded-lg border border-stone-200 hover:border-stone-300 shadow-xs transition-colors"
                            title="Editar experiência"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExperience(idx)}
                            className="p-1.5 bg-white text-stone-400 hover:text-red-500 rounded-lg border border-stone-200 hover:border-stone-300 shadow-xs transition-colors"
                            title="Remover experiência"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <h4 className="font-serif font-bold text-stone-950 text-sm">{expItem.role}</h4>
                        <p className="text-xs text-stone-600 font-bold mt-0.5">{expItem.company}</p>
                        <p className="text-[10px] text-stone-400 font-mono mt-1 font-medium">{expItem.startDate} - {expItem.endDate}</p>
                        {expItem.description && (
                          <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">{expItem.description}</p>
                        )}
                        {expItem.skills && expItem.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {expItem.skills.map((sk, sIdx) => (
                              <span key={sIdx} className="text-[9px] bg-stone-100 border border-stone-200/50 text-stone-600 px-2 py-0.5 rounded-md font-medium">
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">Nenhuma experiência profissional registrada.</p>
                )}

                {/* Add Experience form inline */}
                {showExpForm && (
                  <div className="bg-stone-50/50 rounded-2xl p-5 border border-stone-200 space-y-4 font-sans text-stone-700">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                      {editingExpIndex !== null ? 'Editar Experiência' : 'Adicionar Nova Experiência'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Empresa *</label>
                        <input
                          type="text"
                          value={expCompany}
                          onChange={(e) => setExpCompany(e.target.value)}
                          placeholder="Ex: Coca-Cola, Freelance"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Cargo / Função *</label>
                        <input
                          type="text"
                          value={expRole}
                          onChange={(e) => setExpRole(e.target.value)}
                          placeholder="Ex: Gerente de Marketing, Programador"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Data de Início (MM/AAAA) *</label>
                        <input
                          type="text"
                          value={expStartDate}
                          onChange={(e) => setExpStartDate(e.target.value)}
                          placeholder="Ex: 04/2021"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Data de Término (MM/AAAA)</label>
                        <input
                          type="text"
                          value={expEndDate}
                          disabled={expCurrent}
                          onChange={(e) => setExpEndDate(e.target.value)}
                          placeholder={expCurrent ? 'Trabalho Atual' : 'Ex: 12/2023'}
                          className={`w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs ${expCurrent ? 'bg-stone-100 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="col-span-full flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="expCurrent"
                          checked={expCurrent}
                          onChange={(e) => setExpCurrent(e.target.checked)}
                          className="rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                        />
                        <label htmlFor="expCurrent" className="text-xs text-stone-600 select-none">Atualmente trabalho nesta função</label>
                      </div>
                      <div className="col-span-full">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Descrição Curta das Atividades</label>
                        <textarea
                          value={expDescription}
                          onChange={(e) => setExpDescription(e.target.value)}
                          placeholder="Responsabilidades, tecnologias utilizadas, conquistas relevantes..."
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs min-h-[70px]"
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Habilidades Aplicadas nesta Experiência (Opcional)</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {expSkills.map((sk, skIdx) => (
                            <span key={skIdx} className="bg-terracotta-50 text-terracotta-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-terracotta-100 flex items-center gap-1">
                              {sk}
                              <button 
                                type="button" 
                                onClick={() => setExpSkills(expSkills.filter(s => s !== sk))} 
                                className="text-[10px] hover:text-red-500 font-bold transition-colors ml-1"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newExpSkill}
                            onChange={(e) => setNewExpSkill(e.target.value)}
                            placeholder="Ex: Figma, Vendas, Excel Avançado (Pressione Enter para adicionar)"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const cleaned = newExpSkill.trim();
                                if (cleaned && !expSkills.includes(cleaned)) {
                                  setExpSkills([...expSkills, cleaned]);
                                  setNewExpSkill('');
                                }
                              }
                            }}
                            className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg text-xs outline-none focus:border-terracotta-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const cleaned = newExpSkill.trim();
                              if (cleaned && !expSkills.includes(cleaned)) {
                                setExpSkills([...expSkills, cleaned]);
                                setNewExpSkill('');
                              }
                            }}
                            className="px-4 py-1.5 bg-stone-950 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowExpForm(false);
                          setEditingExpIndex(null);
                        }}
                        className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={addExperience}
                        className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        {editingExpIndex !== null ? 'Salvar Alterações' : 'Salvar Experiência'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Education Section */}
              <div className="space-y-4 pt-4">
                <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                  <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-terracotta-600" />
                    Escolaridade / Formação Acadêmica
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEduIndex(null);
                      setEduInstitution('');
                      setEduDegree('');
                      setEduFieldOfStudy('');
                      setEduStartYear('');
                      setEduEndYear('');
                      setEduCurrent(false);
                      setEduStatus('CONCLUIDO');
                      setShowEduForm(!showEduForm);
                    }}
                    className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nova Formação
                  </button>
                </div>

                {/* Education list */}
                {education.length > 0 ? (
                  <div className="space-y-4">
                    {education.map((eduItem, idx) => (
                      <div key={idx} className="bg-stone-50 border border-stone-200/80 p-5 rounded-2xl relative group">
                        <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => editEducation(idx)}
                            className="p-1.5 bg-white text-stone-600 hover:text-stone-955 rounded-lg border border-stone-200 hover:border-stone-300 shadow-xs transition-colors"
                            title="Editar formação"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEducation(idx)}
                            className="p-1.5 bg-white text-stone-400 hover:text-red-500 rounded-lg border border-stone-200 hover:border-stone-300 shadow-xs transition-colors"
                            title="Remover formação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <h4 className="font-serif font-bold text-stone-950 text-sm">{eduItem.degree} em {eduItem.fieldOfStudy}</h4>
                        <p className="text-xs text-stone-600 font-bold mt-0.5">{eduItem.institution}</p>
                        <p className="text-[10px] text-stone-400 font-mono mt-1 font-medium">{eduItem.startYear} - {eduItem.endYear}</p>
                        {eduItem.status && (
                          <span className="inline-block mt-2.5 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                            {eduItem.status === 'CONCLUIDO' && 'Concluído'}
                            {eduItem.status === 'EM_ANDAMENTO' && 'Em andamento'}
                            {eduItem.status === 'TRANCADO' && 'Trancado'}
                            {eduItem.status === 'INTERROMPIDO' && 'Interrompido'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">Nenhuma formação acadêmica registrada.</p>
                )}

                {/* Add Education form */}
                {showEduForm && (
                  <div className="bg-stone-50/50 rounded-2xl p-5 border border-stone-200 space-y-4 font-sans text-stone-700">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                      {editingEduIndex !== null ? 'Editar Formação Acadêmica' : 'Adicionar Formação Acadêmica'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-full">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Instituição / Escola *</label>
                        <input
                          type="text"
                          value={eduInstitution}
                          onChange={(e) => setEduInstitution(e.target.value)}
                          placeholder="Ex: USP, Etec, Escola Estadual"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Grau / Nível Acadêmico *</label>
                        <input
                          type="text"
                          value={eduDegree}
                          onChange={(e) => setEduDegree(e.target.value)}
                          placeholder="Ex: Graduação, Ensino Médio, Tecnólogo"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Curso / Área de Estudo</label>
                        <input
                          type="text"
                          value={eduFieldOfStudy}
                          onChange={(e) => setEduFieldOfStudy(e.target.value)}
                          placeholder="Ex: Administração de Empresas, Informática"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Ano de Início *</label>
                        <input
                          type="text"
                          value={eduStartYear}
                          onChange={(e) => setEduStartYear(e.target.value)}
                          placeholder="Ex: 2018"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Status da Formação Acadêmica *</label>
                        <select
                          value={eduStatus}
                          onChange={(e) => setEduStatus(e.target.value as any)}
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs bg-white"
                        >
                          <option value="CONCLUIDO">Concluído</option>
                          <option value="EM_ANDAMENTO">Em andamento</option>
                          <option value="TRANCADO">Trancado</option>
                          <option value="INTERROMPIDO">Interrompido</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Ano de Conclusão / Término</label>
                        <input
                          type="text"
                          value={eduEndYear}
                          disabled={eduStatus === 'EM_ANDAMENTO'}
                          onChange={(e) => setEduEndYear(e.target.value)}
                          placeholder={eduStatus === 'EM_ANDAMENTO' ? 'Em andamento' : 'Ex: 2022'}
                          className={`w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs ${eduStatus === 'EM_ANDAMENTO' ? 'bg-stone-100 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEduForm(false);
                          setEditingEduIndex(null);
                        }}
                        className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={addEducation}
                        className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        {editingEduIndex !== null ? 'Salvar Alterações' : 'Salvar Formação'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Courses & Certifications Section */}
              <div className="space-y-4 pt-4">
                <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                  <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-terracotta-600" />
                    Cursos Livres e Certificações
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCourseIndex(null);
                      setCourseName('');
                      setCourseInstitution('');
                      setCourseYear('');
                      setShowCourseForm(!showCourseForm);
                    }}
                    className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Novo Curso
                  </button>
                </div>

                {/* Courses list */}
                {courses.length > 0 ? (
                  <div className="space-y-4">
                    {courses.map((courseItem, idx) => (
                      <div key={idx} className="bg-stone-50 border border-stone-200/80 p-5 rounded-2xl relative group">
                        <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => editCourse(idx)}
                            className="p-1.5 bg-white text-stone-600 hover:text-stone-955 rounded-lg border border-stone-200 hover:border-stone-300 shadow-xs transition-colors"
                            title="Editar curso"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCourse(idx)}
                            className="p-1.5 bg-white text-stone-400 hover:text-red-500 rounded-lg border border-stone-200 hover:border-stone-300 shadow-xs transition-colors"
                            title="Remover curso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <h4 className="font-serif font-bold text-stone-950 text-sm">{courseItem.name}</h4>
                        <p className="text-xs text-stone-600 font-bold mt-0.5">{courseItem.institution}</p>
                        <p className="text-[10px] text-stone-400 font-mono mt-1 font-medium">{courseItem.year}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">Nenhum curso ou certificação registrado.</p>
                )}

                {/* Add Course form */}
                {showCourseForm && (
                  <div className="bg-stone-50/50 rounded-2xl p-5 border border-stone-200 space-y-4 font-sans text-stone-700">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                      {editingCourseIndex !== null ? 'Editar Curso ou Certificação' : 'Adicionar Curso ou Certificação'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-full">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome do Curso / Certificado *</label>
                        <input
                          type="text"
                          value={courseName}
                          onChange={(e) => setCourseName(e.target.value)}
                          placeholder="Ex: Scrum Master, Python para Análise de Dados"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Instituição Organizadora</label>
                        <input
                          type="text"
                          value={courseInstitution}
                          onChange={(e) => setCourseInstitution(e.target.value)}
                          placeholder="Ex: Alura, Udemy, Coursera"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Ano de Conclusão</label>
                        <input
                          type="text"
                          value={courseYear}
                          onChange={(e) => setCourseYear(e.target.value)}
                          placeholder="Ex: 2023"
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:border-terracotta-500 outline-none text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCourseForm(false);
                          setEditingCourseIndex(null);
                        }}
                        className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={addCourse}
                        className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        {editingCourseIndex !== null ? 'Salvar Alterações' : 'Salvar Curso'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Submit Action Button */}
          <div className="flex justify-end pt-5 border-t border-stone-100">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-stone-900 hover:bg-stone-850 text-white px-10 py-4 rounded-xl font-bold transition-all disabled:opacity-50 text-sm shadow-xs cursor-pointer"
            >
              {loading ? 'Salvando Perfil Completo...' : 'Salvar Meu Perfil Completo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
