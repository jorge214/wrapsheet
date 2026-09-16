# WrapSheet

App de folhas de horas para equipas de cinema e publicidade. **Está em produção**:
App Store desde 17/08/2026 (1.1.0) e web em https://wrapsheet-app.com. Há
utilizadores reais a faturar com os PDF que isto gera — um cálculo errado é
dinheiro a menos no bolso de alguém.

Expo SDK 54 · React Native 0.81 · expo-router · TypeScript. A web é o MESMO
código através do React Native Web, publicado na Vercel a partir de `main`.

## Comandos

| | |
|---|---|
| `npm test` | testes (vitest) |
| `npm run verify` | tipos + testes — a verificação de fim de tarefa |
| `npx tsc --noEmit` | só os tipos |
| `npx expo export -p web` | compila o pacote web (prova que nada partiu) |
| `npx expo start` | app em desenvolvimento (Expo Go) |

O `verify` usa a MESMA configuração que o VS Code — a `tsconfig.json` sobrepunha
`module` e `moduleResolution` à base do Expo, que traz `customConditions`, e isso
dava TS5098: o tsc abortava antes de verificar o que quer que fosse. Os dois
overrides foram removidos.

## Regras que não se quebram

**Os valores esperados nos testes vêm das tabelas de referência do setor,
calculados à mão e justificados em comentário.** Nunca se altera um valor
esperado para fazer um teste passar. Quando um teste falha, o errado é o
código. Esta é a regra mais importante deste ficheiro.

E não fica só na palavra: `engine.test.ts` e `cinema.test.ts` estão numa regra
de permissão `ask`, por isso editá-los pede autorização ao Jorge. Acrescentar
testes é livre; mexer num valor esperado passa pelos olhos dele. (O hook `Stop`
impede que uma tarefa termine com um teste vermelho, e é precisamente essa
pressão que torna tentador "corrigir" o número esperado em vez do código.)

**Migrações têm de ser ADITIVAS.** A app da App Store e a web partilham a mesma
base de dados de produção. Uma versão antiga da app continua a ler as mesmas
linhas. Campos novos vivem dentro do blob JSON `data`, nunca em colunas novas,
e o código antigo tem de continuar a funcionar sem eles.

**`main` publica sozinho para produção.** Trabalha sempre num ramo
(`feat/...`). Não commitar para `main` sem o Jorge pedir.

**No iOS não pode haver links para pagamento externo** (regra 3.1.2 da Apple —
já custou uma rejeição). A compra no iPhone é sempre o IAP; a Stripe é só na
web. O mesmo cuidado vale para a Play Store.

**Expressões regulares dentro dos `<script>` injetados** (`editorScript` em
`buildPdfHtml.ts` e o script da folha de cinema) precisam das barras
**duplicadas**: `\\d`, `\\D`. O script vive dentro de um template literal, e uma
barra simples é comida na interpolação. Foi a causa do bug das horas.

## Como está organizado

**Cálculo** (`src/calc/`) — `calcProject(p)` é o **ponto único**: escolhe o motor
pelo formato do projeto. Nunca decidir o formato fora dele.
- `engine.ts` — motor comum (horas extra A/B, recuperação, descanso, ajudas, impostos)
- `cinema.ts` — folha semanal: descanso entre semanas, recuperação, folgas a dobrar
- `feriadosPT.ts` — os 13 feriados obrigatórios, com a Páscoa calculada
- `types.ts` — `Dia`, `Tabela`, `Fiscal`, `CalcDia`

**Dois formatos de folha**, escolhidos ao criar o projeto e guardados em
`projeto.formato`:
- **publicidade** (ausente = esta, nas folhas antigas): salário ao dia, taxas €/h
- **cinema**: salário à semana ÷ 5 dias ÷ 10h = valor-hora; extras por
  multiplicador; folgas e feriados a dobrar; Segurança Social

**Folha** (`src/export/`) — `buildPdfHtml.ts` (publicidade) e `buildCinemaHtml.ts`
(cinema). Cada um gera o PDF **e** o editor. O script do editor é **um só**,
`editorScript(s)`, partilhado pelas duas folhas: uma correção lá serve às duas.

**O editor a sério é a WebView HTML**, não o `EditableSheet` nativo (código
morto). Comunica com a app por mensagens `ws:*` (`ws:edit`, `ws:addDay`,
`ws:calc`…) tratadas em `handleEditMessage`, em `app/projects/[id].tsx`.

**Armazenamento** (`src/storage/`) — tudo em AsyncStorage, sincronizado para o
Supabase como blob JSON. `projects.ts` é o ficheiro central.

**Perfis** — multi-perfil é a funcionalidade paga (1 grátis, 10 no plano pago,
nunca mais do que 10). O direito vive na tabela `entitlements` do Supabase;
RevenueCat (iOS) e Stripe (web) escrevem lá os dois, e `getMaxProfiles` lê de
lá em qualquer plataforma.

## Antes de dizer que está feito

O hook `Stop` corre o `verify.mjs` sozinho, mas o hábito é este:

1. `node scripts/verify.mjs` — tipos e testes
2. `npx expo export -p web` — se mexeste em algo que a web usa
3. Mexeste numa folha? Gera uma amostra HTML e **olha para ela**. Os testes
   provam os números, não provam que a folha está bonita.
   Para olhar sem browser aberto: `node scripts/shot.js <url-ou-file://> out.png 390 844`
   emula um iPhone (1024 1366 = iPad; último argumento `1` = página inteira) com o
   Edge em headless e o protocolo DevTools. O `--window-size` do headless não
   desce abaixo de ~480 px, por isso capturas "de iPhone" sem emulação mentem.

Os hooks do Claude Code só disparam quando é o Claude a editar. Para as
edições à mão há o `pre-commit` do git, instalado sozinho a cada `npm install`
(script `prepare`) — numa máquina nova não é preciso lembrar-se de nada.

## Armadilhas conhecidas

- **Heredocs grandes rebentam** nesta máquina (`unexpected EOF`) com TypeScript
  e acentos. Ficheiros novos: ferramenta Write. Edições: um JSON de operações
  `{find, replace}` com o `patch.js` do scratchpad.
- **Os 9 ficheiros de tradução são CRLF.** Editar por linha, nunca
  `JSON.parse` + `JSON.stringify` do ficheiro inteiro.
- **A Vercel cria um link novo por commit.** O link de pré-visualização de
  ontem mostra código de ontem.
- **Há 9 erros de tipos antigos** noutros ficheiros (`layout.ts`,
  `typography.ts`, `WebHead.web.tsx`, e a duplicação de tipos `ProjectState`
  entre `models/` e `storage/`). Estão em `scripts/tsc-baseline.txt` para o
  `verify` não reclamar deles, mas a linha de base **só encolhe**: o `verify`
  conta OCORRÊNCIAS (um segundo erro igual ao mesmo ficheiro bloqueia) e
  reescreve o ficheiro sozinho quando um erro antigo desaparece. Arranja-os
  quando passares por perto; não os aumentes.
