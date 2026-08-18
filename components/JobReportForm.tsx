import React, { FormEvent, useState } from "react";
import { Flag } from "lucide-react";
import { api } from "../lib/api";

export function JobReportForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post(`/jobs/${jobId}/reports`, { reason, details });
      setMessage("Alerta recebido. Vamos revisar esta vaga.");
      setOpen(false);
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Não foi possível registrar o alerta agora.",
      );
    }
  };
  if (message) return <p className="mt-4 text-sm text-stone-500">{message}</p>;
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-red-700"
      >
        <Flag className="h-4 w-4" /> Reportar esta vaga
      </button>
    );
  return (
    <form
      onSubmit={submit}
      className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm"
    >
      <label className="block font-bold text-stone-700">
        Qual é o problema?
      </label>
      <select
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
      >
        <option value="">Selecione...</option>
        <option value="VAGA_INEXISTENTE">A vaga não existe mais</option>
        <option value="PROCESSO_ENCERRADO">
          O processo seletivo foi encerrado
        </option>
        <option value="INFORMACAO_INCORRETA">Informações incorretas</option>
        <option value="GOLPE_OU_FRAUDE">Suspeita de golpe ou fraude</option>
        <option value="OUTRO">Outro</option>
      </select>
      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Detalhes opcionais"
        className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
      />
      <div className="mt-2 flex gap-2">
        <button className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">
          Enviar alerta
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-xs font-bold text-stone-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
