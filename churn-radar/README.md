# 📡 Churn Radar — Dashboard Preditor de Retenção de Clientes

Em SaaS, o cancelamento raramente é surpresa: os sinais aparecem semanas antes. Este dashboard processa o CSV de uso dos clientes e prioriza quem está em "Zona de Risco" — dizendo ao time de CS **para quem ligar hoje e por quê**.

> 🖼️ *[adicione aqui um GIF/screenshot da interface — use o ShareX]*

## Decisões técnicas

- **Score de churn por heurística ponderada e explicável** (não ML caixa-preta): cada fator soma pontos e o card mostra os motivos. Times de CS confiam em regras auditáveis.
- **Parser CSV com validação estrita** ("parse, don't validate"): arquivo malformado é rejeitado por inteiro, com a linha do erro — importar dados pela metade faria o CS ligar para o cliente errado.
- **Result type (`Ok | Err`)** em vez de `throw`: o erro faz parte da assinatura da função e o chamador é obrigado a tratá-lo.
- **Zero dependências de parsing**: `FileReader` nativo.

## Formato do CSV esperado

```csv
customer_id,name,days_since_last_login,usage_trend_pct,open_tickets,months_to_renewal,mrr
CLI-001,Padaria Estrela,45,-52,3,1,890
```

## Stack

React 18 · TypeScript (strict) · Tailwind CSS v4 · Vite

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173 — o dashboard carrega com dados de demonstração; use o botão de upload para testar com seu próprio CSV.
