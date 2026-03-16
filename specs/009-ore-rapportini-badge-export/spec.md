# Spec 009 — Badge ore, Dashboard per operaio, Export Excel

**Feature Branch**: `feature/ore-rapportini-badge-export`
**Created**: 2026-03-14
**Status**: Approved

---

## Obiettivo

Aggiungere tre feature complementari per migliorare il tracciamento ore:
1. Badge con somma ore totali filtrate nella pagina Rapportini
2. Grafico ore per operaio nella Dashboard (admin only)
3. Export Excel ore per operaio/cliente con filtro mese/anno (admin only)

---

## User Stories

| ID | Come | Voglio | Per |
|----|------|--------|-----|
| US-1 | Operaio | Vedere le ore totali di tutte le righe che corrispondono ai miei filtri | Sapere il totale anche se sono su pagina 2 della paginazione |
| US-2 | Admin | Vedere ore totali per ogni operaio nel mese | Monitorare il carico di lavoro del team |
| US-3 | Admin | Exportare ore in Excel raggruppate per operaio e cliente | Fatturare e analizzare i dati offline |

---

## Requisiti Funzionali

### RF-1 — Badge ore totali in Rapportini
- **Dove**: sopra/accanto al testo "Totale: N righe" nella pagina Rapportini
- **Cosa**: badge con icona orologio + numero ore totali + unità "h"
- **Colore**: blu (bg-primary), come le altre statistiche
- **Calcolo**: somma di TUTTE le righe che corrispondono ai filtri attivi (non solo della pagina corrente)
- **Aggiornamento**: automatico quando i filtri cambiano o si clicca "Applica"

### RF-2 — Ore per operaio in Dashboard
- **Dove**: nuova riga grafico nella Dashboard, dopo i KPI card, solo admin
- **Cosa**: grafico a barre orizzontali (stessa libreria Chart.js)
- **Dati**: una barra per operaio, mostra ore totali ordinate decrescenti
- **Colore**: viola (#6f42c1)
- **Badge**: "admin" grigio accanto al titolo
- **Visibilità**: solo admin
- **Top N**: non limitato (mostra tutti gli operai che hanno ore nel mese)

### RF-3 — Export Excel ore
- **Dove**: bottone "Esporta Excel" nella Dashboard accanto ai selettori mese/anno, solo admin
- **Struttura file**: 3 fogli Excel
  - Foglio 1 - "Ore per Operaio": Operaio | Ore Totali | Ore in Nota | Ore non Gestite
  - Foglio 2 - "Ore per Cliente": Cliente | Ore Totali | Ore in Nota | Ore non Gestite
  - Foglio 3 - "Dettaglio": Giorno | Operaio | Cliente | Ora Inizio | Ora Fine | Ore | In Nota | Macchina | Note
- **Filename**: `ore_YYYY_MM.xlsx` (es. `ore_2026_03.xlsx`)
- **Filtro**: mese e anno selezionati nella Dashboard
- **Download**: download automatico nel client (no pop-up)
- **Visibilità**: solo admin

---

## Requisiti Tecnici

### Backend

#### Modifica `GET /api/rapportini`
**Logica:**
- Mantenere la paginazione esistente (20 righe per pagina)
- Aggiungere un campo `ore_totali_filtrate` alla risposta, calcolato come somma ore di TUTTE le righe che matchano i filtri (ignora LIMIT/OFFSET)
- Calcolo ore in JavaScript (stessa logica di `dashboard.js`): `(ora_fine - ora_inizio)` in ore decimali

**Risposta JSON aggiornata:**
```json
{
  "data": [...],
  "pagination": { "page": 1, "perPage": 20, "total": 50, "totalPages": 3 },
  "ore_totali_filtrate": 87.5
}
```

#### Modifica `GET /api/dashboard/stats?mese=N&anno=N`
**Logica aggiunta per admin:**
- Eseguire una seconda aggregazione delle righe rapportino per `utente_id`/`utente_nome`
- Restituire array `ore.per_operaio` (non presente per utenti normali, array vuoto alternativa)

**Risposta JSON aggiornata (solo admin):**
```json
{
  "preventivi": {...},
  "ore": {
    "per_cliente": [...],
    "per_operaio": [
      { "utente_id": 1, "utente_nome": "Marco", "ore_totali": 18.5, "ore_in_nota": 12.0, "ore_non_gestite": 6.5 },
      { "utente_id": 2, "utente_nome": "Luca", "ore_totali": 24.0, "ore_in_nota": 20.0, "ore_non_gestite": 4.0 }
    ]
  }
}
```

#### Nuovo endpoint `GET /api/dashboard/export-ore?mese=N&anno=N`
**Auth**: JWT + admin only (`preHandler: [app.authenticate, app.requireRole('admin')]`)

**Query params**: `mese` (1-12), `anno` (>=2000)

**Logica:**
1. Fetch righe rapportino nel range data
2. Aggregare per operaio: somma ore, ore in nota, ore non gestite
3. Aggregare per cliente: somma ore, ore in nota, ore non gestite
4. Costruire Excel con 3 fogli via `xlsx`
5. Restituire con headers HTTP di download

**Headers HTTP risposta:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="ore_2026_03.xlsx"
```

---

### Frontend

#### Modifica `RapportiniPage.vue`
- Aggiungere `ref oreTotali = 0`
- Leggere da risposta API: `result.ore_totali_filtrate`
- Badge HTML nella sezione header:
```html
<span class="badge bg-primary ms-2">
  <i class="bi bi-clock me-1"></i>{{ oreTotali }} h totali
</span>
```

#### Nuovo componente `OrePerOperaioBarChart.vue`
- Stessa struttura di `OrePerClienteBarChart.vue`
- Props: `perOperaio` (array di `{ utente_nome, ore_totali, ore_in_nota, ore_non_gestite }`)
- Colore: `#6f42c1` (viola)
- Mostra messaggio "Nessuna ora registrata" se array vuoto
- Ordinato per `ore_totali` decrescente

#### Modifica `DashboardPage.vue`
- Aggiungere computed `perOperaio` da `stats.ore.per_operaio`
- Nuova riga grafico (solo admin):
```html
<div v-if="admin" class="row g-4 mb-4">
  <div class="col-12">
    <div class="card shadow-sm">
      <div class="card-header bg-white">
        <strong><i class="bi bi-person-check me-2 text-success"></i>Ore per operaio</strong>
        <span class="badge bg-secondary ms-2">admin</span>
      </div>
      <div class="card-body">
        <OrePerOperaioBarChart :per-operaio="perOperaio" />
      </div>
    </div>
  </div>
</div>
```
- Bottone "Esporta Excel" accanto ai selettori mese/anno:
```html
<button v-if="admin" class="btn btn-success btn-sm" @click="onExportExcel" :disabled="loading">
  <i class="bi bi-file-earmark-excel me-1"></i>Esporta Excel
</button>
```
- Funzione `onExportExcel()`: chiama service e fa download automatico

#### Modifica `frontend/src/services/dashboard.js`
- Nuova funzione:
```js
export async function exportOreExcel(mese, anno) {
  const response = await api.get('/dashboard/export-ore', {
    params: { mese, anno },
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ore_${anno}_${String(mese).padStart(2, '0')}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
```

---

## Test

### Backend (Jest) — `backend/tests/integration/rapportini.test.js` (nuovo file)

Test da scrivere:
1. **Autenticazione**: senza token → 401
2. **Paginazione**: lista restituisce `pagination` con `totalPages` corretto
3. **Filtri**: applicare filtro per cliente, giorno, gestita → risultati corretti
4. **RBAC**: operaio vede solo le proprie righe, admin vede tutte
5. **Ore totali filtrate**: calcolo corretto indipendentemente dalla pagina
6. **POST validazione**: ora_fine > ora_inizio, fuori_catalogo, cliente_id
7. **DELETE RBAC**: operaio non può cancellare righe altrui
8. **Materiali**: creazione e caricamento materiali

### Backend (Jest) — Aggiornamento `dashboard.test.js`

Test da aggiungere:
1. `per_operaio` presente nella risposta per admin
2. `per_operaio` assente/vuoto per utente normale
3. Endpoint `GET /export-ore` → 200 + file xlsx
4. `GET /export-ore` → 403 per utente normale
5. Contenuto Excel: 3 fogli, dati corretti

### Frontend (Vitest) — `OrePerOperaioBarChart.test.js` (nuovo file)

Test:
1. `perOperaio: []` → mostra messaggio "Nessuna ora registrata"
2. `perOperaio` con dati → canvas presente
3. Ordinamento decrescente per `ore_totali`

### Frontend (Vitest) — Aggiornamento `dashboard.test.js`

Test da aggiungere:
1. `exportOreExcel` chiama correttamente l'API
2. `exportOreExcel` fa download con filename corretto

---

## Success Criteria

- [ ] Badge ore totali visibile in Rapportini con valore corretto
- [ ] Grafico ore per operaio visibile in Dashboard solo per admin
- [ ] Bottone Esporta Excel funzionante, download file `.xlsx` con 3 fogli
- [ ] Tutti i test backend passano (Jest)
- [ ] Tutti i test frontend passano (Vitest)
- [ ] Build frontend senza errori (`pnpm build`)
- [ ] Build backend test senza errori (`npm test`)
