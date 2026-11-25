// Links oficiais de abertura de conversa (wa.me). Nenhuma mensagem é enviada automaticamente:
// o texto é apenas preenchido e o visitante decide se deseja enviá-lo.
// O número fica centralizado em src/config/site.json (contato.whatsapp).
import { contato, marca } from './site';

export function waLink(message: string): string {
  const numero = String(contato.whatsapp).replace(/\D/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

export const mensagens = {
  geral: () =>
    `Olá! Acessei o site da ${marca.nome} e gostaria de consultar informações sobre equipamentos hospitalares e possibilidades de fornecimento por atas.`,

  produto: (nome: string, url: string, renem?: string) =>
    `Olá! Tenho interesse no equipamento ${nome}${renem ? `, código RENEM ${renem}` : ''}.\n\n` +
    `Gostaria de consultar especificações, disponibilidade comercial e possibilidade de fornecimento por Ata de Registro de Preços.\n\n` +
    `Produto: ${url}`,

  produtoAta: (nome: string, url: string, renem?: string) =>
    `Olá! Gostaria de consultar a disponibilidade em Ata de Registro de Preços do equipamento ${nome}${renem ? ` (RENEM ${renem})` : ''}.\n\nProduto: ${url}`,

  produtoDocumentacao: (nome: string, url: string, renem?: string) =>
    `Olá! Gostaria de solicitar a documentação técnica (ficha técnica, manual e regularização sanitária, quando aplicável) do equipamento ${nome}${renem ? ` (RENEM ${renem})` : ''}.\n\nProduto: ${url}`,

  categoria: (categoria: string) =>
    `Olá! Gostaria de consultar equipamentos da categoria ${categoria} para uma aquisição pública.`,

  atas: () =>
    `Olá! Gostaria de consultar as Atas de Registro de Preços disponíveis para aquisição de mobiliário e equipamentos hospitalares.`,

  ataEspecifica: (numero: string, orgao: string) =>
    `Olá! Gostaria de consultar as condições da Ata de Registro de Preços nº ${numero} (${orgao}).`,

  solucao: (tipoUnidade: string) =>
    `Olá! Gostaria de receber informações sobre equipamentos relacionados à estruturação de ${tipoUnidade}.`,

  lista: () =>
    `Olá! Gostaria de enviar uma lista de equipamentos para consulta de especificações e possibilidades de fornecimento.`,
};
