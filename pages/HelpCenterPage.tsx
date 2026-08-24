import React, { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, asArray } from "../lib/api";

type Faq = { id: string; slug: string; title: string; summary: string; body: string; publishedAt?: string | null };

export default function HelpCenterPage() {
  const { slug } = useParams();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [article, setArticle] = useState<Faq | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.get(slug ? `/help/faqs/${slug}` : "/help/faqs")
      .then((response) => slug ? setArticle(response.data) : setFaqs(asArray<Faq>(response.data)))
      .catch((requestError: any) => setError(requestError?.response?.data?.message || "Não foi possível carregar a Central de Ajuda."))
      .finally(() => setLoading(false));
  }, [slug]);

  const filtered = faqs.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="min-h-screen bg-[#f7f2ed] text-stone-900"><header className="border-b border-stone-200 bg-[#fffdfa]"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><Link to="/"><img src="/brand/logo-horizontal-terracotta.png" alt="PiraNegócios" className="h-9 w-auto" /></Link><Link to="/login" className="rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white">Entrar</Link></div></header><main className="mx-auto max-w-5xl px-5 py-10">{loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : article ? <article className="mx-auto max-w-3xl"><Link to="/ajuda" className="inline-flex items-center gap-1 text-xs font-bold text-terracotta-700"><ArrowLeft className="h-4 w-4" /> Central de Ajuda</Link><div className="mt-5 rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm md:p-10"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><BookOpen className="h-5 w-5" /></span><h1 className="mt-5 font-serif text-3xl font-bold md:text-4xl">{article.title}</h1><p className="mt-3 text-base leading-7 text-stone-500">{article.summary}</p><div className="mt-8 whitespace-pre-wrap border-t border-stone-100 pt-7 text-sm leading-7 text-stone-700">{article.body}</div></div></article> : <><div className="mx-auto max-w-2xl text-center"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><BookOpen className="h-6 w-6" /></span><h1 className="mt-4 font-serif text-4xl font-bold">Central de Ajuda</h1><p className="mt-2 text-sm leading-6 text-stone-500">Respostas construídas a partir das dúvidas mais frequentes de quem usa o PiraNegócios.</p><label className="mt-6 flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 shadow-sm"><Search className="h-4 w-4 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque uma dúvida..." className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none" /></label></div><section className="mt-10 grid gap-3 md:grid-cols-2">{filtered.map((item) => <Link key={item.id} to={`/ajuda/${item.slug}`} className="group rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200"><h2 className="font-bold text-stone-900 group-hover:text-violet-800">{item.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-500">{item.summary}</p><span className="mt-4 inline-block text-[10px] font-black uppercase tracking-wide text-terracotta-700">Ler resposta</span></Link>)}{filtered.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">Nenhuma resposta encontrada.</div>}</section></>}</main></div>;
}
