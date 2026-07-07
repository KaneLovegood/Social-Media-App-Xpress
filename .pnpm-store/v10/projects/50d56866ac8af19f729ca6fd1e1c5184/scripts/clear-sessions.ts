/* eslint-disable no-console */
import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGODB_SESSION_URI ??
  'mongodb://localhost:27017/xpress';

const XpressItemSchema = new mongoose.Schema(
  {
    PK: { type: String, required: true },
    SK: { type: String, required: true },
    entityType: { type: String, required: true },
  },
  {
    collection: 'xpress_items',
    strict: false,
    versionKey: false,
  },
);

async function main(): Promise<void> {
  await mongoose.connect(mongoUri);
  const XpressItem = mongoose.model('XpressItem', XpressItemSchema);

  console.log(`Dang xoa session trong MongoDB "${mongoUri}"...`);
  const result = await XpressItem.deleteMany({
    entityType: 'SESSION',
    SK: { $regex: '^SESSION#' },
  }).exec();

  console.log(`Hoan tat: da xoa ${result.deletedCount} session.`);
}

main()
  .catch((err) => {
    console.error('Loi khi xoa session:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

