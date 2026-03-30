const {
  AlumnoCarrera,
  Persona,
  Carrera,
} = require("../../../models/");
const { fn, col, literal } = require("sequelize");

exports.getEstadisticas = async (req, res, next) => {
  try {
    const generoPorCarrera = await AlumnoCarrera.findAll({
      attributes: [
        "id_carrera",
        [
          literal('SUM(CASE WHEN `persona`.`sexo` = "M" THEN 1 ELSE 0 END)'),
          "hombres",
        ],
        [
          literal('SUM(CASE WHEN `persona`.`sexo` = "F" THEN 1 ELSE 0 END)'),
          "mujeres",
        ],
        [
          literal('SUM(CASE WHEN `persona`.`sexo` = "X" THEN 1 ELSE 0 END)'),
          "noBin",
        ],
      ],
      include: [
        { model: Persona, as: "persona", attributes: ["sexo"] },
        { model: Carrera, as: "carrera", attributes: ["nombre"] },
      ],
      group: ["id_carrera", col("carrera.nombre")],
      raw: true,
      subQuery: false,
    });
    const generoPorCarreraCurso = await AlumnoCarrera.findAll({
      attributes: [
        "id_carrera",
        [literal("YEAR(`fecha_inscripcion`)"), "anio_inscripcion"],
        [
          literal('SUM(CASE WHEN `persona`.`sexo` = "M" THEN 1 ELSE 0 END)'),
          "hombres",
        ],
        [
          literal('SUM(CASE WHEN `persona`.`sexo` = "F" THEN 1 ELSE 0 END)'),
          "mujeres",
        ],
        [
          literal('SUM(CASE WHEN `persona`.`sexo` = "X" THEN 1 ELSE 0 END)'),
          "noBin",
        ],
      ],
      include: [
        { model: Persona, as: "persona", attributes: ["sexo"] },
        { model: Carrera, as: "carrera", attributes: ["nombre"] },
      ],
      group: ["id_carrera", "anio_inscripcion", col("carrera.nombre")],
      raw: true,
      subQuery: false,
    });

    const egresadosPorAnio = await AlumnoCarrera.findAll({
      where: { egresado: 1 },
      attributes: [
        [fn("YEAR", col("fecha_inscripcion")), "anio"],
        [fn("COUNT", col("id")), "cantidad"],
      ],
      group: [fn("YEAR", col("fecha_inscripcion"))],
      raw: true,
    });

    const estadisticas = {
      generoPorCarrera,
      generoPorCarreraCurso,
      egresadosPorAnio,
    };
    res.status(200).json(estadisticas);
  } catch (err) {
    console.error(err);
    next(err);
  }
};
