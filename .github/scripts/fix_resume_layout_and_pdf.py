from pathlib import Path
import re

repo = Path('.')
workspace_path = repo / 'pages/ResumeWorkspace.tsx'
builder_path = repo / 'pages/ResumeBuilderPage.tsx'
studio_path = repo / 'pages/ResumeBuilderStudio.tsx'
wrapper_path = repo / 'components/resume-templates/TemplateWrapper.tsx'
template_paths = [
    repo / 'components/resume-templates/CreativeTemplate.tsx',
    repo / 'components/resume-templates/ModernTemplate.tsx',
    repo / 'components/resume-templates/ClassicTemplate.tsx',
    repo / 'components/resume-templates/MinimalistTemplate.tsx',
]

workspace = workspace_path.read_text()
builder = builder_path.read_text()
studio = studio_path.read_text()
wrapper = wrapper_path.read_text()

# 1) ResumeWorkspace must not draw a second navigation above ResumeBuilderStudio.
nav_start = workspace.find('      <div className="resume-workflow-nav sticky top-0')
resume_stage = workspace.find('      {stage === "resume" && (')
if nav_start != -1 and resume_stage != -1 and nav_start < resume_stage:
    workspace = workspace[:nav_start] + workspace[resume_stage:]

# Remove the large draft/publication status strip from the editing surface.
status_block = re.compile(
    r'''\n          <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5">[\s\S]*?\n          </div>\n          <ResumeBuilderStudio />''',
    re.M,
)
workspace, status_count = status_block.subn('\n          <ResumeBuilderStudio />', workspace, count=1)
if status_count == 0:
    print('INFO: faixa externa de status já parecia removida.')

# 2) Documento-base must be the final tool in the preview sidebar.
source_start_marker = '              <section className="rounded-2xl border border-white/10 bg-white/[.055] p-4 text-white">\n'
source_start = builder.find(source_start_marker)
if source_start != -1:
    source_end = builder.find('              </section>\n\n', source_start)
    if source_end == -1:
        raise SystemExit('Não consegui localizar o fim do painel Documento-base.')
    source_end += len('              </section>\n\n')
    source_panel = builder[source_start:source_end]
    builder = builder[:source_start] + builder[source_end:]

    sidebar_close = builder.find('            </div>\n          </aside>', source_start)
    if sidebar_close == -1:
        raise SystemExit('Não consegui localizar o fim do menu lateral do preview.')
    builder = builder[:sidebar_close] + source_panel + builder[sidebar_close:]
else:
    print('INFO: painel Documento-base não encontrado na posição antiga.')

# Remove the old inline print rules. Print has one source of truth now.
builder = re.sub(
    r'''\n        <style dangerouslySetInnerHTML=\{\{ __html: `@media print \{[\s\S]*?` \}\} />''',
    '',
    builder,
    count=1,
)

# 3) One coherent print stylesheet. No competing 210mm/192mm rules.
print_marker = '      @media print {'
print_index = studio.find(print_marker)
if print_index != -1:
    style_tail = studio.find('    `}</style>', print_index)
    if style_tail == -1:
        raise SystemExit('Não consegui localizar o final do CSS do ResumeBuilderStudio.')
    new_print = '''      @media print {\n        @page {\n          size: A4 portrait;\n          margin: 10mm 10mm 14mm;\n        }\n\n        html, body {\n          margin: 0 !important;\n          padding: 0 !important;\n          background: white !important;\n          overflow: visible !important;\n          -webkit-print-color-adjust: exact !important;\n          print-color-adjust: exact !important;\n        }\n\n        .resume-studio-header,\n        .resume-studio-body #resume-builder-sidebar {\n          display: none !important;\n        }\n\n        .resume-studio,\n        .resume-studio-body,\n        .resume-studio-body #resume-builder-root,\n        .resume-studio-body #resume-preview-area {\n          display: block !important;\n          width: auto !important;\n          min-width: 0 !important;\n          max-width: none !important;\n          min-height: 0 !important;\n          height: auto !important;\n          margin: 0 !important;\n          padding: 0 !important;\n          border: 0 !important;\n          background: white !important;\n          overflow: visible !important;\n          box-shadow: none !important;\n        }\n\n        .resume-studio-body #resume-preview-area > div {\n          width: auto !important;\n          min-width: 0 !important;\n          max-width: none !important;\n          margin: 0 !important;\n          padding: 0 !important;\n          transform: none !important;\n          transform-origin: top left !important;\n          filter: none !important;\n        }\n      }\n'''
    studio = studio[:print_index] + new_print + studio[style_tail:]
else:
    print('INFO: bloco @media print do studio não encontrado.')

# 4) TemplateWrapper: allow natural pagination. Only small semantic blocks avoid page breaks.
wrapper = wrapper.replace(
'''        .resume-a4-document section,\n        .resume-a4-document .break-inside-avoid,\n        .resume-a4-document li {\n          break-inside: avoid;\n          page-break-inside: avoid;\n        }''',
'''        .resume-a4-document .break-inside-avoid,\n        .resume-a4-document .resume-experience-stage {\n          break-inside: avoid;\n          page-break-inside: avoid;\n        }'''
)

wrapper = wrapper.replace('            margin: 9mm 9mm 15mm !important;', '            margin: 10mm 10mm 14mm !important;')

wrapper = wrapper.replace(
'''          #resume-preview-area > div > .resume-a4-document,\n          .resume-a4-document {\n            width: 192mm !important;\n            min-width: 192mm !important;\n            max-width: 192mm !important;\n            min-height: 273mm !important;\n            margin: 0 !important;\n            padding: 0 !important;''',
'''          #resume-preview-area > div > .resume-a4-document,\n          .resume-a4-document {\n            width: 190mm !important;\n            min-width: 190mm !important;\n            max-width: 190mm !important;\n            min-height: 0 !important;\n            margin: 0 !important;\n            padding: 0 0 10mm !important;'''
)

wrapper = wrapper.replace(
'''          #resume-preview-area > div {\n            width: 192mm !important;\n            min-width: 192mm !important;\n            max-width: 192mm !important;\n          }''',
'''          #resume-preview-area > div {\n            width: 190mm !important;\n            min-width: 190mm !important;\n            max-width: 190mm !important;\n          }'''
)

wrapper = wrapper.replace(
'''          .resume-a4-document section,\n          .resume-a4-document .break-inside-avoid,\n          .resume-a4-document li,\n          .resume-a4-document article {\n            break-inside: avoid-page !important;\n            page-break-inside: avoid !important;\n          }''',
'''          .resume-a4-document .break-inside-avoid,\n          .resume-a4-document .resume-experience-stage {\n            break-inside: avoid-page !important;\n            page-break-inside: avoid !important;\n          }'''
)

wrapper = wrapper.replace(
'''          .resume-brand-footer {\n            position: fixed;\n            left: 0;\n            right: 0;\n            bottom: -10mm;\n            border-top-color: rgba(87, 72, 64, .12);\n            background: white;\n          }''',
'''          .resume-brand-footer {\n            position: absolute;\n            left: 0;\n            right: 0;\n            bottom: 1mm;\n            border-top-color: rgba(87, 72, 64, .10);\n            background: transparent;\n          }'''
)

# Help split visual cards cleanly when a long company spans two sheets.
if '.resume-experience-card {' not in wrapper:
    insertion = '''\n        .resume-experience-card {\n          -webkit-box-decoration-break: clone;\n          box-decoration-break: clone;\n        }\n'''
    wrapper = wrapper.replace('        .resume-a4-document h1,\n', insertion + '\n        .resume-a4-document h1,\n', 1)

# 5) Long companies may split; each individual role/stage stays together.
for template_path in template_paths:
    text = template_path.read_text()

    # Company containers in all four templates.
    text = text.replace('className="relative pl-5 border-l-2 break-inside-avoid"', 'className="resume-experience-card relative pl-5 border-l-2"')
    text = text.replace('className="bg-stone-50 rounded-2xl p-5 border border-stone-100 break-inside-avoid shadow-sm"', 'className="resume-experience-card bg-stone-50 rounded-2xl p-5 border border-stone-100 shadow-sm"')
    text = text.replace('className="break-inside-avoid">\n                    <div className="flex justify-between items-baseline mb-2 gap-4">', 'className="resume-experience-card">\n                    <div className="flex justify-between items-baseline mb-2 gap-4">')
    text = text.replace('className="grid grid-cols-12 gap-4 break-inside-avoid">\n                    <div className="col-span-3 text-xs text-stone-500 pt-1">{exp.startDate}', 'className="resume-experience-card grid grid-cols-12 gap-4">\n                    <div className="col-span-3 text-xs text-stone-500 pt-1">{exp.startDate}')

    # Individual stages are the atomic units that should not be sliced in half.
    text = text.replace('className="relative pl-4">\n                      {stages.length > 1', 'className="resume-experience-stage relative pl-4">\n                      {stages.length > 1')
    text = text.replace('className="relative pl-4 border-l-2" style={{ borderColor:', 'className="resume-experience-stage relative pl-4 border-l-2" style={{ borderColor:')
    text = text.replace('<div key={stage.id || stageIdx}>\n                          <div className="flex justify-between gap-4 items-baseline">', '<div key={stage.id || stageIdx} className="resume-experience-stage">\n                          <div className="flex justify-between gap-4 items-baseline">')
    text = text.replace('<div key={stage.id || stageIdx}>\n                            <div className="flex items-baseline justify-between gap-4">', '<div key={stage.id || stageIdx} className="resume-experience-stage">\n                            <div className="flex items-baseline justify-between gap-4">')

    template_path.write_text(text)

workspace_path.write_text(workspace)
builder_path.write_text(builder)
studio_path.write_text(studio)
wrapper_path.write_text(wrapper)

print('OK: uma única nav no editor, Documento-base no fim do sidebar e paginação/rodapé de impressão corrigidos.')
