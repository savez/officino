# Spec 008 — Nuova Dashboard con Statistiche e Grafici

**Feature Branch**: `feature/nuova-dashboard`
**Created**: 2026-03-14
**Status**: Approved

---

## Obiettivo

Rifare completamente la pagina Home con una dashboard moderna che mostri statistiche significative: preventivi (totali, aperti, chiusi per stato) e ore lavorate (per cliente, suddivise tra gestite in nota di lavorazione e non gestite). Tutti i dati sono filtrabili per mese e anno.

---

## User Stories

| ID | Come | Voglio | Per |
|----|------|--------|-----|
| US-1 | Utente autenticato | Vedere i preventivi del mese filtrati per stato | Avere un colpo d'occhio sull'andamento commerciale |
| US-2 | Utente autenticato | Vedere le mie ore lavorate per cliente nel mese | Sapere quanto ho lavorato e per chi |
| US-3 | Admin | Vedere le ore di tutti gli operai aggregate per cliente | Monitorare il carico di lavoro per cliente |
| US-4 | Admin | Vedere quante ore sono già in nota di lavorazione vs non gestite | Sapere cosa ancora da fatturare |
| US-5 | Utente autenticato | Filtrare i dati per mese e anno | Confrontare periodi diversi |

---

## Endpoint Backend

### GET /api/dashboard/stats

**Query params:** `mese` (1-12), `anno` (es. 2026)
**Auth:** JWT required

**Risposta:**
```json
{
  "preventivi": {
    "totale": 42,
    "per_stato": { "bozza": 5, "approvato": 8, "rifiutato": 3, "scaduto": 2, "fatturato": 22, "cancellato": 2 },
    "aperti": 13,
    "chiusi": 29
  },
  "ore": {
    "per_cliente": [
      { "cliente_id": 1, "cliente_nome": "Rossi SRL", "ore_totali": 24.5, "ore_in_nota": 18.0, "ore_non_gestite": 6.5 }
    ]
  }
}
```

---

## Visibilità per Ruolo

| Elemento | Utente | Admin |
|----------|--------|-------|
| KPI Preventivi | Tutti i preventivi del periodo | Tutti i preventivi del periodo |
| KPI Ore | Solo le proprie ore | Ore di tutti gli operai |
| Grafico doughnut preventivi | Visibile | Visibile |
| Grafico barre ore/cliente | Visibile (solo propri clienti) | Visibile (tutti i clienti) |
| Grafico ore gestite vs non gestite | Nascosto | Visibile |
