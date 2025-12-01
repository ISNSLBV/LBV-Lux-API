module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'examen_final',
    {
      id:                           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      id_materia_plan:              { type: DataTypes.INTEGER, allowNull: false },
      fecha:                        { type: DataTypes.DATE },
      estado:                       { type: DataTypes.STRING(20), defaultValue: 'Pendiente' },
      id_usuario_profesor:          { type: DataTypes.INTEGER, allowNull: false },
      libro:                        { type: DataTypes.STRING(20), allowNull: true },
      folio:                        { type: DataTypes.STRING(20), allowNull: true },
      id_profesor_vocal:            { type: DataTypes.INTEGER, allowNull: true },
      creado_por:                   { type: DataTypes.INTEGER, allowNull: false },
      fecha_creacion:               { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      modificado_por:               { type: DataTypes.INTEGER },
      fecha_modificacion: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate:    sequelize.literal('CURRENT_TIMESTAMP')
      }
    },
    {
      tableName: 'examen_final',
      timestamps: false,
      indexes: [
        { fields: ['fecha'] },
        { fields: ['id_profesor_vocal'] }
      ]
    }
  );
};
