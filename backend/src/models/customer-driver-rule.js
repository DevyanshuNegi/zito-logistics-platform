// src/models/customer-driver-rule.js
// Maps customer -> driver whitelist/blacklist for assignment engine (PRD §4.2 Customer Preference)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CustomerDriverRule = sequelize.define('CustomerDriverRule', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    customer_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'users', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
    driver_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'drivers', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
    rule_type: {
      type: DataTypes.ENUM('whitelist', 'blacklist'),
      allowNull: false,
    },
  }, {
    tableName:   'customer_driver_rules',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['driver_id'] },
      { unique: true, fields: ['customer_id', 'driver_id', 'rule_type'] },
    ],
  });

  CustomerDriverRule.associate = (models) => {
    CustomerDriverRule.belongsTo(models.User, { foreignKey: 'customer_id', as: 'customer' });
    CustomerDriverRule.belongsTo(models.Driver, { foreignKey: 'driver_id', as: 'driver' });
  };

  return CustomerDriverRule;
};
