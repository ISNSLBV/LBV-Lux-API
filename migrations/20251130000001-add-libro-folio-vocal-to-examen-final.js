'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('examen_final', 'libro', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Número de libro donde se registra el examen'
    });

    await queryInterface.addColumn('examen_final', 'folio', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Número de folio donde se registra el examen'
    });

    await queryInterface.addColumn('examen_final', 'id_profesor_vocal', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'usuario',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Profesor que actúa como vocal en el examen'
    });

    // Agregar índice para el profesor vocal
    await queryInterface.addIndex('examen_final', ['id_profesor_vocal'], {
      name: 'idx_examen_final_profesor_vocal'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('examen_final', 'idx_examen_final_profesor_vocal');
    await queryInterface.removeColumn('examen_final', 'id_profesor_vocal');
    await queryInterface.removeColumn('examen_final', 'folio');
    await queryInterface.removeColumn('examen_final', 'libro');
  }
};
