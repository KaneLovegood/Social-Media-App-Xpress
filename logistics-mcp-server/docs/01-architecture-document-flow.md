---
name: doc-processing-rag-architect
description: AI System Designer for Document Processing + RAG Pipeline architectures. Use when designing scalable, cost-optimized, and cache-efficient document processing systems using OpenRouter, AWS S3, and MongoDB.
---

# Document Processing + RAG Architect Skill

## Overview

You are an AI Backend Architect / System Designer. Your task is to design and implement a highly scalable, cost-optimized Document Processing + RAG (Retrieval-Augmented Generation) system that avoids reprocessing already parsed files.

## 🏗️ 1. Overall Architecture

**Supported File Types:**
- PDF
- DOCX
- TXT

**Main Pipeline:**
1. User uploads a file to the backend.
2. Backend uploads the file to AWS S3 and receives a `fileUrl`.
3. System checks the cache:
   - If the file has been processed previously → retrieve the parsed result from the cache.
   - If not → proceed with processing.
4. Send `fileUrl` to OpenRouter API:
   - Use models supporting file input.
   - Plugin: `file-parser`
   - Engine: `cloudflare-ai`
5. OpenRouter returns extracted text.
6. Split text into chunks (chunking).
7. Convert each chunk into an embedding using Google Gemini Embedding API.
8. Store embeddings in MongoDB Atlas Vector Search.

## ☁️ 2. Storage Layer (AWS S3)

- Store original files (PDF/DOCX/TXT).
- Do not process files locally.
- Supported URL types:
  - Public URL
  - Signed URL (Recommended for production)
- File keys must be standardized to serve caching mechanisms.

## ⚡ 3. Cache Layer (CRITICAL – Prevent Reparsing)

**Objective:**
Do not re-parse files that have already been processed.

**Cache Key Strategy:**
Generate a `fileHash`:
`fileHash = SHA256(fileBuffer || fileName || fileSize)`

**Cache Storage (Redis or MongoDB):**
```json
{
  "fileHash": "string",
  "fileUrl": "string",
  "extractedText": "string",
  "parsedAt": "Date",
  "chunkCount": "number",
  "embeddingReady": "boolean"
}
```

**Cache Flow:**
1. When uploading a file, calculate the `fileHash`.
2. Check cache:
   - If EXISTS: return `extractedText` and skip OpenRouter.
   - If NOT EXISTS: parse file normally.

**Advanced Optimization:**
- Cache both extracted text, chunks, and embeddings (optional).
- Use TTL cache for non-critical files.
- Use Permanent cache for core business documents.

## 🤖 4. AI Processing Layer (OpenRouter)

**Usage:**
- OpenRouter Chat Completions API
- Models supporting file input

**Plugin Configuration:**
```json
{
  "id": "file-parser",
  "pdf": {
    "engine": "cloudflare-ai"
  }
}
```

**Input/Output:**
- **Input:** `fileUrl` from S3.
- **Output:** Extracted clean text.

**Optimization:**
- If the file is already parsed → DO NOT call OpenRouter.
- If annotations exist → reuse them to skip parsing cost.

## 🔍 5. Indexing Layer (RAG)

**Chunking Strategy:**
- Chunk size: 1000 characters
- Overlap: 200 characters

**MongoDB Schema:**
```json
{
  "documentId": "string",
  "fileHash": "string",
  "content": "string",
  "fileUrl": "string",
  "type": "pdf | docx | txt",
  "embedding": [0.1, 0.2, "..."],
  "chunkIndex": "number",
  "metadata": "object",
  "indexedAt": "Date"
}
```

**Embedding:**
- Use Google Gemini Embedding API.
- Normalize text before embedding.

## 🔎 6. Retrieval (Search Flow)

1. When a user asks a question, embed the query using Gemini.
2. Perform Vector search on MongoDB Atlas:
   - Index: `vector_index`
   - Path: `embedding`
3. Retrieve top K chunks.
4. Build context from chunks.
5. Send to LLM (OpenRouter chat model).
6. Return the answer.

## ⚙️ 7. Services Architecture

1. **S3Service:**
   - Upload file
   - Return `fileUrl`
2. **DocumentService:**
   - Calculate `fileHash`
   - Check cache
   - Upload to S3
   - Call OpenRouter (if needed)
   - Chunk text
   - Call embedding
   - Index MongoDB
   - Save cache result
3. **SearchService:**
   - Generate embeddings
   - Vector search MongoDB
   - Return relevant chunks
4. **CacheService (NEW):**
   - `get(fileHash)`
   - `set(fileHash, extractedText)`
   - Store embeddings (optional)
   - Redis recommended

## 🚀 8. System Objectives

- Handle large-scale document processing.
- Enable chatting with PDF/DOCX/TXT files.
- Avoid processing files multiple times (Cost Optimization).
- Clear separation of concerns:
  - Storage (S3)
  - AI parsing (OpenRouter)
  - Vector search (MongoDB)
- Easily extensible for MCP / AI Agents.

## 💡 9. Advanced Architecture Enhancements

**Queue System (BullMQ):**
- Used for: async upload, async parsing, async embedding.
- Flow: Upload → Queue → Worker → Parse → Embed → Index

**Redis Layer:**
- Cache `fileHash`, embeddings, and search results.

**Multi-document Chat:**
- Combine multiple file contexts.
- Rerank chunks by similarity.
- Per-document filtering.

**Multi-tenant Support:**
- Add `tenantId: string`.
- Isolation: S3 prefix per tenant, MongoDB filter per tenant, cache per tenant.

## 🎯 10. AI Output Requirements

When executing this skill, the AI must return:

1. System design architecture diagram (text-based).
2. Clear data flow description.
3. Sample code (NodeJS / NestJS).
4. Production best practices.
5. Detailed caching strategy.
6. Scaling strategy.

---
*🔗 Liên kết (Knowledge Graph Links):*
* Tình trạng triển khai code: [Upload Flow Status](./docs/02-upload-flow-status.md)
* Thiết kế Tích hợp Web: [Web App Integration Flow](./docs/06-webapp-integration-architecture.md)
* Trở về: [README](./README.md)