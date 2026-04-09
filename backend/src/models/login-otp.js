const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LoginOtp = sequelize.define(
    'LoginOtp',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      contact: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      otp: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'login',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      consumed_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: 'login_otps',
      underscored: true,
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['contact'] },
        { fields: ['type'] },
        { fields: ['expires_at'] },
        { fields: ['consumed_at'] },
      ],
    }
  );

  LoginOtp.associate = (models) => {
    LoginOtp.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return LoginOtp;
};

