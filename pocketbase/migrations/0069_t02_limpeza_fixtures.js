// T02 — Limpeza das fixtures da prova (padrão 0046/0049): remove o probe
// t02-dup-probe-1 (e seus eventos) e o usuário efêmero t02.prova da 0068.
// Regra do runbook: limpeza de fixture da PRÓPRIA prova é técnica (idempotente);
// decisão humana sobre fixtures antigas de outras tasks não é tocada aqui.

migrate(
  (app) => {
    // 1. probe de agendamento t02-dup-probe-1 (+ eventos vinculados)
    let probes = []
    try {
      probes = app.findRecordsByFilter(
        'lead_appointments',
        "appointment_id = 't02-dup-probe-1' || appointment_id ~ 't02-'",
        '',
        0,
        0,
      )
    } catch (_) {}
    for (const p of probes) {
      const apptId = p.getString('appointment_id', '')
      try {
        const evs = app.findRecordsByFilter(
          'lead_appointment_events',
          'appointment_id = {:a}',
          '',
          0,
          0,
          { a: apptId },
        )
        for (const ev of evs) app.delete(ev)
      } catch (_) {}
      app.delete(p)
    }
    // 2. eventos órfãos de probe (por segurança, por event_id conhecido)
    try {
      const orphans = app.findRecordsByFilter(
        'lead_appointment_events',
        "event_id ~ 't02-'",
        '',
        0,
        0,
      )
      for (const ev of orphans) app.delete(ev)
    } catch (_) {}
    // 3. usuário efêmero da 0068
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 't02.prova@fellice-fitness.local'))
    } catch (_) {}
  },
  (app) => {},
)
