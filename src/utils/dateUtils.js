/**
 * Utilidades para manejo de fechas en el backend
 */

/**
 * Formatea una fecha en formato dd/mm/aaaa
 * @param {Date|string} fecha - Fecha a formatear
 * @returns {string} Fecha en formato dd/mm/aaaa
 */
const formatearFecha = (fecha) => {
  if (!fecha) return '';
  
  try {
    const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
    const day = String(fechaObj.getDate()).padStart(2, '0');
    const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const year = fechaObj.getFullYear();
    
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
 * @param {Date} fecha1 
 * @param {Date} fecha2 
 * @returns {number} -1 si fecha1 < fecha2, 0 si iguales, 1 si fecha1 > fecha2
 */
const compararSoloFechas = (fecha1, fecha2) => {
  const f1 = new Date(fecha1.getFullYear(), fecha1.getMonth(), fecha1.getDate());
  const f2 = new Date(fecha2.getFullYear(), fecha2.getMonth(), fecha2.getDate());
  
  if (f1 < f2) return -1;
  if (f1 > f2) return 1;
  return 0;
};

module.exports = {
  formatearFecha,
  parsearFechaLocal,
  compararSoloFechas
};