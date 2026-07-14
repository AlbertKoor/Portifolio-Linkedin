/**
 * ═══════════════════════════════════════════════════════════════════
 * CHRONOS — Portal de Agendamento SaaS para Autônomos
 * ═══════════════════════════════════════════════════════════════════
 * Stack: React 18 + TypeScript + Tailwind CSS
 * Tema: "Minimalist Calm / Cozy Tech" — creme, off-white, azul-sereno
 *
 * DOR DE NEGÓCIO: autônomos (psicólogos, personal trainers, tatuadores)
 * gerenciam agenda por WhatsApp e sofrem com o pior erro possível:
 * dois clientes no mesmo horário. O sistema precisa tornar o conflito
 * IMPOSSÍVEL por construção, não apenas improvável.
 *
 * DECISÕES TÉCNICAS (para defender em entrevista):
 * 1. Detecção de conflito pelo teorema clássico de sobreposição de
 *    intervalos: A e B colidem ⟺ startA < endB && startB < endA.
 *    Cobre TODOS os casos (contido, parcial, idêntico) numa expressão.
 * 2. Minutos-desde-meia-noite como representação interna: aritmética
 *    de inteiros elimina os bugs clássicos de comparação de Date/fuso.
 * 3. Validação em camadas com erros tipados (union type): a UI mapeia
 *    cada código de erro para mensagem amigável — regra de negócio
 *    e texto de interface ficam desacoplados.
 * 4. Buffer configurável entre sessões (respiro/deslocamento) tratado
 *    como expansão do intervalo — sem caso especial no algoritmo.
 */

import { useMemo, useState } from "react";

/* ═══════════════ 1. TIPOS — domínio do agendamento ═══════════════ */

/** Agendamento confirmado. Horários em minutos desde 00:00. */
export interface Booking {
  id: string;
  clientName: string;
  service: string;
  /** Data ISO (yyyy-mm-dd) — sem hora, para evitar fuso. */
  date: string;
  startMin: number;
  endMin: number;
}

/** Pedido de novo agendamento vindo do formulário. */
export interface BookingRequest {
  clientName: string;
  service: string;
  date: string;
  /** "HH:MM" — formato do <input type="time">. */
  startTime: string;
  durationMin: number;
}

/** Erros possíveis, como union type: a UI é obrigada a tratar todos. */
export type BookingError =
  | { code: "INVALID_TIME"; message: string }
  | { code: "OUTSIDE_HOURS"; message: string }
  | { code: "CONFLICT"; message: string; conflictWith: Booking };

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: BookingError };

/** Regras do profissional — em produção, configuráveis por usuário. */
const AGENDA_RULES = {
  workStartMin: 8 * 60, // 08:00
  workEndMin: 19 * 60, // 19:00
  bufferMin: 10, // respiro entre sessões
} as const;

/* ═══════════════ 2. ALGORITMO — validação de conflitos ═══════════════ */

/** "HH:MM" → minutos desde meia-noite. null se o formato for inválido. */
export function parseTimeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** minutos → "HH:MM" para exibição. */
export function minutesToLabel(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Teorema da sobreposição de intervalos:
 * dois intervalos [aStart, aEnd) e [bStart, bEnd) se sobrepõem
 * se e somente se: aStart < bEnd && bStart < aEnd.
 * Uma única expressão cobre sobreposição parcial, total e contida.
 */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Valida um pedido contra a agenda existente.
 * Camadas: formato → expediente → conflito (com buffer).
 * Retorna Result tipado — quem chama não tem como esquecer o erro.
 */
export function validateBooking(
  request: BookingRequest,
  existing: Booking[],
): BookingResult {
  // Camada 1: formato e duração.
  const startMin = parseTimeToMinutes(request.startTime);
  if (startMin === null || request.durationMin <= 0) {
    return {
      ok: false,
      error: { code: "INVALID_TIME", message: "Horário ou duração inválidos." },
    };
  }
  const endMin = startMin + request.durationMin;

  // Camada 2: dentro do expediente.
  if (startMin < AGENDA_RULES.workStartMin || endMin > AGENDA_RULES.workEndMin) {
    return {
      ok: false,
      error: {
        code: "OUTSIDE_HOURS",
        message: `Atendimentos das ${minutesToLabel(AGENDA_RULES.workStartMin)} às ${minutesToLabel(AGENDA_RULES.workEndMin)}.`,
      },
    };
  }

  // Camada 3: conflito com agendamentos do MESMO dia.
  // O buffer expande o intervalo novo dos dois lados — assim a regra
  // "10 min de respiro" usa o mesmo teorema, sem código extra.
  const sameDay = existing.filter((b) => b.date === request.date);
  for (const booked of sameDay) {
    if (
      intervalsOverlap(
        startMin - AGENDA_RULES.bufferMin,
        endMin + AGENDA_RULES.bufferMin,
        booked.startMin,
        booked.endMin,
      )
    ) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: `Conflito com ${booked.clientName} (${minutesToLabel(booked.startMin)}–${minutesToLabel(booked.endMin)}).`,
          conflictWith: booked,
        },
      };
    }
  }

  // Tudo válido → constrói o agendamento tipado.
  return {
    ok: true,
    booking: {
      id: `bk_${request.date}_${startMin}`, // determinístico p/ demo; em prod: uuid
      clientName: request.clientName.trim(),
      service: request.service,
      date: request.date,
      startMin,
      endMin,
    },
  };
}

/* ═══════════════ 3. FIXTURE — agenda de demonstração ═══════════════ */

const DEMO_DATE = "2026-07-15";
const INITIAL_BOOKINGS: Booking[] = [
  { id: "bk_1", clientName: "Renata Alves", service: "Sessão de terapia", date: DEMO_DATE, startMin: 9 * 60, endMin: 9 * 60 + 50 },
  { id: "bk_2", clientName: "João Pedro", service: "Avaliação inicial", date: DEMO_DATE, startMin: 11 * 60, endMin: 12 * 60 },
  { id: "bk_3", clientName: "Camila Duarte", service: "Sessão de terapia", date: DEMO_DATE, startMin: 15 * 60 + 30, endMin: 16 * 60 + 20 },
];

/* ═══════════════ 4. COMPONENTE — UI Minimalist Calm ═══════════════
 *
 * Receita visual (Tailwind):
 * - Base: bg-[#faf7f2] (creme quente) — nada de branco puro #fff.
 * - Cartões off-white (bg-white/70) com backdrop-blur suave e sombra
 *   difusa e leve (shadow-sm + shadow de cor quente) — "cozy", não flat.
 * - Acento único: azul-sereno (sky-600/700) em ações e horários.
 * - Tipografia com tracking-tight em títulos; muito espaço em branco.
 * - Cantos generosos: rounded-2xl/3xl.
 */

export default function Chronos() {
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [form, setForm] = useState({
    clientName: "",
    service: "Sessão de terapia",
    startTime: "10:00",
    durationMin: 50,
  });
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const dayBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === DEMO_DATE)
        .sort((a, b) => a.startMin - b.startMin),
    [bookings],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim()) {
      setFeedback({ kind: "error", text: "Informe o nome do cliente." });
      return;
    }
    const result = validateBooking({ ...form, date: DEMO_DATE }, bookings);
    if (result.ok) {
      setBookings((prev) => [...prev, result.booking]);
      setFeedback({
        kind: "success",
        text: `Agendado: ${result.booking.clientName} às ${minutesToLabel(result.booking.startMin)}.`,
      });
      setForm((f) => ({ ...f, clientName: "" }));
    } else {
      setFeedback({ kind: "error", text: result.error.message });
    }
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-800 antialiased">
      <main className="mx-auto max-w-3xl px-6 py-14">
        {/* ── Cabeçalho ── */}
        <header className="mb-10 text-center">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-sky-700/60">
            Chronos
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Sua agenda, sem choques de horário
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Quarta-feira, 15 de julho · expediente 08:00–19:00 · respiro de 10 min
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          {/* ── Agenda do dia ── */}
          <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6 shadow-sm shadow-stone-200/60 backdrop-blur">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-400">
              Agenda do dia
            </h2>
            <ol className="space-y-3">
              {dayBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-4 rounded-2xl bg-[#faf7f2] px-4 py-3 ring-1 ring-stone-200/60"
                >
                  <span className="rounded-xl bg-sky-100/80 px-3 py-1.5 font-mono text-xs font-semibold text-sky-700">
                    {minutesToLabel(b.startMin)}–{minutesToLabel(b.endMin)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-stone-800">
                      {b.clientName}
                    </p>
                    <p className="text-xs text-stone-500">{b.service}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Formulário de novo agendamento ── */}
          <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6 shadow-sm shadow-stone-200/60 backdrop-blur">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-400">
              Novo agendamento
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-500">
                  Cliente
                </span>
                <input
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Nome do cliente"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-stone-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-stone-500">
                    Início
                  </span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-stone-500">
                    Duração (min)
                  </span>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={form.durationMin}
                    onChange={(e) =>
                      setForm({ ...form, durationMin: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-b from-sky-600 to-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/20 transition-all hover:shadow-lg hover:shadow-sky-600/30 active:scale-[0.99]"
              >
                Confirmar horário
              </button>

              {/* Feedback mapeado dos erros tipados do algoritmo */}
              {feedback && (
                <p
                  role="status"
                  className={`rounded-xl px-4 py-3 text-sm ${
                    feedback.kind === "success"
                      ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                      : "bg-orange-50 text-orange-800 ring-1 ring-orange-200"
                  }`}
                >
                  {feedback.text}
                </p>
              )}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
