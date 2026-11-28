#!/usr/bin/env bash
# Junta os arquivos .gs em um único arquivo para colar no editor do Apps Script.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
out=dist/NexusRadar.gs
{
  echo "// NEXUS RADAR — Oportunidades Públicas Hospitalares"
  echo "// Arquivo único gerado por build.sh em $(date -u +%Y-%m-%d). Cole TODO o conteúdo no arquivo Código.gs do Apps Script."
  for f in Config Http CatalogData Catalog Classify Pncp Store Report Main; do
    echo; echo "// ======================= $f.gs ======================="
    cat "apps-script/$f.gs"
  done
} > "$out"
cp apps-script/appsscript.json dist/appsscript.json
node -e "new Function(require('fs').readFileSync('$out','utf8'))" && echo "OK: $out ($(wc -l < "$out") linhas, sintaxe válida)"
