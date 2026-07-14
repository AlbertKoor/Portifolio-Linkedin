/**
 * ═══════════════════════════════════════════════════════════════════
 * CHURN RADAR — Dashboard Preditor de Retenção de Clientes
 * ═══════════════════════════════════════════════════════════════════
 * Stack: React 18 + TypeScript + Tailwind CSS
 * Tema: "Cyberpunk Soft" — fundo escuro profundo, rosa & roxo neon
 *
 * DOR DE NEGÓCIO: em SaaS, o cancelamento raramente é surpresa — os
 * sinais (queda de login, tickets abertos, fim de contrato) aparecem
 * semanas antes. O time de CS precisa saber PARA QUEM ligar HOJE.
 *
 * DECISÕES TÉCNICAS (para defender em entrevista):
 * 1. Score de churn por heurística ponderada e EXPLICÁVEL (não é ML
 *    caixa-preta): cada fator contribui com pontos e o dashboard
 *    mostra o "porquê". Times de CS confiam mais em regras auditáveis.
 * 2. Parser CSV escrito à mão com validação estrita linha a linha —
 *    dados ruins são REJEITADOS com mensagem de erro, nunca
 *    silenciosamente convertidos (princípio "parse, don't validate").
 * 3. Result type (Ok | Err) em vez de throw: força o chamador a tratar
 *    o caso de erro no sistema de tipos — padrão vindo de Rust/Go.
 * 4. FileReader assíncrono nativo — zero dependências externas.
 */

import { useCallback, useMemo, useState } from "react";

/* ═══════════════ 1. TIPOS — domínio e Result type ═══════════════ */

/** Linha válida do CSV de uso de clientes. */
export interface CustomerUsage {
  customerId: string;
  name: string;
  /** Dias desde o último login. */
  daysSinceLastLogin: number;
  /** Variação % de uso no último mês (negativa = queda). */
  usageTrendPct: number;
  /** Tickets de suporte abertos nos últimos 30 dias. */
  openTickets: number;
  /** Meses restantes de contrato. */
  monthsToRenewal: number;
  /** Valor mensal da assinatura (MRR) em R$. */
  mrr: number;
}

export type RiskLevel = "safe" | "watch" | "danger";

export interface ScoredCustomer extends CustomerUsage {
  /** 0–100: probabilidade estimada de churn. */
  churnScore: number;
  risk: RiskLevel;
  /** Fatores que puxaram o score (transparência p/ o time de CS). */
  reasons: string[];
}

/** Result type: erro faz parte da assinatura, impossível ignorar. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/* ═══════════════ 2. PARSER CSV — validação estrita ═══════════════ */

const EXPECTED_HEADER =
  "customer_id,name,days_since_last_login,usage_trend_pct,open_tickets,months_to_renewal,mrr";

/**
 * Converte texto CSV em CustomerUsage[]. Estratégia "parse, don't
 * validate": ou a linha inteira é válida e tipada, ou o arquivo todo é
 * rejeitado com o número da linha problemática — nunca importamos
 * dados pela metade (metade dos dados = decisão errada do CS).
 */
export function parseCustomerCsv(raw: string): Result<CustomerUsage[]> {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { ok: false, error: "Arquivo vazio ou sem linhas de dados." };
  }

  // 1º contrato: o cabeçalho precisa bater exatamente.
  if (lines[0].trim().toLowerCase() !== EXPECTED_HEADER) {
    return {
      ok: false,
      error: `Cabeçalho inválido. Esperado: "${EXPECTED_HEADER}"`,
    };
  }

  const parsed: CustomerUsage[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length !== 7) {
      return { ok: false, error: `Linha ${i + 1}: esperadas 7 colunas, recebidas ${cols.length}.` };
    }

    const [customerId, name, login, trend, tickets, renewal, mrr] = cols;
    const nums = {
      daysSinceLastLogin: Number(login),
      usageTrendPct: Number(trend),
      openTickets: Number(tickets),
      monthsToRenewal: Number(renewal),
      mrr: Number(mrr),
    };

    // Validação numérica estrita: NaN ou negativos onde não faz sentido → rejeita.
    if (Object.values(nums).some((n) => Number.isNaN(n))) {
      return { ok: false, error: `Linha ${i + 1}: valor numérico inválido.` };
    }
    if (nums.daysSinceLastLogin < 0 || nums.openTickets < 0 || nums.mrr < 0) {
      return { ok: false, error: `Linha ${i + 1}: valores negativos não permitidos.` };
    }
    if (!customerId || !name) {
      return { ok: false, error: `Linha ${i + 1}: id e nome são obrigatórios.` };
    }

    parsed.push({ customerId, name, ...nums });
  }
  return { ok: true, value: parsed };
}

/* ═══════════════ 3. SCORE DE CHURN — heurística explicável ═══════════════ */

/**
 * Pesos calibrados com o time de negócio (em produção, viriam de
 * análise de coorte). Somam no máximo 100 para o score ser legível
 * como percentual de risco.
 */
export function scoreChurn(c: CustomerUsage): ScoredCustomer {
  let score = 0;
  const reasons: string[] = [];

  // Inatividade é o preditor nº 1 de churn em SaaS.
  if (c.daysSinceLastLogin > 30) {
    score += 35;
    reasons.push(`Sem login há ${c.daysSinceLastLogin} dias`);
  } else if (c.daysSinceLastLogin > 14) {
    score += 20;
    reasons.push(`Login em queda (${c.daysSinceLastLogin} dias)`);
  }

  // Queda de uso: o cliente está "desligando aos poucos".
  if (c.usageTrendPct < -30) {
    score += 30;
    reasons.push(`Uso caiu ${Math.abs(c.usageTrendPct)}% no mês`);
  } else if (c.usageTrendPct < -10) {
    score += 15;
    reasons.push(`Uso em declínio (${c.usageTrendPct}%)`);
  }

  // Atrito com suporte.
  if (c.openTickets >= 3) {
    score += 20;
    reasons.push(`${c.openTickets} tickets abertos`);
  } else if (c.openTickets > 0) {
    score += 8;
    reasons.push(`${c.openTickets} ticket(s) em aberto`);
  }

  // Janela de renovação: risco latente vira decisão de compra.
  if (c.monthsToRenewal <= 1) {
    score += 15;
    reasons.push("Renovação em menos de 1 mês");
  } else if (c.monthsToRenewal <= 3) {
    score += 7;
    reasons.push("Renovação próxima (≤ 3 meses)");
  }

  const churnScore = Math.min(score, 100);
  const risk: RiskLevel =
    churnScore >= 60 ? "danger" : churnScore >= 30 ? "watch" : "safe";

  return { ...c, churnScore, risk, reasons };
}

/* ═══════════════ 4. FIXTURE p/ demonstração sem upload ═══════════════ */

const DEMO_CSV = `customer_id,name,days_since_last_login,usage_trend_pct,open_tickets,months_to_renewal,mrr
CLI-001,Padaria Estrela,45,-52,3,1,890
CLI-002,Studio Vega,2,12,0,8,1450
CLI-003,AutoPeças Lima,21,-18,1,2,2300
CLI-004,Clínica Horizonte,5,3,0,11,3200
CLI-005,EducaPro Cursos,33,-41,2,3,760
CLI-006,Mercado Bonfim,9,-12,4,6,1120`;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Mapa de estilos por nível de risco — cyberpunk soft. */
const RISK_STYLE: Record<
  RiskLevel,
  { label: string; badge: string; bar: string; glow: string }
> = {
  danger: {
    label: "Zona de Risco",
    badge: "bg-pink-500/15 text-pink-300 ring-pink-500/40",
    bar: "bg-gradient-to-r from-pink-500 to-fuchsia-400",
    glow: "hover:shadow-[0_0_35px_-5px_rgba(236,72,153,0.35)] border-pink-500/30",
  },
  watch: {
    label: "Atenção",
    badge: "bg-violet-500/15 text-violet-300 ring-violet-500/40",
    bar: "bg-gradient-to-r from-violet-500 to-purple-400",
    glow: "hover:shadow-[0_0_35px_-5px_rgba(139,92,246,0.3)] border-violet-500/20",
  },
  safe: {
    label: "Saudável",
    badge: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    bar: "bg-gradient-to-r from-slate-500 to-slate-400",
    glow: "border-white/5",
  },
};

/* ═══════════════ 5. COMPONENTE — UI Cyberpunk Soft ═══════════════
 *
 * Receita visual (Tailwind):
 * - Fundo: #08060f via bg-[#08060f] + dois gradientes radiais neon
 *   (rosa topo-direito, roxo base-esquerda) com opacidade baixíssima.
 * - Glassmorphism: bg-white/[0.04] + backdrop-blur-2xl + ring-white/10.
 * - Neon com moderação: glow via shadow colorida SÓ nos cards em risco
 *   — o brilho vira sinal de informação, não decoração.
 */

export default function ChurnRadar() {
  const [csvError, setCsvError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerUsage[]>(
    () => (parseCustomerCsv(DEMO_CSV) as { ok: true; value: CustomerUsage[] }).value,
  );

  /** Upload: lê o arquivo e delega ao parser estrito. */
  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseCustomerCsv(String(reader.result ?? ""));
      if (result.ok) {
        setCustomers(result.value);
        setCsvError(null);
      } else {
        setCsvError(result.error); // arquivo rejeitado por inteiro, com motivo
      }
    };
    reader.readAsText(file);
  }, []);

  // Ordena por risco: quem o CS precisa ligar primeiro fica no topo.
  const scored = useMemo(
    () => customers.map(scoreChurn).sort((a, b) => b.churnScore - a.churnScore),
    [customers],
  );

  const mrrAtRisk = scored
    .filter((c) => c.risk === "danger")
    .reduce((sum, c) => sum + c.mrr, 0);

  return (
    <div className="min-h-screen bg-[#08060f] text-slate-100 antialiased [background-image:radial-gradient(ellipse_60%_40%_at_85%_0%,rgba(236,72,153,0.10),transparent),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(139,92,246,0.10),transparent)]">
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* ── Cabeçalho + KPI ── */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.25em] text-fuchsia-300/60">
              Churn Radar
            </p>
            <h1 className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
              Retenção de Clientes
            </h1>
          </div>
          <div className="rounded-2xl border border-pink-500/25 bg-pink-500/10 px-5 py-3 backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-wider text-pink-200/60">
              MRR em risco
            </p>
            <p className="text-2xl font-bold text-pink-300">{brl(mrrAtRisk)}</p>
          </div>
        </header>

        {/* ── Upload de CSV ── */}
        <label className="mb-8 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-4 backdrop-blur-2xl transition-colors hover:border-fuchsia-400/40">
          <span className="text-sm text-slate-400">
            Arraste ou clique para enviar o CSV de uso dos clientes
          </span>
          <span className="rounded-xl bg-gradient-to-r from-pink-500/20 to-violet-500/20 px-4 py-2 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/30">
            Upload CSV
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {csvError && (
          <p className="mb-6 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
            ⚠ {csvError}
          </p>
        )}

        {/* ── Lista priorizada ── */}
        <section className="space-y-4">
          {scored.map((c) => {
            const style = RISK_STYLE[c.risk];
            return (
              <article
                key={c.customerId}
                className={`rounded-3xl border bg-white/[0.04] p-5 backdrop-blur-2xl transition-all duration-300 ${style.glow}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-100">{c.name}</h2>
                    <p className="font-mono text-xs text-slate-500">
                      {c.customerId} · {brl(c.mrr)}/mês
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${style.badge}`}
                  >
                    {style.label} · {c.churnScore}
                  </span>
                </div>

                {/* Barra de score — largura proporcional ao risco */}
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${style.bar}`}
                    style={{ width: `${c.churnScore}%` }}
                  />
                </div>

                {/* Transparência: POR QUE o cliente está em risco */}
                {c.reasons.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {c.reasons.map((r) => (
                      <li
                        key={r}
                        className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-400 ring-1 ring-white/5"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
