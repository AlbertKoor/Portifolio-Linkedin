/**
 * ═══════════════════════════════════════════════════════════════════
 * LOGÍSTICA SMART — Otimizador de Fretes para E-commerce
 * ═══════════════════════════════════════════════════════════════════
 * DOR DE NEGÓCIO: pequenos e-commerces roteirizam entregas "no olho",
 * pagando frete individual por pedido. Agrupar pedidos por região e
 * ordenar a rota reduz km rodado e custo por entrega.
 */

import { useMemo, useState } from "react";

/* ═══════════════ 1. TIPOS — modelagem estrita do domínio ═══════════════ */

/** Um pedido pronto para expedição. */
export interface Order {
  id: string;
  customer: string;
  /** CEP somente dígitos, ex.: "01310930" */
  cep: string;
  lat: number;
  lng: number;
  weightKg: number;
}

/** Grupo de pedidos da mesma sub-região de CEP. */
export interface RegionCluster {
  /** Prefixo de 3 dígitos do CEP (sub-região dos Correios). */
  regionKey: string;
  orders: Order[];
  /** Rota otimizada: pedidos na ordem de visita. */
  route: Order[];
  totalKm: number;
  /** Custo estimado da rota agrupada. */
  optimizedCost: number;
  /** Custo se cada pedido fosse entregue individualmente. */
  naiveCost: number;
}

/** Parâmetros de custo — em produção viriam de config/API. */
const COST = {
  baseFeePerTrip: 12.0, // custo fixo de despacho (motoboy/veículo)
  perKm: 1.85, // R$ por km rodado
  depot: { lat: -23.5505, lng: -46.6333 }, // CD em São Paulo (Sé)
} as const;

/* ═══════════════ 2. ALGORITMO — lógica de negócio pura ═══════════════ */

/**
 * Distância em km entre duas coordenadas (fórmula de Haversine).
 * Usada em vez da euclidiana porque lat/lng vivem numa esfera.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // raio médio da Terra em km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Agrupa pedidos por sub-região (3 primeiros dígitos do CEP).
 * Estratégia O(n), determinística e fácil de explicar ao operador —
 * requisito comum em ferramentas internas: o usuário precisa CONFIAR
 * no agrupamento, e "mesma região dos Correios" é auto-explicativo.
 */
export function clusterByCepPrefix(orders: Order[]): Map<string, Order[]> {
  const clusters = new Map<string, Order[]>();
  for (const order of orders) {
    // Validação estrita: CEP brasileiro tem exatamente 8 dígitos.
    if (!/^\d{8}$/.test(order.cep)) continue;
    const key = order.cep.slice(0, 3);
    const bucket = clusters.get(key) ?? [];
    bucket.push(order);
    clusters.set(key, bucket);
  }
  return clusters;
}

/**
 * Heurística do Vizinho Mais Próximo: partindo do CD, visita sempre
 * o pedido não-visitado mais perto do ponto atual. O(n²).
 */
export function nearestNeighborRoute(orders: Order[]): {
  route: Order[];
  totalKm: number;
} {
  const remaining = [...orders];
  const route: Order[] = [];
  let current: { lat: number; lng: number } = COST.depot;
  let totalKm = 0;

  while (remaining.length > 0) {
    // Encontra o índice do pedido mais próximo do ponto atual.
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    route.push(next);
    totalKm += bestDist;
    current = next;
  }
  return { route, totalKm };
}

/**
 * Pipeline completo: clusteriza → roteiriza → calcula economia.
 * Função pura: mesma entrada, mesma saída → trivial de testar.
 */
export function optimizeShipping(orders: Order[]): RegionCluster[] {
  return [...clusterByCepPrefix(orders).entries()]
    .map(([regionKey, group]) => {
      const { route, totalKm } = nearestNeighborRoute(group);
      // Cenário ingênuo: uma viagem CD → cliente por pedido.
      const naiveCost = group.reduce(
        (sum, o) =>
          sum + COST.baseFeePerTrip + haversineKm(COST.depot, o) * COST.perKm,
        0,
      );
      const optimizedCost = COST.baseFeePerTrip + totalKm * COST.perKm;
      return { regionKey, orders: group, route, totalKm, naiveCost, optimizedCost };
    })
    .sort((a, b) => b.naiveCost - b.optimizedCost - (a.naiveCost - a.optimizedCost));
}

/* ═══════════════ 3. DADOS SIMULADOS (fixture de demonstração) ═══════════════ */

const MOCK_ORDERS: Order[] = [
  { id: "PED-001", customer: "Marina L.", cep: "01310930", lat: -23.5614, lng: -46.6559, weightKg: 1.2 },
  { id: "PED-002", customer: "Carlos T.", cep: "01311000", lat: -23.5648, lng: -46.6532, weightKg: 3.4 },
  { id: "PED-003", customer: "Beatriz S.", cep: "04538133", lat: -23.5866, lng: -46.6821, weightKg: 0.8 },
  { id: "PED-004", customer: "Diego F.", cep: "04543011", lat: -23.5911, lng: -46.6889, weightKg: 2.1 },
  { id: "PED-005", customer: "Elisa M.", cep: "01452002", lat: -23.5719, lng: -46.6928, weightKg: 5.0 },
  { id: "PED-006", customer: "Fábio R.", cep: "04547130", lat: -23.5935, lng: -46.6842, weightKg: 1.6 },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ═══════════════ 4. COMPONENTE — UI Dark Grafite & Verde-Menta ═══════════════
 *
 * Receita visual (Tailwind):
 * - Fundo: bg-zinc-950 com gradiente radial sutil de menta (profundidade).
 * - Glassmorphism: bg-white/5 + backdrop-blur-xl + border-white/10.
 * - Acento: emerald-300/400 (verde-menta) SÓ em números e CTAs —
 *   acento escasso é o que faz o dark mode parecer caro.
 * - Cantos: rounded-2xl/3xl consistentes.
 */

export default function LogisticaSmart() {
  const [orders] = useState<Order[]>(MOCK_ORDERS);
  // useMemo: o pipeline O(n²) só re-executa se os pedidos mudarem.
  const clusters = useMemo(() => optimizeShipping(orders), [orders]);

  const totalSavings = clusters.reduce(
    (sum, c) => sum + (c.naiveCost - c.optimizedCost),
    0,
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased [background-image:radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(52,211,153,0.08),transparent)]">
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* ── Cabeçalho ── */}
        <header className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/70">
              Logística Smart
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
              Otimizador de Fretes
            </h1>
          </div>
          {/* Card-resumo de economia: o número que o dono do negócio quer ver */}
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-wider text-emerald-200/70">
              Economia estimada
            </p>
            <p className="text-2xl font-bold text-emerald-300">
              {brl(totalSavings)}
            </p>
          </div>
        </header>

        {/* ── Grid de clusters ── */}
        <section className="grid gap-5 md:grid-cols-2">
          {clusters.map((cluster) => (
            <article
              key={cluster.regionKey}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/30 hover:bg-white/[0.07]"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Região CEP {cluster.regionKey}xx-xxx
                </h2>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  {cluster.orders.length} pedidos · {cluster.totalKm.toFixed(1)} km
                </span>
              </div>

              {/* Rota na ordem de visita calculada */}
              <ol className="mb-5 space-y-2">
                {cluster.route.map((order, i) => (
                  <li key={order.id} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-emerald-300 ring-1 ring-white/10">
                      {i + 1}
                    </span>
                    <span className="text-zinc-300">{order.customer}</span>
                    <span className="ml-auto font-mono text-xs text-zinc-500">
                      {order.id}
                    </span>
                  </li>
                ))}
              </ol>

              {/* Comparativo de custo: antes vs. depois */}
              <div className="flex items-center justify-between rounded-2xl bg-zinc-900/60 px-4 py-3 ring-1 ring-white/5">
                <div>
                  <p className="text-[11px] text-zinc-500">Entrega individual</p>
                  <p className="text-sm text-zinc-400 line-through">
                    {brl(cluster.naiveCost)}
                  </p>
                </div>
                <span className="text-zinc-600">→</span>
                <div className="text-right">
                  <p className="text-[11px] text-zinc-500">Rota agrupada</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {brl(cluster.optimizedCost)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
