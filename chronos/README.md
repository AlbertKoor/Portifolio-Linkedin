# 🗓️ Chronos — Portal de Agendamento SaaS para Autônomos

Autônomos gerenciam agenda pelo WhatsApp e pagam caro pelo pior erro possível: dois clientes no mesmo horário. No Chronos, o conflito é **impossível por construção**, não apenas improvável.

> 🖼️ *[adicione aqui um GIF/screenshot da interface — use o ShareX]*

## Decisões técnicas

- **Teorema de sobreposição de intervalos**: `startA < endB && startB < endA` cobre todos os casos (parcial, total, contido) numa única expressão.
- **Minutos-desde-meia-noite como inteiros**: elimina os bugs clássicos de comparação de `Date` e fuso horário.
- **Erros tipados em union type** (`INVALID_TIME | OUTSIDE_HOURS | CONFLICT`): a UI é obrigada pelo compilador a tratar cada caso, e regra de negócio fica desacoplada do texto de interface.
- **Buffer entre sessões** tratado como expansão do intervalo — a regra "10 min de respiro" usa o mesmo teorema, sem caso especial.

## Stack

React 18 · TypeScript (strict) · Tailwind CSS v4 · Vite

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173 — tente agendar um horário em cima de outro para ver a validação em ação.
