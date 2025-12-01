/**
 * Utilidades para la gestión de exámenes finales
 * Contiene la lógica para manejar intentos consecutivos y reglas de aprobación
 */

const { InscripcionExamenFinal, ExamenFinal } = require("../models");
const { Op } = require("sequelize");

/**
 * Constantes para las reglas de exámenes finales
 */
const CONSTANTES_EXAMENES = {
  MAX_INTENTOS_TOTALES: 8, // Máximo de intentos totales por inscripción (alumnos regulares)
  MAX_DESAPROBACIONES_CONSECUTIVAS: 4, // Máximo de desaprobaciones consecutivas antes de perder la regularidad
  MAX_INTENTOS_LIBRE: 1, // Alumnos libres solo tienen 1 intento
};

/**
 * Constantes para tipos de alumno
 * 1 = Regular, 2 = Libre, 3 = Oyente, 4 = Itinerante
 */
const TIPOS_ALUMNO = {
  REGULAR: 1,
  LIBRE: 2,
  OYENTE: 3,
  ITINERANTE: 4,
};

/**
 * Determina si una nota es aprobatoria según el tipo de aprobación de la materia
 * @param {number} nota - Nota obtenida en el examen (0-10)
 * @param {string} tipoAprobacion - Tipo de aprobación de la materia ('EP', 'P', 'NP')
 * @returns {boolean} - true si la nota es aprobatoria, false si no
 */
const esNotaAprobatoria = (nota, tipoAprobacion) => {
  if (nota === null || nota === undefined) return false;
  
  // EP (Exclusivamente Promocionable): solo aprueba con 7 o más
  if (tipoAprobacion === "EP") {
    return nota >= 7;
  }
  
  // P (Promocionable) y NP (No Promocionable): aprueba con 4 o más
  return nota >= 4;
};

/**
 * Cuenta los intentos de examen final para una inscripción a materia específica
 * Solo cuenta los exámenes que ya tienen nota asignada (finalizados)
 * @param {number} idInscripcionMateria - ID de la inscripción a la materia
 * @param {number} idUsuarioAlumno - ID del usuario alumno
 * @returns {Promise<Object>} - Objeto con estadísticas de intentos
 */
const contarIntentosExamenFinal = async (idInscripcionMateria, idUsuarioAlumno) => {
  const inscripciones = await InscripcionExamenFinal.findAll({
    where: {
      id_inscripcion_materia: idInscripcionMateria,
      id_usuario_alumno: idUsuarioAlumno,
      nota: { [Op.not]: null }, // Solo contar los que ya tienen nota
    },
    include: [
      {
        model: ExamenFinal,
        as: "examenFinal",
        attributes: ["id", "fecha", "estado"],
      },
    ],
    order: [
      [{ model: ExamenFinal, as: "examenFinal" }, "fecha", "ASC"],
      ["fecha_inscripcion", "ASC"],
    ],
  });

  return {
    totalIntentos: inscripciones.length,
    inscripciones: inscripciones,
  };
};

/**
 * Cuenta las desaprobaciones consecutivas más recientes para una inscripción a materia
 * @param {number} idInscripcionMateria - ID de la inscripción a la materia
 * @param {number} idUsuarioAlumno - ID del usuario alumno
 * @param {string} tipoAprobacion - Tipo de aprobación de la materia ('EP', 'P', 'NP')
 * @param {number|null} nuevaNota - Nueva nota a considerar (opcional, para calcular incluyendo la nota que se está por guardar)
 * @returns {Promise<number>} - Cantidad de desaprobaciones consecutivas
 */
const contarDesaprobacionesConsecutivas = async (
  idInscripcionMateria,
  idUsuarioAlumno,
  tipoAprobacion,
  nuevaNota = null
) => {
  const { inscripciones } = await contarIntentosExamenFinal(
    idInscripcionMateria,
    idUsuarioAlumno
  );

  // Crear array de notas ordenadas cronológicamente
  let notas = inscripciones.map((insc) => parseFloat(insc.nota));
  
  // Si hay una nueva nota para considerar, agregarla al final
  if (nuevaNota !== null) {
    notas.push(parseFloat(nuevaNota));
  }

  // Contar desaprobaciones consecutivas desde el final hacia atrás
  let consecutivas = 0;
  for (let i = notas.length - 1; i >= 0; i--) {
    if (!esNotaAprobatoria(notas[i], tipoAprobacion)) {
      consecutivas++;
    } else {
      // Si encontramos una aprobación, se corta la racha
      break;
    }
  }

  return consecutivas;
};

/**
 * Verifica si el alumno puede inscribirse a un nuevo examen final
 * basándose en la cantidad de intentos y desaprobaciones consecutivas
 * @param {number} idInscripcionMateria - ID de la inscripción a la materia
 * @param {number} idUsuarioAlumno - ID del usuario alumno
 * @param {string} tipoAprobacion - Tipo de aprobación de la materia
 * @returns {Promise<Object>} - Objeto con el resultado de la verificación
 */
const verificarPuedeRendirFinal = async (
  idInscripcionMateria,
  idUsuarioAlumno,
  tipoAprobacion
) => {
  const { totalIntentos } = await contarIntentosExamenFinal(
    idInscripcionMateria,
    idUsuarioAlumno
  );

  const desaprobacionesConsecutivas = await contarDesaprobacionesConsecutivas(
    idInscripcionMateria,
    idUsuarioAlumno,
    tipoAprobacion
  );

  // Verificar si superó el máximo de intentos totales
  if (totalIntentos >= CONSTANTES_EXAMENES.MAX_INTENTOS_TOTALES) {
    return {
      puede: false,
      razon: `Has alcanzado el máximo de ${CONSTANTES_EXAMENES.MAX_INTENTOS_TOTALES} intentos para rendir este examen final.`,
      totalIntentos,
      desaprobacionesConsecutivas,
    };
  }

  // Verificar si tiene 4 desaprobaciones consecutivas
  if (desaprobacionesConsecutivas >= CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS) {
    return {
      puede: false,
      razon: `Has desaprobado ${CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS} veces consecutivas. Debes volver a regularizar la materia para poder rendir nuevamente.`,
      totalIntentos,
      desaprobacionesConsecutivas,
    };
  }

  return {
    puede: true,
    razon: null,
    totalIntentos,
    desaprobacionesConsecutivas,
    intentosRestantes: CONSTANTES_EXAMENES.MAX_INTENTOS_TOTALES - totalIntentos,
    desaprobacionesHastaPerderRegularidad: CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS - desaprobacionesConsecutivas,
  };
};

/**
 * Determina si al asignar una nota desaprobatoria se debe marcar la inscripción_materia como desaprobada
 * @param {number} idInscripcionMateria - ID de la inscripción a la materia
 * @param {number} idUsuarioAlumno - ID del usuario alumno
 * @param {string} tipoAprobacion - Tipo de aprobación de la materia
 * @param {number} nuevaNota - La nueva nota que se está por asignar
 * @param {number} tipoAlumno - Tipo de alumno (1=Regular, 2=Libre, 3=Oyente, 4=Itinerante)
 * @returns {Promise<Object>} - Objeto indicando si se debe desaprobar la inscripción materia
 */
const debeDesaprobarInscripcionMateria = async (
  idInscripcionMateria,
  idUsuarioAlumno,
  tipoAprobacion,
  nuevaNota,
  tipoAlumno = TIPOS_ALUMNO.REGULAR
) => {
  // Si la nota es aprobatoria, no hay que desaprobar
  if (esNotaAprobatoria(nuevaNota, tipoAprobacion)) {
    return {
      debeDesaprobar: false,
      razon: "La nota es aprobatoria",
    };
  }

  // Para alumnos LIBRES: una sola desaprobación = materia desaprobada
  if (tipoAlumno === TIPOS_ALUMNO.LIBRE) {
    return {
      debeDesaprobar: true,
      razon: "El alumno libre ha desaprobado su único intento de examen final. La materia queda desaprobada.",
      desaprobacionesConsecutivas: 1,
    };
  }

  // Para alumnos regulares e itinerantes: contar desaprobaciones consecutivas
  const desaprobacionesConsecutivas = await contarDesaprobacionesConsecutivas(
    idInscripcionMateria,
    idUsuarioAlumno,
    tipoAprobacion,
    nuevaNota
  );

  if (desaprobacionesConsecutivas >= CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS) {
    return {
      debeDesaprobar: true,
      razon: `El alumno ha desaprobado ${desaprobacionesConsecutivas} veces consecutivas (máximo permitido: ${CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS}). Se pierde la regularidad.`,
      desaprobacionesConsecutivas,
    };
  }

  return {
    debeDesaprobar: false,
    razon: `El alumno tiene ${desaprobacionesConsecutivas} desaprobaciones consecutivas. Aún puede intentar ${CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS - desaprobacionesConsecutivas} veces más.`,
    desaprobacionesConsecutivas,
    intentosRestantesAntesDePerderRegularidad: CONSTANTES_EXAMENES.MAX_DESAPROBACIONES_CONSECUTIVAS - desaprobacionesConsecutivas,
  };
};

/**
 * Verifica si un alumno LIBRE puede inscribirse al examen final
 * Los alumnos libres solo pueden inscribirse a UN examen final por inscripción a materia
 * @param {number} idInscripcionMateria - ID de la inscripción a la materia
 * @param {number} idUsuarioAlumno - ID del usuario alumno
 * @returns {Promise<Object>} - Objeto con el resultado de la verificación
 */
const verificarPuedeRendirFinalComoLibre = async (
  idInscripcionMateria,
  idUsuarioAlumno
) => {
  const { totalIntentos } = await contarIntentosExamenFinal(
    idInscripcionMateria,
    idUsuarioAlumno
  );

  // Los alumnos libres solo tienen 1 intento
  if (totalIntentos >= CONSTANTES_EXAMENES.MAX_INTENTOS_LIBRE) {
    return {
      puede: false,
      razon: "Ya has utilizado tu único intento de examen final como alumno libre. Debes inscribirte nuevamente a la materia para obtener otra oportunidad.",
      totalIntentos,
    };
  }

  // Verificar si hay una inscripción pendiente (sin nota) al examen
  const inscripcionesPendientes = await InscripcionExamenFinal.findAll({
    where: {
      id_inscripcion_materia: idInscripcionMateria,
      id_usuario_alumno: idUsuarioAlumno,
      nota: null, // Inscripciones sin nota (pendientes)
    },
  });

  if (inscripcionesPendientes.length > 0) {
    return {
      puede: false,
      razon: "Ya tienes una inscripción pendiente a un examen final para esta materia.",
      totalIntentos,
    };
  }

  return {
    puede: true,
    razon: null,
    totalIntentos,
    intentosRestantes: CONSTANTES_EXAMENES.MAX_INTENTOS_LIBRE - totalIntentos,
  };
};

/**
 * Verifica si un tipo de alumno puede recibir calificaciones cuatrimestrales
 * @param {number} tipoAlumno - Tipo de alumno (1=Regular, 2=Libre, 3=Oyente, 4=Itinerante)
 * @returns {Object} - Objeto indicando si puede recibir calificaciones y la razón
 */
const puedeRecibirCalificacionCuatrimestral = (tipoAlumno) => {
  // Oyentes y Libres NO pueden recibir calificaciones cuatrimestrales
  if (tipoAlumno === TIPOS_ALUMNO.OYENTE) {
    return {
      puede: false,
      razon: "Los alumnos oyentes no pueden recibir calificaciones cuatrimestrales.",
    };
  }

  if (tipoAlumno === TIPOS_ALUMNO.LIBRE) {
    return {
      puede: false,
      razon: "Los alumnos libres no pueden recibir calificaciones cuatrimestrales.",
    };
  }

  return {
    puede: true,
    razon: null,
  };
};

/**
 * Verifica si un tipo de alumno puede tener asistencia registrada
 * @param {number} tipoAlumno - Tipo de alumno (1=Regular, 2=Libre, 3=Oyente, 4=Itinerante)
 * @returns {Object} - Objeto indicando si puede tener asistencia y la razón
 */
const puedeRecibirAsistencia = (tipoAlumno) => {
  // Libres NO pueden tener asistencia (no cursan presencialmente)
  if (tipoAlumno === TIPOS_ALUMNO.LIBRE) {
    return {
      puede: false,
      razon: "Los alumnos libres no pueden tener registro de asistencia.",
    };
  }

  // Regulares, Oyentes e Itinerantes SÍ pueden tener asistencia
  return {
    puede: true,
    razon: null,
  };
};

module.exports = {
  CONSTANTES_EXAMENES,
  TIPOS_ALUMNO,
  esNotaAprobatoria,
  contarIntentosExamenFinal,
  contarDesaprobacionesConsecutivas,
  verificarPuedeRendirFinal,
  verificarPuedeRendirFinalComoLibre,
  debeDesaprobarInscripcionMateria,
  puedeRecibirCalificacionCuatrimestral,
  puedeRecibirAsistencia,
};
