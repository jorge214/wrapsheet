import { Redirect } from "expo-router";

// Rota desconhecida (um URL restaurado pelo browser, um atalho velho, um
// histórico baralhado): em vez do ecrã "Unmatched Route" do expo-router — que
// um utilizador descreve como "a página não existe" — volta ao início, que
// manda cada um para o seu sítio (lista de projetos no computador, separadores
// no telemóvel).
export default function NotFound() {
  return <Redirect href="/" />;
}
