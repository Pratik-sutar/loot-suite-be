module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define(
    "OrderItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "orders",
          key: "id",
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
        },
      },
      unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      product_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      brand: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      attributes: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Additional product attributes like size, color, etc.",
      },
    },
    {
      tableName: "order_items",
      timestamps: true,
      indexes: [
        {
          fields: ["order_id"],
        },
        {
          fields: ["name"],
        },
        {
          fields: ["brand"],
        },
        {
          fields: ["category"],
        },
      ],
      hooks: {
        beforeSave: (item) => {
          // Auto-calculate total price if not provided
          if (item.quantity && item.unit_price && !item.total_price) {
            item.total_price = item.quantity * item.unit_price;
          }
        },
      },
    }
  );

  // Instance methods
  OrderItem.prototype.updateQuantity = async function (newQuantity) {
    this.quantity = newQuantity;
    this.total_price = this.unit_price * newQuantity;
    return await this.save();
  };

  // Class methods
  OrderItem.findByOrder = async function (orderId) {
    return await this.findAll({
      where: { order_id: orderId },
      order: [["created_at", "ASC"]],
    });
  };

  OrderItem.getTotalValue = async function (orderId) {
    const result = await this.findOne({
      where: { order_id: orderId },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("total_price")), "total_value"],
        [sequelize.fn("COUNT", "*"), "item_count"],
      ],
      raw: true,
    });

    return {
      total_value: parseFloat(result.total_value) || 0,
      item_count: parseInt(result.item_count) || 0,
    };
  };

  // Associations
  OrderItem.associate = function (models) {
    OrderItem.belongsTo(models.Order, {
      foreignKey: "order_id",
      as: "order",
    });
  };

  return OrderItem;
};
