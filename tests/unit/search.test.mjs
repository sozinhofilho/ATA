import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDoc, search, normalize, stem, tokenize } from '../../src/lib/search-core.mjs';

const items = [
  { id: '1', nome: 'Cama hospitalar tipo Fowler', renem: '1981', categoria: 'Mobiliário hospitalar', subcategoria: 'Camas Fowler', sinonimos: ['leito'], marca: 'Marca A' },
  { id: '2', nome: 'Cama hospitalar elétrica', categoria: 'Mobiliário hospitalar', subcategoria: 'Camas elétricas', sinonimos: ['leito elétrico'] },
  { id: '3', nome: 'Desfibrilador externo automático (DEA)', categoria: 'Urgência e emergência', sinonimos: ['AED'] },
  { id: '4', nome: 'Monitor multiparamétrico', renem: '673', categoria: 'Equipamentos médicos' },
  { id: '5', nome: 'Carro maca simples', renem: '1488', categoria: 'Macas e transporte' },
  { id: '6', nome: 'Esfigmomanômetro', catmat: '445566', categoria: 'Consultórios', sinonimos: ['aparelho de pressão'] },
  { id: '7', nome: 'Berço hospitalar', categoria: 'Maternidade', modelo: 'BX-200' },
  { id: '8', nome: 'Leito de observação', categoria: 'Mobiliário hospitalar' },
];
const docs = items.map(prepareDoc);
const ids = (q) => search(docs, q).map((r) => r.item.id);

test('normalização: acentos, maiúsculas e pontuação', () => {
  assert.equal(normalize('  BERÇO Hospitalar!! '), 'berco hospitalar');
  assert.equal(stem('camas'), 'cama');
  assert.equal(stem('colchões'.normalize('NFD').replace(/[̀-ͯ]/g, '')), 'colchao');
  assert.equal(stem('hospitalares'), 'hospitalar');
  assert.deepEqual(tokenize('Mesa de exames'), ['mesa', 'exame']);
});

test('"cama hospitalar" encontra camas e leitos', () => {
  const r = ids('cama hospitalar');
  assert.ok(r.includes('1') && r.includes('2') && r.includes('8'));
});
test('"Fowler" encontra a cama Fowler', () => assert.equal(ids('Fowler')[0], '1'));
test('código RENEM "1981" encontra o produto', () => assert.deepEqual(ids('1981'), ['1']));
test('código CATMAT encontra o produto', () => assert.deepEqual(ids('445566'), ['6']));
test('"DEA" e "aed" encontram desfibrilador', () => { assert.equal(ids('DEA')[0], '3'); assert.equal(ids('aed')[0], '3'); });
test('"monitor" encontra monitor', () => assert.equal(ids('monitor')[0], '4'));
test('"maca" e "MACAS" encontram o carro maca', () => { assert.equal(ids('maca')[0], '5'); assert.equal(ids('MACAS')[0], '5'); });
test('acentos: "berco" e "berços" encontram o berço', () => { assert.equal(ids('berco')[0], '7'); assert.equal(ids('berços')[0], '7'); });
test('sinônimo cadastrado: "aparelho de pressão"', () => assert.equal(ids('aparelho de pressão')[0], '6'));
test('erro de digitação: "desfibriladr"', () => assert.equal(ids('desfibriladr')[0], '3'));
test('marca e modelo', () => { assert.equal(ids('Marca A')[0], '1'); assert.equal(ids('bx-200')[0], '7'); });
test('categoria', () => assert.ok(ids('emergência').includes('3')));
test('consulta sem correspondência retorna vazio', () => assert.deepEqual(ids('xyzqwe'), []));
test('consulta vazia retorna vazio', () => assert.deepEqual(ids('  '), []));
