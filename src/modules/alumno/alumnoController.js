const {
  Usuario,
  Persona,
  InscripcionMateria,
  MateriaPlanCicloLectivo,
  Materia,
  AlumnoCarrera,
  Carrera,
  ProfesorMateria,
  MateriaPlan,
  Correlativa,
  InscripcionExamenFinal,
  ExamenFinal,
  PlanEstudio,
  CalificacionCuatrimestre,
  ConfiguracionSistema,
} = require("../../models");
const { Op } = require("sequelize");
const {
  verificarPuedeRendirFinal,
  verificarPuedeRendirFinalComoLibre,
  CONSTANTES_EXAMENES,
  TIPOS_ALUMNO,
} = require("../../utils/examenFinalUtils");

// Obtener las carreras en las que se inscribió el alumno
exports.getCarrerasInscripto = async (req, res) => {
  try {
    const idAlumnoBuscado = req.user.id;
    const alumno = await Usuario.findByPk(idAlumnoBuscado, {
      attributes: ["id_persona"],
    });

    const idAlumno = alumno?.id_persona;
    const inscripciones = await AlumnoCarrera.findAll({
      where: { id_persona: idAlumno },
      include: [
        {
          model: Carrera,
          as: "carrera",
          attributes: ["id", "nombre"],
        },
      ],
    });

    // Extraer las carreras de las inscripciones
    const carreras = inscripciones.map((inscripcion) => inscripcion.carrera);

    if (!carreras.length) {
      return res.status(404).json({
        message: "El alumno no está inscripto en ninguna carrera.",
      });
    }

    res.status(200).json(carreras);
  } catch (error) {
    console.error("Error al obtener las carreras del alumno: ", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Obtener las materias de un alumno para una carrera específica
exports.getMateriasPorCarrera = async (req, res) => {
  try {
    const { idCarrera } = req.params;
    const idAlumnoBuscado = req.user.id;

    // Obtener id_persona del usuario
    const alumno = await Usuario.findByPk(idAlumnoBuscado, {
      attributes: ["id_persona"],
    });
    const idAlumno = alumno?.id_persona;
    if (!idAlumno) {
      return res.status(404).json({ message: "Alumno no encontrado." });
    }

    // Verificar inscripción del alumno en la carrera y obtener el plan asignado
    const inscripcion = await AlumnoCarrera.findOne({
      where: {
        id_persona: idAlumno,
        id_carrera: idCarrera,
      },
    });
    if (!inscripcion) {
      return res.status(404).json({
        message: "El alumno no está inscripto en esta carrera.",
      });
    }

    const idPlanEstudioAsignado = inscripcion.id_plan_estudio_asignado;

    // Traer todas las materias inscriptas o aprobadas del alumno para esa carrera
    const materiasInscriptas = await InscripcionMateria.findAll({
      where: {
        id_usuario_alumno: idAlumnoBuscado,
      },
      include: [
        {
          model: MateriaPlanCicloLectivo,
          as: "ciclo",
          required: true,
          attributes: ["id", "ciclo_lectivo", "tipo_aprobacion"],
          include: [
            {
              model: MateriaPlan,
              as: "materiaPlan",
              required: true,
              where: {
                id_plan_estudio: idPlanEstudioAsignado,
              },
              include: [
                {
                  model: Materia,
                  as: "materia",
                  attributes: ["id", "nombre"],
                  required: true,
                },
              ],
            },
            {
              model: ProfesorMateria,
              as: "profesores",
              include: [
                {
                  model: Usuario,
                  as: "profesor",
                  include: [
                    {
                      model: Persona,
                      as: "persona",
                      attributes: ["nombre", "apellido"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    // Ya no es necesario filtrar aquí porque el filtro se aplicó en el where de MateriaPlan
    const materiasFiltradas = materiasInscriptas;

    // Mapear la respuesta
    const resumenMateriasAlumno = materiasFiltradas.map((item) => ({
      id: item.ciclo?.materiaPlan?.materia?.id ?? null,
      nombre: item.ciclo?.materiaPlan?.materia?.nombre ?? "",
      estado: item.estado,
      nota: item.nota_final,
      anio: item.ciclo?.ciclo_lectivo ?? null,
      profesor: item.ciclo?.profesores?.length
        ? item.ciclo.profesores
            .map(
              (p) =>
                `${p.profesor?.persona?.nombre ?? ""} ${
                  p.profesor?.persona?.apellido ?? ""
                }`
            )
            .join(", ")
        : "Sin profesor asignado",
    }));

    return res.status(200).json(resumenMateriasAlumno);
  } catch (error) {
    console.error("Error al obtener las materias del alumno: ", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor.", error: error.message });
  }
};

exports.registrarInscripcionMateria = async (req, res) => {
  const idAlumno = req.user.id;
  const { idTipoAlumno } = req.body;
  const { idMateriaPlanCicloLectivo } = req.params;

  try {
    // Verificar que las inscripciones a materias estén abiertas
    const configuracion = await ConfiguracionSistema.findByPk(1);
    if (!configuracion || configuracion.inscripciones_materias_abiertas === 0) {
      return res.status(403).json({
        error: "Las inscripciones a materias se encuentran cerradas"
      });
    }

    // Verificar que la materia existe y obtener su fecha de cierre
    const materiaPlanCiclo = await MateriaPlanCicloLectivo.findByPk(
      idMateriaPlanCicloLectivo,
      {
        attributes: ["id", "fecha_cierre", "fecha_inicio", "id_materia_plan"],
        include: [
          {
            model: MateriaPlan,
            as: "materiaPlan",
            attributes: ["id"],
          },
        ],
      }
    );

    if (!materiaPlanCiclo) {
      return res.status(404).json({ 
        error: "La materia especificada no existe" 
      });
    }

    // Verificar si el alumno ya tiene una inscripción activa en esta materia (cualquier ciclo lectivo)
    // Solo puede volver a inscribirse si su inscripción anterior está en estado "Desaprobada"
    const inscripcionExistente = await InscripcionMateria.findOne({
      where: {
        id_usuario_alumno: idAlumno,
        estado: {
          [Op.notIn]: ["Desaprobada"], // Solo permitir reinscripción si está desaprobada
        },
      },
      include: [
        {
          model: MateriaPlanCicloLectivo,
          as: "ciclo",
          where: {
            id_materia_plan: materiaPlanCiclo.id_materia_plan,
          },
          required: true,
        },
      ],
    });

    if (inscripcionExistente) {
      const estadoActual = inscripcionExistente.estado;
      let mensajeError = "";

      if (estadoActual === "Aprobada") {
        mensajeError = "Ya tienes esta materia aprobada.";
      } else if (estadoActual === "Regularizada") {
        mensajeError = "Ya tienes esta materia regularizada. Debes rendir el examen final.";
      } else if (estadoActual === "Cursando") {
        mensajeError = "Ya estás cursando esta materia.";
      } else {
        mensajeError = `Ya tienes una inscripción activa en esta materia con estado: ${estadoActual}`;
      }

      return res.status(403).json({
        error: mensajeError,
        estadoActual: estadoActual,
      });
    }

    await InscripcionMateria.create({
      id_usuario_alumno: idAlumno,
      id_materia_plan_ciclo_lectivo: idMateriaPlanCicloLectivo,
      creado_por: idAlumno,
      id_tipo_alumno: idTipoAlumno,
    });
    return res
      .status(201)
      .json({ message: "Inscripción registrada con éxito" });
  } catch (error) {
    console.error("Error al registrar inscripción:", error);
    return res.status(500).json({ 
      error: "Error al registrar la inscripción",
      details: error.message 
    });
  }
};

exports.verificarEstadoInscripcionMaterias = async (req, res) => {
  const idAlumno = req.user.id;
  const { planId } = req.params;
  const currentYear = new Date().getFullYear();

  try {
    // 0. Verificar que el alumno esté activo en la carrera del plan
    const usuario = await Usuario.findByPk(idAlumno, {
      attributes: ["id_persona"]
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const planEstudio = await PlanEstudio.findByPk(planId, {
      attributes: ["id_carrera"]
    });

    if (!planEstudio) {
      return res.status(404).json({ error: "Plan de estudios no encontrado" });
    }

    const alumnoCarrera = await AlumnoCarrera.findOne({
      where: {
        id_persona: usuario.id_persona,
        id_carrera: planEstudio.id_carrera
      }
    });

    if (!alumnoCarrera) {
      return res.status(403).json({ 
        error: "No estás inscripto en esta carrera" 
      });
    }

    if (alumnoCarrera.activo === 0) {
      return res.status(403).json({ 
        error: "Estás dado de baja en esta carrera y no puedes inscribirte a materias" 
      });
    }

    // 1. Obtener todas las materias del plan del ciclo lectivo actual, incluyendo el nombre de la materia y fechas
    const materiasPlan = await MateriaPlan.findAll({
      where: { id_plan_estudio: planId },
      attributes: ["id"],
      include: [
        {
          model: Materia,
          as: "materia",
          attributes: ["id", "nombre"],
        },
        {
          model: MateriaPlanCicloLectivo,
          as: "ciclos",
          where: { ciclo_lectivo: currentYear },
          attributes: ["id", "fecha_inicio", "fecha_cierre"],
          required: true,
        },
      ],
    });

    const idsMateriaPlan = materiasPlan.map((mp) => mp.id);

    // 2. Obtener inscripciones existentes del alumno para este ciclo lectivo (Estados relevantes)
    const inscripcionesExistentes = await InscripcionMateria.findAll({
      where: {
        id_usuario_alumno: idAlumno,
        estado: ["Cursando", "Regularizada", "Aprobada"],
      },
      include: [
        {
          model: MateriaPlanCicloLectivo,
          as: "ciclo",
          where: { ciclo_lectivo: currentYear },
          required: true,
          include: [
            {
              model: MateriaPlan,
              as: "materiaPlan",
              where: { id_plan_estudio: planId },
              required: false,
            },
          ],
        },
      ],
    });

    // 3. Obtener materias aprobadas históricamente del alumno (por plan)
    const materiasAprobadas = await InscripcionMateria.findAll({
      where: {
        id_usuario_alumno: idAlumno,
        estado: "Aprobada",
      },
      include: [
        {
          model: MateriaPlanCicloLectivo,
          as: "ciclo",
          required: false,
          include: [
            {
              model: MateriaPlan,
              as: "materiaPlan",
              where: { id_plan_estudio: planId },
              required: false,
            },
          ],
        },
      ],
    });

    // 4. Obtener todas las correlativas del plan con información de las materias correlativas
    //    Aseguramos que si idsMateriaPlan está vacío, no hagamos una consulta inútil.
    let correlativas = [];
    if (idsMateriaPlan.length > 0) {
      correlativas = await Correlativa.findAll({
        where: { id_materia_plan: idsMateriaPlan },
        include: [
          {
            model: MateriaPlan,
            as: "materiaCorrelativa",
            include: [
              {
                model: Materia,
                as: "materia",
                attributes: ["id", "nombre"],
              },
            ],
          },
        ],
      });
    }

    // 5. Crear mapas para facilitar las verificaciones (con protecciones)
    const materiasInscriptasMap = new Set(
      inscripcionesExistentes
        .map((ins) =>
          ins.ciclo && ins.ciclo.materiaPlan ? ins.ciclo.materiaPlan.id : null
        )
        .filter(Boolean)
    );

    const materiasAprobadasMap = new Set(
      materiasAprobadas
        .map((ins) =>
          ins.ciclo && ins.ciclo.materiaPlan ? ins.ciclo.materiaPlan.id : null
        )
        .filter(Boolean)
    );

    const correlativasMap = new Map();
    correlativas.forEach((corr) => {
      const key = corr.id_materia_plan;
      if (!correlativasMap.has(key)) correlativasMap.set(key, []);
      const correlativaId = corr.id_materia_plan_correlativa;
      const correlativaNombre =
        corr.materiaCorrelativa?.materia?.nombre || null;
      correlativasMap.get(key).push({
        id: correlativaId,
        nombre: correlativaNombre,
      });
    });

    // 6. Verificar estado de cada materia (añadimos nombre de la materia principal y validación de fechas)
    const fechaActual = new Date();
    
    const estadoMaterias = materiasPlan.map((materiaPlan) => {
      const idMateriaPlan = materiaPlan.id;
      const cicloLectivo = materiaPlan.ciclos && materiaPlan.ciclos[0];
      const idMateriaPlanCicloLectivo = cicloLectivo ? cicloLectivo.id : null;

      // Nombre de la materia (si fue incluido)
      const nombreMateria = materiaPlan.materia?.nombre || null;

      // Obtener fechas
      const fechaInicio = cicloLectivo?.fecha_inicio ? new Date(cicloLectivo.fecha_inicio) : null;
      const fechaCierre = cicloLectivo?.fecha_cierre ? new Date(cicloLectivo.fecha_cierre) : null;

      // Verificar si ya está inscripto
      const yaInscripto = materiasInscriptasMap.has(idMateriaPlan);

      // Verificar si ya está aprobado
      const yaAprobado = materiasAprobadasMap.has(idMateriaPlan);

      // Verificar correlativas (traemos objetos {id, nombre})
      const correlativasRequeridas = correlativasMap.get(idMateriaPlan) || [];
      const correlativasPendientes = correlativasRequeridas.filter(
        (corr) => !materiasAprobadasMap.has(corr.id)
      );
      const correlativasCumplidas = correlativasPendientes.length === 0;

      // Determinar si puede inscribirse
      let puedeInscribirse = true;
      let razonBloqueo = null;

      if (yaAprobado) {
        puedeInscribirse = false;
        razonBloqueo = "Materia ya aprobada";
      } else if (yaInscripto) {
        puedeInscribirse = false;
        razonBloqueo = "Ya inscripto en esta materia";
      } else if (!correlativasCumplidas) {
        puedeInscribirse = false;
        razonBloqueo = "Correlativas no cumplidas";
      } else if (fechaCierre && fechaActual > fechaCierre) {
        puedeInscribirse = false;
        razonBloqueo = "Cursada finalizada";
      }

      return {
        idMateriaPlan,
        idMateriaPlanCicloLectivo,
        nombreMateria, // <-- nombre agregado
        puedeInscribirse,
        razonBloqueo,
        yaInscripto,
        yaAprobado,
        // devolvemos correlativas como objetos con id + nombre para más flexibilidad en frontend
        correlativasRequeridas: correlativasRequeridas.map((c) => ({
          id: c.id,
          nombre: c.nombre,
        })),
        correlativasPendientes: correlativasPendientes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
        })),
        correlativasCumplidas,
      };
    });

    // 7. Ordenar materias: primero las que se puede inscribir, luego las que no (prioridad definida)
    estadoMaterias.sort((a, b) => {
      if (a.puedeInscribirse !== b.puedeInscribirse) {
        // queremos true (1) primero => hacer b - a
        return (
          (b.puedeInscribirse === true ? 1 : 0) -
          (a.puedeInscribirse === true ? 1 : 0)
        );
      }
      const ordenPrioridad = {
        null: 0,
        "Ya inscripto en esta materia": 1,
        "Materia ya aprobada": 2,
        "Correlativas no cumplidas": 3,
        "Cursada finalizada": 4,
      };
      return (
        (ordenPrioridad[a.razonBloqueo] || 6) -
        (ordenPrioridad[b.razonBloqueo] || 6)
      );
    });

    // Respuesta
    res.json({
      success: true,
      data: estadoMaterias,
      resumen: {
        totalMaterias: materiasPlan.length,
        disponiblesParaInscripcion: estadoMaterias.filter(
          (m) => m.puedeInscribirse
        ).length,
        yaInscriptas: estadoMaterias.filter((m) => m.yaInscripto).length,
        yaAprobadas: estadoMaterias.filter((m) => m.yaAprobado).length,
        bloqueadasPorCorrelativas: estadoMaterias.filter(
          (m) => m.razonBloqueo === "Correlativas no cumplidas"
        ).length,
      },
    });
  } catch (error) {
    console.error("Error en verificarEstadoInscripcionMaterias:", error);
    res.status(500).json({
      success: false,
      message: "Error al verificar estado de inscripciones",
      error: error.message,
    });
  }
};

exports.listarExamenesPorPlan = async (req, res) => {
  const { idPlan } = req.params;
  try {
    const examenes = await ExamenFinal.findAll({
      attributes: ["id", "fecha", "estado", "id_usuario_profesor"],
      include: [
        {
          model: MateriaPlan,
          as: "materiaPlan",
          required: true,
          attributes: ["id", "id_materia"],
          include: [
            {
              model: Materia,
              as: "materia",
              required: true,
              attributes: ["id", "id_tipo_materia", "nombre"],
            },
            {
              model: PlanEstudio,
              as: "planEstudio",
              required: true,
              where: { id: idPlan },
              attributes: ["id", "resolucion"],
            },
          ],
        },
        {
          model: Usuario,
          as: "Profesor",
          attributes: ["id", "id_persona"],
          include: [
            {
              model: Persona,
              as: "persona",
              attributes: ["nombre", "apellido"],
            },
          ],
        },
      ],
      order: [["fecha", "DESC"]],
    });
    res.json(examenes);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

exports.verificarEstadoInscripcionFinales = async (req, res) => {
  const { idPlan } = req.params;
  const idAlumno = req.user.id;

  try {
    // Verificar que el alumno esté activo en la carrera del plan
    const usuario = await Usuario.findByPk(idAlumno, {
      attributes: ["id_persona"]
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const planEstudio = await PlanEstudio.findByPk(idPlan, {
      attributes: ["id_carrera"]
    });

    if (!planEstudio) {
      return res.status(404).json({ error: "Plan de estudios no encontrado" });
    }

    const alumnoCarrera = await AlumnoCarrera.findOne({
      where: {
        id_persona: usuario.id_persona,
        id_carrera: planEstudio.id_carrera
      }
    });

    if (!alumnoCarrera) {
      return res.status(403).json({ 
        error: "No estás inscripto en esta carrera" 
      });
    }

    if (alumnoCarrera.activo === 0) {
      return res.status(403).json({ 
        error: "Estás dado de baja en esta carrera y no puedes inscribirte a exámenes finales" 
      });
    }

    const examenes = await ExamenFinal.findAll({
      attributes: ["id", "fecha", "estado", "id_usuario_profesor"],
      include: [
        {
          model: MateriaPlan,
          as: "materiaPlan",
          required: true,
          attributes: ["id", "id_materia"],
          include: [
            {
              model: Materia,
              as: "materia",
              required: true,
              attributes: ["id", "id_tipo_materia", "nombre"],
            },
            {
              model: PlanEstudio,
              as: "planEstudio",
              required: true,
              where: { id: idPlan },
              attributes: ["id", "resolucion"],
            },
          ],
        },
        {
          model: Usuario,
          as: "Profesor",
          attributes: ["id", "id_persona"],
          include: [
            {
              model: Persona,
              as: "persona",
              attributes: ["nombre", "apellido"],
            },
          ],
        },
      ],
      order: [["fecha", "DESC"]],
    });

    if (!examenes.length) {
      return res.status(200).json({
        success: true,
        data: [],
        resumen: {
          totalFinales: 0,
          disponiblesParaInscripcion: 0,
          yaInscriptoFinal: 0,
          bloqueados: 0,
        },
      });
    }

    const examenesIds = Array.from(new Set(examenes.map((examen) => examen.id)));
    const materiaPlanIds = Array.from(
      new Set(
        examenes
          .map((examen) => examen.materiaPlan?.id)
          .filter((idMateriaPlan) => idMateriaPlan != null)
      )
    );

    const inscripcionesFinales =
      examenesIds.length > 0
        ? await InscripcionExamenFinal.findAll({
            where: {
              id_usuario_alumno: idAlumno,
              id_examen_final: { [Op.in]: examenesIds },
            },
          })
        : [];

    const inscripcionFinalSet = new Set(
      inscripcionesFinales.map((inscripcion) => inscripcion.id_examen_final)
    );

    const inscripcionesMateria =
      materiaPlanIds.length > 0
        ? await InscripcionMateria.findAll({
            where: { id_usuario_alumno: idAlumno },
            attributes: [
              "id",
              "estado",
              "nota_final",
              "id_tipo_alumno",
              "fecha_inscripcion",
            ],
            include: [
              {
                model: MateriaPlanCicloLectivo,
                as: "ciclo",
                where: { id_materia_plan: { [Op.in]: materiaPlanIds } },
                required: true,
                attributes: ["id", "id_materia_plan", "tipo_aprobacion"],
              },
              {
                model: CalificacionCuatrimestre,
                as: "calificaciones",
                required: false,
                attributes: ["calificacion"],
              },
            ],
            order: [
              ["fecha_inscripcion", "DESC"],
              ["id", "DESC"],
            ],
          })
        : [];

    const inscripcionMateriaMap = new Map();
    inscripcionesMateria.forEach((inscripcion) => {
      const idMateriaPlan = inscripcion?.ciclo?.id_materia_plan;
      if (!idMateriaPlan) return;
      if (!inscripcionMateriaMap.has(idMateriaPlan)) {
        inscripcionMateriaMap.set(idMateriaPlan, inscripcion);
      }
    });

    const estadosFinales = await Promise.all(examenes.map(async (examen) => {
      const idExamenFinal = examen.id;
      const idMateriaPlan = examen.materiaPlan?.id ?? null;
      const inscripcionMateria =
        idMateriaPlan != null
          ? inscripcionMateriaMap.get(idMateriaPlan)
          : null;

      let puedeInscribirse = true;
      let razonBloqueo = null;
      let tipoAprobacion = null;
      let promedioCalificaciones = null;
      let notaBase = null;
      let tipoAlumno = null;
      let intentosInfo = null; // Nueva variable para información de intentos
      const yaInscriptoFinal = inscripcionFinalSet.has(idExamenFinal);

      if (yaInscriptoFinal) {
        puedeInscribirse = false;
        razonBloqueo = "Ya estás inscripto/a a este examen final.";
      } else if (!inscripcionMateria) {
        puedeInscribirse = false;
        razonBloqueo =
          "No registrás inscripciones a esta materia.";
      } else {
        const estadoInscripcion = (
          inscripcionMateria.estado || ""
        ).toLowerCase();
        tipoAlumno =
          inscripcionMateria.id_tipo_alumno != null
            ? Number(inscripcionMateria.id_tipo_alumno)
            : null;

        // Si la materia ya está aprobada, no puede inscribirse al final
        if (estadoInscripcion === "aprobada") {
          puedeInscribirse = false;
          razonBloqueo =
            "Materia ya aprobada";
        } else if (estadoInscripcion === "desaprobada") {
          // Si está desaprobada, no puede inscribirse
          puedeInscribirse = false;
          razonBloqueo =
            "Has perdido la regularidad en esta materia. Debes volver a inscribirte para poder rendir el final.";
        } else if (tipoAlumno === TIPOS_ALUMNO.OYENTE) {
          // Los OYENTES nunca pueden inscribirse a exámenes finales
          puedeInscribirse = false;
          razonBloqueo =
            "Los alumnos oyentes no pueden inscribirse a exámenes finales.";
        } else if (tipoAlumno === TIPOS_ALUMNO.LIBRE) {
          // Los LIBRES pueden inscribirse sin estar regularizados, pero solo tienen 1 intento
          tipoAprobacion = inscripcionMateria.ciclo?.tipo_aprobacion || null;

          // Verificar si el examen es del mismo ciclo lectivo que la inscripción
          const cicleLectivoInscripcion = inscripcionMateria.ciclo?.ciclo_lectivo;
          const cicloLectivoExamen = examen.materiaPlan?.ciclo_lectivo || new Date(examen.fecha).getUTCFullYear();
          
          // Para alumnos libres, verificar que puedan rendir (1 solo intento)
          const verificacionLibre = await verificarPuedeRendirFinalComoLibre(
            inscripcionMateria.id,
            idAlumno
          );

          if (!verificacionLibre.puede) {
            puedeInscribirse = false;
            razonBloqueo = verificacionLibre.razon;
          } else {
            // Alumno libre puede inscribirse
            intentosInfo = {
              totalIntentos: verificacionLibre.totalIntentos,
              intentosRestantes: verificacionLibre.intentosRestantes,
              esAlumnoLibre: true,
            };
          }
        } else if (estadoInscripcion !== "regularizada") {
          // Para REGULARES e ITINERANTES, deben estar regularizados
          puedeInscribirse = false;
          razonBloqueo =
            "La cursada aún no está regularizada.";
        } else {
          // Lógica para alumnos REGULARES e ITINERANTES
          tipoAprobacion = inscripcionMateria.ciclo?.tipo_aprobacion || null;

          if (!tipoAprobacion) {
            puedeInscribirse = false;
            razonBloqueo =
              "No se pudo determinar el tipo de aprobación de la materia para validar la inscripción.";
          } else {
            // Verificar intentos previos y desaprobaciones consecutivas
            const verificacionIntentos = await verificarPuedeRendirFinal(
              inscripcionMateria.id,
              idAlumno,
              tipoAprobacion
            );

            if (!verificacionIntentos.puede) {
              puedeInscribirse = false;
              razonBloqueo = verificacionIntentos.razon;
            } else {
              // Guardar información de intentos para mostrar al usuario
              intentosInfo = {
                totalIntentos: verificacionIntentos.totalIntentos,
                intentosRestantes: verificacionIntentos.intentosRestantes,
                desaprobacionesConsecutivas: verificacionIntentos.desaprobacionesConsecutivas,
                desaprobacionesHastaPerderRegularidad: verificacionIntentos.desaprobacionesHastaPerderRegularidad,
              };

              const calificaciones = (inscripcionMateria.calificaciones || [])
                .map((calificacion) =>
                  calificacion?.calificacion != null
                    ? Number(calificacion.calificacion)
                    : null
                )
                .filter((calificacion) => calificacion != null);

              if (calificaciones.length > 0) {
                promedioCalificaciones =
                  calificaciones.reduce((acc, nota) => acc + nota, 0) /
                  calificaciones.length;
              }

              if (tipoAprobacion === "EP") {
                if (promedioCalificaciones == null) {
                  puedeInscribirse = false;
                  razonBloqueo =
                    "La materia es exclusivamente promocionable y no registra calificaciones de cuatrimestre.";
                } else if (promedioCalificaciones < 7) {
                  puedeInscribirse = false;
                  razonBloqueo =
                    "Para materias exclusivamente promocionables el promedio de calificaciones debe ser al menos 7.";
                }
              } else {
                notaBase =
                  inscripcionMateria.nota_final != null
                    ? Number(inscripcionMateria.nota_final)
                    : promedioCalificaciones;

                if (notaBase == null) {
                  puedeInscribirse = false;
                  razonBloqueo =
                    "La materia no registra calificaciones suficientes para validar la inscripción al examen final.";
                } else if (notaBase < 4) {
                  puedeInscribirse = false;
                  razonBloqueo =
                    "La calificación obtenida en la cursada debe ser igual o superior a 4 para rendir el examen final.";
                }
              }
            }
          }
        }
      }

      return {
        idExamenFinal,
        idMateriaPlan,
        idInscripcionMateria: inscripcionMateria?.id ?? null,
        fecha: examen.fecha,
        estadoExamen: examen.estado,
        materia: {
          id: examen.materiaPlan?.materia?.id ?? null,
          nombre: examen.materiaPlan?.materia?.nombre ?? null,
        },
        profesor: examen.Profesor
          ? {
              id: examen.Profesor.id,
              nombre: examen.Profesor.persona?.nombre ?? null,
              apellido: examen.Profesor.persona?.apellido ?? null,
            }
          : null,
        puedeInscribirse,
        razonBloqueo,
        tipoAprobacion,
        promedioCalificaciones,
        notaBase,
        tipoAlumno,
        yaInscriptoFinal,
        intentosInfo, // Nueva información de intentos
      };
    }));

    res.status(200).json({estadosFinales});
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        "Error al verificar estado de inscripción a exámenes finales",
      error: error.message,
    });
  }
};

exports.registrarInscripcionExamenFinal = async (req, res) => {
  const idAlumno = req.user.id;
  const { idExamenFinal } = req.params;
  const { idInscripcionMateria } = req.body;
  try {
    // Verificar que las inscripciones a finales estén abiertas
    const configuracion = await ConfiguracionSistema.findByPk(1);
    if (!configuracion || configuracion.inscripciones_finales_abiertas === 0) {
      return res.status(403).json({
        success: false,
        message: "Las inscripciones a exámenes finales se encuentran cerradas"
      });
    }

    // Verificar que existe la inscripción a materia y obtener el tipo de aprobación
    const inscripcionMateria = await InscripcionMateria.findByPk(idInscripcionMateria, {
      include: [
        {
          model: MateriaPlanCicloLectivo,
          as: "ciclo",
          attributes: ["tipo_aprobacion"],
        },
      ],
    });

    if (!inscripcionMateria) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la inscripción a la materia"
      });
    }

    const tipoAlumno = inscripcionMateria.id_tipo_alumno;

    // OYENTES nunca pueden inscribirse a exámenes finales
    if (tipoAlumno === TIPOS_ALUMNO.OYENTE) {
      return res.status(403).json({
        success: false,
        message: "Los alumnos oyentes no pueden inscribirse a exámenes finales"
      });
    }

    // Para LIBRES: no necesitan estar regularizados, pero solo tienen 1 intento
    if (tipoAlumno === TIPOS_ALUMNO.LIBRE) {
      // Verificar que no esté desaprobada
      if (inscripcionMateria.estado === "Desaprobada") {
        return res.status(403).json({
          success: false,
          message: "La materia está desaprobada. Debes inscribirte nuevamente para obtener otra oportunidad."
        });
      }

      // Verificar que no esté aprobada
      if (inscripcionMateria.estado === "Aprobada") {
        return res.status(403).json({
          success: false,
          message: "La materia ya está aprobada"
        });
      }

      // Verificar que puede rendir como libre (1 solo intento)
      const verificacionLibre = await verificarPuedeRendirFinalComoLibre(
        idInscripcionMateria,
        idAlumno
      );

      if (!verificacionLibre.puede) {
        return res.status(403).json({
          success: false,
          message: verificacionLibre.razon
        });
      }
    } else {
      // Para REGULARES e ITINERANTES: deben estar regularizados
      if (inscripcionMateria.estado !== "Regularizada") {
        return res.status(403).json({
          success: false,
          message: `No puedes inscribirte a este examen. Estado actual de la materia: ${inscripcionMateria.estado}`
        });
      }

      // Verificar intentos previos y desaprobaciones consecutivas
      const tipoAprobacion = inscripcionMateria.ciclo?.tipo_aprobacion;
      if (tipoAprobacion) {
        const verificacionIntentos = await verificarPuedeRendirFinal(
          idInscripcionMateria,
          idAlumno,
          tipoAprobacion
        );

        if (!verificacionIntentos.puede) {
          return res.status(403).json({
            success: false,
            message: verificacionIntentos.razon
          });
        }
      }
    }

    // Verificar que no esté ya inscripto a este examen
    const inscripcionExistente = await InscripcionExamenFinal.findOne({
      where: {
        id_usuario_alumno: idAlumno,
        id_examen_final: idExamenFinal,
      },
    });

    if (inscripcionExistente) {
      return res.status(403).json({
        success: false,
        message: "Ya estás inscripto/a a este examen final"
      });
    }

    await InscripcionExamenFinal.create({
      id_usuario_alumno: idAlumno,
      id_examen_final: idExamenFinal,
      creado_por: idAlumno,
      id_inscripcion_materia: idInscripcionMateria,
    });
    res.status(201).json({
      success: true,
      message: "Inscripción realizada con éxito",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al registrar la inscripción",
      error: error.message,
    });
  }
};

// Obtener los exámenes finales en los que está inscripto el alumno
exports.getExamenesInscripto = async (req, res) => {
  try {
    const idAlumno = req.user.id;

    // Buscar todas las inscripciones a exámenes finales del alumno
    const inscripciones = await InscripcionExamenFinal.findAll({
      where: { id_usuario_alumno: idAlumno },
      include: [
        {
          model: ExamenFinal,
          as: "examenFinal",
          attributes: ["id", "fecha", "estado"],
          include: [
            {
              model: MateriaPlan,
              as: "materiaPlan",
              attributes: ["id"],
              include: [
                {
                  model: Materia,
                  as: "materia",
                  attributes: ["id", "nombre"],
                },
                {
                  model: PlanEstudio,
                  as: "planEstudio",
                  attributes: ["id", "resolucion"],
                  include: [
                    {
                      model: Carrera,
                      as: "carrera",
                      attributes: ["id", "nombre"],
                    },
                  ],
                },
              ],
            },
            {
              model: Usuario,
              as: "Profesor",
              attributes: ["id"],
              include: [
                {
                  model: Persona,
                  as: "persona",
                  attributes: ["nombre", "apellido"],
                },
              ],
            },
          ],
        },
        {
          model: InscripcionMateria,
          as: "inscripcionMateria",
          attributes: ["id", "estado"],
        },
      ],
      order: [
        [{ model: ExamenFinal, as: "examenFinal" }, "fecha", "DESC"],
      ],
    });

    // Formatear la respuesta
    const examenesInscripto = inscripciones.map((inscripcion) => ({
      idInscripcion: {
        idUsuarioAlumno: inscripcion.id_usuario_alumno,
        idExamenFinal: inscripcion.id_examen_final,
      },
      fechaInscripcion: inscripcion.fecha_inscripcion,
      nota: inscripcion.nota,
      bloqueada: inscripcion.bloqueada,
      examenFinal: {
        id: inscripcion.examenFinal?.id,
        fecha: inscripcion.examenFinal?.fecha,
        estado: inscripcion.examenFinal?.estado,
      },
      materia: {
        id: inscripcion.examenFinal?.materiaPlan?.materia?.id,
        nombre: inscripcion.examenFinal?.materiaPlan?.materia?.nombre,
        codigo: inscripcion.examenFinal?.materiaPlan?.materia?.codigo,
      },
      carrera: {
        id: inscripcion.examenFinal?.materiaPlan?.planEstudio?.carrera?.id,
        nombre: inscripcion.examenFinal?.materiaPlan?.planEstudio?.carrera?.nombre,
      },
      planEstudio: {
        id: inscripcion.examenFinal?.materiaPlan?.planEstudio?.id,
        nombre: inscripcion.examenFinal?.materiaPlan?.planEstudio?.nombre,
      },
      profesor: inscripcion.examenFinal?.Profesor
        ? {
            id: inscripcion.examenFinal.Profesor.id,
            nombre: inscripcion.examenFinal.Profesor.persona?.nombre,
            apellido: inscripcion.examenFinal.Profesor.persona?.apellido,
          }
        : null,
      inscripcionMateria: {
        id: inscripcion.inscripcionMateria?.id,
        estado: inscripcion.inscripcionMateria?.estado,
      },
    }));

    res.status(200).json({
      success: true,
      data: examenesInscripto,
      total: examenesInscripto.length,
    });
  } catch (error) {
    console.error("Error al obtener los exámenes inscriptos:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los exámenes inscriptos",
      error: error.message,
    });
  }
};
