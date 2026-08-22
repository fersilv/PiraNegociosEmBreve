import React from 'react';
import { Navbar } from '../components/Navbar';
import { ShieldCheck, Lock, FileText, Scale, Accessibility } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-24">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 bg-stone-100 text-stone-600 px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase mb-6">
            <ShieldCheck className="w-4 h-4" /> Conformidade LGPD
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6 tracking-tight">
            Termos de Uso e Política de Privacidade
          </h1>
          <p className="text-xl text-stone-500 max-w-2xl mx-auto leading-relaxed">
            Transparência e segurança no tratamento dos seus dados.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-stone-200 prose prose-stone max-w-none">
          <div className="flex items-start gap-4 mb-8">
            <div className="bg-terracotta-100 p-3 rounded-xl text-terracotta-600 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold mt-0 mb-2">1. Aceitação dos Termos</h2>
              <p className="text-stone-600 leading-relaxed mb-0">
                Ao acessar e utilizar o PiraNegócios, você concorda expressamente com os Termos de Uso e a Política de Privacidade aqui descritos. O uso continuado da plataforma implica na aceitação de quaisquer atualizações ou modificações nestes termos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-8">
            <div className="bg-terracotta-100 p-3 rounded-xl text-terracotta-600 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold mt-0 mb-2">2. Proteção de Dados (LGPD)</h2>
              <p className="text-stone-600 leading-relaxed mb-0">
                Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), adotamos medidas de minimização e controle de acesso aos dados utilizados na plataforma.
              </p>
              <ul className="text-stone-600 mt-2 list-disc pl-5 space-y-1">
                <li>Dados de perfil profissional são tratados para funcionamento dos recursos de recrutamento, candidatura e banco de talentos.</li>
                <li>Currículos e dados profissionais do banco de talentos só são disponibilizados a empresas verificadas e autorizadas.</li>
                <li>Você pode solicitar retificação ou exclusão dos seus dados e alterar preferências fornecidas à plataforma.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-8">
            <div className="bg-violet-100 p-3 rounded-xl text-violet-700 shrink-0">
              <Accessibility className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold mt-0 mb-2">3. Autodeclaração PcD e dados sensíveis</h2>
              <p className="text-stone-600 leading-relaxed mb-0">
                A informação sobre eventual condição de pessoa com deficiência (PcD) é opcional e tratada como dado pessoal sensível. Quando o usuário escolhe fornecê-la, o PiraNegócios solicita consentimento específico e destacado para armazenar a autodeclaração e, se informado, apenas o status de existência de documentação comprobatória.
              </p>
              <ul className="text-stone-600 mt-2 list-disc pl-5 space-y-1">
                <li>Não solicitamos diagnóstico, CID, descrição da deficiência ou upload de laudo nesse campo.</li>
                <li>A informação é utilizada para personalizar a exibição de oportunidades PcD e não reduz a visibilidade do usuário em vagas gerais.</li>
                <li>A autodeclaração e o status de documentação não são disponibilizados no banco de talentos das empresas.</li>
                <li>O usuário pode retirar essa autorização escolhendo a opção “Prefiro não informar”, deixando de utilizar esses dados para personalização futura.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-8">
            <div className="bg-terracotta-100 p-3 rounded-xl text-terracotta-600 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold mt-0 mb-2">4. Uso por Empresas</h2>
              <p className="text-stone-600 leading-relaxed mb-0">
                O acesso ao Banco de Talentos é restrito a empresas verificadas. Ao utilizar esse recurso, a empresa se compromete a:
              </p>
              <ul className="text-stone-600 mt-2 list-disc pl-5 space-y-1">
                <li>Utilizar os dados dos candidatos estritamente para finalidades legítimas de recrutamento e seleção.</li>
                <li>Não compartilhar, vender ou distribuir informações dos candidatos a terceiros sem fundamento legal adequado.</li>
                <li>Não utilizar dados pessoais para práticas discriminatórias ou incompatíveis com a legislação trabalhista e de proteção à pessoa com deficiência.</li>
                <li>Cumprir as obrigações aplicáveis da LGPD em suas próprias operações.</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-200 mt-12">
            <p className="text-sm text-stone-400 text-center">
              Última atualização: Agosto de 2026. Em caso de dúvidas, entre em contato conosco através do suporte técnico.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
