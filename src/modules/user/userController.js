const {
  Usuario,
  Persona,
  Direccion,
  InscripcionMateria,
  MateriaPlanCicloLectivo,
  Materia,
  HorarioMateria,
  AlumnoCarrera,
  Carrera,
  Rol,
  PlanEstudio,
  MateriaPlan,
  RolUsuario,
  InscripcionExamenFinal
} = require("../../models");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const verificationService = require("../../services/verificationService");
const { enviarCorreo } = require("../../lib/mailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

exports.perfil = async (req, res, next) => {
  try {
    const idUsuario = req.params.id || req.user.id;

    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id", "username"],
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: [
            "nombre",
            "apellido",
            "email",
            "dni",
            "telefono",
            "fecha_nacimiento",
          ],
          include: [
            {
              model: Direccion,
              as: "direcciones",
              attributes: ["calle", "altura", "localidad"],
            },
            {
              model: AlumnoCarrera,
              as: "carreras",
              attributes: ["fecha_inscripcion", "activo"],
              include: [
                {
                  model: Carrera,
                  as: "carrera",
                  attributes: ["id", "nombre"],
                  include: [
                    {
                      model: PlanEstudio,
                      as: "planesEstudio",
                      attributes: ["id", "resolucion", "vigente"],
                      where: { vigente: 1 },
                      include: [
                        {
                          model: MateriaPlan,
                          as: "materiaPlans",
                          attributes: ["id"],
                          include: [
                            {
                              model: Materia,
                              as: "materia",
                              attributes: ["id", "nombre"],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: InscripcionMateria,
          as: "inscripciones",
          attributes: ["id", "estado", "nota_final"],
          include: [
            {
              model: MateriaPlanCicloLectivo,
              as: "ciclo",
              attributes: ["id", "ciclo_lectivo"],
              include: [
                {
                  model: MateriaPlan,
                  as: "materiaPlan",
                  attributes: ["id", "id_materia", "anio_carrera"],
                  include: [
                    {
                      model: Materia,
                      as: "materia",
                      attributes: ["id", "nombre"],
                    },
                    {
                      model: PlanEstudio,
                      as: "planEstudio",
                      attributes: ["id"],
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
                  model: HorarioMateria,
                  as: "horarios",
                  attributes: ["dia_semana", "bloque"],
                },
              ],
            },
          ],
        },
        {
          model: Rol,
          as: "roles",
          attributes: ["id", "nombre"],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const aprobadas = usuario.inscripciones.filter(
      (i) => i.estado === "Aprobada"
    ).length;

    // Contar materias únicas aprobadas por el alumno
    const materiasAprobadasIds = new Set();
    usuario.inscripciones
      .filter((i) => i.estado === "Aprobada")
      .forEach((i) => {
        if (i.ciclo && i.ciclo.materiaPlan && i.ciclo.materiaPlan.id_materia) {
          materiasAprobadasIds.add(i.ciclo.materiaPlan.id_materia);
        }
      });

    const materiasAprobadasUnicas = materiasAprobadasIds.size;

    // Calcular promedio con materias aprobadas y exámenes finales aprobados
    const notasAprobadas = [];
    
    // Obtener notas de materias aprobadas por promoción
    usuario.inscripciones
      .filter((i) => i.estado === "Aprobada" && i.nota_final !== null)
      .forEach((i) => {
        notasAprobadas.push(parseFloat(i.nota_final));
      });
    
    // Obtener notas de exámenes finales aprobados
    const examenesFinalesAprobados = await InscripcionExamenFinal.findAll({
      where: {
        id_usuario_alumno: idUsuario,
        nota: { [Op.not]: null }
      },
      attributes: ['nota']
    });
    
    examenesFinalesAprobados.forEach((examen) => {
      if (examen.nota !== null) {
        notasAprobadas.push(parseFloat(examen.nota));
      }
    });
    
    // Calcular promedio
    const promedio = notasAprobadas.length > 0
      ? notasAprobadas.reduce((sum, nota) => sum + nota, 0) / notasAprobadas.length
      : 0;

    const tipoAlumnoMap = {
      1: "Regular",
      2: "Libre",
      3: "Oyente",
      4: "Itinerante",
    };

    const carreras = usuario.persona.carreras;
    
    // Preparar información por carrera
    const carrerasList = carreras.map((carreraAlumno) => {
      const carrera = carreraAlumno.carrera;
      const planVigente = carrera.planesEstudio && carrera.planesEstudio[0];
      const totalMateriasPlan = planVigente?.materiaPlans?.length || 0;
      
      // Filtrar inscripciones de esta carrera específica
      const inscripcionesCarrera = usuario.inscripciones.filter(
        (i) => i.ciclo?.materiaPlan?.planEstudio?.carrera?.id === carrera.id
      );
      
      // Calcular materias aprobadas únicas para esta carrera
      const materiasAprobadasIdsCarrera = new Set();
      inscripcionesCarrera
        .filter((i) => i.estado === "Aprobada")
        .forEach((i) => {
          if (i.ciclo?.materiaPlan?.id_materia) {
            materiasAprobadasIdsCarrera.add(i.ciclo.materiaPlan.id_materia);
          }
        });
      
      // Calcular promedio para esta carrera
      const notasAprobadasCarrera = inscripcionesCarrera
        .filter((i) => i.estado === "Aprobada" && i.nota_final !== null)
        .map((i) => parseFloat(i.nota_final));
      
      const promedioCarrera = notasAprobadasCarrera.length > 0
        ? notasAprobadasCarrera.reduce((sum, nota) => sum + nota, 0) / notasAprobadasCarrera.length
        : 0;
      
      return {
        id: carrera.id,
        nombre: carrera.nombre,
        activo: carreraAlumno.activo === 1,
        fechaInscripcion: carreraAlumno.fecha_inscripcion,
        promedio: promedioCarrera.toFixed(1),
        materiasAprobadas: materiasAprobadasIdsCarrera.size,
        totalMateriasPlan,
        materias: inscripcionesCarrera.map((i) => ({
          nombre: i.ciclo.materiaPlan.materia.nombre,
          profesor: "—",
          estado: i.estado,
          horario: i.ciclo.horarios
            .map((h) => `${h.dia_semana}-${h.bloque}`)
            .join(", "),
          nota: i.nota_final,
        })),
        horarios: inscripcionesCarrera.flatMap((i) =>
          i.ciclo.horarios.map((h) => ({
            nombre: i.ciclo.materiaPlan.materia.nombre,
            profesor: "—",
            horario: `Día ${h.dia_semana} Bloque ${h.bloque}`,
          }))
        ),
      };
    });
    
    // Carrera activa por defecto (primera activa o primera en la lista)
    const carreraActivaIndex = carrerasList.findIndex((c) => c.activo);
    const carreraDefault = carrerasList[carreraActivaIndex !== -1 ? carreraActivaIndex : 0] || {};

    const informacionPersonal = {
      nombre: `${usuario.persona.nombre} ${usuario.persona.apellido}`,
      fechaNacimiento: usuario.persona.fecha_nacimiento,
      dni: usuario.persona.dni,
      ingreso: carreraDefault.fechaInscripcion || null,
      carrera: carreras.map((c) => c.carrera.nombre).join(", "),
    };

    res.json({
      informacionPersonal,
      estadisticas: [
        { iconoKey: "promedio", valor: promedio.toFixed(1) },
        {
          iconoKey: "aprobadas",
          valor: `${materiasAprobadasUnicas}/${carreraDefault.totalMateriasPlan || 0}`,
        },
      ],
      horarios: usuario.inscripciones.flatMap((i) =>
        i.ciclo.horarios.map((h) => ({
          nombre: i.ciclo.materiaPlan.materia.nombre,
          profesor: "—",
          horario: `Día ${h.dia_semana} Bloque ${h.bloque}`,
        }))
      ),
      materias: usuario.inscripciones.map((i) => ({
        nombre: i.ciclo.materiaPlan.materia.nombre,
        profesor: "—",
        estado: i.estado,
        horario: i.ciclo.horarios
          .map((h) => `${h.dia_semana}-${h.bloque}`)
          .join(", "),
        nota: i.nota_final,
      })),
      promedioGeneral: promedio.toFixed(1),
      carreras: carrerasList,
      // Agregar inscripciones con año de carrera para certificados
      inscripcionesActuales: usuario.inscripciones.map((i) => ({
        estado: i.estado,
        anio_carrera: i.ciclo?.materiaPlan?.anio_carrera || 0,
        materia: i.ciclo?.materiaPlan?.materia?.nombre || "",
        carrera: i.ciclo?.materiaPlan?.planEstudio?.carrera?.nombre || "",
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.mostrarDatosPersonales = async (req, res, next) => {
  try {
    const idUsuario = req.params.id || req.user.id;
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id"],
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: ["email", "telefono"],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({
      email: usuario.persona.email,
      telefono: usuario.persona.telefono,
    });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.actualizarDatosPersonales = async (req, res, next) => {
  const idUsuario = req.params.id || req.user.id;
  const { email, telefono } = req.body;
  try {
    const usuario = await Usuario.findByPk(idUsuario, {
      include: [{ model: Persona, as: "persona" }],
    });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Verificar si el usuario está intentando cambiar email o teléfono
    const emailCambiado = email && email !== usuario.persona.email;
    const telefonoCambiado = telefono && telefono !== usuario.persona.telefono;

    if (emailCambiado || telefonoCambiado) {
      return res.status(400).json({ 
        message: "Para cambiar email o teléfono, usa el endpoint de solicitud de verificación",
        requiresVerification: true
      });
    }

    // Si no hay cambios en email ni teléfono, actualizar normalmente
    await usuario.persona.update({
      email: email || usuario.persona.email,
      telefono: telefono || usuario.persona.telefono,
    });
    
    res.json({
      message: "Datos actualizados correctamente",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Solicitar cambio de email o teléfono
 * Genera un código y lo envía al email actual
 */
exports.solicitarCambioDato = async (req, res, next) => {
  try {
    const idUsuario = req.params.id || req.user.id;
    const { campo, nuevoValor } = req.body;

    // Validar campo
    if (!['email', 'telefono'].includes(campo)) {
      return res.status(400).json({ 
        message: "Campo inválido. Debe ser 'email' o 'telefono'" 
      });
    }

    // Validar que se proporcione el nuevo valor
    if (!nuevoValor || nuevoValor.trim() === '') {
      return res.status(400).json({ 
        message: "Debe proporcionar el nuevo valor" 
      });
    }

    // Buscar usuario
    const usuario = await Usuario.findByPk(idUsuario, {
      include: [{ model: Persona, as: "persona" }],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Verificar que el nuevo valor sea diferente al actual
    if (usuario.persona[campo] === nuevoValor.trim()) {
      return res.status(400).json({ 
        message: `El nuevo ${campo} es igual al actual` 
      });
    }

    // Verificar si ya existe una solicitud pendiente
    const hasPending = await verificationService.hasPendingRequest(idUsuario, campo);
    if (hasPending) {
      const timeRemaining = await verificationService.getTimeRemaining(idUsuario, campo);
      return res.status(429).json({ 
        message: "Ya existe una solicitud pendiente. Espera a que expire o usa el código enviado.",
        timeRemaining: timeRemaining > 0 ? timeRemaining : 0
      });
    }

    const expirationMinutes = 15;
    const code = await verificationService.createVerificationRequest(
      idUsuario,
      campo,
      nuevoValor.trim(),
      usuario.persona.email,
      expirationMinutes
    );

    // Leer y compilar la plantilla de email
    const templatePath = path.join(__dirname, '../../templates/verificacion_cambio.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateSource);

    const fieldNameMap = {
      email: 'correo electrónico',
      telefono: 'teléfono'
    };

    const html = template({
      fieldName: fieldNameMap[campo],
      newValue: nuevoValor.trim(),
      code,
      expirationMinutes
    });

    // Determinar a qué dirección enviar el email
    // Si es cambio de email, enviar al nuevo email
    // Si es cambio de teléfono, enviar al email actual
    const destinatarioEmail = campo === 'email' ? nuevoValor.trim() : usuario.persona.email;

    // Enviar email
    await enviarCorreo({
      to: destinatarioEmail,
      subject: `Verificación de cambio de ${fieldNameMap[campo]}`,
      html
    });

    res.json({ 
      message: `Código de verificación enviado a ${destinatarioEmail}`,
      expiresIn: expirationMinutes * 60 // segundos
    });

  } catch (error) {
    console.error('[ERROR] Error al solicitar cambio:', error);
    next(error);
  }
};

/**
 * Verificar código y aplicar cambio
 */
exports.verificarCambioDato = async (req, res, next) => {
  try {
    const idUsuario = req.params.id || req.user.id;
    const { campo, codigo } = req.body;

    // Validar campo
    if (!['email', 'telefono'].includes(campo)) {
      return res.status(400).json({ 
        message: "Campo inválido. Debe ser 'email' o 'telefono'" 
      });
    }

    // Validar código
    if (!codigo || codigo.trim() === '') {
      return res.status(400).json({ 
        message: "Debe proporcionar el código de verificación" 
      });
    }

    // Verificar código
    const verificationData = await verificationService.verifyCode(
      idUsuario, 
      campo, 
      codigo.trim()
    );

    if (!verificationData) {
      return res.status(400).json({ 
        message: "Código inválido o expirado" 
      });
    }

    // Buscar usuario
    const usuario = await Usuario.findByPk(idUsuario, {
      include: [{ model: Persona, as: "persona" }],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Aplicar el cambio
    await usuario.persona.update({
      [campo]: verificationData.newValue
    });

    // Eliminar la solicitud de verificación
    await verificationService.deleteVerificationRequest(idUsuario, campo);

    const fieldNameMap = {
      email: 'correo electrónico',
      telefono: 'teléfono'
    };

    res.json({ 
      message: `${fieldNameMap[campo]} actualizado correctamente`,
      newValue: verificationData.newValue
    });

  } catch (error) {
    console.error('[ERROR] Error al verificar cambio:', error);
    next(error);
  }
};

/**
 * Cancelar solicitud de cambio pendiente
 */
exports.cancelarCambioDato = async (req, res, next) => {
  try {
    const idUsuario = req.params.id || req.user.id;
    const { campo } = req.body;

    // Validar campo
    if (!['email', 'telefono'].includes(campo)) {
      return res.status(400).json({ 
        message: "Campo inválido. Debe ser 'email' o 'telefono'" 
      });
    }

    // Verificar si existe una solicitud pendiente
    const hasPending = await verificationService.hasPendingRequest(idUsuario, campo);
    
    if (!hasPending) {
      return res.status(404).json({ 
        message: "No hay ninguna solicitud pendiente para este campo" 
      });
    }

    // Eliminar la solicitud
    await verificationService.deleteVerificationRequest(idUsuario, campo);

    res.json({ 
      message: "Solicitud de cambio cancelada correctamente" 
    });

  } catch (error) {
    console.error('[ERROR] Error al cancelar cambio:', error);
    next(error);
  }
};

/**
 * Obtener verificaciones pendientes del usuario
 */
exports.obtenerVerificacionesPendientes = async (req, res, next) => {
  try {
    const idUsuario = req.params.id || req.user.id;
    const pendientes = {};

    // Verificar para email
    const emailData = await verificationService.getPendingVerificationData(idUsuario, 'email');
    if (emailData) {
      pendientes.email = emailData;
    }

    // Verificar para teléfono
    const telefonoData = await verificationService.getPendingVerificationData(idUsuario, 'telefono');
    if (telefonoData) {
      pendientes.telefono = telefonoData;
    }

    res.json({ pendientes });

  } catch (error) {
    console.error('[ERROR] Error al obtener verificaciones pendientes:', error);
    next(error);
  }
};

exports.actualizarPassword = async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;
    const idUsuario = req.params.id || req.user.id;
    const usuario = await Usuario.findByPk(idUsuario);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const passwordMatch = await bcrypt.compare(
      actual,
      usuario.password
    );
    if (!passwordMatch) {
      return res.status(400).json({ message: "Contraseña actual incorrecta" });
    }
    const hashedPassword = await bcrypt.hash(nueva, 10);
    await usuario.update({ password: hashedPassword });
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    next(error);
  }
};

exports.getCarrerasInscripto = async (req, res) => {
  try {
    const { idAlumno } = req.params;

    const inscripciones = await AlumnoCarrera.findAll({
      where: { id_persona: idAlumno },
      include: [
        {
          model: Carrera,
          as: "carrera",
          attributes: ["id", "nombre"],
        },
      ],
      required: false, // LEFT JOIN para no excluir usuarios sin carreras
    });

    // Aplicar filtros específicos si se proporcionan
    if (activo !== undefined || carrera) {
      const carreraWhere = {};
      if (activo !== undefined) {
        carreraWhere.activo = activo === "true" ? 1 : 0;
      }
      if (carrera) {
        carreraWhere.id_carrera = carrera;
      }

      carreraInclude.where = carreraWhere;
      carreraInclude.required = true; // INNER JOIN cuando hay filtros específicos
    }

    const alumnos = await Usuario.findAll({
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: ["nombre", "apellido", "dni", "email", "telefono"],
          include: [carreraInclude],
          required: true, // Asegurar que siempre tenga persona
        },
        {
          model: RolUsuario,
          as: "rol_usuarios",
          include: [
            {
              model: Rol,
              as: "rol",
              attributes: ["id", "nombre"],
              where: { nombre: "Alumno" },
            },
          ],
          required: true,
        },
      ],
      where: whereConditions,
    });

    const alumnosFormateados = alumnos
      .map((alumno) => {
        // Validar que persona existe
        if (!alumno.persona) {
          console.warn(`Usuario ${alumno.id} sin persona asociada`);
          return null;
        }

        const carreras = alumno.persona.carreras || [];
        const carreraActiva =
          carreras.find((c) => c.activo === 1) || carreras[0];

        return {
          id: alumno.id,
          username: alumno.username,
          nombre: alumno.persona.nombre,
          apellido: alumno.persona.apellido,
          dni: alumno.persona.dni,
          email: alumno.persona.email,
          telefono: alumno.persona.telefono,
          carrera: {
            id: carreraActiva?.carrera?.id || null,
            nombre: carreraActiva?.carrera?.nombre || "Sin carrera",
          },
          fechaInscripcion: carreraActiva?.fecha_inscripcion || null,
          activo: carreraActiva?.activo === 1,
        };
      })
      .filter((alumno) => alumno !== null); // Filtrar elementos nulos

    res.json(alumnosFormateados);
  } catch (error) {
    console.error("Error al listar alumnos:", error);
    next(error);
  }
};
// Controlador para buscar alumnos por DNI o nombre
exports.buscarAlumnos = async (req, res, next) => {
  try {
    const term = req.query.term;
    if (!term) {
      return res.status(400).json({ message: "Término de búsqueda requerido" });
    }
    const alumnos = await Usuario.findAll({
      where: {},
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: ["nombre", "apellido", "dni"],
          where: {
            [Op.or]: [
              { dni: { [Op.like]: `%${term}%` } },
              { nombre: { [Op.like]: `%${term}%` } },
              { apellido: { [Op.like]: `%${term}%` } },
            ],
          },
        },
        {
          model: RolUsuario,
          as: "rol_usuarios",
          include: [{ model: Rol, as: "rol", where: { nombre: "Alumno" } }],
        },
      ],
      limit: 10,
    });
    const resultados = alumnos.map((a) => ({
      id: a.id,
      nombre: a.persona.nombre,
      apellido: a.persona.apellido,
      dni: a.persona.dni,
    }));
    res.json(resultados);
  } catch (error) {
    next(error);
  }
};

exports.listarCarreras = async (req, res, next) => {
  try {
    const carreras = await Carrera.findAll({
      attributes: ["id", "nombre"],
      order: [["nombre", "ASC"]],
    });

    res.json(carreras);
  } catch (error) {
    console.error("Error al listar carreras:", error);
    next(error);
  }
};

// Controlador para listar todos los alumnos
exports.listarAlumnos = async (req, res, next) => {
  try {
    const { activo, carrera } = req.query;

    // Construir condiciones de filtrado
    const whereConditions = {
      "$rol_usuarios.rol.nombre$": "Alumno",
    };

    const carreraInclude = {
      model: AlumnoCarrera,
      as: "carreras",
      attributes: ["fecha_inscripcion", "activo", "id_plan_estudio_asignado"],
      include: [
        {
          model: Carrera,
          as: "carrera",
          attributes: ["id", "nombre"],
        },
        {
          model: PlanEstudio,
          as: "planEstudio",
          attributes: ["id", "resolucion"],
        }
      ],
      required: false, // LEFT JOIN para no excluir usuarios sin carreras
    };

    // Aplicar filtros específicos si se proporcionan
    if (activo !== undefined || carrera) {
      const carreraWhere = {};
      if (activo !== undefined) {
        carreraWhere.activo = activo === "true" ? 1 : 0;
      }

      if (carrera) {
        carreraWhere.id_carrera = carrera;
      }
      carreraInclude.where = carreraWhere;
      carreraInclude.required = true; // INNER JOIN cuando hay filtros específicos
    }

    const alumnos = await Usuario.findAll({
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: ["nombre", "apellido", "dni", "email", "telefono"],
          include: [carreraInclude],
          required: true, // Asegurar que siempre tenga persona
        },
        {
          model: RolUsuario,
          as: "rol_usuarios",
          include: [
            {
              model: Rol,
              as: "rol",
              attributes: ["id", "nombre"],
              where: { nombre: "Alumno" },
            },
          ],
          required: true,
        },
      ],
      where: whereConditions,
    });

    const alumnosFormateados = alumnos
      .map((alumno) => {
        // Validar que persona existe
        if (!alumno.persona) {
          console.warn(`Usuario ${alumno.id} sin persona asociada`);
          return null;
        }

        const carreras = alumno.persona.carreras || [];
        
        // Formatear todas las carreras del alumno
        const carrerasFormateadas = carreras.map(c => ({
          id: c.carrera?.id || null,
          nombre: c.carrera?.nombre || "Sin carrera",
          fechaInscripcion: c.fecha_inscripcion || null,
          activo: c.activo === 1,
          idPlanEstudioAsignado: c.id_plan_estudio_asignado || null,
          resolucionPlanAsignado: c.planEstudio?.resolucion || null,
        }));

        return {
          id: alumno.id,
          username: alumno.username,
          nombre: alumno.persona.nombre,
          apellido: alumno.persona.apellido,
          dni: alumno.persona.dni,
          email: alumno.persona.email,
          telefono: alumno.persona.telefono,
          carreras: carrerasFormateadas,
        };
      })
      .filter((alumno) => alumno !== null); // Filtrar elementos nulos

    res.json(alumnosFormateados);
  } catch (error) {
    console.error("Error al listar alumnos:", error);
    next(error);
  }
};

exports.obtenerIdPersona = async (req, res, next) => {
  try {
    const idUsuario = req.user.id;
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id_persona"],
    });
    res.json({ id_persona: usuario.id_persona });
  } catch (error) {
    next(error);
  }
};

exports.modificarPlanEstudio = async (req, res, next) => {
  try {
    const { idUsuario, idCarrera } = req.params;
    const { idPlanEstudio } = req.body;

    // Obtener id_persona del usuario
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id_persona"]
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validar que el plan de estudios exista y pertenezca a la carrera
    const planEstudio = await PlanEstudio.findOne({
      where: {
        id: idPlanEstudio,
        id_carrera: idCarrera
      }
    });

    if (!planEstudio) {
      return res.status(404).json({ 
        message: "El plan de estudios no existe o no pertenece a la carrera especificada" 
      });
    }

    // Buscar la relación alumno-carrera
    const alumnoCarrera = await AlumnoCarrera.findOne({
      where: {
        id_persona: usuario.id_persona,
        id_carrera: idCarrera
      }
    });

    if (!alumnoCarrera) {
      return res.status(404).json({ 
        message: "El alumno no está inscripto en esta carrera" 
      });
    }

    // Actualizar el plan de estudios asignado
    alumnoCarrera.id_plan_estudio_asignado = idPlanEstudio;
    await alumnoCarrera.save();

    res.json({ 
      message: "Plan de estudios actualizado correctamente",
      alumnoCarrera 
    });
  } catch (error) {
    console.error("Error al modificar plan de estudios:", error);
    next(error);
  }
};

exports.darDeBajaAlumnoCarrera = async (req, res, next) => {
  try {
    const { idUsuario, idCarrera } = req.params;

    // Obtener id_persona del usuario
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id_persona"]
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Buscar la relación alumno-carrera
    const alumnoCarrera = await AlumnoCarrera.findOne({
      where: {
        id_persona: usuario.id_persona,
        id_carrera: idCarrera
      }
    });

    if (!alumnoCarrera) {
      return res.status(404).json({ 
        message: "El alumno no está inscripto en esta carrera" 
      });
    }

    // Verificar si ya está dado de baja
    if (alumnoCarrera.activo === 0) {
      return res.status(400).json({ 
        message: "El alumno ya está dado de baja en esta carrera" 
      });
    }

    // Dar de baja (cambiar activo a 0)
    alumnoCarrera.activo = 0;
    await alumnoCarrera.save();

    res.json({ 
      message: "Alumno dado de baja correctamente de la carrera",
      alumnoCarrera 
    });
  } catch (error) {
    console.error("Error al dar de baja alumno:", error);
    next(error);
  }
};

exports.reactivarAlumnoCarrera = async (req, res, next) => {
  try {
    const { idUsuario, idCarrera } = req.params;

    // Obtener id_persona del usuario
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id_persona"]
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Buscar la relación alumno-carrera
    const alumnoCarrera = await AlumnoCarrera.findOne({
      where: {
        id_persona: usuario.id_persona,
        id_carrera: idCarrera
      }
    });

    if (!alumnoCarrera) {
      return res.status(404).json({ 
        message: "El alumno no está inscripto en esta carrera" 
      });
    }

    // Verificar si ya está activo
    if (alumnoCarrera.activo === 1) {
      return res.status(400).json({ 
        message: "El alumno ya está activo en esta carrera" 
      });
    }

    // Reactivar (cambiar activo a 1)
    alumnoCarrera.activo = 1;
    await alumnoCarrera.save();

    res.json({ 
      message: "Alumno reactivado correctamente en la carrera",
      alumnoCarrera 
    });
  } catch (error) {
    console.error("Error al reactivar alumno:", error);
    next(error);
  }
};

exports.obtenerPlanesCarrera = async (req, res, next) => {
  try {
    const { idCarrera } = req.params;

    const planes = await PlanEstudio.findAll({
      where: { id_carrera: idCarrera },
      attributes: ["id", "resolucion", "vigente"],
      order: [["vigente", "DESC"], ["resolucion", "DESC"]]
    });

    res.json(planes);
  } catch (error) {
    console.error("Error al obtener planes de estudios:", error);
    next(error);
  }
};

exports.verificarEstadoCarreras = async (req, res, next) => {
  try {
    const idUsuario = req.user.id;

    // Obtener usuario y sus carreras
    const usuario = await Usuario.findByPk(idUsuario, {
      attributes: ["id", "id_persona"],
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: ["id"],
          include: [
            {
              model: AlumnoCarrera,
              as: "carreras",
              attributes: ["id", "id_carrera", "activo"],
              include: [
                {
                  model: Carrera,
                  as: "carrera",
                  attributes: ["id", "nombre"]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!usuario || !usuario.persona) {
      return res.status(404).json({ 
        message: "Usuario no encontrado",
        puedeAcceder: false,
        carrerasActivas: [],
        carrerasInactivas: [],
        todasInactivas: true
      });
    }

    const carreras = usuario.persona.carreras || [];
    const carrerasActivas = carreras.filter(c => c.activo === 1);
    const carrerasInactivas = carreras.filter(c => c.activo === 0);

    // Determinar si puede acceder a las secciones
    const puedeAcceder = carrerasActivas.length > 0;
    const todasInactivas = carreras.length > 0 && carrerasActivas.length === 0;

    res.json({
      puedeAcceder,
      todasInactivas,
      carrerasActivas: carrerasActivas.map(c => ({
        id: c.id_carrera,
        nombre: c.carrera?.nombre,
        activo: true
      })),
      carrerasInactivas: carrerasInactivas.map(c => ({
        id: c.id_carrera,
        nombre: c.carrera?.nombre,
        activo: false
      })),
      totalCarreras: carreras.length,
      mensaje: todasInactivas 
        ? "Estás dado de baja en todas tus carreras. No puedes acceder a inscripciones ni solicitar equivalencias."
        : puedeAcceder
        ? "Tienes acceso a las funcionalidades del sistema."
        : "No estás inscripto en ninguna carrera."
    });
  } catch (error) {
    console.error("Error al verificar estado de carreras:", error);
    next(error);
  }
};

