// T06 (Fase 5) / veredito T05 (D3) + confirmação do Champion em 26/11/2026
// registrada em 04_fase-atual/t06-confirmacoes-recebidas.md:
//
//   "2 - regra de feriado permanece, temos duas vertentes em feriado, ou
//    funciona de 08h às 12h ou está fechado"
//   "3 - abre de 08h às 12h"                      → 08/12/2026
//   "4 - 24/12 e 31/12 funcionamento reduzido de 05:30 às 14h"
//   → depois corrigido pelo Champion: "A - não ter horário disponível para
//     agendar, somente urgência igual a fim de semana"
//     (B) 24/12 e 31/12 FECHADOS: "datas que estará fechada a academia, não
//     tem horário disponível para agendamento"
//   "5 - funcionamento normal, fecha apenas 25/12 e 01/01"
//   "C - correto"                                 → 08/12 08:00–12:00
//
// Regra final aplicada neste arquivo:
//   - 08/12/2026 (Conceição da Praia): funciona 08:00–12:00.
//   - 24/12/2026 e 31/12/2026: FECHADO (sem grade; urgência é exceção humana).
//   - 25/12/2026 e 01/01/2027: FECHADO (sem grade).
//   - demais dias úteis: grade normal seg–sex, 07:00–19:30, capacidade 1/2/1
//     (mesma forma da 0067), sem fim de semana.
//
// Como um dia "fechado" é representado: os slots do dia recebem
// status='BLOQUEADO'. A página /agendar consulta filter=(status='ABERTO')
// (Agendar.tsx linha 172), então slot bloqueado NÃO é ofertado — e o registro
// permanece, permitindo reabrir depois sem perder o histórico.
// Em 08/12 mantêm-se ABERTOS só os slots de 08:00 a 11:30 (último início que
// termina até 12:00); os demais do dia ficam BLOQUEADOS.
//
// A janela nova vai de 31/12/2026 a 30/01/2027, para cobrir o 31/12 (fechado)
// e as 4 semanas seguintes de operação normal. Não há grade entre 26/12 e
// 30/12 — decisão do Champion (datas de academia fechada; urgência pelo
// atendimento humano, mesma regra de sábado/domingo).
//
// Idempotente: não duplica slot_id existente; reaplica o status sempre.
// Down remove somente os slots criados aqui (created_by='grade-real-2026-12')
// e devolve a grade da 0067 ao estado ABERTO — as datas fechadas da 0067 não
// são recriadas (a 0067 nasce com tudo ABERTO).

const GRADE_TAG = 'grade-real-2026-12'

const CAPACITY_DOUBLE_FROM = 11 * 60 // 11:00
const CAPACITY_DOUBLE_TO = 17 * 60 // 17:00

// datas fechadas (sem oferta de horário)
const DATAS_FECHADAS = ['2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01']

// data com funcionamento especial: mantém ABERTO só dentro da faixa
const HORARIOS_ESPECIAIS = {
  '2026-12-08': { inicio: 8 * 60, fim: 12 * 60 },
}

const jsonDate = (date, hh, mm) => `${date} ${hh}:${mm}:00.000Z`

const diaDaSemana = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map((v) => parseInt(v, 10))
  const utc = new Date(Date.UTC(y, m - 1, d))
  return utc.getUTCDay() // 0 dom ... 6 sáb
}

const proximoDia = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map((v) => parseInt(v, 10))
  const utc = new Date(Date.UTC(y, m - 1, d + 1))
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(
    utc.getUTCDate(),
  ).padStart(2, '0')}`
}

const slotsDoDia = (isoDate) => {
  const fechado = DATAS_FECHADAS.indexOf(isoDate) >= 0
  const vespera = diaDaSemana(isoDate) === 0 || diaDaSemana(isoDate) === 6
  if (vespera) return []
  const especial = HORARIOS_ESPECIAIS[isoDate] || null
  const slots = []
  for (let startMinutes = 7 * 60; startMinutes <= 19 * 60 + 30; startMinutes += 30) {
    const h = Math.floor(startMinutes / 60)
    const m = startMinutes % 60
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    let status = 'ABERTO'
    if (fechado) status = 'BLOQUEADO'
    else if (especial) {
      status =
        startMinutes >= especial.inicio && startMinutes < especial.fim ? 'ABERTO' : 'BLOQUEADO'
    }
    const capacity =
      startMinutes >= CAPACITY_DOUBLE_FROM && startMinutes < CAPACITY_DOUBLE_TO ? 2 : 1
    slots.push({
      slot_id: `slot-${isoDate}-${hh}${mm}`,
      slot_datetime: jsonDate(isoDate, hh, mm),
      slot_duration_min: 30,
      capacity,
      status,
      created_by: GRADE_TAG,
    })
  }
  return slots
}

const buildGrid = () => {
  let todos = []
  let data = '2026-12-31'
  const fim = '2027-01-30'
  while (data <= fim) {
    todos = todos.concat(slotsDoDia(data))
    data = proximoDia(data)
  }
  return todos
}

// Datas que já existem na grade da 0067 (30/11–25/12) e precisam de status
// ajustado: 08/12 mantém aberto só 08:00–11:30; 24/12 e 25/12 fecham.
// A 0067 cria esses slots como ABERTO, então o ajuste é feito aqui.
const DATAS_JA_EXISTENTES = ['2026-12-08', '2026-12-24', '2026-12-25']

const statusDoSlotExistente = (isoDate, startMinutes) => {
  if (DATAS_FECHADAS.indexOf(isoDate) >= 0) return 'BLOQUEADO'
  const especial = HORARIOS_ESPECIAIS[isoDate]
  if (especial) {
    return startMinutes >= especial.inicio && startMinutes < especial.fim ? 'ABERTO' : 'BLOQUEADO'
  }
  return 'ABERTO'
}

// minutos do dia a partir do slot_id (formato slot-YYYY-MM-DD-HHMM)
const inicioDoSlot = (slotId) => {
  const partes = String(slotId || '').split('-')
  const hhmm = partes[partes.length - 1] || ''
  if (hhmm.length !== 4) return -1
  const h = parseInt(hhmm.slice(0, 2), 10)
  const m = parseInt(hhmm.slice(2), 10)
  if (isNaN(h) || isNaN(m)) return -1
  return h * 60 + m
}

migrate(
  (app) => {
    const slotsCollection = app.findCollectionByNameOrId('agenda_slots')

    // 1. ajusta as datas da grade vigente (0067)
    let ajustados0067 = 0
    for (const isoDate of DATAS_JA_EXISTENTES) {
      let registros = []
      try {
        registros = app.findRecordsByFilter('agenda_slots', 'slot_id ~ {:p}', '', 0, 0, {
          p: `slot-${isoDate}-`,
        })
      } catch (_) {}
      for (const record of registros) {
        const inicio = inicioDoSlot(record.getString('slot_id', ''))
        const desejado = statusDoSlotExistente(isoDate, inicio)
        if (record.getString('status', '') !== desejado) {
          record.set('status', desejado)
          app.save(record)
          ajustados0067 += 1
        }
      }
    }

    // 2. gera a janela nova (31/12/2026–30/01/2027)
    const grid = buildGrid()
    let criados = 0
    let atualizados = 0
    grid.forEach((data) => {
      try {
        const existente = app.findFirstRecordByData('agenda_slots', 'slot_id', data.slot_id)
        // já existe (grade da 0067): reaplica status para respeitar feriado
        if (existente.getString('status', '') !== data.status) {
          existente.set('status', data.status)
          app.save(existente)
          atualizados += 1
        }
      } catch (_) {
        const record = new Record(slotsCollection)
        Object.entries(data).forEach(([key, value]) => record.set(key, value))
        app.save(record)
        criados += 1
      }
    })
    console.log(
      'grade T06 aplicada',
      'ajustados0067',
      String(ajustados0067),
      'criados',
      String(criados),
      'atualizados',
      String(atualizados),
    )
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter(
        'agenda_slots',
        'created_by = {:t}',
        '-slot_datetime',
        0,
        0,
        { t: GRADE_TAG },
      )
      records.forEach((record) => app.delete(record))
    } catch (_) {}
    try {
      const fechados = app.findRecordsByFilter('agenda_slots', "status = 'BLOQUEADO'", '', 0, 0)
      fechados.forEach((record) => {
        record.set('status', 'ABERTO')
        app.save(record)
      })
    } catch (_) {}
  },
)
