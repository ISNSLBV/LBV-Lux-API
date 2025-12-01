const express = require('express');
const router = express.Router();
const { 
  registrarExamenFinal, 
  listarExamenesFinales, 
  detalleExamenFinal,
  obtenerAlumnosInscriptos,
  registrarAsistencia,
  obtenerCalificaciones,
  actualizarCalificacion,
  actualizarConfiguracion,
  bloquearCalificacion,
  obtenerProfesoresPorMateria,
  obtenerProfesoresVocalesDisponibles,
  finalizarExamen
} = require('./examenFinalController');
const { requireRole, verifyToken } = require("../../../middlewares/auth");

// Rutas básicas
router.post('/registrar', verifyToken, requireRole("Administrador"), registrarExamenFinal);
router.get('/listar-examenes', verifyToken, requireRole("Administrador", "Profesor"), listarExamenesFinales);
router.get('/:id/detalle', verifyToken, requireRole("Administrador", "Profesor"), detalleExamenFinal);

// Rutas para gestión de alumnos y asistencia
router.get('/:id/alumnos', verifyToken, requireRole("Administrador", "Profesor"), obtenerAlumnosInscriptos);
router.post('/:idExamen/asistencia', verifyToken, requireRole("Administrador", "Profesor"), registrarAsistencia);

// Rutas para calificaciones
router.get('/:id/calificaciones', verifyToken, requireRole("Administrador", "Profesor"), obtenerCalificaciones);
router.put('/calificaciones/:idInscripcion', verifyToken, requireRole("Administrador", "Profesor"), actualizarCalificacion);
router.put('/calificaciones/:idInscripcion/bloquear', verifyToken, requireRole("Administrador"), bloquearCalificacion);

// Rutas para configuración (solo admin)
router.put('/:id/configuracion', verifyToken, requireRole("Administrador"), actualizarConfiguracion);

// Rutas para obtener profesores por materia
router.get('/profesores-materia/:idMateria', verifyToken, obtenerProfesoresPorMateria);

// Rutas para finalizar examen
router.get('/:id/profesores-vocales', verifyToken, requireRole("Administrador", "Profesor"), obtenerProfesoresVocalesDisponibles);
router.put('/:id/finalizar', verifyToken, requireRole("Profesor"), finalizarExamen);

module.exports = router;