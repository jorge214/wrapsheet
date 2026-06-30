# WrapSheet — Setup em novo PC

## Repositório
- GitHub: https://github.com/jorge214/wrapsheet.git
- Branch principal: main
- Clonar com: git clone https://github.com/jorge214/wrapsheet.git

## Stack
- React Native 0.81.4 + Expo SDK 54
- Expo Router v6 (file-based routing)
- TypeScript 5.9
- React 19

## Plataformas
- Web: Vercel — deploy automático quando faço push para main
  - Build command: npx expo export -p web
  - Output: dist/
- iOS App Store: EAS Build + EAS Submit
  - Conta Expo: costa1904
  - Bundle ID: com.wrapsheet
  - EAS Project ID: 6add5ccd-c99b-4660-a1eb-84246ef113c0
- Android: configurado mas ainda não publicado (package: com.wrapsheet)

## APIs e Serviços
- Supabase (auth + sync): URL e anon key hardcoded em src/lib/supabase.ts (sem ficheiro .env)
- Sentry (crash reporting): DSN em app/_layout.tsx, só activo em produção
- i18n: i18next + react-i18next, suporta PT/EN/ES/FR/DE/UK

## Setup no novo PC (por ordem)
1. Instalar Git + Node.js LTS (v20 ou v22)
2. git clone https://github.com/jorge214/wrapsheet.git
3. cd wrapsheet && npm install
4. npx expo login   # conta: costa1904
5. eas login        # mesma conta
6. Instalar extensão GitDoc no VS Code: code --install-extension vsls-contrib.gitdoc
7. Abrir pasta no VS Code — GitDoc faz commit+push automático ao guardar

## Deploy
- Web (Vercel): automático via push para main — não precisa de nada local
- App Store (iOS): eas build -p ios --profile production → eas submit -p ios --profile production
- Não há ficheiro .env — não há nada a copiar além do repositório
