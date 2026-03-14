<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'scanned'])

const manualBarcode = ref('')
const scannerError = ref('')
const scannerContainerId = 'barcode-scanner-container'

let html5Qrcode = null

watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      scannerError.value = ''
      manualBarcode.value = ''
      await nextTick()
      startScanner()
    } else {
      stopScanner()
    }
  }
)

onBeforeUnmount(() => {
  stopScanner()
})

async function startScanner() {
  try {
    html5Qrcode = new Html5Qrcode(scannerContainerId)

    await html5Qrcode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.7778,
      },
      onScanSuccess,
      () => {
        // Scan failure silently ignored (each frame that doesn't detect)
      }
    )
  } catch (err) {
    scannerError.value =
      'Impossibile avviare la fotocamera. Usa l\'inserimento manuale.'
    console.warn('Barcode scanner start error:', err)
  }
}

async function stopScanner() {
  if (html5Qrcode) {
    try {
      const state = html5Qrcode.getState()
      // state 2 = SCANNING
      if (state === 2) {
        await html5Qrcode.stop()
      }
    } catch {
      // Ignore errors during cleanup
    }
    try {
      html5Qrcode.clear()
    } catch {
      // Ignore
    }
    html5Qrcode = null
  }
}

function onScanSuccess(decodedText) {
  stopScanner()
  emit('scanned', decodedText)
  emit('close')
}

function onManualSubmit() {
  const code = manualBarcode.value.trim()
  if (code) {
    stopScanner()
    emit('scanned', code)
    emit('close')
  }
}

function handleClose() {
  stopScanner()
  emit('close')
}
</script>

<template>
  <div
    v-if="show"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    style="background-color: rgba(0, 0, 0, 0.5)"
    @click.self="handleClose"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Scansiona Barcode</h5>
          <button type="button" class="btn-close" @click="handleClose"></button>
        </div>

        <div class="modal-body">
          <!-- Scanner viewport -->
          <div
            :id="scannerContainerId"
            class="mb-3 border rounded overflow-hidden"
            style="min-height: 250px"
          ></div>

          <div v-if="scannerError" class="alert alert-warning mb-3">
            {{ scannerError }}
          </div>

          <!-- Manual fallback -->
          <hr />
          <p class="text-muted small mb-2">Oppure inserisci il codice manualmente:</p>
          <form @submit.prevent="onManualSubmit" class="d-flex gap-2">
            <input
              v-model="manualBarcode"
              type="text"
              class="form-control"
              placeholder="Codice a barre"
              autofocus
            />
            <button type="submit" class="btn btn-primary text-nowrap" :disabled="!manualBarcode.trim()">
              <i class="bi bi-search me-1"></i>Cerca
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
