const {
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
} = require("../../../../models");
const sequelize = require("../../../../config/db");
const {
  puedeRecibirCalificacionCuatrimestral,
  TIPOS_ALUMNO,
} = require("../../../../utils/examenFinalUtils");

exports.registrarMateriaPlanCicloLectivo = async (req, res, next) => {
  const {
    idMateriaPlan,
    cicloLectivo,
    fechaInicio,
    fechaCierre,
    tipoAprobacion,
  } = req.body;

  try {
    const materiaPlan = await MateriaPlan.findByPk(idMateriaPlan);
    if (!materiaPlan) {
      return res.status(404).json({ error: "Materia del plan no encontrada" });
    }

    const materiaExistente = await MateriaPlanCicloLectivo.findOne({
      where: { id_materia_plan: idMateriaPlan, ciclo_lectivo: cicloLectivo },
    })

    if (materiaExistente) {
      return res.status(400).json({ error: "Materia ya registrada en el ciclo lectivo" });
    }

    await MateriaPlanCicloLectivo.create({
      id_materia_plan: materiaPlan.id,
      ciclo_lectivo: cicloLectivo,
      fecha_inicio: fechaInicio,
      fecha_cierre: fechaCierre,
      tipo_aprobacion: tipoAprobacion,
    });

    res.status(201).json({ message: "Materia registrada correctamente" });
  } catch (err) {
    next(err);
  }
};

exports.listarMateriasPlanCicloLectivo = async (req, res, next) => {
  try {
    const rolUsuario = req.user.rol;
    if (rolUsuario === "Profesor") {
      // Si el usuario es profesor, listar solo las materias que dicta
      const profesorId = req.user.id;
      const materiasPlanCicloLectivo = await MateriaPlanCicloLectivo.findAll({
        include: [
          {
            model: MateriaPlan,
            as: "materiaPlan",
            include: [
              {
                model: PlanEstudio,
                as: "planEstudio",
                include: [{ model: Carrera, as: "carrera" }],
              },
              { model: Materia, as: "materia" },
            ],
          },
          {
            model: ProfesorMateria,
            as: "profesores",
            where: { id_usuario_profesor: profesorId },
            include: [
              {
                model: Usuario,
                as: "profesor",
                include: [{ model: Persona, as: "persona" }],
              },
            ],
          },
        ],
      });
      res.status(200).json(materiasPlanCicloLectivo);
    } else if (rolUsuario === "Administrador") {
      const materiasPlanCicloLectivo = await MateriaPlanCicloLectivo.findAll({
        attributes: ['id', 'ciclo_lectivo', 'fecha_inicio', 'fecha_cierre', 'tipo_aprobacion'],
        include: [
          {
            model: MateriaPlan,
            as: "materiaPlan",
            attributes: ['id'],
            include: [
              {
                model: PlanEstudio,
                as: "planEstudio",
                attributes: ['resolucion'],
                include: [{ model: Carrera, as: "carrera", attributes: ['nombre'] }],
              },
              { model: Materia, as: "materia", attributes: ['nombre'] },
            ],
          },
          {
            model: ProfesorMateria,
            as: "profesores",
            attributes: ['id_usuario_profesor', 'rol'],
            include: [
              {
                model: Usuario,
                as: "profesor",
                attributes: ['id'],
                include: [
                  {
                    model: Persona,
                    as: "persona",
                    attributes: ['nombre', 'apellido']
                  },
                ],
              },
            ],
          },
        ],
      });
      res.status(200).json(materiasPlanCicloLectivo);
    }
  } catch (err) {
    next(err);
  }
};

exports.modificarMateriaPlanCicloLectivo = async (req, res, next) => {
  const {
    materiaPlanCicloLectivoId,
    cicloLectivo,
    fechaInicio,
    fechaCierre,
    tipoAprobacion,
  } = req.body;

  try {
    const materiaPlanCicloLectivo = await MateriaPlanCicloLectivo.findByPk(
      materiaPlanCicloLectivoId
    );
    if (!materiaPlanCicloLectivo) {
      return res
        .status(404)
        .json({ error: "Materia del plan ciclo lectivo no encontrada" });
    }

    materiaPlanCicloLectivo.ciclo_lectivo =
      cicloLectivo || materiaPlanCicloLectivo.ciclo_lectivo;
    materiaPlanCicloLectivo.fecha_inicio =
      fechaInicio || materiaPlanCicloLectivo.fecha_inicio;
    materiaPlanCicloLectivo.fecha_cierre =
      fechaCierre || materiaPlanCicloLectivo.fecha_cierre;
    materiaPlanCicloLectivo.tipo_aprobacion =
      tipoAprobacion || materiaPlanCicloLectivo.tipo_aprobacion;
    await materiaPlanCicloLectivo.save();

    res.status(200).json(materiaPlanCicloLectivo);
  } catch (err) {
    next(err);
  }
};

exports.detalleMateriaPlanCicloLectivo = async (req, res, next) => {
  const { id } = req.params;
  try {
    const ciclo = await MateriaPlanCicloLectivo.findByPk(id, {
      include: [
        {
          model: MateriaPlan,
          as: "materiaPlan",
          include: [
            { model: Materia, as: "materia", attributes: ["id", "nombre"] },
            {
              model: PlanEstudio,
              as: "planEstudio",
              attributes: ["id", "resolucion"],
              include: [
                { model: Carrera, as: "carrera", attributes: ["id", "nombre"] },
              ],
            },
          ],
        },
        {
          model: InscripcionMateria,
          as: "inscripcionesCiclo",
          attributes: [
            "id",
            "id_usuario_alumno",
            "fecha_inscripcion",
            "estado",
            "nota_final",
          ],
          include: [
            {
              model: Usuario,
              as: "usuario",
              attributes: ["id"],
              include: [
                {
                  model: Persona,
                  as: "persona",
                  attributes: ["nombre", "apellido", "dni"],
                },
              ],
            },
            {
              model: CalificacionCuatrimestre,
              as: "calificaciones",
              attributes: ["cuatrimestre", "calificacion", "bloqueada"],
              required: false, // puede no existir aún
              // Podés filtrar si solo querés un cuatrimestre específico:
              // where: { cuatrimestre: 1 },
            },
          ],
        },
      ],
    });

    if (!ciclo) {
      return res
        .status(404)
        .json({ error: "Materia del plan ciclo lectivo no encontrada" });
    }

    const profesores = await ProfesorMateria.findAll({
      where: { id_materia_plan_ciclo_lectivo: id },
      include: [
        {
          model: Usuario,
          as: "profesor",
          include: [
            {
              model: Persona,
              as: "persona",
              attributes: ["nombre", "apellido", "email"],
            },
          ],
        },
      ],
    });

    const detalle = {
      id_mpcl: ciclo.id,
      ciclo: ciclo.ciclo_lectivo,
      materia: ciclo.materiaPlan?.materia?.nombre,
      resolucion: ciclo.materiaPlan?.planEstudio?.resolucion,
      carrera: ciclo.materiaPlan?.planEstudio?.carrera?.nombre,
      fechaInicio: ciclo.fecha_inicio,
      fechaCierre: ciclo.fecha_cierre,
      alumnos: (ciclo.inscripcionesCiclo || []).map((ins) => ({
        id_inscripcion: ins.id,
        id_usuario: ins.usuario?.id,
        nombre: ins.usuario?.persona?.nombre,
        apellido: ins.usuario?.persona?.apellido,
        dni: ins.usuario?.persona?.dni,
        fecha_inscripcion: ins.fecha_inscripcion,
        estado: ins.estado,
        nota_final: ins.nota_final,
        calificaciones: (ins.calificaciones || []).map((c) => ({
          cuatrimestre: c.cuatrimestre,
          calificacion: Number(c.calificacion),
          bloqueada: !!c.bloqueada,
        })),
      })),
      profesores: profesores.map((p) => ({
        id_usuario: p.profesor?.id,
        nombre: p.profesor?.persona?.nombre,
        apellido: p.profesor?.persona?.apellido,
        email: p.profesor?.persona?.email,
        rol: p.rol,
      })),
    };

    res.json(detalle);
  } catch (err) {
    next(err);
  }
};

exports.asignarProfesor = async (req, res, next) => {
  const { materiaId } = req.params;
  const { profesorId, profesorRol } = req.body;

  try {
    const materia = await MateriaPlanCicloLectivo.findByPk(materiaId);
    if (!materia) {
      return res
        .status(404)
        .json({ error: "Materia del plan ciclo lectivo no encontrada" });
    }

    const profesor = await Usuario.findByPk(profesorId);
    if (!profesor) {
      return res.status(404).json({ error: "Profesor no encontrado" });
    }

    await ProfesorMateria.create({
      id_materia_plan_ciclo_lectivo: materiaId,
      id_usuario_profesor: profesorId,
      rol: profesorRol,
    });

    res.status(201).json({ message: "Profesor asignado a la materia" });
  } catch (err) {
    // Si hay entrada duplicada, retornar error amigable
    if (
      err.name === "SequelizeUniqueConstraintError" ||
      (err.original && err.original.code === "ER_DUP_ENTRY")
    ) {
      return res
        .status(400)
        .json({ error: "El profesor ya está asignado a esta materia" });
    }
    next(err);
  }
};

exports.crearClase = async (req, res, next) => {
  const { idMateriaPlanCicloLectivo, fecha } = req.body;

  try {
    const materia = await MateriaPlanCicloLectivo.findByPk(
      idMateriaPlanCicloLectivo
    );
    if (!materia) {
      return res
        .status(404)
        .json({ error: "Materia del plan ciclo lectivo no encontrada" });
    }

    const clase = await Clase.create({
      id_materia_plan_ciclo_lectivo: idMateriaPlanCicloLectivo,
      fecha,
    });

    res.status(201).json(clase);
  } catch (err) {
    next(err);
  }
};

exports.listarClasesPorMateria = async (req, res, next) => {
  const { materiaId } = req.params;

  try {
    const clases = await Clase.findAll({
      where: { id_materia_plan_ciclo_lectivo: materiaId },
    });

    res.json(clases);
  } catch (err) {
    next(err);
  }
};

exports.asignarHorarioMateria = async (req, res, next) => {
  const { idMateriaPlanCicloLectivo, diaSemana, bloque } = req.body;

  try {
    const materia = await MateriaPlanCicloLectivo.findByPk(
      idMateriaPlanCicloLectivo
    );
    if (!materia) {
      return res
        .status(404)
        .json({ error: "Materia del plan ciclo lectivo no encontrada" });
    }

    const horarioExistente = await HorarioMateria.findOne({
      where: {
        id_materia_plan_ciclo_lectivo: idMateriaPlanCicloLectivo,
        dia_semana: diaSemana,
        bloque: bloque,
      },
    });

    if (horarioExistente) {
      return res.status(400).json({
        error: "Ya existe un horario asignado para este día y bloque",
      });
    }

    const horario = await HorarioMateria.create({
      id_materia_plan_ciclo_lectivo: idMateriaPlanCicloLectivo,
      dia_semana: diaSemana,
      bloque: bloque,
    });

    res.status(201).json(horario);
  } catch (err) {
    next(err);
  }
};

exports.registrarClaseInformacion = async (req, res, next) => {
  const { idClase, tema, idProfesor } = req.body;

  const t = await sequelize.transaction();
  try {
    const clase = await Clase.findByPk(idClase, { transaction: t });
    if (!clase) {
      await t.rollback();
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    // Validar que el profesor existe si se proporciona
    if (idProfesor) {
      const profesor = await Usuario.findByPk(idProfesor, { transaction: t });
      if (!profesor) {
        await t.rollback();
        return res.status(404).json({ error: "Profesor no encontrado" });
      }
    }

    const nuevoTema = await Tema.create(
      { descripcion: tema },
      { transaction: t }
    );

    await ClaseTema.create(
      {
        id_clase: idClase,
        id_tema: nuevoTema.id,
      },
      { transaction: t }
    );

    if (idProfesor) {
      await ClaseProfesor.create(
        {
          id_clase: idClase,
          id_usuario_profesor: idProfesor,
        },
        { transaction: t }
      );
    }

    await t.commit();
    res.status(201).json("Tema y profesor vinculados correctamente");
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.obtenerCalificacionesCuatrimestre = async (req, res, next) => {
  const { id, periodo } = req.params;

  try {
    const inscripciones = await InscripcionMateria.findAll({
      where: { id_materia_plan_ciclo_lectivo: id },
      attributes: ["id", "estado"],
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id"],
          include: [
            {
              model: Persona,
              as: "persona",
              attributes: ["nombre", "apellido"],
            },
          ],
        },
        {
          model: CalificacionCuatrimestre,
          as: "calificaciones",
          where: { cuatrimestre: periodo },
          required: false, // Para incluir alumnos que aún no tienen calificación
        },
      ],
    });

    const calificaciones = inscripciones.map((inscripcion) => ({
      inscripcionId: inscripcion.id, // Ahora enviamos el ID de inscripción
      alumno: {
        id: inscripcion.usuario.id,
        nombre: inscripcion.usuario.persona.nombre,
        apellido: inscripcion.usuario.persona.apellido,
      },
      calificacion: inscripcion.calificaciones?.[0]?.calificacion || null,
      bloqueada: inscripcion.calificaciones?.[0]?.bloqueada || false,
    }));

    res.json(calificaciones);
  } catch (err) {
    next(err);
  }
};

exports.actualizarCalificacionCuatrimestre = async (req, res, next) => {
  const { id: inscripcionId } = req.params;
  const { calificacion, cuatrimestre } = req.body;
  const userRole = req.user.rol; // Asumiendo que el middleware de auth agrega el rol del usuario

  try {
    // Validar que la calificación esté entre 0 y 10
    if (calificacion < 0 || calificacion > 10) {
      return res
        .status(400)
        .json({ error: "La calificación debe estar entre 0 y 10" });
    }

    // Verificar el tipo de alumno de la inscripción
    const inscripcionMateria = await InscripcionMateria.findByPk(inscripcionId, {
      attributes: ["id_tipo_alumno"],
    });

    if (!inscripcionMateria) {
      return res.status(404).json({ error: "Inscripción no encontrada" });
    }

    // Validar si el tipo de alumno puede recibir calificaciones cuatrimestrales
    const validacionTipoAlumno = puedeRecibirCalificacionCuatrimestral(
      inscripcionMateria.id_tipo_alumno
    );

    if (!validacionTipoAlumno.puede) {
      return res.status(403).json({ error: validacionTipoAlumno.razon });
    }

    // Buscar o crear la calificación
    const [calificacionCuatrimestre, created] =
      await CalificacionCuatrimestre.findOrCreate({
        where: {
          id_inscripcion_materia: inscripcionId,
          cuatrimestre: cuatrimestre,
        },
        defaults: {
          calificacion: calificacion,
          bloqueada: true, // Al crear una nueva calificación, se bloquea automáticamente
        },
      });

    // Si la calificación está bloqueada y el usuario no es administrador
    if (
      !created &&
      calificacionCuatrimestre.bloqueada &&
      userRole !== "Administrador"
    ) {
      return res.status(403).json({
        error:
          "La calificación está bloqueada. Solo un administrador puede modificarla.",
      });
    }

    if (!created) {
      calificacionCuatrimestre.calificacion = calificacion;
      calificacionCuatrimestre.bloqueada = userRole !== "Administrador"; // Solo se mantiene desbloqueada si es admin
      await calificacionCuatrimestre.save();
    }

    // Actualizar estado de regularización después de crear/actualizar la calificación
    setTimeout(async () => {
      try {
        const RegularizacionUtils = require("../../../../utils/regularizacion");
        await RegularizacionUtils.actualizarEstadoRegularizacion(inscripcionId);
      } catch (error) {
        console.log("Error al actualizar el estado", error);
      }
    }, 200);

    res.json(calificacionCuatrimestre);
  } catch (err) {
    next(err);
  }
};

exports.listarMateriaPlanCicloActual = async (req, res, next) => {
  const { planId } = req.params;
  const currentYear = new Date().getFullYear();

  try {
    const plan = await PlanEstudio.findByPk(planId, {
      attributes: ["id", "resolucion"],
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan de estudio no encontrado' });
    }

    const materias = await MateriaPlanCicloLectivo.findAll({
      where: { ciclo_lectivo: currentYear },
      include: [
        {
          model: MateriaPlan,
          as: "materiaPlan",
          attributes: ["id"],
          where: { id_plan_estudio: plan.id },
          include: [
            { 
              model: Materia, 
              as: "materia", 
              attributes: ["id", "nombre"] 
            }
          ],
        },
      ],
    });

    // Formatear la respuesta para ser menos verbosa
    const materiasFormateadas = materias.map(materia => ({
      id: materia.id,
      nombre: materia.materiaPlan?.materia?.nombre || 'Sin nombre',
      idMateria: materia.materiaPlan?.materia?.id || null,
      idMateriaPlan: materia.materiaPlan?.id || null,
      cicloLectivo: materia.ciclo_lectivo,
      fechaInicio: materia.fecha_inicio,
      fechaCierre: materia.fecha_cierre,
      tipoAprobacion: materia.tipo_aprobacion
    }));
    
    res.json({
      success: true,
      planEstudio: {
        id: plan.id,
        resolucion: plan.resolucion
      },
      cicloLectivo: currentYear,
      materias: materiasFormateadas,
      total: materiasFormateadas.length
    });
  } catch (err) {
    console.error('Error en listarMateriaPlanCicloActual:', err);
    next(err);
  }
};

/**
 * Actualizar el estado de regularización de una inscripción específica
 */
exports.actualizarEstadoRegularizacion = async (req, res) => {
  try {
    const { idInscripcion } = req.params;
    const RegularizacionUtils = require('../../../../utils/regularizacion');
    
    if (!idInscripcion || isNaN(idInscripcion)) {
      return res.status(400).json({
        success: false,
        message: 'ID de inscripción inválido'
      });
    }

    const resultado = await RegularizacionUtils.actualizarEstadoRegularizacion(parseInt(idInscripcion));
    
    if (resultado.success) {
      res.json(resultado);
    } else {
      res.status(500).json(resultado);
    }

  } catch (error) {
    console.error('Error en endpoint actualizar regularización:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Actualizar el estado de regularización de todas las inscripciones de un alumno
 */
exports.actualizarEstadosAlumno = async (req, res) => {
  try {
    const { idUsuarioAlumno } = req.params;
    const RegularizacionUtils = require('../../../../utils/regularizacion');
    
    if (!idUsuarioAlumno || isNaN(idUsuarioAlumno)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario alumno inválido'
      });
    }

    const resultado = await RegularizacionUtils.actualizarEstadosAlumno(parseInt(idUsuarioAlumno));
    
    if (resultado.success) {
      res.json(resultado);
    } else {
      res.status(500).json(resultado);
    }

  } catch (error) {
    console.error('Error en endpoint actualizar estados alumno:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};
