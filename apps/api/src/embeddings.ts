import OpenAI from "openai";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export interface EmbeddingProvider {
  readonly model: string;
  embed(inputs: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model = DEFAULT_EMBEDDING_MODEL) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async embed(inputs: string[]): Promise<number[][]> {
    if (!inputs.length) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: inputs,
      encoding_format: "float"
    });

    return response.data
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
  }
}

export function createOpenAIEmbeddingProvider(
  apiKey = process.env.OPENAI_API_KEY
): EmbeddingProvider | null {
  const trimmedKey = apiKey?.trim();
  return trimmedKey ? new OpenAIEmbeddingProvider(trimmedKey) : null;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;

  let dotProduct = 0;
  let leftMagnitudeSquared = 0;
  let rightMagnitudeSquared = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return 0;
    dotProduct += leftValue * rightValue;
    leftMagnitudeSquared += leftValue * leftValue;
    rightMagnitudeSquared += rightValue * rightValue;
  }

  const denominator = Math.sqrt(leftMagnitudeSquared) * Math.sqrt(rightMagnitudeSquared);
  return denominator ? dotProduct / denominator : 0;
}
