const {
  AlumnoCarrera,
  Persona,
  Carrera,
} = require("../../../models/");
const { Op, fn, col, literal } = require("sequelize");

const calcularEdad = (fechaNacimiento) => {
  const hoy = new Date();
  const cumpleanos = new Date(fechaNacimiento);
  
  // Usar métodos UTC para fechas que vienen de la BD como "YYYY-MM-DD"
  let edad = hoy.getFullYear() - cumpleanos.getUTCFullYear();
  const mes = hoy.getMonth() - cumpleanos.getUTCMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < cumpleanos.getUTCDate())) {
    edad--;
  }
  return edad;
};

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

    const alumnosConEdad = await Persona.findAll({
      attributes: ["fecha_nacimiento"],
      raw: true,
    });

    const rangos = {
      19: 0,
      20: 0,
      21: 0,
      22: 0,
      23: 0,
      24: 0,
      "25-29": 0,
      "30-34": 0,
      "35+": 0,
    };

    alumnosConEdad.forEach((alumno) => {
      const edad = calcularEdad(alumno.fecha_nacimiento);
      if (edad >= 19 && edad <= 24) rangos[edad.toString()]++;
      else if (edad >= 25 && edad <= 29) rangos["25-29"]++;
      else if (edad >= 30 && edad <= 34) rangos["30-34"]++;
      else if (edad >= 35) rangos["35+"]++;
    });

    const rangoEtario = Object.keys(rangos).map((key) => ({
      rango: key,
      estudiantes: rangos[key],
    }));

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
      rangoEtario,
      egresadosPorAnio,
    };
    res.status(200).json(estadisticas);
  } catch (err) {
    console.error(err);
    next(err);
  }
};
