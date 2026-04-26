import mongoose, { Schema, Document } from 'mongoose';

export enum LossType {
  DAMAGE = 'DAMAGE',
  THEFT = 'THEFT',
  MISPLACEMENT = 'MISPLACEMENT',
  SHORTAGE = 'SHORTAGE',
}

export interface ILossReport extends Document {
  bookingId: mongoose.Types.ObjectId;
  itemId?: mongoose.Types.ObjectId;
  type: LossType;
  reportedBy: mongoose.Types.ObjectId;
  description: string;
  status: 'PENDING' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'CLAIMED';
  estimatedValue: number;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LossReportSchema: Schema = new Schema({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem' },
  type: { type: String, enum: Object.values(LossType), required: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'CLAIMED'], 
    default: 'PENDING' 
  },
  estimatedValue: { type: Number, default: 0 },
  resolutionNotes: { type: String },
}, { timestamps: true });

export default mongoose.model<ILossReport>('LossReport', LossReportSchema);