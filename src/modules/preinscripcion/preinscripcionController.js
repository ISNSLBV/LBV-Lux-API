const {
  sequelize,
  Persona,
  Direccion,
  Preinscripcion,
  Carrera,
  ConfiguracionSistema,
} = require("../../models");
const { enqueueEmail } = require("../../queues/email.queue");
const { formatearFecha } = require("../../utils/dateUtils");

exports.createPreinscripcion = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const estado = await ConfiguracionSistema.findByPk(1);
    if (!estado || estado.preinscripciones_abiertas === 0) {
      await t.rollback();
      return res.status(403).json({
        error: "Las preinscripciones están actualmente cerradas",
      });
    }

    let persona = await Persona.findOne({
      where: { dni: req.body.numeroDocumento },
      transaction: t,
    });

    if (!persona) {
      persona = await Persona.create(
        {
          nombre: req.body.nombre,
          apellido: req.body.apellido,
          sexo: req.body.sexo,
          dni: req.body.numeroDocumento,
          email: req.body.email,
          telefono: req.body.telefono,
          nacionalidad: req.body.nacionalidad,
          fecha_nacimiento: req.body.fechaNacimiento,
        },
        { transaction: t }
      );

      await Direccion.create(
        {
          calle: req.body.calle,
          altura: req.body.altura,
          localidad: req.body.localidad,
          id_persona: persona.id,
        },
        { transaction: t }
      );
    }

    const preinscripcion = await Preinscripcion.create(
      {
        id_persona: persona.id,
        id_carrera: req.body.carrera,
        comentario: req.body.observaciones,
      },
      { transaction: t }
    );

    const carrera = await Carrera.findByPk(req.body.carrera);

    await t.commit();

    let fechaHora =
      preinscripcion.createdAt || preinscripcion.fecha_creacion || Date.now();

    fechaHora = new Date(fechaHora);
    if (isNaN(fechaHora.getTime())) fechaHora = new Date();

    const registrationNumber = `PR-${String(preinscripcion.id).padStart(
      5,
      "0"
    )}`;

    const submissionDate = formatearFecha(fechaHora);
    const submissionTime = fechaHora.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    try {
      await enqueueEmail({
        to: persona.email,
        subject: "ISNSLBV - Preinscripción recibida",
        text: `Hola ${persona.nombre},
            Recibimos tu preinscripción a la carrera de ${
              carrera ? carrera.nombre : req.body.carrera
            }.
            Tu número de registro es ${registrationNumber}, realizada el ${submissionDate} a las ${submissionTime}.
            Para concretar tu inscripción al instituto, deberás presentarte en Secretaría con la siguiente documentación:
            - Fotocopia de DNI
            - Analítico o Constancia de analítico en trámite
            - 2 fotos 4x4
            - Apto psicofísico emitido por cualquier médico matriculado
            - Fotocopia de Partida de Nacimiento

            Asimismo, deberás firmar el formulario de inscripción que te entregaremos en el momento.

            Podés asistir de Lunes a Viernes de 19hs. a 21:30hs. en Ruta 8 Nº 6725, 2º piso.

            Ante cualquier duda, podés contactarnos al 5263-2395 o por nuestro email: terciario@lujanbuenviaje.edu.ar

            Te esperamos.
            Saludos,
            Secretaría del Instituto Nuestra Señora de Luján del Buen Viaje`,
        html: `<p>Hola ${persona.nombre},</p>
            <p>Recibimos tu preinscripción a la carrera de ${
              carrera ? carrera.nombre : req.body.carrera
            }.</p>
            <p>Tu número de registro es <strong>${registrationNumber}</strong>, realizada el <strong>${submissionDate}</strong> a las <strong>${submissionTime}</strong>.</p>
            <p>Para concretar tu inscripción al instituto, deberás presentarte en Secretaría con la siguiente documentación:</p>
            <ul>
            <li>Fotocopia de DNI</li>
            <li>Analítico o Constancia de analítico en trámite</li>
            <li>2 fotos 4x4</li>
            <li>Apto psicofísico emitido por cualquier médico matriculado</li>
            <li>Fotocopia de Partida de Nacimiento</li>
            </ul>
            <br/>
            <p>Asimismo, deberás firmar el formulario de inscripción que te entregaremos en el momento.</p>
            <p>Podés asistir de Lunes a Viernes de 19hs. a 21:30hs. en Ruta 8 Nº 6725, 2º piso.</p>
            <br/>
            <p>Ante cualquier duda, podés contactarnos al 5263-2395 o por nuestro email: terciario@lujanbuenviaje.edu.ar</p>
            <br/>
            <p>Te esperamos.</p>
            <p>Saludos,<br/>Secretaría del Instituto Nuestra Señora de Luján del Buen Viaje</p>`,
      });
    } catch (queueErr) {
      console.error("Error al encolar email de confirmación:", queueErr);
    }

    res.status(201).json({
      message: "Preinscripción recibida",
      registrationNumber,
      submissionDate,
      submissionTime,
      studentData: {
        career: carrera ? carrera.nombre : req.body.carrera,
        email: persona.email,
      },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.getEstadoPreinscripcion = async (req, res, next) => {
  try {
    const estado = await ConfiguracionSistema.findByPk(1);

    res.status(200).json({
      abierta: estado ? estado.preinscripciones_abiertas : 0,
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleEstadoPreinscripcion = async (req, res, next) => {
  try {
    const estado = await ConfiguracionSistema.findByPk(1);

    const nuevoEstado = estado.preinscripciones_abiertas ? 0 : 1;

    await estado.update({ preinscripciones_abiertas: nuevoEstado });

    res.status(200).json({
      message: `Preinscripciones ${nuevoEstado ? "abiertas" : "cerradas"}`,
      abierta: nuevoEstado,
    });
  } catch (error) {
    next(error);
  }
};
