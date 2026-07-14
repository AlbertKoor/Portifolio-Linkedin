# 🚚 Logística Smart — Otimizador de Fretes para E-commerce

Pequenos e-commerces roteirizam entregas manualmente e pagam frete individual por pedido. Este sistema agrupa pedidos por região de CEP, calcula a rota de menor custo e mostra a economia estimada por rota.

> 🖼️ *[adicione aqui um GIF/screenshot da interface — use o ShareX]*

## Decisões técnicas

- **Clustering por prefixo de CEP (3 dígitos)** em vez de K-Means: determinístico, O(n) e explicável ao operador — "mesma sub-região dos Correios" é auto-evidente.
- **Rota por heurística do Vizinho Mais Próximo**: o problema real (TSP) é NP-difícil; a heurística entrega rota ~25% acima do ótimo em O(n²) — trade-off honesto para uso operacional.
- **Distância de Haversine**, não euclidiana: coordenadas geográficas vivem numa esfera.
- **Lógica de negócio 100% pura** (sem React) em `src/LogisticaSmart.tsx` — testável sem renderizar nada.

## Stack

React 18 · TypeScript (strict) · Tailwind CSS v4 · Vite

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173.
