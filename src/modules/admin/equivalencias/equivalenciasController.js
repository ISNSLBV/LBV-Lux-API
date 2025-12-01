const {
  AcreditacionEquivalencia,
  Materia,
  MateriaPlan,
  PlanEstudio,
  MateriaPlanCicloLectivo,
  InscripcionMateria,
  Usuario,
  Persona,
  ProfesorMateria,
  Carrera,
  Clase,
  HorarioMateria,
  Tema,
  ClaseTema,
  ClaseProfesor,
  CalificacionCuatrimestre,
  AlumnoCarrera,
} = require("../../../models");
const { Op } = require('sequelize');
const sequelize = require('../../../config/db');

exports.registrarSolicitud = async (req, res, next) => {
  try {
    const alumnoId = req.user.id;
    const { origenInstitucion, origenMateria, origenCalificacion, resolucion, idCarrera } =
      req.body;

    // Validar que el alumno tenga al menos una carrera activa
    const usuario = await Usuario.findByPk(alumnoId, {
      attributes: ["id_persona"]
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const carrerasActivas = await AlumnoCarrera.findAll({
      where: {
        id_persona: usuario.id_persona,
        activo: 1
      }
    });

    if (carrerasActivas.length === 0) {
      return res.status(403).json({
        message: "No tienes carreras activas. Debes estar inscripto y activo en al menos una carrera para solicitar equivalencias"
      });
    }

    // Determinar id_carrera: si se envió, validar que sea activa; si no, usar la primera activa
    let carreraFinal = null;
    if (idCarrera) {
      // Validar que la carrera enviada esté entre las activas del alumno
      const carreraActiva = carrerasActivas.find(c => c.id_carrera === parseInt(idCarrera));
      if (!carreraActiva) {
        return res.status(400).json({
          message: "La carrera seleccionada no está activa o no pertenece a tu lista de carreras"
        });
      }
      carreraFinal = parseInt(idCarrera);
    } else {
      // Si no se envió, usar la primera carrera activa (para compatibilidad con alumnos de una sola carrera)
      carreraFinal = carrerasActivas[0].id_carrera;
    }

    // Validar datos requeridos
    if (!origenInstitucion || !origenMateria || !origenCalificacion) {
      return res.status(400).json({
        message: "Estos campos son obligatorios"
      });
    }

    // Crear la solicitud de equivalencia
    const nuevaSolicitud = await AcreditacionEquivalencia.create({
      id_usuario_alumno: alumnoId,
      id_materia_destino: null,
      id_carrera: carreraFinal,
      origen_institucion: origenInstitucion,
      origen_materia: origenMateria,
      origen_calificacion: origenCalificacion,
      resolucion: resolucion || null,
      estado: 'Pendiente'
    });

    res.status(201).json({
      message: "Solicitud de equivalencia registrada exitosamente",
      data: nuevaSolicitud
    });

  } catch (error) {
    next(error);
  }
};

// Obtener todas las solicitudes de equivalencia del alumno
exports.obtenerSolicitudesAlumno = async (req, res, next) => {
  try {
    const alumnoId = req.user.id;

    const solicitudes = await AcreditacionEquivalencia.findAll({
      where: {
        id_usuario_alumno: alumnoId
      },
      include: [
        {
          model: Carrera,
          as: 'carrera',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['fecha_solicitud', 'DESC']]
    });

    res.json({
      message: "Solicitudes obtenidas exitosamente",
      data: solicitudes
    });

  } catch (error) {
    next(error);
  }
};

// Obtener una solicitud específica
exports.obtenerSolicitudPorId = async (req, res, next) => {
  try {
    const alumnoId = req.user.id;
    const { id } = req.params;

    const solicitud = await AcreditacionEquivalencia.findOne({
      where: {
        id: id,
        id_usuario_alumno: alumnoId
      }
    });

    if (!solicitud) {
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    res.json({
      message: "Solicitud obtenida exitosamente",
      data: solicitud
    });

  } catch (error) {
    next(error);
  }
};

// ==================== CONTROLADORES PARA ADMINISTRADORES ====================

// Obtener todos los alumnos que hayan solicitado equivalencias
exports.obtenerAlumnosConSolicitudes = async (req, res, next) => {
  try {
    const { estado } = req.query;
    
    const whereClause = {};
    if (estado) {
      whereClause.estado = estado;
    }

    const alumnos = await AcreditacionEquivalencia.findAll({
      where: whereClause,
      include: [
        {
          model: Usuario,
          as: 'alumno',
          attributes: ['id'],
          include: [
            {
              model: Persona,
              as: 'persona',
              attributes: ['nombre', 'apellido', 'dni', 'email']
            }
          ]
        },
        {
          model: Carrera,
          as: 'carrera',
          attributes: ['id', 'nombre']
        }
      ],
      attributes: [
        'id',
        'id_usuario_alumno',
        'id_carrera',
        'origen_institucion',
        'origen_materia', 
        'origen_calificacion',
        'resolucion',
        'estado',
        'fecha_solicitud',
        'fecha_resolucion',
        'motivo_rechazo'
      ],
      order: [['fecha_solicitud', 'DESC']]
    });

    res.json({
      message: "Alumnos con solicitudes obtenidos exitosamente",
      data: alumnos
    });

  } catch (error) {
    next(error);
  }
};

// Aprobar solicitud de equivalencia
exports.aprobarSolicitud = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const administradorId = req.user.id;
    const { 
      idMateriaPlanCicloLectivo,
      notaFinal,
      origenInstitucion,
      origenMateria,
      origenCalificacion,
      resolucion
    } = req.body;

    // Validar datos requeridos
    if (!idMateriaPlanCicloLectivo || !notaFinal) {
      return res.status(400).json({
        message: "La materia destino y la nota final son obligatorias"
      });
    }

    // Buscar la solicitud
    const solicitud = await AcreditacionEquivalencia.findByPk(id, { transaction });
    
    if (!solicitud) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    // Verificar que esté en estado pendiente
    if (solicitud.estado !== 'Pendiente') {
      await transaction.rollback();
      return res.status(400).json({
        message: "Solo se pueden aprobar solicitudes en estado 'Pendiente'"
      });
    }

    // Buscar la materia plan ciclo lectivo para obtener el id_materia_plan
    const materiaPlanCicloLectivo = await MateriaPlanCicloLectivo.findByPk(idMateriaPlanCicloLectivo, {
      include: [{
        model: MateriaPlan,
        as: 'materiaPlan'
      }],
      transaction
    });

    if (!materiaPlanCicloLectivo) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Materia plan ciclo lectivo no encontrada"
      });
    }

    // Verificar si ya existe una inscripción para este alumno en esta materia
    const inscripcionExistente = await InscripcionMateria.findOne({
      where: {
        id_usuario_alumno: solicitud.id_usuario_alumno,
        id_materia_plan_ciclo_lectivo: idMateriaPlanCicloLectivo
      },
      transaction
    });

    let inscripcion;

    if (inscripcionExistente) {
      // Si ya existe una inscripción, actualizarla
      await inscripcionExistente.update({
        estado: 'Aprobada',
        nota_final: notaFinal,
        fecha_finalizacion: new Date(),
        modificado_por: administradorId,
        fecha_modificacion: new Date(),
        origen_aprobacion: 'Equivalencia',
        id_inscripcion_examen_final_aprobatorio: null,
        id_acreditacion_equivalencia_aprobatoria: solicitud.id
      }, { transaction });

      inscripcion = inscripcionExistente;
    } else {
      // Si no existe, crear una nueva inscripción
      inscripcion = await InscripcionMateria.create({
        id_usuario_alumno: solicitud.id_usuario_alumno,
        id_materia_plan_ciclo_lectivo: idMateriaPlanCicloLectivo,
        id_tipo_alumno: 1, // Regular
        estado: 'Aprobada',
        nota_final: notaFinal,
        fecha_finalizacion: new Date(),
        creado_por: administradorId,
        origen_aprobacion: 'Equivalencia',
        id_inscripcion_examen_final_aprobatorio: null,
        id_acreditacion_equivalencia_aprobatoria: solicitud.id
      }, { transaction });
    }

    // Actualizar la solicitud de equivalencia
    const datosActualizacion = {
      id_materia_destino: materiaPlanCicloLectivo.id_materia_plan,
      estado: 'Aprobada',
      autorizado_por: administradorId,
      fecha_resolucion: new Date()
    };

    // Si se proporcionaron correcciones, actualizarlas
    if (origenInstitucion) datosActualizacion.origen_institucion = origenInstitucion;
    if (origenMateria) datosActualizacion.origen_materia = origenMateria;
    if (origenCalificacion) datosActualizacion.origen_calificacion = origenCalificacion;
    if (resolucion) datosActualizacion.resolucion = resolucion;

    await solicitud.update(datosActualizacion, { transaction });

    await transaction.commit();

    res.json({
      message: "Solicitud aprobada exitosamente",
      data: {
        solicitud: solicitud,
        inscripcion: inscripcion
      }
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Rechazar solicitud de equivalencia
exports.rechazarSolicitud = async (req, res, next) => {
  try {
    const { id } = req.params;
    const administradorId = req.user.id;
    const { motivoRechazo } = req.body;

    // Validar que el motivo sea proporcionado
    if (!motivoRechazo) {
      return res.status(400).json({
        message: "El motivo de rechazo es obligatorio"
      });
    }

    // Buscar la solicitud
    const solicitud = await AcreditacionEquivalencia.findByPk(id);
    
    if (!solicitud) {
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    // Verificar que esté en estado pendiente
    if (solicitud.estado !== 'Pendiente') {
      return res.status(400).json({
        message: "Solo se pueden rechazar solicitudes en estado 'Pendiente'"
      });
    }

    // Actualizar la solicitud
    await solicitud.update({
      estado: 'Rechazada',
      motivo_rechazo: motivoRechazo,
      autorizado_por: administradorId,
      fecha_resolucion: new Date()
    });

    res.json({
      message: "Solicitud editada exitosamente",
      data: solicitud
    });

  } catch (error) {
    next(error);
  }
};

// Obtener carreras del alumno
exports.obtenerCarrerasAlumno = async (req, res, next) => {
  try {
    const { idUsuario } = req.params;
    // Primero buscar el usuario para obtener su id_persona
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ['id', 'id_persona'],
      include: [
        {
          model: Persona,
          as: 'persona',
          attributes: ['id', 'nombre', 'apellido']
        }
      ]
    });

    if (!usuario) {
      return res.status(404).json({
        message: "Usuario no encontrado",
        idBuscado: idUsuario
      });
    }

    // Luego buscar las carreras usando el id_persona
    const carreras = await AlumnoCarrera.findAll({
      where: { 
        id_persona: usuario.id_persona,
        activo: true 
      },
      include: [
        {
          model: Carrera,
          as: 'carrera',
          attributes: ['id', 'nombre']
        },
        {
          model: PlanEstudio,
          as: 'planEstudio',
          attributes: ['id', 'resolucion']
        }
      ]
    });

    res.json(carreras);

  } catch (error) {
    console.error('Error al obtener carreras del alumno:', error);
    next(error);
  }
};

// Editar solicitud pendiente (solo para administradores)
exports.editarSolicitud = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { origenInstitucion, origenMateria, origenCalificacion, resolucion } = req.body;

    // Buscar la solicitud
    const solicitud = await AcreditacionEquivalencia.findByPk(id);
    
    if (!solicitud) {
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    // Solo se pueden editar solicitudes pendientes
    if (solicitud.estado !== 'Pendiente') {
      return res.status(400).json({
        message: "Solo se pueden editar solicitudes en estado 'Pendiente'"
      });
    }

    // Preparar datos para actualizar
    const datosActualizacion = {};
    if (origenInstitucion) datosActualizacion.origen_institucion = origenInstitucion;
    if (origenMateria) datosActualizacion.origen_materia = origenMateria;
    if (origenCalificacion) datosActualizacion.origen_calificacion = origenCalificacion;
    if (resolucion !== undefined) datosActualizacion.resolucion = resolucion;

    // Actualizar la solicitud
    await solicitud.update(datosActualizacion);

    res.json({
      message: "Solicitud editada exitosamente",
      data: solicitud
    });

  } catch (error) {
    next(error);
  }
};