# Upload / Document Processing Flow — Implementation Status

Purpose: provide a concise, actionable snapshot of what is implemented in the repository for the upload → parse → embed → index flow, what is partially done, and what is missing. Use this to monitor progress and plan next work.

Generated: 2026-04-15

---

## Summary (one-line)

Core upload-and-index pipeline is implemented end-to-end in code (mocked S3 + OpenRouter call + chunking + Gemini embeddings + MongoDB indexing + cache entries), but several production-grade pieces are incomplete or implemented as mocks.

## Files implementing the flow

- `src/services/document.service.ts` — main orchestrator: hashing, cache check, (mock) S3 upload, OpenRouter call, chunking, indexing.
- `src/services/s3.service.ts` — S3 abstraction (currently returns mock URL).
- `src/services/cache.service.ts` — cache using MongoDB collection `document_cache` (get/set implemented).
- `src/services/search.service.ts` — MongoDB connection, Gemini embedding call, `vectorSearch` aggregation, `collection` used for indexing.
- `src/index.ts` — MCP server tools wired: `logistics_upload_document`, `logistics_search_knowledge`, `logistics_ask_question`, etc.
- `src/services/intelligence.service.ts` — RAG orchestration using OpenRouter for final answer generation.

## What is fully implemented / works today

1. File hashing
   - `DocumentService.generateFileHash()` computes SHA-256 from buffer + filename + size.

2. Cache check (basic)
   - `DocumentService.parseDocument()` calculates `fileHash` and calls `CacheService.get(fileHash)`.
   - If cache entry contains `extractedText`, it returns it immediately (cache hit path).

3. Mock S3 upload
   - `S3Service.uploadFile()` returns a mock URL string. Integration hooks are in place.

4. OpenRouter parsing call (prototype)
   - `DocumentService.parseViaOpenRouter()` sends a POST to `https://openrouter.ai/api/v1/chat/completions` using `axios` including a `file-parser` plugin object.
   - Requires environment variable `OPENROUTER_API_KEY`.

5. Chunking and indexing
   - `DocumentService.chunkText()` implements chunking (1000 char default, 200 overlap default).
   - `indexDocument()` creates embeddings with `SearchService.getEmbedding()` and inserts chunk documents into MongoDB `documents` collection.

6. Embedding service
   - `SearchService.getEmbedding()` calls Google Gemini API (via REST) using `GEMINI_API_KEY` and returns a numeric vector.

7. Vector search
   - `SearchService.vectorSearch()` uses MongoDB `$vectorSearch` aggregation stage on `embedding` path and projects results.

8. MCP server wiring
   - `src/index.ts` registers MCP tools that call the above services (`logistics_upload_document` calls parse + index).

## What is partially implemented / needs review

1. OpenRouter file parsing integration (partial / fragile)
   - Implementation posts a JSON payload with a `plugins` field and an `image_url` block inside message content. This may not match the exact OpenRouter model/plugin contract for file parsing or the model you intend to use.
   - Response extraction uses `response.data.choices[0].message.content` which assumes a specific response shape.
   - Action: validate with current OpenRouter docs or use the official SDK plugin call patterns.

2. Error handling and retries
   - There is basic try/catch around HTTP requests, but no retry/backoff, no rate-limit handling, and no graceful fallback.

3. Cache metadata completeness
   - After indexing, `indexDocument()` updates cache using `cacheService.set(fileHash, { chunkCount, embeddingReady: true })` but does not preserve `extractedText` in that update (the first set in `parseDocument` stores some fields, but updates could overwrite or be partial).
   - Action: unify cache writes (upsert full entry including both extractedText and indexing flags) and add TTL or tenant scoping.

4. Schema & Indexes in MongoDB
   - The code expects a `vector_index` index for vectorSearch, but the repo does not contain index creation scripts or migration steps.
   - Action: add migration / index creation script for MongoDB Atlas (create vector index on `documents.embedding`).

5. Environment variable checks at startup
   - Some services throw when keys are missing at runtime (e.g., Gemini), but startup does not fully validate all required envs and exit early with clear messages.


## What is missing / TODO for production readiness

1. Real S3 integration
   - Replace mock `S3Service` with `@aws-sdk/client-s3` implementation.
   - Support Signed URLs (presigned) and standardized keys per tenant.

2. Robust OpenRouter / file parsing plugin
   - Ensure the request shape matches the model/plugin capability for file parsing.
   - Support streaming large files or chunked upload if required by model.
   - Parse and validate OpenRouter responses safely (handle alternative shapes).

3. Queue / Worker system for async processing
   - Add job queue (BullMQ + Redis) for heavy tasks: parsing, embedding, indexing.

4. Redis cache layer (optional but recommended)
   - Use Redis for quick fileHash -> cache lookups, embed caching, and task state.

5. Store and cache chunks & embeddings
   - Cache per-chunk metadata and optionally embeddings to avoid re-embedding.

---
*🔗 Liên kết (Knowledge Graph Links):* 
* [Document Flow Core](../01-architecture-document-flow.md)
* [Fix PDF Parsing](./03-troubleshooting-pdf-parsing.md)
* [Setup Vector Index](./05-setup-mongodb-vector-index.md)
* Trở về: [README](../README.md)

6. Multi-tenant support
   - Add `tenantId` propagation to S3 keys, MongoDB documents, and cache keys.

7. Tests & CI
   - Unit tests for DocumentService (cache hit/miss, chunking correctness, error paths).
   - Integration tests for SearchService (mock Gemini responses) and indexing flows.

8. Observability & metrics
   - Instrumentation (request latency, cache hit rate, embedding throughput, queue lengths).

9. Security & limits
   - Validate uploaded file size and type.
   - Stream large files instead of buffering fully in memory.
   - Add rate limits and authentication on upload endpoints or MCP tools.

10. MongoDB Atlas vector index creation & maintenance
    - Add scripts and docs to create `vector_index` on `documents.embedding` and set appropriate dimensions and indexType.


## Risks / Notes discovered during scan

- OpenRouter/embedding API keys are required at runtime; missing keys will throw. Make a clear `.env.example` and startup validation.
- Current S3 implementation will not work in production; tests may succeed but production S3 behavior (permissions, signed URLs) is not covered.
- The OpenRouter payload is implemented by hand with `axios` — using the official SDK or confirmed API contract will reduce risk.
- Chunking logic is simple and mostly OK, but edge cases (very small docs, trailing overlaps) should be unit-tested.


## Quick verification steps (how to test locally)

1. Populate `.env` (recommended minimal):

```bash
MONGODB_URI="your_mongodb_uri"
OPENROUTER_API_KEY="your_openrouter_key"
GEMINI_API_KEY="your_gemini_key"
SERPER_API_KEY="optional_serper_key"
```

2. Start the server (stdio MCP server wired):

```bash
npm run build   # if using TypeScript build
node build/index.js
# or for dev
npm run dev
```

3. Use the MCP tool `logistics_upload_document` with a publicly reachable file URL (or upload your file to any public host) and `type` set to `pdf|docx|txt`.

4. Observe console logs for cache hit/miss, upload mock URL, OpenRouter call, and inserted chunk count.


## Recommended next steps (priority ordered)

1. Replace `S3Service` with real AWS S3 integration + presigned URL support.
2. Validate and adapt `parseViaOpenRouter()` to the official OpenRouter plugin/file parsing API or use the OpenRouter SDK plugin methods.
3. Add startup env validation and a `.env.example` file.
4. Add basic unit tests for `generateFileHash`, `chunkText`, `parseDocument` (mock HTTP), and `indexDocument` (mock embedding).
5. Add MongoDB index creation script for `vector_index` and include in deployment docs.
6. (Optional) Introduce Redis for fast cache lookups and BullMQ for async processing.


## Requirements coverage mapping (from Skill spec)

- Storage (S3): wiring present (mock) — IMPLEMENTED (mock). Needs real S3: TODO.
- AI parsing (OpenRouter): implemented (prototype) — PARTIAL (verify API/response shape).
- Vector search (MongoDB): implemented (client + vectorSearch) — IMPLEMENTED but needs index migration script.
- Cache layer (fileHash strategy): implemented (MongoDB-based) — IMPLEMENTED basic, recommend Redis and fuller entry writes.
- Chunking & embedding: implemented — IMPLEMENTED but embedding depends on GEMINI_API_KEY.
- Queue / async processing: NOT IMPLEMENTED — TODO.


---

If you'd like, I can:
- open PR with a real `S3Service` implementation using `@aws-sdk/client-s3` and presigned URLs,
- add startup env validation and `.env.example`,
- add a small unit test suite for `DocumentService` and `SearchService` using jest.

Which of the above should I implement next? (Suggest: env validation + `.env.example` first — low-risk, high-value.)
