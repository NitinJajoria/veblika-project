import mongoose from 'mongoose';

const deploymentSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    port: {
      type: Number,
      required: true,
      unique: true,
    },
    logs: [String],
  },
  { timestamps: true }
);

export default mongoose.model('Deployment', deploymentSchema);
