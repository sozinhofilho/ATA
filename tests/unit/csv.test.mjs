import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv, detectSeparator } from '../../scripts/lib/csv.mjs';

test('lê CSV com aspas, vírgulas e quebras de linha dentro do campo', () => {
  const { header, records } = parseCsv('id,nome,descricao\n1,"Cama, Fowler","linha 1\nlinha 2"\n2,Maca,"aspas ""duplas"""\n');
  assert.deepEqual(header, ['id', 'nome', 'descricao']);
  assert.equal(records.length, 2);
  assert.equal(records[0].nome, 'Cama, Fowler');
  assert.equal(records[0].descricao, 'linha 1\nlinha 2');
  assert.equal(records[1].descricao, 'aspas "duplas"');
  assert.equal(records[0].__linha, 2);
});

test('detecta ponto e vírgula (Excel em português) e remove BOM', () => {
  const txt = '﻿id;nome\n1;Berço\n';
  assert.equal(detectSeparator(txt), ';');
  const { header, records } = parseCsv(txt);
  assert.deepEqual(header, ['id', 'nome']);
  assert.equal(records[0].nome, 'Berço');
});

test('ignora linhas vazias e faz ida e volta com toCsv', () => {
  const csv = toCsv(['a', 'b'], [{ a: 'x,y', b: 'z' }, { a: '', b: '' }]);
  const { records } = parseCsv(csv + '\n\n');
  assert.equal(records.length, 1);
  assert.equal(records[0].a, 'x,y');
});
