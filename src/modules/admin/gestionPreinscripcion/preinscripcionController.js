const bcrypt = require("bcrypt");
const {
  Persona,
  Usuario,
  Rol,
  RolUsuario,
  AlumnoCarrera,
  Preinscripcion,
  Carrera,
  PlanEstudio,
  Direccion,
  sequelize,
} = require("../../../models");
const { Op } = require("sequelize");
const { enqueueEmail } = require("../../../queues/email.queue");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const { formatearFecha } = require("../../../utils/dateUtils");

exports.listarPreinscripcion = async (req, res, next) => {
  try {
    const { estado, visible, search } = req.query;
    const preWhere = {};
    if (estado) preWhere.estado = estado;
    if (visible === "0" || visible === "1") preWhere.visible = Number(visible);

    const personaWhere = {};
    if (search) {
      const term = `%${search}%`;
      personaWhere[Op.or] = [
        { nombre: { [Op.like]: term } },
        { apellido: { [Op.like]: term } },
        { dni: { [Op.like]: term } },
      ];
    }

    const personas = await Persona.findAll({
      where: personaWhere,
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: [
        {
          model: Preinscripcion,
          as: "preinscripciones",
          attributes: [
            "id",
            "id_carrera",
            "comentario",
            "estado",
            "visible",
            "fecha_creacion",
          ],
          where: preWhere,
          required: true,
          include: [
            {
              model: Carrera,
              as: "carrera",
              attributes: ["id", "nombre"],
            },
          ],
        },
      ],
      order: [["fecha_registro", "ASC"]],
    });

    res.json(personas);
  } catch (err) {
    next(err);
  }
};

exports.aceptar = async (req, res, next) => {
  const { personaId } = req.params;
  const { carreraId } = req.body;
  const tipoAlumnoId = 1; // Siempre Regular

  try {
    await sequelize.transaction(async (t) => {
      const persona = await Persona.findByPk(personaId, { transaction: t });
      if (!persona) throw new Error("Persona no encontrada");

      const preinscripcion = await Preinscripcion.findOne({
        where: { id_persona: persona.id, estado: "Pendiente" },
        transaction: t,
      });
      
      if (!preinscripcion)
        throw new Error(
          "No se encontró una preinscripción pendiente para esta persona."
        );

      // Obtener el plan de estudios vigente de la carrera
      const planVigente = await PlanEstudio.findOne({
        where: { 
          id_carrera: carreraId,
          vigente: 1 
        },
        transaction: t,
      });

      if (!planVigente) {
        throw new Error("No se encontró un plan de estudios vigente para esta carrera");
      }

      preinscripcion.estado = "Aprobada";
      preinscripcion.visible = 0;
      await preinscripcion.save({ transaction: t });

      let usuario = await Usuario.findOne({
        where: { id_persona: persona.id },
        transaction: t,
      });

      if (!usuario) {
        const dni = persona.dni;
        const existe = await Usuario.findOne({
          where: { username: dni },
          transaction: t,
        });
        if (existe)
          throw new Error("Ya existe un usuario con ese DNI como username");

        usuario = await Usuario.create(
          {
            username: dni,
            password: await bcrypt.hash(dni, 10),
            id_persona: persona.id,
          },
          { transaction: t }
        );
      }

      let rolAlumno = await Rol.findOne({
        where: { nombre: "Alumno" },
        transaction: t,
      });
      if (!rolAlumno) {
        rolAlumno = await Rol.create({ nombre: "Alumno" }, { transaction: t });
      }

      const yaEsAlumno = await RolUsuario.findOne({
        where: { id_usuario: usuario.id, id_rol: rolAlumno.id },
        transaction: t,
      });
      if (!yaEsAlumno) {
        await RolUsuario.create(
          { id_usuario: usuario.id, id_rol: rolAlumno.id },
          { transaction: t }
        );
      }

      const yaInscripto = await AlumnoCarrera.findOne({
        where: { id_persona: persona.id, id_carrera: carreraId },
        transaction: t,
      });
      if (!yaInscripto) {
        await AlumnoCarrera.create(
          {
            id_persona: persona.id,
            id_carrera: carreraId,
            id_plan_estudio_asignado: planVigente.id,
          },
          { transaction: t }
        );
      }
      // Encolar email de confirmación para envío asíncrono
      try {
        await enqueueEmail({
          to: persona.email,
          subject: "ISNSLBV | Bienvenido al instituto",
          text: 
            `Hola ${persona.nombre},
            Tu preinscripción ha sido aprobada. Podés acceder al sistema LUX con:
            Usuario: ${usuario.username}
            Contraseña: tu DNI

            Éxitos en la carrera, estamos a tu disposición en todo momento.
            Saludos,
            Secretaría del Instituto Nuestra Señora de Luján del Buen Viaje`,
          html: 
            `<p>Hola ${persona.nombre},</p>
            <p>Tu preinscripción ha sido <strong>aprobada</strong>. Podés acceder al sistema LUX con:</p>
            <ul><li>Usuario: ${usuario.username}</li><li>Contraseña: tu DNI</li></ul>
            <p>Éxitos en la carrera, estamos a tu disposición en todo momento.</p>
            <p>Saludos,<br/>Secretaría del Instituto Nuestra Señora de Luján del Buen Viaje</p>`,
        });
      } catch (queueErr) {
        console.error("Error al encolar email de confirmación:", queueErr);
      }

      res
        .status(201)
        .json({ message: "Preinscripción aprobada y usuario creado" });
    });
  } catch (err) {
    next(err);
  }
};

exports.ocultar = async (req, res, next) => {
  const { personaId } = req.params;

  try {
    await sequelize.transaction(async (t) => {
      const persona = await Persona.findByPk(personaId, { transaction: t });
      if (!persona) throw new Error("Persona no encontrada");

      await Preinscripcion.update(
        { visible: 0 },
        { where: { id_persona: persona.id }, transaction: t }
      );

      res.status(204).send();
    });
  } catch (err) {
    next(err);
  }
};

exports.generarFichaInscripcion = async (req, res, next) => {
  const { personaId } = req.params;

  try {
    const persona = await Persona.findByPk(personaId, {
      include: [
        {
          model: Preinscripcion,
          as: "preinscripciones",
          where: { estado: "Pendiente" },
          include: [
            {
              model: Carrera,
              as: "carrera",
              attributes: ["nombre"],
            },
          ],
        },
        {
          model: Direccion,
          as: "direcciones",
        },
      ],
    });

    if (!persona) {
      return res.status(404).json({ message: "Persona no encontrada" });
    }

    const preinscripcion = persona.preinscripciones?.[0];
    if (!preinscripcion) {
      return res.status(404).json({ message: "No hay preinscripción pendiente" });
    }

    // Leer logo y convertir a base64
    const logoPath = path.join(__dirname, "../../../assets/logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString("base64");

    // Helper para Handlebars
    handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });

    // Preparar datos para la ficha
    const carreraNombre = preinscripcion.carrera?.nombre || "";
    const direccionCompleta = persona.direcciones?.[0]
      ? `${persona.direcciones?.[0]?.calle} ${persona.direcciones?.[0]?.altura}`
      : "";

    const datos = {
      logoBase64,
      carrera: carreraNombre.toUpperCase(),
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni: persona.dni,
      estadoCivil: "", // A completar a mano
      numeroHijos: "", // A completar a mano
      direccion: direccionCompleta,
      localidad: persona.direcciones?.[0]?.localidad || "",
      codigoPostal: "",
      celular: persona.telefono,
      email: persona.email,
      fechaNacimiento: persona.fecha_nacimiento
        ? formatearFecha(persona.fecha_nacimiento)
        : "",
      lugarNacimiento: "", // A completar a mano
      provincia: "", // A completar a mano
      nacionalidad: persona.nacionalidad,
      estudiosNivel: "", // A completar a mano
      estudiosTitulo: "", // A completar a mano
      estudiosInstitucion: "", // A completar a mano
    };

    // Leer y compilar template
    const templatePath = path.join(__dirname, "../../../templates/ficha_inscripcion.hbs");
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    const template = handlebars.compile(templateSource);
    const html = template(datos);

    // Generar PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "15mm",
        bottom: "15mm",
        left: "15mm",
      },
    });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Ficha_Inscripcion_${persona.apellido}_${persona.nombre}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("Error al generar ficha:", err);
    next(err);
  }
};
