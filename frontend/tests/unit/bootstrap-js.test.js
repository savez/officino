import { describe, expect, it } from 'vitest'
import bundle, { Modal, Popover, Tooltip } from '../../src/bootstrap-js'

// Questo file esiste per un guasto preciso: `HelpTooltip` si affidava a
// `window.bootstrap.Tooltip`, che sotto Vite non esiste mai, e una guardia
// `?.` trasformava l'assenza in silenzio. Nessun tooltip si e' mai aperto in
// nessuna delle pagine, e nessun test se ne e' accorto.
describe('il ponte verso il JS di Bootstrap', () => {
  it('espone Tooltip come costruttore utilizzabile', () => {
    expect(typeof Tooltip).toBe('function')
    expect(Tooltip.VERSION).toMatch(/^5\./)
  })

  it('espone anche Popover e Modal', () => {
    expect(typeof Popover).toBe('function')
    expect(typeof Modal).toBe('function')
  })

  it('non lascia che il bundle si riduca a un oggetto vuoto', () => {
    // Se l'interop CJS/ESM si rompesse, `bundle` diventerebbe `{}` e ogni
    // export qui sopra sarebbe `undefined`: e' esattamente il modo in cui il
    // difetto originale e' passato inosservato.
    expect(Object.keys(bundle).length).toBeGreaterThan(5)
  })
})
