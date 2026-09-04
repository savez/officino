// Il bundle UMD di Bootstrap, sotto Vite, viene pre-compilato come CommonJS:
// prende il ramo `module.exports = ...` e NON popola `window.bootstrap`.
// Chi si affidava a quel globale non ha mai visto un tooltip, in silenzio.
// Questo modulo e' l'unico punto in cui si entra nel JS di Bootstrap: importa
// il bundle (che contiene gia' Popper, percio' `@popperjs/core` non serve) e
// ne espone i costruttori come veri export.
import bundle from 'bootstrap/dist/js/bootstrap.bundle.min.js'

export const Tooltip = bundle.Tooltip
export const Popover = bundle.Popover
export const Modal = bundle.Modal
export default bundle
