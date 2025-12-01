const { Asistencia, Clase, InscripcionMateria, MateriaPlanCicloLectivo } = require("../../../models");
const {
  puedeRecibirAsistencia,
} = require("../../../utils/examenFinalUtils");

exports.registrarAsistencia = async (req, res, next) => {
  const { claseId, alumnoId, estado, profesorRegistroId } = req.body;

  try {
    const clase = await Clase.findByPk(claseId, {
      attributes: ["id", "id_materia_plan_ciclo_lectivo"],
    });
    if (!clase) {
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    // Buscar la inscripción a la materia del alumno para verificar el tipo de alumno
    const inscripcionMateria = await InscripcionMateria.findOne({
      where: {
        id_usuario_alumno: alumnoId,
        id_materia_plan_ciclo_lectivo: clase.id_materia_plan_ciclo_lectivo,
      },
      attributes: ["id_tipo_alumno"],
    });

    if (inscripcionMateria) {
      // Validar si el tipo de alumno puede tener asistencia registrada
      const validacionTipoAlumno = puedeRecibirAsistencia(
        inscripcionMateria.id_tipo_alumno
      );

      if (!validacionTipoAlumno.puede) {
        return res.status(403).json({ error: validacionTipoAlumno.razon });
      }
    }

    const asistenciaExistente = await Asistencia.findOne({
      where: { id_clase: claseId, id_usuario_alumno: alumnoId },
    });

    if (asistenciaExistente && req.user.rol === "Profesor") {
      return res
        .status(400)
        .json({
          error:
            "La asistencia ya fue registrada. Solo un administrador puede modificarla.",
        });
    }

    if (asistenciaExistente && req.user.rol === "Administrador") {
      asistenciaExistente.estado_asistencia = estado;
      asistenciaExistente.modificado_por = req.user.id;
      asistenciaExistente.fecha_modificacion = new Date();
      await asistenciaExistente.save();
      return res.status(200).json(asistenciaExistente);
    }

    if (!asistenciaExistente) {
      const asistencia = await Asistencia.create({
        id_clase: clase.id,
        id_usuario_alumno: alumnoId,
        estado_asistencia: estado,
        id_usuario_profesor_registro: profesorRegistroId || req.user.id,
        creado_por: req.user.id,
      });
      return res.status(201).json(asistencia);
    }
  } catch (err) {
    next(err);
  }
};
