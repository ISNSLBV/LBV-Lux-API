/**
 * Utilidades para manejo de fechas en el backend
 */

/**
 * Formatea una fecha en formato dd/mm/aaaa
 * IMPORTANTE: Usa métodos UTC para evitar problemas de zona horaria
 * cuando la fecha viene de la base de datos (ej: "2000-01-01" no debe cambiar a 31/12/1999)
 * @param {Date|string} fecha - Fecha a formatear
 * @returns {string} Fecha en formato dd/mm/aaaa
 */
const formatearFecha = (fecha) => {
  if (!fecha) return '';
  
  try {
    const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
    
    // Usar métodos UTC para evitar conversión de zona horaria
    // Esto es crítico para fechas de nacimiento que vienen de la BD como "YYYY-MM-DD"
    const day = String(fechaObj.getUTCDate()).padStart(2, '0');
    const month = String(fechaObj.getUTCMonth() + 1).padStart(2, '0');
    const year = fechaObj.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return '';
  }
};

/**
 * Parsea una fecha del frontend y la convierte en fecha local sin zona horaria
 * @param {string} fechaString - Fecha en formato string del frontend
 * @returns {Date|null} Fecha parseada o null si es inválida
 */
const parsearFechaLocal = (fechaString) => {
  if (!fechaString) return null;
  
  try {
    // Si viene en formato ISO (YYYY-MM-DDTHH:MM), extraer componentes
    const match = fechaString.match(/(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    
    if (match) {
      const [, year, month, day, hour = 0, minute = 0] = match;
      // Crear fecha local usando componentes extraídos
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    
    // Fallback para otros formatos
    return new Date(fechaString);
  } catch (error) {
    return null;
  }
};

/**
 * Compara solo las fechas (sin tiempo) de dos fechas
 * IMPORTANTE: Usa componentes UTC para evitar problemas de zona horaria
 * @param {Date} fecha1 
 * @param {Date} fecha2 
 * @returns {number} -1 si fecha1 < fecha2, 0 si iguales, 1 si fecha1 > fecha2
 */
const compararSoloFechas = (fecha1, fecha2) => {
  // Usar UTC para consistencia con formatearFecha
  const f1 = new Date(fecha1.getUTCFullYear(), fecha1.getUTCMonth(), fecha1.getUTCDate());
  const f2 = new Date(fecha2.getUTCFullYear(), fecha2.getUTCMonth(), fecha2.getUTCDate());
  
  if (f1 < f2) return -1;
  if (f1 > f2) return 1;
  return 0;
};

module.exports = {
  formatearFecha,
  parsearFechaLocal,
  compararSoloFechas
};