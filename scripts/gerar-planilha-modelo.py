#!/usr/bin/env python3
"""Gera docs/planilha-modelo/modelo-catalogo-produtos.xlsx a partir das definições de colunas do catálogo.
Uso: python3 scripts/gerar-planilha-modelo.py  (requer openpyxl)"""
import json, subprocess, csv, io, pathlib
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

root = pathlib.Path(__file__).resolve().parent.parent
cols = json.loads(subprocess.check_output(['node', '-e', "import('./scripts/lib/catalog-core.mjs').then(m=>console.log(JSON.stringify({c:m.COLUMNS,a:m.AMBIENTES,i:m.ILUSTRACOES})))"], cwd=root))
cats = json.loads((root / 'src/data/categories.json').read_text())
demo = list(csv.DictReader(io.StringIO((root / 'data/catalog/produtos.csv').read_text(encoding='utf-8'))))

wb = Workbook()
ws = wb.active; ws.title = 'Produtos'
NAVY, TEAL = '102E43', '087E8B'
for i, (name, typ, help_) in enumerate(cols['c'], 1):
    c = ws.cell(row=1, column=i, value=name)
    c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor=NAVY); c.alignment = Alignment(vertical='center')
    ws.column_dimensions[get_column_letter(i)].width = max(14, min(40, len(name) + 6))
ws.freeze_panes = 'C2'
# duas linhas de exemplo demonstrativo
for r, row in enumerate(demo[:2], 2):
    for i, (name, *_ ) in enumerate(cols['c'], 1): ws.cell(row=r, column=i, value=row.get(name, ''))
idx = {n: get_column_letter(i) for i, (n, *_ ) in enumerate(cols['c'], 1)}
def dv(col, values, prompt):
    v = DataValidation(type='list', formula1='"' + ','.join(values) + '"', allow_blank=True, showErrorMessage=True, promptTitle=col, prompt=prompt)
    v.add(f'{idx[col]}2:{idx[col]}2000'); ws.add_data_validation(v)
dv('status', ['rascunho', 'pendente', 'publicado', 'inativo'], 'Somente "publicado" aparece no site.')
for b in ['autorizacao_publicacao', 'demonstrativo', 'destaque', 'imagem_ilustrativa']: dv(b, ['sim', 'nao'], 'sim ou nao')
dv('disponibilidade_ata', ['confirmada', ''], 'Use "confirmada" somente com ata vigente cadastrada em atas.json.')
dv('categoria', [c['slug'] for c in cats], 'Slug da categoria (veja a aba Categorias).')

ins = wb.create_sheet('Instruções')
ins.column_dimensions['A'].width = 28; ins.column_dimensions['B'].width = 14; ins.column_dimensions['C'].width = 90
ins.append(['Coluna', 'Tipo', 'Como preencher'])
for c in ins[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor=TEAL)
tipos = {'text': 'texto', 'longtext': 'texto longo', 'list': 'lista (|)', 'bool': 'sim/nao', 'date': 'data', 'specs': 'pares (|)', 'url': 'caminho', 'code': 'número', 'enum': 'lista fixa'}
for name, typ, help_ in cols['c']: ins.append([name, tipos.get(typ, typ), help_])
ins.append([]); ins.append(['REGRAS', '', 'Só vão para o site linhas com status = publicado E autorizacao_publicacao = sim.'])
ins.append(['', '', 'Não inclua preços internos, margens, comissões, dados bancários ou pessoais: colunas fora desta lista são descartadas pelo importador.'])
ins.append(['', '', 'Deixe vazio o que não estiver confirmado pelo fornecedor (garantia, prazo, Anvisa, dimensões etc.). Campos vazios não aparecem no site.'])
ins.append(['', '', 'Exporte como CSV (Arquivo > Fazer download > CSV) e salve em data/catalog/produtos.csv. Veja docs/guia-catalogo.md.'])
ins.append(['Ambientes válidos', '', ', '.join(cols['a'].keys())])
ins.append(['Ilustrações', '', 'ilustracao:' + ', ilustracao:'.join(cols['i'])])

cs = wb.create_sheet('Categorias')
cs.append(['categoria (slug)', 'nome da categoria', 'subcategoria (slug)', 'nome da subcategoria'])
for c in cs[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor=TEAL)
for c in cats:
    for s in c['subcategorias']: cs.append([c['slug'], c['nome'], s['slug'], s['nome']])
for col, w in zip('ABCD', (30, 34, 36, 40)): cs.column_dimensions[col].width = w

out = root / 'docs/planilha-modelo/modelo-catalogo-produtos.xlsx'
wb.save(out)
# CSV-modelo apenas com cabeçalho
(root / 'docs/planilha-modelo/modelo-catalogo-produtos.csv').write_text(','.join(n for n, *_ in cols['c']) + '\n', encoding='utf-8')
print('ok', out)
