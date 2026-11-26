// T06 — usuário EFÊMERO de verificação (padrão 0068/0069 da T02).
//
// Contexto: a 0070 removeu o usuário de teste teste.r1@fellice-fitness.local
// (confirmado como teste pelo Champion em 26/11/2026). Sem ele, não há como
// abrir /fila, /visao, /funil, /dashboard e /saude para provar a própria T06 —
// e as contas permanentes (gerencia@, r1@, administracao@) têm senha que
// ninguém registrou.
//
// Este usuário existe SOMENTE para a prova técnica da T06 e é removido pela
// migração seguinte (0073), como aconteceu na 0068 → 0069.
// Não é conta de operação; não deve sobreviver à T06.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 't06.prova@fellice-fitness.local')
      return // já existe (idempotente)
    } catch (_) {}
    const record = new Record(users)
    record.set('email', 't06.prova@fellice-fitness.local')
    record.set('password', 'T06Prova@2026')
    record.set('passwordConfirm', 'T06Prova@2026')
    record.set('role', 'champion')
    record.set('name', 'Verificação T06')
    record.set('verified', true)
    app.save(record)
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 't06.prova@fellice-fitness.local'))
    } catch (_) {}
  },
)
