module.exports = (sequelize, DataTypes) => {
  const EmailSync = sequelize.define(
    "EmailSync",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      sync_type: {
        type: DataTypes.ENUM("manual", "automatic", "scheduled"),
        defaultValue: "manual",
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "in_progress",
          "completed",
          "failed",
          "cancelled"
        ),
        defaultValue: "pending",
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      emails_processed: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      orders_found: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      orders_created: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      orders_updated: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      errors: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Array of error messages and details",
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Additional sync information like date range, filters, etc.",
      },
      duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "email_syncs",
      timestamps: true,
      indexes: [
        {
          fields: ["user_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["sync_type"],
        },
        {
          fields: ["started_at"],
        },
      ],
    }
  );

  // Instance methods
  EmailSync.prototype.start = async function () {
    this.status = "in_progress";
    this.started_at = new Date();
    return await this.save();
  };

  EmailSync.prototype.complete = async function (results = {}) {
    const now = new Date();
    this.status = "completed";
    this.completed_at = now;
    this.duration_seconds = Math.floor((now - this.started_at) / 1000);

    // Update counters if provided
    Object.keys(results).forEach((key) => {
      if (this.hasOwnProperty(key)) {
        this[key] = results[key];
      }
    });

    return await this.save();
  };

  EmailSync.prototype.fail = async function (error) {
    const now = new Date();
    this.status = "failed";
    this.completed_at = now;
    this.duration_seconds = this.started_at
      ? Math.floor((now - this.started_at) / 1000)
      : null;

    // Add error to errors array
    const currentErrors = this.errors || [];
    currentErrors.push({
      timestamp: now,
      message: error.message,
      stack: error.stack,
    });
    this.errors = currentErrors;

    return await this.save();
  };

  EmailSync.prototype.addError = async function (error, context = {}) {
    const currentErrors = this.errors || [];
    currentErrors.push({
      timestamp: new Date(),
      message: error.message,
      context,
      stack: error.stack,
    });
    this.errors = currentErrors;
    return await this.save();
  };

  EmailSync.prototype.updateProgress = async function (progress = {}) {
    Object.keys(progress).forEach((key) => {
      if (this.hasOwnProperty(key)) {
        this[key] = progress[key];
      }
    });
    return await this.save();
  };

  // Class methods
  EmailSync.getLatestForUser = async function (userId) {
    return await this.findOne({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });
  };

  EmailSync.getRunningSync = async function (userId) {
    return await this.findOne({
      where: {
        user_id: userId,
        status: "in_progress",
      },
    });
  };

  EmailSync.getSyncStats = async function (userId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    const whereClause = { user_id: userId };

    if (startDate && endDate) {
      whereClause.created_at = {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      };
    }

    const stats = await this.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", "*"), "count"],
        [
          sequelize.fn("SUM", sequelize.col("emails_processed")),
          "total_emails",
        ],
        [sequelize.fn("SUM", sequelize.col("orders_created")), "total_orders"],
        [
          sequelize.fn("AVG", sequelize.col("duration_seconds")),
          "avg_duration",
        ],
      ],
      group: ["status"],
      raw: true,
    });

    return stats;
  };

  // Associations
  EmailSync.associate = function (models) {
    EmailSync.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
  };

  return EmailSync;
};
