import mongoose from "mongoose";
const { Schema, model } = mongoose;

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
          quantity: {
            type: Number,
            required: true,
          },
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "shipped", "delivered", "cancelled"],
      default: "pending",
      lastAction: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);
export const Order = mongoose.models.Order || model("Order", orderSchema);
