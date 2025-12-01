const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");
const personaModel = require("./persona");
const direccionModel = require("./direccion");
const usuarioModel = require("./usuario");
const rolModel = require("./rol");
const rolUsuarioModel = require("./rol_usuario");
const preinscripcionModel = require("./preinscripcion");
const configuracionSistemaModel = require("./configuracion_sistema");
const carreraModel = require("./carrera");
const planEstudioModel = require("./plan_estudio");
const materiaModel = require("./materia");
const materiaPlanModel = require("./materia_plan");
const materiaPlanCicloLectivoModel = require("./materia_plan_ciclo_lectivo");
const correlativaModel = require("./correlativa");
const examenFinalModel = require("./examen_final");
const profesorMateriaModel = require("./profesor_materia");
const alumnoCarreraModel = require("./alumno_carrera");
const inscripcionMateriaModel = require("./inscripcion_materia");
const inscripcionExamenFinalModel = require("./inscripcion_examen_final");
const claseModel = require("./clase");
const claseProfesorModel = require("./clase_profesor");
const temaModel = require("./tema");
const claseTemaModel = require("./clase_tema");
const asistenciaModel = require("./asistencia");
const certificadoModel = require("./certificado");
const alertaModel = require("./alerta");
const asistenciaExamenFinalModel = require("./asistencia_examen_final");
const horarioMateriaModel = require("./horario_materia");
const calificacionCuatrimestreModel = require("./calificacion_cuatrimestre");
const acreditacionEquivalenciaModel = require("./acreditacion_equivalencia");
const Persona = personaModel(sequelize, DataTypes);
const Direccion = direccionModel(sequelize, DataTypes);
const Usuario = usuarioModel(sequelize, DataTypes);
const Rol = rolModel(sequelize, DataTypes);
const RolUsuario = rolUsuarioModel(sequelize, DataTypes);
const Preinscripcion = preinscripcionModel(sequelize, DataTypes);
const ConfiguracionSistema = configuracionSistemaModel(sequelize, DataTypes);
const Carrera = carreraModel(sequelize, DataTypes);
const PlanEstudio = planEstudioModel(sequelize, DataTypes);
const Materia = materiaModel(sequelize, DataTypes);
const MateriaPlan = materiaPlanModel(sequelize, DataTypes);
const MateriaPlanCicloLectivo = materiaPlanCicloLectivoModel(
  sequelize,
  DataTypes
);
const Correlativa = correlativaModel(sequelize, DataTypes);
const ExamenFinal = examenFinalModel(sequelize, DataTypes);
const ProfesorMateria = profesorMateriaModel(sequelize, DataTypes);
const AlumnoCarrera = alumnoCarreraModel(sequelize, DataTypes);
const InscripcionMateria = inscripcionMateriaModel(sequelize, DataTypes);
const InscripcionExamenFinal = inscripcionExamenFinalModel(
  sequelize,
  DataTypes
);
const Clase = claseModel(sequelize, DataTypes);
const ClaseProfesor = claseProfesorModel(sequelize, DataTypes);
const Tema = temaModel(sequelize, DataTypes);
const ClaseTema = claseTemaModel(sequelize, DataTypes);
const Asistencia = asistenciaModel(sequelize, DataTypes);
const Certificado = certificadoModel(sequelize, DataTypes);
const Alerta = alertaModel(sequelize, DataTypes);
const AsistenciaExamenFinal = asistenciaExamenFinalModel(sequelize, DataTypes);
const HorarioMateria = horarioMateriaModel(sequelize, DataTypes);
const CalificacionCuatrimestre = calificacionCuatrimestreModel(
  sequelize,
  DataTypes
);
const AcreditacionEquivalencia = acreditacionEquivalenciaModel(
  sequelize,
  DataTypes
);

// Definición de relaciones

Persona.hasMany(Direccion, { foreignKey: "id_persona", as: "direcciones" });

Carrera.hasMany(PlanEstudio, { foreignKey: "id_carrera", as: "planesEstudio" });

MateriaPlan.belongsTo(Materia, {
  foreignKey: "id_materia",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
  as: "materia",
});

Materia.hasMany(MateriaPlan, { foreignKey: "id_materia", as: "materiaPlans" });

MateriaPlan.belongsTo(PlanEstudio, {
  foreignKey: "id_plan_estudio",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
  as: "planEstudio",
});

PlanEstudio.hasMany(MateriaPlan, {
  foreignKey: "id_plan_estudio",
  as: "materiaPlans",
});

MateriaPlanCicloLectivo.belongsTo(MateriaPlan, {
  as: "materiaPlan",
  foreignKey: "id_materia_plan",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlan.hasMany(MateriaPlanCicloLectivo, {
  as: "ciclos",
  foreignKey: "id_materia_plan",
});

MateriaPlan.belongsToMany(MateriaPlan, {
  through: Correlativa,
  as: "Correlativas",
  foreignKey: "id_materia_plan",
  otherKey: "id_materia_plan_correlativa",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Correlativa.belongsTo(MateriaPlan, {
  as: "materiaPrincipal",
  foreignKey: "id_materia_plan",
});

Correlativa.belongsTo(MateriaPlan, {
  as: "materiaCorrelativa",
  foreignKey: "id_materia_plan_correlativa",
});

ExamenFinal.belongsTo(MateriaPlan, {
  as: "materiaPlan",
  foreignKey: "id_materia_plan",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlan.hasMany(ExamenFinal, {
  as: "examenes",
  foreignKey: "id_materia_plan",
});

ExamenFinal.belongsTo(Usuario, {
  as: "Profesor",
  foreignKey: "id_usuario_profesor",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ExamenFinal.belongsTo(Usuario, {
  as: "ProfesorVocal",
  foreignKey: "id_profesor_vocal",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

ExamenFinal.belongsTo(Usuario, {
  as: "usuarioCreador",
  foreignKey: "creado_por",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ExamenFinal.hasMany(InscripcionExamenFinal, {
  as: "inscripciones",
  foreignKey: "id_examen_final",
});

ProfesorMateria.belongsTo(Usuario, {
  as: "profesor",
  foreignKey: "id_usuario_profesor",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ProfesorMateria.belongsTo(MateriaPlanCicloLectivo, {
  as: "ciclo",
  foreignKey: "id_materia_plan_ciclo_lectivo",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlanCicloLectivo.hasMany(ProfesorMateria, {
  as: "profesores",
  foreignKey: "id_materia_plan_ciclo_lectivo",
});

Usuario.hasMany(AlumnoCarrera, { foreignKey: "id_persona", as: "carreras" });

InscripcionExamenFinal.belongsTo(Usuario, {
  as: "alumno",
  foreignKey: "id_usuario_alumno",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

InscripcionExamenFinal.belongsTo(ExamenFinal, {
  as: "examenFinal",
  foreignKey: "id_examen_final",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

InscripcionExamenFinal.belongsTo(InscripcionMateria, {
  as: "inscripcionMateria",
  foreignKey: "id_inscripcion_materia",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Clase.belongsTo(MateriaPlanCicloLectivo, {
  as: "ciclo",
  foreignKey: "id_materia_plan_ciclo_lectivo",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlanCicloLectivo.hasMany(Clase, {
  as: "clases",
  foreignKey: "id_materia_plan_ciclo_lectivo",
});

ClaseProfesor.belongsTo(Clase, {
  as: "clase",
  foreignKey: "id_clase",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ClaseProfesor.belongsTo(Usuario, {
  as: "Profesor",
  foreignKey: "id_usuario_profesor",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ClaseTema.belongsTo(Clase, {
  as: "clase",
  foreignKey: "id_clase",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ClaseTema.belongsTo(Tema, {
  as: "tema",
  foreignKey: "id_tema",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Asistencia.belongsTo(Clase, {
  as: "clase",
  foreignKey: "id_clase",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Asistencia.belongsTo(Usuario, {
  as: "Alumno",
  foreignKey: "id_usuario_alumno",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Asistencia.belongsTo(Usuario, {
  as: "Profesor",
  foreignKey: "id_usuario_profesor_registro",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Certificado.belongsTo(Usuario, {
  as: "alumno",
  foreignKey: "id_usuario_alumno",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Alerta.belongsTo(Usuario, {
  as: "Administrador",
  foreignKey: "id_usuario_administrador",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

AsistenciaExamenFinal.belongsTo(ExamenFinal, {
  as: "examenFinal",
  foreignKey: "id_examen_final",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

AsistenciaExamenFinal.belongsTo(Usuario, {
  as: "Alumno",
  foreignKey: "id_usuario_alumno",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

AsistenciaExamenFinal.belongsTo(Usuario, {
  as: "ProfesorControl",
  foreignKey: "id_usuario_profesor_control",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Preinscripcion.belongsTo(Persona, {
  as: "persona",
  foreignKey: "id_persona",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Preinscripcion.belongsTo(Carrera, {
  as: "carrera",
  foreignKey: "id_carrera",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Persona.hasMany(Preinscripcion, {
  as: "preinscripciones",
  foreignKey: "id_persona",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Materia.belongsToMany(PlanEstudio, {
  through: MateriaPlan,
  foreignKey: "id_materia",
  otherKey: "id_plan_estudio",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PlanEstudio.belongsTo(Carrera, {
  foreignKey: "id_carrera",
  as: "carrera",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PlanEstudio.belongsToMany(Materia, {
  through: MateriaPlan,
  foreignKey: "id_plan_estudio",
  otherKey: "id_materia",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Usuario.belongsTo(Persona, {
  foreignKey: "id_persona",
  as: "persona",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Persona.hasOne(Usuario, {
  foreignKey: "id_persona",
  as: "usuario",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Direccion.belongsTo(Persona, {
  foreignKey: "id_persona",
  as: "persona",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Persona.hasMany(AlumnoCarrera, {
  foreignKey: "id_persona",
  as: "carreras",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

AlumnoCarrera.belongsTo(Persona, {
  foreignKey: "id_persona",
  as: "persona",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

AlumnoCarrera.belongsTo(Carrera, {
  foreignKey: "id_carrera",
  as: "carrera",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Carrera.hasMany(AlumnoCarrera, {
  foreignKey: "id_carrera",
  as: "inscripcionesCarrera",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Asociar AlumnoCarrera con PlanEstudio (plan asignado al alumno)
AlumnoCarrera.belongsTo(PlanEstudio, {
  foreignKey: "id_plan_estudio_asignado",
  as: "planEstudio",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PlanEstudio.hasMany(AlumnoCarrera, {
  foreignKey: "id_plan_estudio_asignado",
  as: "alumnosAsignados",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Usuario.hasMany(InscripcionMateria, {
  foreignKey: "id_usuario_alumno",
  as: "inscripciones",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

InscripcionMateria.belongsTo(Usuario, {
  foreignKey: "id_usuario_alumno",
  as: "usuario",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

CalificacionCuatrimestre.belongsTo(InscripcionMateria, {
  foreignKey: "id_inscripcion_materia",
  as: "inscripcion",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlanCicloLectivo.hasMany(InscripcionMateria, {
  foreignKey: "id_materia_plan_ciclo_lectivo",
  as: "inscripcionesCiclo",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

InscripcionMateria.belongsTo(MateriaPlanCicloLectivo, {
  foreignKey: "id_materia_plan_ciclo_lectivo",
  as: "ciclo",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Materia.hasMany(MateriaPlanCicloLectivo, {
  foreignKey: "id_materia_plan",
  as: "planesCiclo",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlanCicloLectivo.belongsTo(Materia, {
  foreignKey: "id_materia_plan",
  as: "materia",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

MateriaPlanCicloLectivo.hasMany(HorarioMateria, {
  foreignKey: "id_materia_plan_ciclo_lectivo",
  as: "horarios",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

HorarioMateria.belongsTo(MateriaPlanCicloLectivo, {
  foreignKey: "id_materia_plan_ciclo_lectivo",
  as: "ciclo",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

InscripcionMateria.hasMany(CalificacionCuatrimestre, {
  as: "calificaciones",
  foreignKey: "id_inscripcion_materia",
});

Usuario.belongsToMany(Rol, {
  through: RolUsuario,
  foreignKey: "id_usuario",
  otherKey: "id_rol",
  as: "roles",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Rol.belongsToMany(Usuario, {
  through: RolUsuario,
  foreignKey: "id_rol",
  otherKey: "id_usuario",
  as: "usuarios",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

RolUsuario.belongsTo(Usuario, { foreignKey: "id_usuario" });
RolUsuario.belongsTo(Rol, { foreignKey: "id_rol" });
Usuario.hasMany(RolUsuario, { foreignKey: "id_usuario" });
Rol.hasMany(RolUsuario, { foreignKey: "id_rol" });

// Asociaciones para AcreditacionEquivalencia
AcreditacionEquivalencia.belongsTo(Usuario, {
  foreignKey: "id_usuario_alumno",
  as: "alumno",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Usuario.hasMany(AcreditacionEquivalencia, {
  foreignKey: "id_usuario_alumno",
  as: "equivalencias",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

AcreditacionEquivalencia.belongsTo(MateriaPlan, {
  foreignKey: "id_materia_destino",
  as: "materiaDestino",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

MateriaPlan.hasMany(AcreditacionEquivalencia, {
  foreignKey: "id_materia_destino",
  as: "equivalencias",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

AcreditacionEquivalencia.belongsTo(Usuario, {
  foreignKey: "autorizado_por",
  as: "autorizador",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

AcreditacionEquivalencia.belongsTo(Carrera, {
  foreignKey: "id_carrera",
  as: "carrera",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Carrera.hasMany(AcreditacionEquivalencia, {
  foreignKey: "id_carrera",
  as: "equivalencias",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

module.exports = {
  sequelize,
  Persona,
  Direccion,
  Usuario,
  Rol,
  RolUsuario,
  Carrera,
  PlanEstudio,
  Materia,
  MateriaPlan,
  MateriaPlanCicloLectivo,
  Correlativa,
  ExamenFinal,
  ProfesorMateria,
  AlumnoCarrera,
  InscripcionMateria,
  InscripcionExamenFinal,
  Clase,
  ClaseProfesor,
  Tema,
  ClaseTema,
  Asistencia,
  Certificado,
  Alerta,
  AsistenciaExamenFinal,
  HorarioMateria,
  Preinscripcion,
  ConfiguracionSistema,
  CalificacionCuatrimestre,
  AcreditacionEquivalencia,
};
