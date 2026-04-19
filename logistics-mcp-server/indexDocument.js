import { MongoClient } from 'mongodb';

// const uri = 'mongodb://localhost:27017/logistics_db?directConnection=true';
const uri = 'mongodb+srv://hoang2212:hoang2212@cluster0.1slztdo.mongodb.net/logistics_db?appName=Cluster0'
const client = new MongoClient(uri);

async function main() {
	// Kết nối tới MongoDB
	await client.connect();
	const db = client.db('logistics_db');
	const col = db.collection('documents');

	// Nếu collection rỗng, chèn một document mẫu (embedding độ dài 1536)
	const count = await col.countDocuments();
	if (count === 0) {
		const doc = {
			title: 'Sample document for vector index creation',
			content: 'This document is used to create the database and collection for Atlas Vector Search (local).',
			embedding: Array(1536).fill(0), // numDimensions = 1536
			createdAt: new Date()
		};
		const res = await col.insertOne(doc);
		console.log('Inserted sample document with _id =', res.insertedId.toString());
	} else {
		console.log('Collection "logistics_db.documents" already contains documents (count =', count, ').');
	}

	await client.close();
	process.exit(0);
}

main().catch(err => {
	console.error('Error:', err);
	process.exit(1);
});