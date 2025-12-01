'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('acreditacion_equivalencia', 'id_carrera', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'carrera',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Carrera para la cual se solicita la equivalencia'
    });

    // Crear índice para mejorar performance en queries por carrera
    await queryInterface.addIndex('acreditacion_equivalencia', ['id_carrera'], {
      name: 'idx_acreditacion_equivalencia_carrera'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar índice primero
    await queryInterface.removeIndex('acreditacion_equivalencia', 'idx_acreditacion_equivalencia_carrera');
    
    // Eliminar columna
    await queryInterface.removeColumn('acreditacion_equivalencia', 'id_carrera');
  }
};
