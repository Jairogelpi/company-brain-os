import { vector as pgVector } from "drizzle-orm/pg-core";

/**
 * Pre-configured pgvector `vector(768)` column builder factory.
 *
 * **Deviation from design D1:** The design assumed `drizzle-orm@0.45.2`
 * ships no pgvector type and called for a hand-rolled `customType` with
 * custom `toDriver`/`fromDriver` parsing. In fact, `drizzle-orm/pg-core`
 * ships a built-in `vector({ dimensions })` type with official
 * `mapToDriverValue` (JSON array literal, pgvector-compatible) and
 * `mapFromDriverValue` (parses `[v1,v2,...]` into `number[]`). Using the
 * built-in eliminates the hand-rolled parse risk (D1) and is strictly
 * better. This wrapper pins the dimension to 768 (nomic-embed-text) so
 * `node_embeddings.embedding` declares a typed vector column without
 * repeating the dimension at every call site.
 */
export function vector768<TName extends string>(name: TName) {
	return pgVector(name, { dimensions: 768 });
}
