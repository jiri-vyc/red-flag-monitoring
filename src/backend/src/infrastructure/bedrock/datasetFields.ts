// Rules and policies may only reference these fields, so every rule stays evaluable over the challenge dataset.
export const AVAILABLE_DATA_FIELDS = `
Transakce:
- transaction_id, client_id, ts (datum a čas), amount (CZK), currency (ISO 4217)
- payer_country, payee_country (ISO 3166-1 alpha-2), payer_account, payee_account
- tx_type: incoming | outgoing | remittance

Klient:
- client_id, country, contract_date, contract_channel: in_person | distant
- is_pep (Y/N), client_type: natural_person | entrepreneur | legal_entity
- projected_monthly_volume_czk, projected_monthly_tx_count (očekávání ze smlouvy)
- q2_volume_czk, q2_tx_count, q2_max_tx_czk (skutečnost za Q2 2026)
- aml_risk_score: low | medium | high
`.trim();
