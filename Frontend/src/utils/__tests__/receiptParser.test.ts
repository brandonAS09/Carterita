import { describe, test, expect } from '@jest/globals';
import { isTicketDateUsable, parseReceipt, ReceiptLine } from '../receiptParser';
import { getLocalNoonISO, toLocalDateKey } from '../dateUtils';

const HOY = '2026-11-03';
const ROW_HEIGHT = 30;
const ROW_GAP = 50;

/** Cada renglón del ticket es un texto o [izquierda, derecha] detectados como líneas separadas. */
const ticket = (rows: (string | [string, string])[]): ReceiptLine[] =>
  rows.flatMap((row, i) => {
    const top = i * ROW_GAP;
    const line = (text: string, left: number, skew = 0): ReceiptLine => ({
      text,
      frame: { left, top: top + skew, width: 200, height: ROW_HEIGHT },
    });
    return typeof row === 'string' ? [line(row, 20)] : [line(row[1], 400, 6), line(row[0], 20)];
  });

const parse = (rows: (string | [string, string])[]) => parseReceipt(ticket(rows), HOY);

describe('ticket completo por tipo de comercio', () => {
  test('tienda de conveniencia con columnas separadas', () => {
    const r = parse([
      'OXXO',
      'CADENA COMERCIAL OXXO, S.A. DE C.V.',
      'RFC CCO8605231N4',
      'AV. REVOLUCION 1234, TIJUANA',
      '03/11/2026 14:32',
      ['COCA COLA 600ML', '$18.00'],
      ['SABRITAS', '$20.00'],
      ['TOTAL', '$38.00'],
      ['EFECTIVO', '$50.00'],
      ['CAMBIO', '$12.00'],
    ]);
    expect(r).toEqual({
      total: 38,
      candidatos: [38, 20, 18],
      comercio: 'OXXO',
      fecha: '2026-11-03',
      categoria: 'Comida',
      confianza: 'alta',
    });
  });

  test('supermercado con muchos artículos y ahorro', () => {
    const r = parse([
      'WALMART',
      'NUEVA WAL MART DE MEXICO S DE RL',
      'FECHA: 02-11-26',
      '2 LECHE 1L 52.00',
      'HUEVO 18 PZ 64.50',
      'TORTILLA 1KG 24.00',
      'SUBTOTAL 140.50',
      'AHORRO 10.00',
      'TOTAL DE ARTICULOS 4',
      'TOTAL 140.50',
      'TARJETA DEBITO 140.50',
    ]);
    expect(r.total).toBe(140.5);
    expect(r.fecha).toBe('2026-11-02');
    expect(r.categoria).toBe('Comida');
  });

  test('gasolinera solo con IMPORTE', () => {
    const r = parse(['SERVICIO GASOLINERO DEL NORTE', 'PEMEX', 'LITROS 21.50', 'PRECIO 23.25', 'IMPORTE 499.88']);
    expect(r.total).toBe(499.88);
    expect(r.categoria).toBe('Transporte');
    expect(r.comercio).toBe('SERVICIO GASOLINERO DEL NORTE');
  });

  test('OXXO Gas es Transporte, no Comida', () => {
    expect(parse(['OXXO GAS', 'TOTAL 300.00']).categoria).toBe('Transporte');
  });

  test('farmacia', () => {
    const r = parse(['FARMACIAS GUADALAJARA', 'SUCURSAL OTAY', 'PARACETAMOL 45.00', 'IVA 0.00', 'TOTAL A PAGAR 45.00']);
    expect(r.total).toBe(45);
    expect(r.comercio).toBe('FARMACIAS GUADALAJARA');
    expect(r.categoria).toBe('Salud');
  });

  test('restaurante con propina', () => {
    const r = parse([
      'RESTAURANTE LA COSTA',
      'SUBTOTAL 431.03',
      'IVA 68.97',
      'TOTAL 500.00',
      'PROPINA 50.00',
      'TOTAL CON PROPINA 550.00',
    ]);
    expect(r.total).toBe(550);
    expect(r.categoria).toBe('Comida');
  });

  test('restaurante con propina sugerida: no la suma', () => {
    const r = parse(['TOTAL 500.00', 'PROPINA SUGERIDA 10% 50.00', 'TOTAL CON PROPINA SUGERIDA']);
    expect(r.total).toBe(500);
  });
});

describe('selección del total', () => {
  test('Escenario 4: subtotal, IVA, efectivo y cambio', () => {
    const r = parse([
      ['SUBTOTAL', '86.21'],
      ['IVA', '13.79'],
      ['TOTAL', '100.00'],
      ['EFECTIVO', '200.00'],
      ['CAMBIO', '100.00'],
    ]);
    expect(r.total).toBe(100);
    expect(r.confianza).toBe('alta');
  });

  test.each([
    ['SUB TOTAL 80.00', 'TOTAL 92.80', 92.8],
    ['SUB-TOTAL 80.00', 'TOTAL 92.80', 92.8],
    ['I.V.A. 16% 12.80', 'TOTAL 92.80', 92.8],
    ['DESCUENTO 15.00', 'TOTAL 92.80', 92.8],
    ['TOTAL 92.80', 'SU CAMBIO 7.20', 92.8],
    ['TOTAL 92.80', 'PAGO CON 100.00', 92.8],
    ['TOTAL 92.80', 'RECIBIDO 100.00', 92.8],
    ['TOTAL 92.80', 'TOTAL DLLS 5.10', 92.8],
  ])('%s + %s', (a, b, esperado) => {
    expect(parse([a, b]).total).toBe(esperado);
  });

  test.each([
    ['TOTAL A PAGAR 123.45', 123.45],
    ['IMPORTE TOTAL 123.45', 123.45],
    ['TOTAL M.N. 123.45', 123.45],
    ['VENTA TOTAL 123.45', 123.45],
    ['Total: $123.45', 123.45],
    ['TOTAL $ 1,234.50', 1234.5],
    ['TOTAL 1.234,50', 1234.5],
    ['TOTAL $85,00', 85],
    ['TÓTAL 85.00', 85],
    ['T0TAL 85.00', 85],
    ['TOTAL 1O0.00', 100],
    ['TOTAL 85.O0', 85],
    ['TOTAL 100 .00', 100],
  ])('formato: %s', (renglon, esperado) => {
    expect(parse([renglon]).total).toBe(esperado);
  });

  test('un total más específico gana aunque esté arriba', () => {
    expect(parse(['TOTAL A PAGAR 200.00', 'TOTAL 150.00']).total).toBe(200);
  });

  test('en empate gana el más abajo del ticket', () => {
    expect(parse(['TOTAL 90.00', 'CUPON APLICADO', 'TOTAL 75.00']).total).toBe(75);
  });

  test('TOTAL sin monto toma el monto del renglón siguiente', () => {
    expect(parse(['TOTAL', '$250.00', 'GRACIAS POR SU COMPRA']).total).toBe(250);
  });

  test('TOTAL sin monto no toma el de otro concepto', () => {
    expect(parse(['TOTAL', 'EFECTIVO 200.00']).total).toBeNull();
  });

  test('la columna "TOTAL" del encabezado no se confunde con el total', () => {
    const r = parse(['CANT DESCRIPCION PRECIO TOTAL', '1 TACOS 45.00 45.00', '2 REFRESCO 25.00 50.00', 'TOTAL 95.00']);
    expect(r.total).toBe(95);
  });

  test('renglón que dice TOTAL pero cae en la siguiente línea por la inclinación', () => {
    const lines: ReceiptLine[] = [
      { text: 'TOTAL', frame: { left: 20, top: 100, width: 100, height: 30 } },
      { text: '$64.00', frame: { left: 400, top: 125, width: 100, height: 30 } },
    ];
    expect(parseReceipt(lines, HOY).total).toBe(64);
  });

  test('ignora fechas, teléfonos, folios y porcentajes como montos', () => {
    const r = parse(['TEL 664-123-4567', 'FOLIO 00012345', '03.11.26', 'IVA 16.00%', 'GRACIAS']);
    expect(r.total).toBeNull();
    expect(r.candidatos).toEqual([]);
    expect(r.confianza).toBe('baja');
  });

  test('la cantidad delante del precio no se une al monto', () => {
    expect(parse(['2 100.00']).candidatos).toEqual([100]);
  });
});

describe('sin total confiable (D10)', () => {
  test('sugiere montos de mayor a menor, sin duplicados ni pagos', () => {
    const r = parse(['ABARROTES LUPITA', 'JABON 25.00', 'ARROZ 40.50', 'JABON 25.00', 'EFECTIVO 100.00']);
    expect(r.total).toBeNull();
    expect(r.candidatos).toEqual([40.5, 25]);
    expect(r.confianza).toBe('media');
  });

  test('limita las sugerencias a 4', () => {
    const r = parse(['A 1.00', 'B 2.00', 'C 3.00', 'D 4.00', 'E 5.00']);
    expect(r.candidatos).toEqual([5, 4, 3, 2]);
  });

  test('si solo hay montos de pago, los ofrece', () => {
    expect(parse(['EFECTIVO 200.00']).candidatos).toEqual([200]);
  });

  test('sin líneas', () => {
    expect(parseReceipt([], HOY)).toEqual({
      total: null,
      candidatos: [],
      comercio: null,
      fecha: null,
      categoria: null,
      confianza: 'baja',
    });
  });
});

describe('comercio', () => {
  test('ignora RFC, direcciones, teléfonos y la palabra TICKET', () => {
    const r = parse(['TICKET DE VENTA', 'RFC ABC123456XY1', 'CALLE 5 NUM 20', 'TEL 6641234567', 'TAQUERIA EL GUERO', 'TOTAL 80.00']);
    expect(r.comercio).toBe('TAQUERIA EL GUERO');
    expect(r.categoria).toBe('Comida');
  });

  test('quita la razón social', () => {
    expect(parse(['COMERCIAL DEL PACIFICO, S.A. DE C.V.']).comercio).toBe('COMERCIAL DEL PACIFICO');
  });

  test('ignora ruido de símbolos', () => {
    expect(parse(['*** --- ***', '12345', 'SORIANA']).comercio).toBe('SORIANA');
  });

  test('no toma como comercio un renglón con monto', () => {
    expect(parse(['TOTAL 50.00']).comercio).toBeNull();
  });

  test('usa el diccionario de voz si no es un comercio conocido', () => {
    expect(parse(['LAVANDERIA LA BURBUJA', 'TOTAL 60.00']).categoria).toBe('Servicios');
  });

  test('un teléfono en el ticket no vuelve Servicios la categoría', () => {
    expect(parse(['TIENDITA DON JOSE', 'TELEFONO 6641234567', 'TOTAL 60.00']).categoria).toBeNull();
  });
});

describe('fecha', () => {
  test.each([
    ['02/11/2026', '2026-11-02'],
    ['02-11-26', '2026-11-02'],
    ['2026-11-02', '2026-11-02'],
    ['02.11.2026', '2026-11-02'],
    ['02 NOV 2026', '2026-11-02'],
    ['02/NOV/26', '2026-11-02'],
    ['2 DE NOVIEMBRE DE 2026', '2026-11-02'],
    ['02 ENE 26', '2026-01-02'],
    ['FECHA: 15/10/2026 HORA: 13:45', '2026-10-15'],
    ['10/25/2026', '2026-10-25'],
  ])('formato: %s', (renglon, esperada) => {
    expect(parse([renglon]).fecha).toBe(esperada);
  });

  test.each([
    ['fecha futura', '04/11/2026'],
    ['fecha imposible', '32/13/2026'],
    ['teléfono', '664-123-4567'],
  ])('ignora %s', (_nombre, renglon) => {
    expect(parse([renglon]).fecha).toBeNull();
  });

  test('prefiere el renglón que dice FECHA', () => {
    expect(parse(['VIGENCIA 01/01/2026', 'FECHA 02/11/2026']).fecha).toBe('2026-11-02');
  });

  test('si la primera fecha es futura, usa la siguiente válida', () => {
    expect(parse(['VENCE 31/12/2027', '02/11/2026']).fecha).toBe('2026-11-02');
  });
});

describe('isTicketDateUsable (D9)', () => {
  const INICIO = '2026-11-01';
  test('un gasto registrado con la fecha del ticket queda en ese día local', () => {
    expect(toLocalDateKey(new Date(getLocalNoonISO('2026-11-02')))).toBe('2026-11-02');
  });

  test.each([
    ['ayer dentro del ciclo', '2026-11-02', true],
    ['primer día del ciclo', '2026-11-01', true],
    ['hoy: no hace falta opción', '2026-11-03', false],
    ['antes del ciclo', '2026-10-31', false],
    ['futura', '2026-11-04', false],
    ['sin fecha', null, false],
  ])('%s', (_nombre, fecha, esperado) => {
    expect(isTicketDateUsable(fecha, HOY, INICIO)).toBe(esperado);
  });
});
