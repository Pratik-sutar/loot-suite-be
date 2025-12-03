const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      provider: {
        type: DataTypes.ENUM("google", "local"),
        defaultValue: "google",
      },
      provider_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      access_token: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_sync: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      settings: {
        type: DataTypes.JSONB,
        defaultValue: {
          notifications: true,
          auto_sync: true,
          sync_frequency: "daily",
        },
      },
    },
    {
      tableName: "users",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["email"],
        },
        {
          fields: ["provider", "provider_id"],
        },
      ],
    }
  );

  // Instance methods
  User.prototype.toSafeObject = function () {
    const { access_token, refresh_token, ...safeUser } = this.toJSON();
    return safeUser;
  };

  User.prototype.needsTokenRefresh = function () {
    if (!this.token_expires_at) return true;
    const bufferTime =
      parseInt(process.env.TOKEN_BUFFER_TIME_MS) || 5 * 60 * 1000; // 5 minutes buffer
    return new Date(this.token_expires_at) <= new Date(Date.now() + bufferTime);
  };

  // Class methods
  User.findByEmail = async function (email) {
    return await this.findOne({ where: { email } });
  };

  User.findByProviderId = async function (provider, providerId) {
    return await this.findOne({
      where: {
        provider,
        provider_id: providerId,
      },
    });
  };

  // Associations
  User.associate = function (models) {
    User.hasMany(models.Order, {
      foreignKey: "user_id",
      as: "orders",
      onDelete: "CASCADE",
    });

    User.hasMany(models.EmailSync, {
      foreignKey: "user_id",
      as: "email_syncs",
      onDelete: "CASCADE",
    });
  };

  return User;
};
