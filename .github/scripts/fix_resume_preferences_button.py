from pathlib import Path

path = Path('pages/ResumeWorkspace.tsx')
text = path.read_text()
old = '<button type="button" onClick={() => setStage("preferences")} className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-600">Revisar preferências</button>'
if old not in text:
    raise SystemExit('Botão residual de preferências não encontrado; nenhuma alteração aplicada.')
path.write_text(text.replace(old, '', 1))
print('OK: botão residual Revisar preferências removido. Preferências permanecem apenas dentro do wizard do currículo.')
