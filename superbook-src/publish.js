const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config()

function readFile(relativePath) {
	const filePath = path.resolve(__dirname, relativePath);
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
}

const init = async () => {
	const client = new MongoClient(process.env.MONGO_DB);
	await client.connect();
	const db = client.db('superbook');
	const now = new Date();

	try {
		async function createOrUpdateBook(bookSchema) {
				const collection = db.collection('books');
				// Check if the book exists in the collection
				const existingBook = await collection.findOne({ "sourceName": bookSchema.sourceName });
		
				if (existingBook) {
					// Update existing book
					await collection.updateOne({ "_id": existingBook._id }, { $set: {
						name: bookSchema.name,
						sourceName: bookSchema.sourceName,
						username: bookSchema.author,
						generatedTopics : bookSchema.chapters.length,
						totalTopics : bookSchema.chapters.length,
						updatedAt: now,
					} });
					console.log("Book updated successfully.");
					return existingBook._id;
				} else {
					// Insert new book
					const newBook =  await collection.insertOne({
						name: bookSchema.name,
						sourceName: bookSchema.sourceName,
						username: bookSchema.author,
						status: 'COMPLETED',
						interests: [],
						chapters: [],
						level : 1,
						size: 1,
						generatedTopics : bookSchema.chapters.length,
						totalTopics : bookSchema.chapters.length,
						createdAt: now,
						updatedAt: now,
					});
					console.log("Book created successfully : "+bookSchema.name);
					return newBook.insertedId;
				}
			}

			async function createOrUpdateChapter(bookId, chapterName, content) {
				const collection = db.collection('chapters');
				const existingChapter = await collection.findOne({ "name": chapterName });

				if (existingChapter) {
					// Update existing book
					await db.collection('topics').updateOne({ "_id": existingChapter.topics[0] }, { $set: {
						name: chapterName,
						answer: content,
						updatedAt: now
					} });

					await collection.updateOne({ "_id": existingChapter._id }, { $set: {
						name: chapterName,
						updatedAt: now
					} });

					await db.collection('books').updateOne({ "_id": bookId }, { $addToSet: {
						chapters: existingChapter._id
					} });

					console.log("Chapter updated successfully.");
					return existingChapter._id;
				} else {
					// Insert new chapter
					const chapterId = new ObjectId();

					const newTopic  = await db.collection('topics').insertOne({
						name: chapterName,
						subtopics: [],
						chapterId: chapterId,
						bookId: new ObjectId(bookId),
						answer: content,
						createdAt: now,
						updatedAt: now
					});

					const newChapter =  await collection.insertOne({
						_id: chapterId,
						name: chapterName,
						topics: [newTopic.insertedId],
						createdAt: now,
						updatedAt: now
					});

					await db.collection('books').updateOne({ "_id": bookId }, { $addToSet: {
						chapters: chapterId
					} });

					console.log("Chapter created successfully : "+chapterName);
					return newChapter.insertedId;
				}
			}

			const books = [{
				name: "You Don't Know JS Yet: Get Started - 2nd Edition",
				sourceName: 'get-started',
				author: 'Kyle Simpson',
				chapters: [
					{ path: '../get-started/foreword.md', name: 'Foreword' },
					{ path: '../preface.md', name: 'Preface' },
					{ path: '../get-started/ch1.md', name: 'Chapter 1: What Is JavaScript?' },
					{ path: '../get-started/ch2.md', name: 'Chapter 2: Surveying JS' },
					{ path: '../get-started/ch3.md', name: 'Chapter 3: Digging to the Roots of JS' },
					{ path: '../get-started/ch4.md', name: 'Chapter 4: The Bigger Picture' },
					{ path: '../get-started/apA.md', name: 'Appendix A: Exploring Further' },
					{ path: '../get-started/apB.md', name: 'Appendix B: Practice, Practice, Practice!' }
				]
			},
		
			{
				name: "You Don't Know JS Yet: Scope & Closures - 2nd Edition",
				sourceName: 'scope-closures',
				author: 'Kyle Simpson',
				chapters: [
					{ path: '../scope-closures/foreword.md', name: 'Foreword (by Sarah Drasner)' },
					{ path: '../preface.md', name: 'Preface' },
					{ path: '../scope-closures/ch1.md', name: 'Chapter 1: What\'s the Scope?' },
					{ path: '../scope-closures/ch2.md', name: 'Chapter 2: Illustrating Lexical Scope' },
					{ path: '../scope-closures/ch3.md', name: 'Chapter 3: The Scope Chain' },
					{ path: '../scope-closures/ch4.md', name: 'Chapter 4: Around the Global Scope' },
					{ path: '../scope-closures/ch5.md', name: 'Chapter 5: The (Not So) Secret Lifecycle of Variables' },
					{ path: '../scope-closures/ch6.md', name: 'Chapter 6: Limiting Scope Exposure' },
					{ path: '../scope-closures/ch7.md', name: 'Chapter 7: Using Closures' },
					{ path: '../scope-closures/ch8.md', name: 'Chapter 8: The Module Pattern' },
					{ path: '../scope-closures/apA.md', name: 'Appendix A: Exploring Further' },
					{ path: '../scope-closures/apB.md', name: 'Appendix B: Practice' }
				]
			}
		];
 
			const promises = books.map((bookSchema => {
				function test(regex, content)
				{
					console.log('ran')
					return regex.exec(content)
				}
				const fun = async () => {
					console.log('--> BOOK : '+bookSchema.name);
					const bookId = await createOrUpdateBook(bookSchema);
					for (const chapter of bookSchema.chapters) {
						let content = await readFile(chapter.path);

						// Convert relative URLs to absolute
						const regex = /<img src="([^"]+)"/g;
						content = content.replace(regex, (_, src) => {
							if(src.match(/^https?:\/\//) == null){
								return `<img src="https://raw.githubusercontent.com/getify/You-Dont-Know-JS/2nd-ed/${bookSchema.sourceName}/${src}"`;
							}
							return src;
						})
						
						await createOrUpdateChapter(bookId, chapter.name, content);
					}
				};
				return fun();
			}));

			await Promise.all(promises);
		}
		catch (error) {
			console.error(error);
		}
		finally {
			await client.close();
		}
}

init();
