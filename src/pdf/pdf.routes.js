const express = require("express");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
require("dayjs/locale/es");
dayjs.extend(utc);
dayjs.locale("es");
const {
  generarConstanciaAlumnoRegular,
  renderConstanciaHTML,
  generarCertificadoMateriasAprobadas,
  renderCertificadoMateriasAprobadasHTML,
  generarCertificadoAsistenciaExamen,
  renderCertificadoAsistenciaExamenHTML,
  generarPlanEstudiosCompleto,
  renderPlanEstudiosCompletoHTML,
} = require("./pdf.service");
const { verifyToken } = require("../middlewares/auth");
const {
  Usuario,
  Persona,
  Carrera,
  AlumnoCarrera,
  Certificado,
  PlanEstudio,
  InscripcionMateria,
  MateriaPlanCicloLectivo,
  MateriaPlan,
  Materia,
  ExamenFinal,
  AsistenciaExamenFinal,
  InscripcionExamenFinal,
} = require("../models");
dayjs.locale("es");
const router = express.Router();
const { Op } = require("sequelize");

// Ruta para certificados manuales (sin idAlumno)
router.get(
  "/certificado/:certificadoId",
  verifyToken,
  async (req, res, next) => {
    try {
      const { certificadoId } = req.params;
      const { nombre, apellido, dni, carrera, resolucion } = req.query;
      const certificadoIdInt = parseInt(certificadoId);

      // Validar que se proporcionaron los datos manuales mínimos
      if (!nombre || !apellido || !dni) {
        return res.status(400).json({
          error: "Se requieren nombre, apellido y DNI para certificado manual",
        });
      }

      // Crear objeto alumno manual
      const alumno = {
        persona: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
        },
        carrera: carrera?.trim() || "Sin especificar",
        resolucion: resolucion?.trim() || "—",
      };

      // Distribuir según el tipo de certificado
      switch (certificadoIdInt) {
        case 1:
          return await procesarCertificadoAlumnoRegular(
            req,
            res,
            next,
            alumno,
            true
          );
        case 2:
          return await procesarCertificadoMateriasAprobadas(
            req,
            res,
            next,
            alumno,
            true
          );
        case 3:
          return await procesarCertificadoAsistenciaExamen(
            req,
            res,
            next,
            alumno,
            true
          );
        default:
          return res
            .status(400)
            .json({ error: "Tipo de certificado no válido" });
      }
    } catch (e) {
      next(e);
    }
  }
);

// Ruta para certificados de alumnos registrados (con idAlumno)
router.get(
  "/certificado/:certificadoId/:idAlumno",
  verifyToken,
  async (req, res, next) => {
    try {
      const { certificadoId, idAlumno } = req.params;
      const certificadoIdInt = parseInt(certificadoId);

      // Validar que el alumno existe
      const alumno = await Usuario.findByPk(idAlumno, {
        include: [
          {
            model: Persona,
            as: "persona",
            attributes: ["nombre", "apellido", "dni"],
          },
        ],
      });

      if (!alumno) {
        return res.status(404).json({ error: "Alumno no encontrado" });
      }

      // Distribuir según el tipo de certificado
      switch (certificadoIdInt) {
        case 1:
          return await procesarCertificadoAlumnoRegular(
            req,
            res,
            next,
            alumno,
            false
          );
        case 2:
          return await procesarCertificadoMateriasAprobadas(
            req,
            res,
            next,
            alumno,
            false
          );
        case 3:
          return await procesarCertificadoAsistenciaExamen(
            req,
            res,
            next,
            alumno,
            false
          );
        default:
          return res
            .status(400)
            .json({ error: "Tipo de certificado no válido" });
      }
    } catch (e) {
      next(e);
    }
  }
);

// Función para generar Certificado de Alumno Regular (modificada)
async function procesarCertificadoAlumnoRegular(
  req,
  res,
  next,
  alumno,
  isManual = false
) {
  try {
    const contacto =
      "terciario@lujanbuenviaje.edu.ar — www.lujanbuenviaje.edu.ar";
    const sitio = "www.lujanbuenviaje.edu.ar";
    const email = "terciario@lujanbuenviaje.edu.ar";
    const hoy = dayjs();

    let carrerasInfo = [];

    if (!isManual) {
      // Para alumnos registrados, buscar carreras activas
      const carrerasActivas = await AlumnoCarrera.findAll({
        where: {
          id_persona: alumno.id_persona,
          activo: { [Op.or]: [true, 1] },
        },
        include: [
          {
            model: Carrera,
            as: "carrera",
            attributes: ["nombre"],
            required: true,
            include: [
              {
                model: PlanEstudio,
                as: "planesEstudio",
                attributes: ["resolucion"],
                required: false,
              },
            ],
          },
        ],
      });

      if (carrerasActivas.length === 0) {
        return res
          .status(400)
          .json({ error: "El alumno no está activo en ninguna carrera" });
      }

      carrerasInfo = carrerasActivas.map((c) => ({
        nombre: c.carrera?.nombre,
        resolucion: c.carrera?.planesEstudio?.[0]?.resolucion ?? "—",
      }));

      // Obtener inscripciones para calcular el año del alumno
      const inscripciones = await InscripcionMateria.findAll({
        where: {
          id_usuario_alumno: alumno.id,
          estado: { [Op.in]: ["REGULAR", "APROBADA", "CURSANDO"] },
        },
        include: [
          {
            model: MateriaPlanCicloLectivo,
            as: "ciclo",
            include: [
              {
                model: MateriaPlan,
                as: "materiaPlan",
                attributes: ["anio_carrera"],
              },
            ],
          },
        ],
      });

      // Encontrar el año más alto
      let anioMasAlto = 0;
      inscripciones.forEach((inscripcion) => {
        const anio = inscripcion.ciclo?.materiaPlan?.anio_carrera || 0;
        if (anio > anioMasAlto) {
          anioMasAlto = anio;
        }
      });

      // Convertir número de año a texto
      const aniosTexto = {
        1: "primer año",
        2: "segundo año",
        3: "tercer año",
        4: "cuarto año",
        5: "quinto año",
      };

      var anioAlumno = aniosTexto[anioMasAlto] || "";
    } else {
      // Para alumnos manuales, usar datos proporcionados o genéricos
      carrerasInfo = [
        {
          nombre: alumno.carrera || "Sin especificar",
          resolucion: alumno.resolucion || "—",
        },
      ];
      var anioAlumno = "";
    }

    const data = {
      nombre: alumno.persona.nombre,
      apellido: alumno.persona.apellido,
      dni: alumno.persona.dni,
      carreras: carrerasInfo,
      anioAlumno: anioAlumno,
      contacto,
      sitio,
      email,
      dia: hoy.format("D"),
      mes: hoy.format("MMMM"),
      anio: hoy.format("YYYY"),
      isManual,
    };

    if (req.query.format === "html") {
      const html = renderConstanciaHTML(data);
      return res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(
          `${html}<script>setTimeout(()=>{try{window.print()}catch(e){}}, 300)</script>`
        );
    }

    const pdf = await generarConstanciaAlumnoRegular(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="constancia_alumno_regular_${data.apellido}_${data.dni}.pdf"`
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(pdf);
  } catch (e) {
    next(e);
  }
}

// Función para generar Certificado de Materias Aprobadas (modificada)
async function procesarCertificadoMateriasAprobadas(
  req,
  res,
  next,
  alumno,
  isManual = false
) {
  try {
    const contacto =
      "terciario@lujanbuenviaje.edu.ar — www.lujanbuenviaje.edu.ar";
    const sitio = "www.lujanbuenviaje.edu.ar";
    const email = "terciario@lujanbuenviaje.edu.ar";
    const hoy = dayjs();

    let materiasInfo = [];
    let carrerasSet = new Set();
    let carreraPrincipal = "";
    let totalMateriasCarrera = 0;

    if (!isManual) {
      // Para alumnos registrados, buscar materias aprobadas
      const materiasAprobadas = await InscripcionMateria.findAll({
        where: {
          id_usuario_alumno: alumno.id,
          estado: "APROBADA",
        },
        include: [
          {
            model: MateriaPlanCicloLectivo,
            as: "ciclo",
            include: [
              {
                model: MateriaPlan,
                as: "materiaPlan",
                attributes: ["anio_carrera"],
                include: [
                  {
                    model: Materia,
                    as: "materia",
                    attributes: ["nombre"],
                  },
                  {
                    model: PlanEstudio,
                    as: "planEstudio",
                    attributes: ["resolucion"],
                    include: [
                      {
                        model: Carrera,
                        as: "carrera",
                        attributes: ["nombre"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        order: [
          [{ model: MateriaPlanCicloLectivo, as: "ciclo" }, { model: MateriaPlan, as: "materiaPlan" }, "anio_carrera", "ASC"]
        ],
      });

      // Convertir números a letras para calificaciones
      const numerosALetras = {
        1: "Uno", 2: "Dos", 3: "Tres", 4: "Cuatro", 5: "Cinco",
        6: "Seis", 7: "Siete", 8: "Ocho", 9: "Nueve", 10: "Diez"
      };

      materiasInfo = materiasAprobadas.map((inscripcion) => {
        const carreraNombre = inscripcion.ciclo?.materiaPlan?.planEstudio?.carrera?.nombre || "";
        if (carreraNombre) {
          carrerasSet.add(carreraNombre);
          carreraPrincipal = carreraNombre; // La última será la principal
        }

        const notaNumero = Math.round(parseFloat(inscripcion.nota_final) || 0);
        
        return {
          anio: inscripcion.ciclo?.materiaPlan?.anio_carrera ? `${inscripcion.ciclo.materiaPlan.anio_carrera}º Año` : "—",
          nombre: inscripcion.ciclo?.materiaPlan?.materia?.nombre || "Materia no especificada",
          fechaAprobacion: inscripcion.fecha_finalizacion
            ? dayjs.utc(inscripcion.fecha_finalizacion).format("DD/MM/YYYY")
            : "—",
          notaNumero: notaNumero || "—",
          notaLetras: numerosALetras[notaNumero] || "—",
        };
      });

      // Calcular porcentaje de materias aprobadas
      // Esto requeriría saber cuántas materias tiene la carrera en total
      // Por ahora lo dejamos genérico
      totalMateriasCarrera = 23; // Valor por defecto, ajustá según tu plan de estudios
      const porcentajeAprobado = Math.round((materiasInfo.length / totalMateriasCarrera) * 100);

      var porcentaje = porcentajeAprobado;
    } else {
      // Para alumnos manuales, lista vacía
      materiasInfo = [];
      var porcentaje = 0;
    }

    // ✅ Obtener TODAS las materias del plan de estudios oficial (no solo las inscriptas)
    let todasLasMaterias = [];
    let resolucionPlan = "";
    if (!isManual) {
      // Obtener la carrera activa del alumno
      const alumnoCarrera = await AlumnoCarrera.findOne({
        where: {
          id_persona: alumno.id_persona,
          activo: { [Op.or]: [true, 1] },
        },
        include: [
          {
            model: Carrera,
            as: "carrera",
            attributes: ["nombre"],
            include: [
              {
                model: PlanEstudio,
                as: "planesEstudio",
                where: { vigente: 1 },
                attributes: ["id", "resolucion"],
                include: [
                  {
                    model: MateriaPlan,
                    as: "materiaPlans",
                    attributes: ["id", "anio_carrera", "horas_catedra"],
                    include: [
                      {
                        model: Materia,
                        as: "materia",
                        attributes: ["nombre"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      if (alumnoCarrera && alumnoCarrera.carrera) {
        const planEstudio = alumnoCarrera.carrera.planesEstudio[0];
        resolucionPlan = planEstudio?.resolucion || "S/N";
        
        // Obtener todas las materias del plan
        const materiasDelPlan = planEstudio?.materiaPlans || [];
        
        // Crear un mapa de las inscripciones del alumno para saber el estado de cada materia
        const inscripcionesMap = new Map();
        const inscripcionesAlumno = await InscripcionMateria.findAll({
          where: {
            id_usuario_alumno: alumno.id,
          },
          include: [
            {
              model: MateriaPlanCicloLectivo,
              as: "ciclo",
              attributes: ["ciclo_lectivo"],
              include: [
                {
                  model: MateriaPlan,
                  as: "materiaPlan",
                  attributes: ["id"],
                },
              ],
            },
          ],
        });

        inscripcionesAlumno.forEach((insc) => {
          const idMateriaPlan = insc.ciclo?.materiaPlan?.id;
          if (idMateriaPlan) {
            inscripcionesMap.set(idMateriaPlan, {
              estado: insc.estado || "NO CURSADA",
              fechaFinalizacion: insc.fecha_finalizacion
                ? dayjs.utc(insc.fecha_finalizacion).format("DD/MM/YYYY")
                : "—",
              nota: insc.nota_final ? Math.round(parseFloat(insc.nota_final)) : "—",
              cicloLectivo: insc.ciclo?.ciclo_lectivo || "—",
            });
          }
        });

        // Mapear todas las materias del plan con su estado
        todasLasMaterias = materiasDelPlan.map((materiaPlan) => {
          const inscripcion = inscripcionesMap.get(materiaPlan.id) || {
            estado: "NO CURSADA",
            fechaFinalizacion: "—",
            nota: "—",
            cicloLectivo: "—",
          };

          let claseEstado = "pendiente";
          if (inscripcion.estado === "APROBADA") claseEstado = "aprobada";
          else if (inscripcion.estado === "CURSANDO") claseEstado = "cursando";
          else if (inscripcion.estado === "REGULAR" || inscripcion.estado === "REGULARIZADA") claseEstado = "regular";

          return {
            anio: materiaPlan.anio_carrera || 0,
            nombre: materiaPlan.materia?.nombre || "Materia no especificada",
            horas: materiaPlan.horas_catedra || 0,
            estado: inscripcion.estado,
            fechaFinalizacion: inscripcion.fechaFinalizacion,
            nota: inscripcion.nota,
            cicloLectivo: inscripcion.cicloLectivo,
            claseEstado: claseEstado,
          };
        });

        // Ordenar por año de carrera
        todasLasMaterias.sort((a, b) => a.anio - b.anio);
      }
    }

    const data = {
      nombre: alumno.persona.nombre,
      apellido: alumno.persona.apellido,
      dni: alumno.persona.dni,
      carreras: Array.from(carrerasSet),
      carreraPrincipal: carreraPrincipal,
      materias: materiasInfo,
      totalMaterias: materiasInfo.length,
      porcentajeAprobado: porcentaje,
      contacto,
      sitio,
      email,
      dia: hoy.format("D"),
      mes: hoy.format("MMMM"),
      anio: hoy.format("YYYY"),
      isManual,
    };

    // Agrupar materias por año de forma genérica
    const materiasPorAnio = {};
    todasLasMaterias.forEach(materia => {
      const anio = materia.anio || 0;
      if (!materiasPorAnio[anio]) {
        materiasPorAnio[anio] = [];
      }
      materiasPorAnio[anio].push(materia);
    });

    // Convertir a formato de años para el template
    const aniosArray = Object.keys(materiasPorAnio)
      .filter(anio => anio > 0) // Filtrar materias sin año
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((anio, index) => {
        const materias = materiasPorAnio[anio];
        const totalHoras = materias.reduce((sum, m) => sum + (m.horas || 0), 0);
        
        return {
          titulo: `${anio}° AÑO`,
          materias: materias.map((m, idx) => ({
            numero: idx + 1,
            nombre: m.nombre,
            horas: `${m.horas || 0} Hs.`
          })),
          totalHoras: `${totalHoras} Hs.`
        };
      });

    const dataPlanCompleto = {
      carrera: carreraPrincipal,
      resolucionPlan: resolucionPlan,
      anios: aniosArray,
    };

    if (req.query.format === "html") {
      const html = renderCertificadoMateriasAprobadasHTML(data);
      return res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(
          `${html}<script>setTimeout(()=>{try{window.print()}catch(e){}}, 300)</script>`
        );
    }

    // ✅ Generar ambos PDFs (cada uno con su propia página)
    const pdf1 = await generarCertificadoMateriasAprobadas(data);
    const pdf2 = await generarPlanEstudiosCompleto(dataPlanCompleto);

    // ✅ Combinar los PDFs
    const pdfDoc = await PDFDocument.create();
    
    const pdf1Doc = await PDFDocument.load(pdf1);
    const pages1 = await pdfDoc.copyPages(pdf1Doc, pdf1Doc.getPageIndices());
    pages1.forEach(page => pdfDoc.addPage(page));

    const pdf2Doc = await PDFDocument.load(pdf2);
    const pages2 = await pdfDoc.copyPages(pdf2Doc, pdf2Doc.getPageIndices());
    pages2.forEach(page => pdfDoc.addPage(page));

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="certificado_materias_aprobadas_${data.apellido}_${data.dni}.pdf"`
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(Buffer.from(pdfBytes));
  } catch (e) {
    next(e);
  }
}

// Función para generar Certificado de Asistencia a Examen (modificada)
async function procesarCertificadoAsistenciaExamen(
  req,
  res,
  next,
  alumno,
  isManual = false
) {
  try {
    const contacto =
      "terciario@lujanbuenviaje.edu.ar — www.lujanbuenviaje.edu.ar";
    const sitio = "www.lujanbuenviaje.edu.ar";
    const email = "terciario@lujanbuenviaje.edu.ar";
    const hoy = dayjs();

    let nombreCarrera = "";
    let anioCarrera = "";
    let nombreMateria = "";
    let diaExamen = "";
    let mesExamen = "";
    let anioExamen = "";

    if (!isManual) {
      // Para alumnos registrados, obtener información de sus inscripciones
      const inscripciones = await InscripcionMateria.findAll({
        where: {
          id_usuario_alumno: alumno.id,
          estado: { [Op.in]: ["REGULAR", "APROBADA", "CURSANDO"] },
        },
        include: [
          {
            model: MateriaPlanCicloLectivo,
            as: "ciclo",
            include: [
              {
                model: MateriaPlan,
                as: "materiaPlan",
                attributes: ["anio_carrera"],
                include: [
                  {
                    model: Materia,
                    as: "materia",
                    attributes: ["nombre"],
                  },
                  {
                    model: PlanEstudio,
                    as: "planEstudio",
                    include: [
                      {
                        model: Carrera,
                        as: "carrera",
                        attributes: ["nombre"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      // Encontrar el año más alto de las materias cursadas
      let anioMasAlto = 0;
      let materiaDelAnioMasAlto = null;
      let carreraDelAnioMasAlto = null;

      inscripciones.forEach((inscripcion) => {
        const anio = inscripcion.ciclo?.materiaPlan?.anio_carrera || 0;
        if (anio > anioMasAlto) {
          anioMasAlto = anio;
          materiaDelAnioMasAlto =
            inscripcion.ciclo?.materiaPlan?.materia?.nombre;
          carreraDelAnioMasAlto =
            inscripcion.ciclo?.materiaPlan?.planEstudio?.carrera?.nombre;
        }
      });

      // Convertir número de año a texto
      const aniosTexto = {
        1: "primer año",
        2: "segundo año",
        3: "tercer año",
        4: "cuarto año",
        5: "quinto año",
      };

      nombreCarrera = req.query.nombreCarrera || carreraDelAnioMasAlto || "";
      anioCarrera = req.query.anioCarrera || aniosTexto[anioMasAlto] || "";
      nombreMateria = req.query.nombreMateria || "Materia no especificada";
    } else {
      // Para modo manual, usar query params
      nombreCarrera = req.query.nombreCarrera || "";
      anioCarrera = req.query.anioCarrera || "";
      nombreMateria = req.query.nombreMateria || "";
    }

    // Datos del examen - siempre desde query params (completados a mano)
    diaExamen = req.query.diaExamen || "";
    mesExamen = req.query.mesExamen || "";
    anioExamen = req.query.anioExamen || "";

    const data = {
      nombre: alumno.persona.nombre,
      apellido: alumno.persona.apellido,
      dni: alumno.persona.dni,
      nombreCarrera,
      anioCarrera,
      nombreMateria,
      diaExamen,
      mesExamen,
      anioExamen,
      contacto,
      sitio,
      email,
      diaPresente: hoy.format("D"),
      mesPresente: hoy.format("MMMM"),
      anioPresente: hoy.format("YYYY"),
      isManual,
    };

    if (req.query.format === "html") {
      const html = renderCertificadoAsistenciaExamenHTML(data);
      return res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(
          `${html}<script>setTimeout(()=>{try{window.print()}catch(e){}}, 300)</script>`
        );
    }

    const pdf = await generarCertificadoAsistenciaExamen(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="certificado_asistencia_examen_${data.apellido}_${data.dni}.pdf"`
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(pdf);
  } catch (e) {
    next(e);
  }
}

// Mantener el endpoint original para compatibilidad
router.get(
  "/constancia-alumno-regular/:idAlumno",
  verifyToken,
  async (req, res, next) => {
    try {
      const { idAlumno } = req.params;

      const alumno = await Usuario.findByPk(idAlumno, {
        include: [
          {
            model: Persona,
            as: "persona",
            attributes: ["nombre", "apellido", "dni"],
          },
        ],
      });

      if (!alumno)
        return res.status(404).json({ error: "Alumno no encontrado" });

      return await procesarCertificadoAlumnoRegular(
        req,
        res,
        next,
        alumno,
        false
      );
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
