import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export type HandoffStatus = 'PENDENTE' | 'ASSUMIDO' | 'ENCERRADO_SEM_AGENDAMENTO'

export type LeadHandoff = {
  id: string
  handoff_id: string
  lead_submission_id: string
  form_id: string
  form_version: string
  created_at: string
  motivo: string
  nome: string
  canal_de_retorno: string
  objetivo: string
  proximidade: string
  ocupacao?: string
  interesse_em_visita: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  attribution_status: string
  status: HandoffStatus
  dono?: string
  assumed_at?: string
  closed_at?: string
  motivo_encerramento?: string
  responsavel_anterior?: string
}

export default pb
