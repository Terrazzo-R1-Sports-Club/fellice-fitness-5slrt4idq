// F2-IMP-006 — Fechamento: remove o usuário sintético da /visao (teste humano aprovado
// pelo consultor em 2026-09-17). A senha provisória deixa de existir.

migrate(
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'visao.teste@fellice-fitness.local'))
    } catch (_) {}
  },
  (app) => {
    // down: sem restauração — usuário de teste
  },
)
