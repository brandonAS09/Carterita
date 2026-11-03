import { addDaysToKey, diffInDays } from './dateUtils';
import { round2 } from './currencyUtils';

/**
 * F06 - Recálculo Inteligente del Presupuesto.
 * Funciones puras (sin BD ni fechas implícitas) para poder probarlas con Jest.
 * Todas las fechas son 'YYYY-MM-DD' locales; fecha_fin es inclusiva.
 */

export interface CycleDates {
  fechaInicio: string;
  fechaFin: string;
}

/**
 * Renovación automática: si el ciclo ya terminó, avanza ciclos contiguos
 * (cada uno inicia el día siguiente al fin del anterior) hasta cubrir `hoy`.
 */
export const resolveCurrentCycle = (cycle: CycleDates, hoy: string): CycleDates & { renovado: boolean } => {
  const duracion = diffInDays(cycle.fechaInicio, cycle.fechaFin) + 1;
  if (duracion <= 0 || diffInDays(cycle.fechaFin, hoy) <= 0) {
    return { ...cycle, renovado: false };
  }
  // Ciclos completos transcurridos desde fecha_fin, calculados de una vez (sin bucle)
  const diasDesdeFin = diffInDays(cycle.fechaFin, hoy); // >= 1
  const ciclosASaltar = Math.ceil(diasDesdeFin / duracion);
  const fechaInicio = addDaysToKey(cycle.fechaInicio, ciclosASaltar * duracion);
  return { fechaInicio, fechaFin: addDaysToKey(fechaInicio, duracion - 1), renovado: true };
};

export interface SmartBudgetInput {
  montoBase: number;
  fechaInicio: string;
  fechaFin: string;
  hoy: string;
  gastadoAntesDeHoy: number; // gastos del ciclo hasta ayer
  gastadoHoy: number;
  aportadoEnCiclo: number;   // aportes a metas dentro del ciclo (F07)
}

export type TipoAjuste = 'alza' | 'baja' | 'ninguno';

export interface SmartBudgetResult {
  limiteBase: number;           // monto_base / duración (referencia estática)
  limiteHoy: number;            // límite inteligente de hoy
  disponibleHoy: number;        // limiteHoy - gastadoHoy (puede ser negativo)
  saldoCiclo: number;           // lo que queda para hoy y los días restantes, antes de los gastos de hoy
  saldoRestanteCiclo: number;   // saldoCiclo - gastadoHoy (lo que el usuario ve como "saldo del ciclo")
  diasRestantes: number;        // incluye hoy
  ajuste: TipoAjuste;
  cicloAgotado: boolean;
  fechaRenovacion: string;      // día en que inicia el siguiente ciclo
}

const TOLERANCIA = 0.01; // diferencias menores a un centavo no cuentan como ajuste

export const calculateSmartBudget = (input: SmartBudgetInput): SmartBudgetResult => {
  const { montoBase, fechaInicio, fechaFin, hoy, gastadoAntesDeHoy, gastadoHoy, aportadoEnCiclo } = input;

  const duracion = Math.max(1, diffInDays(fechaInicio, fechaFin) + 1);
  const diasRestantes = Math.max(1, diffInDays(hoy, fechaFin) + 1);

  const limiteBase = montoBase / duracion;
  const saldoCiclo = montoBase - gastadoAntesDeHoy - aportadoEnCiclo;
  const limiteHoy = Math.max(0, saldoCiclo / diasRestantes);

  let ajuste: TipoAjuste = 'ninguno';
  if (hoy !== fechaInicio) {
    const diferencia = round2(limiteHoy) - round2(limiteBase);
    if (diferencia >= TOLERANCIA) ajuste = 'alza';
    else if (diferencia <= -TOLERANCIA) ajuste = 'baja';
  }

  return {
    limiteBase,
    limiteHoy,
    disponibleHoy: limiteHoy - gastadoHoy,
    saldoCiclo,
    saldoRestanteCiclo: saldoCiclo - gastadoHoy,
    diasRestantes,
    ajuste,
    cicloAgotado: saldoCiclo <= 0,
    fechaRenovacion: addDaysToKey(fechaFin, 1),
  };
};
