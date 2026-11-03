// Modo privacidade: o que um valor em dinheiro mostra nos ecrãs da app.
//
// Pedido de uma utilizadora: ao abrir a app em público, o valor a receber
// aparecia em grande. Com o modo ligado, TODO o dinheiro dos ecrãs (página
// inicial, Dashboard, lista de projetos) passa a "€ ••••". Horas e contagens
// ficam visíveis — não são o que incomoda mostrar. A folha/PDF não muda.
//
// Três estados, não dois: enquanto a preferência guardada no aparelho ainda
// não foi lida ("unknown") não se sabe se o modo está ligado, e mostrar o valor
// nesse intervalo era precisamente o que o pedido quer evitar. Mostrar a
// máscara também não serve: quem tem o modo DESLIGADO via "€ ••••" a piscar
// para o número. Por isso, sem saber, fica um espaço em branco — o mesmo que a
// página inicial já mostra enquanto o resumo do mês carrega.
//
// Módulo puro (sem AsyncStorage nem React) para se poder testar.
import { formatMoneyApp } from "./money";

export type PrivacyState = "unknown" | "on" | "off";

/** Os pontos que tomam o lugar do número (o símbolo fica à frente, como no resto da app). */
export const MONEY_MASK = "••••";

/** Branco que não colapsa a linha: o cartão não salta quando o valor chega. */
export const MONEY_PENDING = " ";

/** Valor guardado no aparelho -> estado. Só "on" liga; ausente ou lixo = desligado. */
export function parsePrivacy(raw: string | null | undefined): "on" | "off" {
  return raw === "on" ? "on" : "off";
}

/** Dinheiro como os ecrãs o mostram, consoante o modo privacidade. */
export function moneyOrMask(n: number, state: PrivacyState, symbol = "€"): string {
  if (state === "off") return formatMoneyApp(n ?? 0, symbol);
  if (state === "on") return `${symbol} ${MONEY_MASK}`;
  return MONEY_PENDING;
}
