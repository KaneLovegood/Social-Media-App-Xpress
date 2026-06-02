import axios from "axios";
import { createHash } from "crypto";
import pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import { SearchService } from "./search.service.js";
import { IndexedDocument } from "../schema/indexedDocument.js";
import { CacheService } from "./cache.service.js";
import { S3Service } from "./s3.service.js";

export class DocumentService {
  constructor(
    private searchService: SearchService,
    private cacheService: CacheService,
    private s3Service: S3Service
  ) {}

  generateFileHash(buffer: Buffer, fileName: string, fileSize: number): string {
    const hash = createHash("sha256");
    hash.update(buffer);
    hash.update(fileName);
    hash.update(fileSize.toString());
    return hash.digest("hex");
  }

  async parseDocument(fileUrl: string, type: string): Promise<string> {
    const response = await axios.get(fileUrl, { 
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    const fileBuffer = Buffer.from(response.data);
    const fileName = fileUrl.split("/").pop() || "document";
    const fileHash = this.generateFileHash(fileBuffer, fileName, fileBuffer.length);
    
    // 1. Check Cache
    const cached = await this.cacheService.get(fileHash);
    if (cached && cached.extractedText) {
      console.error(`[DocumentService] Cache hit for ${fileName} (${fileHash})`);
      return cached.extractedText;
    }

    // 2. Upload to S3 (Mock/Real)
    const uploadedUrl = await this.s3Service.uploadFile(fileBuffer, fileName, type);

    // 3. Parse Locally
    console.error(`[DocumentService] Extracting text locally for ${fileName}...`);
    let extractedText = await this.extractTextLocally(fileBuffer, type);
    
    // Fallback to OpenRouter if local parsing yields empty results
    if (!extractedText || extractedText.trim().length === 0) {
      console.error(`[DocumentService] Local extraction failed or returned empty. Falling back to OpenRouter...`);
      extractedText = await this.parseViaOpenRouter(fileBuffer, fileName, uploadedUrl);
    }

    // 4. Save to Cache
    await this.cacheService.set(fileHash, {
      fileHash,
      fileUrl: uploadedUrl,
      extractedText,
      chunkCount: 0,
      embeddingReady: false
    });

    return extractedText;
  }

  private async extractTextLocally(fileBuffer: Buffer, type: string): Promise<string> {
    try {
      const format = type.toLowerCase();
      
      if (format === 'pdf' || format === '.pdf') {
        const data = await pdfParse(fileBuffer);
        return data.text;
      } 
      
      if (format === 'docx' || format === '.docx') {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
      }
      
      if (format === 'txt' || format === '.txt') {
        return fileBuffer.toString('utf-8');
      }

      console.warn(`[DocumentService] Unsupported type for local extraction: ${type}`);
      return "";
    } catch (err: any) {
      console.error(`[DocumentService] Local extraction error: ${err.message}`);
      return "";
    }
  }

  private async parseViaOpenRouter(fileBuffer: Buffer, fileName: string, fileUrl: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

    // Use gemini-1.5-pro for more reliable document parsing (more robust than Flash for complex docs)
    const model = "google/gemini-1.5-pro";
    
    try {
      const base64Data = fileBuffer.toString("base64");
      
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please extract all text content from this document precisely. Return only the extracted text content without any additional comments. If the document has tables, represent them as Markdown tables."
                },
                {
                  type: "file",
                  file: {
                    name: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
                    data: base64Data,
                    mime_type: "application/pdf"
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://github.com/mcp-server/logistics-mcp-server",
            "X-Title": "Logistics MCP Server",
            "Content-Type": "application/json"
          },
          timeout: 120000 // Increase timeout to 120s for large/complex document parsing
        }
      );

      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        console.error("[DocumentService] Unexpected OpenRouter response format:", JSON.stringify(response.data, null, 2));
        throw new Error("Invalid response structure from OpenRouter (missing choices)");
      }

      const choice = response.data.choices[0];
      let content = choice.message?.content;
      
      // Handle assistant annotations if content is empty (common with some parsers)
      if (!content && choice.message?.annotations) {
        const fileAnnotation = choice.message.annotations.find((a: any) => a.type === "file");
        if (fileAnnotation && fileAnnotation.file?.content) {
            content = fileAnnotation.file.content
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n");
        }
      }

      if (!content) {
        console.warn("[DocumentService] No content returned from OpenRouter parsing");
      }

      return content || "";
    } catch (error: any) {
      const responseData = error.response?.data;
      console.error("OpenRouter Parsing error:", responseData || error.message);
      
      if (responseData?.error) {
          console.error("Detailed OpenRouter error:", JSON.stringify(responseData.error, null, 2));
          throw new Error(`OpenRouter Parsing failed: ${responseData.error.message || error.message}`);
      }
      
      throw new Error(`OpenRouter Parsing failed: ${error.message}`);
    }
  }

  private getContentType(type: string): string {
    switch (type.toLowerCase()) {
      case "pdf": return "application/pdf";
      case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "txt": return "text/plain";
      default: return "application/octet-stream";
    }
  }

  chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = start + chunkSize;
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
      if (start >= text.length && chunks.length > 0) break; // Avoid infinite loop or empty chunks
    }
    return chunks;
  }

  async indexDocument(fileUrl: string, type: string, fullText: string, metadata: any = {}) {
    const chunks = this.chunkText(fullText);
    const documentId = Math.random().toString(36).substring(7);
    const fileHash = metadata.fileHash || "";

    const indexPromises = chunks.map(async (chunk, index) => {
      const embedding = await this.searchService.getEmbedding(chunk);
      return {
        documentId,
        fileHash,
        content: chunk,
        fileUrl,
        type,
        embedding,
        chunkIndex: index,
        metadata: metadata || {},
        indexedAt: new Date(),
      } as IndexedDocument;
    });

    const docsToInsert = await Promise.all(indexPromises);

    if (docsToInsert.length > 0) {
      await this.searchService.collection.insertMany(docsToInsert);
    }

    // Update cache with chunk count and embedding status if fileHash is available
    if (fileHash) {
      await this.cacheService.set(fileHash, {
        chunkCount: chunks.length,
        embeddingReady: true
      });
    }

    return chunks.length;
  }
}
