module.exports = (sequelize, DataTypes) => {
    return sequelize.define(
        'acreditacion_equivalencia',
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            id_usuario_alumno: { type: DataTypes.INTEGER, allowNull: false },
            id_materia_destino: { type: DataTypes.INTEGER, allowNull: true },
            id_carrera: { type: DataTypes.INTEGER, allowNull: true },
            origen_institucion: { type: DataTypes.STRING(120), allowNull: false },
            origen_materia: { type: DataTypes.STRING(120), allowNull: false },
            origen_calificacion: { type: DataTypes.STRING(20), allowNull: false },
            resolucion: { type: DataTypes.STRING(50) },
            estado: { type: DataTypes.ENUM('Pendiente', 'Aprobada', 'Rechazada'), defaultValue: 'Pendiente' },
            motivo_rechazo: { type: DataTypes.TEXT },
            autorizado_por: { type: DataTypes.INTEGER },
            fecha_solicitud: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
            fecha_resolucion: { type: DataTypes.DATE }
        },
        {
            tableName: 'acreditacion_equivalencia',
            timestamps: false,
            indexes: [
                { fields: ['id_usuario_alumno', 'estado'] },
                { fields: ['id_materia_destino'] },
                { fields: ['id_carrera'] }
            ]
        }
    )
}