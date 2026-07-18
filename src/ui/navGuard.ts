// Guarda de navegação global: um ecrã com alterações por gravar (ex.: Perfil)
// regista-se aqui; a barra lateral pergunta antes de navegar. Sem isto, o
// popup "Guardar/Ignorar" só existia no botão Voltar — clicar em Projetos/
// Painel/Definições saía sem avisar.
//
// O guard devolve true se ASSUMIU a navegação (mostra o popup e chama
// `navigate` depois da escolha), false se não há nada por gravar.

type Guard = (navigate: () => void) => boolean;

let guard: Guard | null = null;

export function setNavGuard(g: Guard): void {
  guard = g;
}

export function clearNavGuard(): void {
  guard = null;
}

/** Navega já, ou entrega ao guard ativo (que navega após Guardar/Ignorar). */
export function runNavGuard(navigate: () => void): void {
  if (guard && guard(navigate)) return;
  navigate();
}
