/**
 * Lightweight Semantic / Keyword Vector Retriever for RAG
 * Computes TF-IDF vector representations and Cosine Similarity
 * between user query and LECO Knowledge Base documents.
 */

const { LECO_KNOWLEDGE_DOCS } = require('./lecoKnowledgeDocs');

// Common English stopwords to ignore in scoring
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'did', 'do', 'does', 'doing', 'don', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my',
  'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours'
]);

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

// Compute term frequency map
function getTermFrequencies(tokens) {
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

// Pre-index knowledge docs
const indexedDocs = LECO_KNOWLEDGE_DOCS.map(doc => {
  const docText = `${doc.title} ${doc.category} ${(doc.keywords || []).join(' ')} ${doc.content}`;
  const tokens = tokenize(docText);
  const tf = getTermFrequencies(tokens);
  return {
    ...doc,
    tokens,
    tf,
    tokenCount: tokens.length
  };
});

// Compute IDF across documents
const docCount = indexedDocs.length;
const idf = new Map();
for (const doc of indexedDocs) {
  for (const term of doc.tf.keys()) {
    idf.set(term, (idf.get(term) || 0) + 1);
  }
}
for (const [term, count] of idf.entries()) {
  idf.set(term, Math.log((1 + docCount) / (1 + count)) + 1);
}

/**
 * Retrieve top K most relevant knowledge documents for a query
 * using TF-IDF cosine similarity.
 *
 * @param {string} query - The user question or search prompt
 * @param {number} topK - Maximum number of relevant chunks to return (default: 2)
 * @returns {Array<{ id, title, category, content, score }>}
 */
function retrieveRelevantKnowledge(query, topK = 2) {
  if (!query || typeof query !== 'string') return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const queryTf = getTermFrequencies(queryTokens);
  let queryNormSq = 0;
  for (const [term, freq] of queryTf.entries()) {
    const weight = freq * (idf.get(term) || 1.0);
    queryNormSq += weight * weight;
  }
  const queryNorm = Math.sqrt(queryNormSq) || 1;

  const scoredDocs = indexedDocs.map(doc => {
    let dotProduct = 0;
    let docNormSq = 0;

    for (const [term, docFreq] of doc.tf.entries()) {
      const docWeight = (docFreq / doc.tokenCount) * (idf.get(term) || 1.0);
      docNormSq += docWeight * docWeight;

      if (queryTf.has(term)) {
        const queryWeight = queryTf.get(term) * (idf.get(term) || 1.0);
        dotProduct += queryWeight * docWeight;
      }
    }

    // Boost score if explicit keyword matches title or keyword list
    let boost = 1.0;
    for (const kw of doc.keywords || []) {
      if (query.toLowerCase().includes(kw.toLowerCase())) {
        boost += 0.35;
      }
    }

    const docNorm = Math.sqrt(docNormSq) || 1;
    const similarity = (dotProduct / (queryNorm * docNorm)) * boost;

    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      content: doc.content,
      score: similarity
    };
  });

  // Sort descending by score
  scoredDocs.sort((a, b) => b.score - a.score);

  // Return top K with a minimal relevance threshold
  return scoredDocs.filter(d => d.score > 0.05).slice(0, topK);
}

module.exports = {
  retrieveRelevantKnowledge,
  LECO_KNOWLEDGE_DOCS
};
