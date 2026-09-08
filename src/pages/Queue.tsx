import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb, { type LeadHandoff, type HandoffStatus } from '@/lib/pocketbase/client'

const statuses: HandoffStatus[] = ['PENDENTE', 'ASSUMIDO', 'ENCERRADO_SEM_AGENDAMENTO']

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString('pt-BR') : '—')

const Queue = () => {
  const [handoffs, setHandoffs] = useState<LeadHandoff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await pb
        .collection<LeadHandoff>('lead_handoffs')
        .getFullList({ sort: '-created_at' })
      setHandoffs(result)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar a fila. Verifique seu acesso autorizado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!pb.authStore.isValid) {
      setLoading(false)
      setError('A fila exige acesso autenticado de Champion ou Consultor Comercial.')
      return
    }
    load()
  }, [])

  const updateHandoff = async (handoff: LeadHandoff, nextStatus: HandoffStatus) => {
    if (!pb.authStore.isValid) return
    setAction(handoff.id)
    setError('')
    try {
      const actorId = pb.authStore.record?.id || ''
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { status: nextStatus }
      if (nextStatus === 'ASSUMIDO') {
        patch.dono = actorId
        patch.assumed_at = now
      }
      if (nextStatus === 'ENCERRADO_SEM_AGENDAMENTO') {
        const reason = window.prompt('Informe o motivo do encerramento:')?.trim()
        if (!reason) {
          setError('O motivo do encerramento é obrigatório.')
          return
        }
        if (handoff.status !== 'ASSUMIDO') {
          setError('O caso precisa estar ASSUMIDO antes de ser encerrado.')
          return
        }
        patch.closed_at = now
        patch.motivo_encerramento = reason
        patch.responsavel_anterior = handoff.dono || ''
      }
      if (nextStatus === 'ASSUMIDO' && handoff.status !== 'PENDENTE') {
        setError('Somente casos PENDENTE podem ser assumidos.')
        return
      }
      await pb.collection('lead_handoffs').update(handoff.id, patch)
      await pb.collection('lead_handoff_events').create({
        event_id: crypto.randomUUID(),
        handoff_id: handoff.handoff_id,
        lead_submission_id: handoff.lead_submission_id,
        event_type: nextStatus === 'ASSUMIDO' ? 'HANDOFF_ASSUMED' : 'HANDOFF_CLOSED',
        occurred_at: now,
        actor_id: actorId,
        payload: { from: handoff.status, to: nextStatus },
      })
      await load()
    } catch (err) {
      console.error(err)
      setError('Não foi possível atualizar o encaminhamento. Nenhuma confirmação foi exibida.')
    } finally {
      setAction('')
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-orange-600">
              ← Voltar ao formulário
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
              Fellice Fitness
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Fila de atendimento humano</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Contexto preservado para consultores autorizados.
            </p>
          </div>
          <button
            onClick={load}
            className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-orange-700 dark:border-slate-700 dark:bg-slate-900 dark:text-orange-300"
          >
            Atualizar fila
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p>Carregando fila...</p>
        ) : handoffs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-200 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Nenhum encaminhamento encontrado.
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {handoffs.map((handoff) => (
              <article
                key={handoff.id}
                className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{handoff.nome}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {handoff.handoff_id} · {formatDate(handoff.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                    {handoff.status}
                  </span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-slate-500">Canal</dt>
                    <dd>{handoff.canal_de_retorno}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Versão</dt>
                    <dd>{handoff.form_version}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Objetivo</dt>
                    <dd>{handoff.objetivo}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Proximidade</dt>
                    <dd>{handoff.proximidade}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Ocupação</dt>
                    <dd>{handoff.ocupacao || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Interesse</dt>
                    <dd>{handoff.interesse_em_visita}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Atribuição</dt>
                    <dd>{handoff.attribution_status}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Dono</dt>
                    <dd>{handoff.dono || 'Sem dono'}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-3">
                  {handoff.status === 'PENDENTE' && (
                    <button
                      disabled={action === handoff.id}
                      onClick={() => updateHandoff(handoff, 'ASSUMIDO')}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Assumir caso
                    </button>
                  )}
                  {handoff.status === 'ASSUMIDO' && (
                    <button
                      disabled={action === handoff.id}
                      onClick={() => updateHandoff(handoff, 'ENCERRADO_SEM_AGENDAMENTO')}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
                    >
                      Encerrar sem agendamento
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-10 flex flex-wrap gap-2 text-xs text-slate-500">
          {statuses.map((status) => (
            <span key={status} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
              {status}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}

export default Queue
