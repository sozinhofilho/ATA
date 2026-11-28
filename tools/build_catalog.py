"""Gera apps-script/CatalogData.gs a partir do catálogo RENEM coletado em equipamentosrenem.com.br.

Agrupa variações do mesmo equipamento (Adulto/Infantil/Obeso, Elétrico/Mecânico, para Telessaúde...)
num único produto de busca, com todos os códigos RENEM do grupo. Acrescenta sinônimos de uso comum.
Uso: python3 tools/build_catalog.py data/renem_catalogo_AAAA-MM-DD.json
"""
import json, re, sys, unicodedata, csv

SRC = sys.argv[1]
items = json.load(open(SRC, encoding='utf-8'))

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', s)).strip()

TRAIL_WORDS = {'adulto', 'infantil', 'pediatrica', 'pediatrico', 'obeso', 'obesos', 'eletrica', 'eletrico',
               'mecanica', 'mecanico', 'movel', 'portatil', 'simples', 'avancado', 'estacionaria',
               'convencional', 'basico', 'basica', 'digital', 'fixo', 'analogico', 'tipo', 'fawler'}
KEEP_FULL = {'bisturi', 'balanca', 'carro'}
TRAIL_PHRASES = ['para telessaude', 'paratelessaude', 'para ressonancia magnetica', 'para uti',
                 'para centro cirurgico', 'para obesos', 'para obeso', 'para unidade movel de urgencia',
                 'com monitor multiparametros', 'com monitor grafico', 'tipo fawler']

def core(name):
    """Nome-base do equipamento, preservando acentos do original."""
    s = re.sub(r'\(.*?\)', ' ', name)
    s = re.split(r'(?i)\s+aquisi[cç][aã]o por preg[aã]o', s)[0]
    s = s.replace('/', ' / ')
    toks = [t for t in re.split(r'\s+', s.strip()) if t]
    if norm(name).startswith('autoclave'):
        return 'Autoclave'
    if norm(name).startswith('aparelho de raios x fixo') or norm(name).startswith('aparelho de raios x movel'):
        return 'Aparelho de Raios X'
    changed = True
    while changed and len(toks) > 1:
        changed = False
        while toks and norm(toks[-1]) in ('', '-', '/'):
            toks.pop(); changed = True
        n = norm(' '.join(toks))
        for ph in TRAIL_PHRASES:
            if n.endswith(' ' + ph):
                k = len(ph.split())
                toks = toks[:-k]; changed = True; break
        else:
            if len(toks) > 1 and norm(toks[-1]) in TRAIL_WORDS:
                rest = toks[:-1]
                # não deixa o nome terminando em conector ("Carro para") nem genérico demais ("Bisturi")
                if norm(rest[-1]) in ('para', 'de', 'do', 'da', 'com', 'e', 'em', 'tipo') or norm(' '.join(rest)) in KEEP_FULL:
                    break
                toks = rest; changed = True
    out = ' '.join(toks).replace(' / ', '/').strip(' -/')
    return out

# Sinônimos de uso comum em editais, por nome-base normalizado.
SYN = {
    'cama hospitalar': 'cama fowler; cama hospitalar fowler; leito hospitalar; cama hospitalar eletrica; cama hospitalar manual; cama de uti; cama para uti; cama hospitalar infantil; cama hospitalar bariatrica',
    'cama ppp': 'cama de parto; cama para parto; cama pre parto parto e pos parto',
    'berco hospitalar com grades': 'berco hospitalar; bercinho hospitalar; berco infantil hospitalar',
    'berco para recem nascido': 'berco acrilico; berco de acrilico; bercario',
    'carro maca': 'maca hospitalar; maca de transporte; maca retratil; maca com grades; maca hidraulica; maca para transporte; maca de emergencia; maca para remocao; maca articulada; maca fixa',
    'carro de emergencia': 'carrinho de emergencia; carro de parada; carro para emergencia; carro de urgencia; carro de urgencia e emergencia',
    'carro de curativos': 'carrinho de curativo; carro de curativo; carro para curativo; carrinho para curativo',
    'mesa de cabeceira': 'mesa de cabeceira hospitalar; criado mudo hospitalar',
    'mesa de cabeceira com refeicao acoplada': 'mesa de refeicao para leito; mesa de refeicao hospitalar; mesa para refeicao no leito',
    'mesa ginecologica': 'mesa para exame ginecologico; maca ginecologica; mesa de parto',
    'mesa de exames': 'mesa de exame; mesa de exame clinico; mesa clinica; mesa para exame clinico; maca para exame; maca para exames; maca clinica',
    'mesa auxiliar': 'mesa auxiliar hospitalar; mesa auxiliar inox; mesa auxiliar em aco inox; mesa para instrumental',
    'diva': 'diva clinico; diva para exame; diva para exames; diva de exame',
    'biombo': 'biombo hospitalar; biombo triplo; biombo duplo',
    'escada com 2 degraus': 'escada 2 degraus; escada com dois degraus; escadinha 2 degraus; escadinha hospitalar; escada de dois degraus',
    'suporte de soro': 'suporte para soro; haste de soro; suporte de soro com rodizios',
    'mocho': 'mocho giratorio; mocho clinico; mocho hospitalar',
    'armario vitrine': 'armario vitrine hospitalar',
    'foco refletor ambulatorial': 'foco clinico; foco de luz auxiliar; luminaria de exame; foco auxiliar',
    'poltrona hospitalar': 'poltrona de acompanhante; poltrona para acompanhante; poltrona reclinavel hospitalar; poltrona hospitalar reclinavel; poltrona de hemodialise; poltrona para hemodialise; poltrona para quimioterapia',
    'sofa cama hospitalar': 'sofa cama para acompanhante',
    'cadeira de rodas': 'cadeira de rodas para obeso; cadeira de rodas obeso; cadeira de rodas infantil',
    'cadeira de banho higienica': 'cadeira higienica; cadeira para banho; cadeira de banho',
    'cadeira para coleta de sangue': 'poltrona de coleta; poltrona para coleta; cadeira de coleta',
    'balanca antropometrica': 'balanca pediatrica; balanca antropometrica digital; balanca digital pediatrica; balanca com regua antropometrica',
    'monitor multiparametros': 'monitor multiparametrico; monitor multiparametro; monitor multiparamentro; monitor cardiaco',
    'monitor de sinais vitais': 'monitor de sinais vitais',
    'bomba de infusao': 'bomba infusora; bomba de infusao volumetrica; bomba de infusao peristaltica',
    'bomba de infusao de seringa': 'bomba de seringa',
    'ventilador pulmonar': 'ventilador mecanico; respirador pulmonar; ventilador de transporte; ventilador pulmonar de transporte',
    'desfibrilador': 'desfibrilador cardioversor; desfibrilador bifasico',
    'dea desfibrilador externo automatico': 'desfibrilador externo automatico; dea',
    'eletrocardiografo': 'aparelho de eletrocardiograma; ecg de 12 canais',
    'aspirador de secrecoes': 'aspirador de secrecao; aspirador cirurgico; aspirador de secrecao portatil',
    'esfigmomanometro': 'aparelho de pressao arterial; aparelho de pressao; tensiometro',
    'incubadora neonatal': 'incubadora para recem nascido; incubadora para rn; incubadora infantil',
    'camara para conservacao de imunobiologicos': 'camara de conservacao de vacinas; camara para conservacao de vacinas; camara fria para vacinas; refrigerador para vacinas; camara de vacinas',
    'aparelho para fototerapia': 'fototerapia; aparelho de fototerapia',
    'lavadora de roupas hospitalar': 'lavadora hospitalar; lavadora de barreira; lavadora hospitalar de roupas',
    'secadora de roupas hospitalar': 'secadora hospitalar; secadora rotativa hospitalar',
    'oximetro de pulso': 'oximetro portatil; oximetro de dedo',
    'reanimador pulmonar manual': 'ambu; reanimador manual',
    'detector fetal': 'sonar doppler; doppler fetal; sonar fetal',
    'nebulizador': 'nebulizador ultrassonico',
    'concentrador de oxigenio': 'concentrador de o2',
    'mesa cirurgica': 'mesa operatoria',
    'bisturi eletrico': 'eletrocauterio; unidade eletrocirurgica',
    'cadeira odontologica completa': 'cadeira odontologica; consultorio odontologico completo',
}
APOIO_NAO_SAUDE = {'agogo', 'cavaquinho', 'chocalho', 'flauta', 'pandeiro', 'reco reco', 'violao', 'violino', 'triangulo',
                   'videogame', 'piscina de bolinhas', 'conjunto de bancos coloridos', 'cavalete de pintura',
                   'cama comum', 'desumidificador', 'monitor de video', 'switch de 100gb', 'rack para servidores genomicos',
                   'radio comunicador maritimo', 'registrador de ponto eletronico', 'gravador de audio digital',
                   'fone de ouvido monoauricular', 'expansor de audio', 'receptor quadruplo sem fio digital',
                   'sistema de retorno de audio sem fio', 'processador de audio', 'sensor inercial', 'no break de 20kva',
                   'cilindro de co2', 'seladora', 'trapezio', 'triangulo', 'papagaio', 'comadre', 'tambor', 'diapasao', 'disco flexor', 'prensa hidraulica', 'chapa aquecedora', 'luminaria flexivel de mesa com lupa'}
GENERIC_SINGLE = {'balanca', 'cadeira', 'mesa', 'armario', 'monitor', 'estante', 'escada', 'bancada', 'nebulizador',
                  'arquivo', 'banqueta', 'longarina', 'fogao', 'televisor', 'telefone', 'tablet', 'scanner', 'microfone'}
# Itens da categoria "Gerais" que são mobiliário clínico/hospitalar (não exigem contexto de saúde).
GERAIS_CLINICOS = re.compile(r'hospitalar|cme|cabeceira|^diva$|^mocho$|vitrine|escada com 2|perfurocortante|trocador de fraldas|mesa para consultorio|cadeira para obeso|balde a pedal|mesa auxiliar')
AMBUL_RE = re.compile(r'ambulancia|samu|unidade movel|transporte sanitario|unidade odontologica movel|transporte adaptado')

groups = {}
for it in items:
    c = core(it['nome'])
    k = norm(c)
    g = groups.setdefault(k, {'core': c, 'cats': [], 'codes': [], 'names': [], 'urls': []})
    g['cats'].append(it['cat']); g['codes'].append(it['cod']); g['names'].append(it['nome']); g['urls'].append(it['url'])

all_keys = set(groups)
all_names = {norm(n) for g in groups.values() for n in g['names']}
rows = []
for k, g in sorted(groups.items(), key=lambda kv: (kv[1]['cats'][0], kv[0])):
    cat = max(set(g['cats']), key=g['cats'].count)
    syn = [s.strip() for s in SYN.get(k, '').split(';') if s.strip()]
    # remove sinônimos que são o nome de outro grupo (evita produto duplicado)
    syn = [s for s in syn if norm(s) == k or (norm(s) not in all_keys - {k} and norm(s) not in all_names - {norm(n) for n in g['names']})]
    syn = [s for s in syn if norm(s) != k]
    req = ((cat in ('Gerais', 'Infraestrutura', 'Item Industrial Não Hospitalar') and not GERAIS_CLINICOS.search(k))
           or (cat == 'Veículo' and not AMBUL_RE.search(k))
           or k in APOIO_NAO_SAUDE or (len(k.split()) == 1 and k in GENERIC_SINGLE))
    full = [n for n in g['names'] if norm(re.sub(r'\(.*?\)', ' ', n)) != k]
    rows.append({'categoria': cat, 'produto': g['core'], 'codigos': '; '.join(g['codes']),
                 'sinonimos': '; '.join(syn), 'nomes': '; '.join(dict.fromkeys(re.sub(r'\s*\(.*?\)', '', n).strip() for n in full)),
                 'exige': 'SIM' if req else 'NÃO', 'url': g['urls'][0] if len(g['urls']) == 1 else ''})
for i, r in enumerate(rows):
    r['id'] = 'RENEM-%03d' % (i + 1)
# Família genérica (oportunidade contextual), sem código.
rows.append({'id': 'CTX-001', 'categoria': 'Genérico hospitalar', 'produto': 'Mobiliário/equipamento hospitalar (genérico)', 'codigos': '',
             'sinonimos': 'mobiliario hospitalar; moveis hospitalares; equipamento hospitalar; equipamentos hospitalares; equipamento medico hospitalar; equipamentos medico hospitalares; equipamento medico assistencial; equipamentos medicos; material permanente hospitalar; mobiliario clinico; equipamentos para ubs; equipamentos para upa; ambulancia; ambulancias',
             'nomes': '', 'exige': 'NÃO', 'url': ''})

for k in SYN:
    if k not in groups:
        print('AVISO: sinônimos sem grupo:', k)

def js(s): return json.dumps(s, ensure_ascii=False)
with open('apps-script/CatalogData.gs', 'w', encoding='utf-8') as f:
    f.write('/**\n * CatalogData.gs: catálogo RENEM (Relação Nacional de Equipamentos e Materiais Permanentes financiáveis\n'
            ' * para o SUS) conforme equipamentosrenem.com.br/catalogo, coletado em ' + SRC.split('_')[-1].replace('.json', '') + '\n'
            ' * (840 itens, tabela FNS de 03/03/2026), agrupado em ' + str(len(rows)) + ' produtos de busca.\n'
            ' * Gerado por tools/build_catalog.py. Não edite à mão: edite a aba CATALOGO da planilha.\n *\n'
            ' * [ID, Categoria, Produto, Códigos RENEM, Sinônimos, Nomes RENEM das variações, Exige contexto de saúde]\n */\n')
    f.write('var RENEM_CATALOG = [\n')
    f.write(',\n'.join('  [' + ', '.join(js(r[x]) for x in ['id', 'categoria', 'produto', 'codigos', 'sinonimos', 'nomes', 'exige']) + ']' for r in rows))
    f.write('\n];\n')
with open('docs/catalogo_renem.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['ID', 'Categoria', 'Produto', 'Códigos RENEM', 'Sinônimos', 'Variações RENEM', 'Exige contexto de saúde'])
    for r in rows: w.writerow([r[x] for x in ['id', 'categoria', 'produto', 'codigos', 'sinonimos', 'nomes', 'exige']])
print(len(items), 'itens ->', len(rows), 'produtos;', sum(r['exige'] == 'SIM' for r in rows), 'exigem contexto de saúde')
