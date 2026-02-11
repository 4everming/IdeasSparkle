import fs from 'fs';
import pdfParse from 'pdf-parse';

/**
 * Parse a PDF file and extract metadata + references.
 * @param {string} filePath - absolute path to the PDF
 * @returns {Promise<{title, authors, abstract, pageCount, references: string[]}>}
 */
export async function parsePDF(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    const text = data.text || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // --- Title: heuristic — first non-empty line ---
    const title = extractTitle(lines);

    // --- Authors: lines near the title that look like names ---
    const authors = extractAuthors(lines);

    // --- Abstract ---
    const abstract = extractAbstract(text);

    // --- References ---
    const references = extractReferences(text);

    return {
        title,
        authors,
        abstract,
        pageCount: data.numpages || 0,
        references,
    };
}

function extractTitle(lines) {
    // Usually the first meaningful line (skip blanks, arXiv IDs, etc.)
    for (const line of lines.slice(0, 10)) {
        if (line.length > 10 && !/^(arXiv|http|doi|www\.)/i.test(line)) {
            return line.slice(0, 512);
        }
    }
    return lines[0]?.slice(0, 512) || 'Untitled';
}

function extractAuthors(lines) {
    // Try to find lines between title and Abstract keyword
    const abstractIdx = lines.findIndex(l => /^abstract/i.test(l));
    if (abstractIdx > 1 && abstractIdx < 20) {
        const authorLines = lines.slice(1, abstractIdx).filter(l =>
            l.length > 3 && l.length < 500 && !/^(keyword|abstract|introduction)/i.test(l)
        );
        return authorLines.join(', ').slice(0, 1024);
    }
    return '';
}

function extractAbstract(text) {
    const match = text.match(/abstract[:\s]*\n?([\s\S]{20,2000}?)(?:\n\s*(?:1\s+introduction|keywords|1\.|I\.\s+Introduction))/i);
    if (match) return match[1].replace(/\s+/g, ' ').trim().slice(0, 3000);

    // Fallback: grab text after "Abstract" keyword
    const idx = text.search(/abstract/i);
    if (idx !== -1) {
        return text.slice(idx + 8, idx + 2000).replace(/\s+/g, ' ').trim().slice(0, 3000);
    }
    return '';
}

function extractReferences(text) {
    // Locate the "References" section
    const refMatch = text.match(/\n\s*references?\s*\n/i);
    if (!refMatch) return [];

    const refStart = refMatch.index + refMatch[0].length;
    const refText = text.slice(refStart);

    // Split by numbered references [1], [2], … or 1., 2., …
    const numbered = refText.split(/\n\s*\[?\d{1,3}[\].)]\s+/).filter(s => s.trim().length > 15);
    if (numbered.length > 1) {
        return numbered.slice(0, 200).map(r => r.replace(/\s+/g, ' ').trim().slice(0, 1000));
    }

    // Fallback: split by double newline
    const chunks = refText.split(/\n{2,}/).filter(s => s.trim().length > 15);
    return chunks.slice(0, 200).map(r => r.replace(/\s+/g, ' ').trim().slice(0, 1000));
}

/**
 * Attempt to parse individual citation fields from raw ref text.
 */
export function parseCitation(refText) {
    const yearMatch = refText.match(/(19|20)\d{2}/);
    const year = yearMatch ? yearMatch[0] : '';

    // Basic title extraction: text inside quotes or after year
    let title = '';
    const quotedMatch = refText.match(/"([^"]{10,300})"/);
    if (quotedMatch) {
        title = quotedMatch[1];
    } else {
        // try text after the first period
        const parts = refText.split('.');
        if (parts.length > 1) {
            title = parts[1].trim().slice(0, 300);
        }
    }

    // Authors: text before the year
    let authors = '';
    if (yearMatch) {
        authors = refText.slice(0, yearMatch.index).replace(/[,.\s]+$/, '').trim().slice(0, 500);
    }

    return { title, authors, year };
}
