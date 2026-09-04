import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FiltroPeriodo from '../FiltroPeriodo.vue';

// Data di riferimento fissa: mercoledì 15 luglio 2026. Senza, i test delle
// scorciatoie fallirebbero a ogni cambio di mese.
const OGGI = new Date(2026, 6, 15, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(OGGI);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Monta il componente con un intervallo iniziale valido.
 * @returns {object} wrapper del componente
 */
function montaFiltro() {
  return mount(FiltroPeriodo, {
    props: { da: '2026-07-01', a: '2026-07-31' },
  });
}

/**
 * Ultimo valore emesso da update:periodo.
 * @param {object} wrapper - wrapper del componente
 * @returns {object|undefined} intervallo emesso
 */
function ultimoEmesso(wrapper) {
  const eventi = wrapper.emitted('update:periodo');
  return eventi ? eventi[eventi.length - 1][0] : undefined;
}

describe('scorciatoie di periodo', () => {
  // Il difetto segnalato: premendo una scorciatoia il componente emetteva solo
  // il NOME della scorciatoia, senza date. Chi la riceveva non aveva modo di
  // filtrare, e le date sparivano dai campi facendo comparire un messaggio di
  // errore.
  it('emette date concrete, non il nome della scorciatoia', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[0].trigger('click');

    const emesso = ultimoEmesso(wrapper);
    expect(emesso).toBeDefined();
    expect(emesso.da).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(emesso.a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('questo mese: dal primo all ultimo giorno del mese corrente', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[0].trigger('click');

    expect(ultimoEmesso(wrapper)).toEqual({ da: '2026-07-01', a: '2026-07-31' });
  });

  it('mese scorso: il mese precedente per intero', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[1].trigger('click');

    expect(ultimoEmesso(wrapper)).toEqual({ da: '2026-06-01', a: '2026-06-30' });
  });

  it('ultimi 30 giorni: finisce oggi e ne comprende 30', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[2].trigger('click');

    expect(ultimoEmesso(wrapper)).toEqual({ da: '2026-06-16', a: '2026-07-15' });
  });

  it('quest anno: dal primo gennaio a oggi', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[3].trigger('click');

    expect(ultimoEmesso(wrapper)).toEqual({ da: '2026-01-01', a: '2026-07-15' });
  });

  // È il messaggio che l'utente vedeva comparire premendo una scorciatoia.
  it('non mostra alcun errore dopo una scorciatoia', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[0].trigger('click');

    expect(wrapper.find('.text-danger').exists()).toBe(false);
  });

  it('aggiorna i campi visibili con le date risolte', async () => {
    const wrapper = montaFiltro();

    await wrapper.findAll('button')[1].trigger('click');

    const campi = wrapper.findAll('input[type="date"]');
    expect(campi[0].element.value).toBe('2026-06-01');
    expect(campi[1].element.value).toBe('2026-06-30');
  });
});

describe('intervallo scelto a mano', () => {
  it('emette le date inserite', async () => {
    const wrapper = montaFiltro();
    const campi = wrapper.findAll('input[type="date"]');

    await campi[0].setValue('2026-03-01');
    await campi[1].setValue('2026-03-31');

    expect(ultimoEmesso(wrapper)).toEqual({ da: '2026-03-01', a: '2026-03-31' });
  });

  it('segnala la fine precedente all inizio e non emette', async () => {
    const wrapper = montaFiltro();
    const campi = wrapper.findAll('input[type="date"]');

    await campi[1].setValue('2026-06-01');

    expect(wrapper.find('.text-danger').exists()).toBe(true);
    expect(ultimoEmesso(wrapper)).toBeUndefined();
  });

  it('segnala un intervallo troppo ampio', async () => {
    const wrapper = montaFiltro();
    const campi = wrapper.findAll('input[type="date"]');

    await campi[0].setValue('2020-01-01');

    expect(wrapper.find('.text-danger').text()).toMatch(/ampio/i);
  });
});
