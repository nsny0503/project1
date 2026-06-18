interface Clause {
  text: string
  risk: 'safe' | 'warn' | 'danger'
  explanation: string
  suggestedAlternative: string
}

interface Contract {
  id: string
  created_at: string
  ll_name: string
  ll_id_num: string
  ll_phone: string
  ll_reg_no?: string
  ll_address: string
  ll_address_detail: string
  ll_housing_type: string
  ll_area: string
  ll_floor: string
  ll_total_floor: string
  ll_deposit: string
  ll_monthly_rent: string
  ll_mgmt_fee: string
  ll_mgmt_includes: string[]
  ll_start_date: string
  ll_end_date: string
  ll_payment_day: string
  ll_tenant_name?: string
  ll_tenant_phone?: string
  contract_type: 'A' | 'B' | 'C'
  clauses: Clause[]
  link_expires_at?: string
  tt_name?: string
  tt_nationality?: string
  tt_id_num?: string
  tt_phone?: string
  tt_visa_type?: string
  tt_signed: boolean
  tt_signed_at?: string
  ll_signed: boolean
  ll_signed_at?: string
}

interface ClauseRequest {
  id: string
  created_at: string
  contract_id: string
  clause_index: number
  message: string
  suggested_alternative: string
  status: 'pending' | 'accepted' | 'rejected'
  updated_clause?: string
  responded_at?: string
}

interface DepositAnalysis {
  risk: 'safe' | 'warn' | 'danger' | 'unknown'
  riskLabel: string
  message: string
  medianDeposit?: number
  sampleCount?: number
  ratio?: number
}

export type { Clause, Contract, ClauseRequest, DepositAnalysis }
