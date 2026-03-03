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
    // Locate the "References" section. Usually at the end.
    // Try some variants of "References" heading
    const refMatch = text.match(/\n\s*(?:references?|bibliography|selected\s+references?)\s*\n/i);
    if (!refMatch) return [];

    const refStart = refMatch.index + refMatch[0].length;
    const refText = text.slice(refStart);

    // Split by numbered references [1], [2], … which is what the user specifically wants.
    // We look for [x] followed by some text.
    // Use a regex that allows start of string or newline.
    const regex = /(?:^|\n)\s*\[(\d{1,3})\]\s+/g;
    let match;
    const markers = [];
    while ((match = regex.exec(refText)) !== null) {
        markers.push({ index: match.index, length: match[0].length, num: match[1] });
    }

    const results = [];
    for (let i = 0; i < markers.length; i++) {
        const start = markers[i].index + markers[i].length;
        const end = (i + 1 < markers.length) ? markers[i].index + markers[i + 1].index - markers[i].index : refText.length;
        let content = refText.slice(start, end).replace(/\s+/g, ' ').trim();
        // Basic cleaning
        if (content.length > 10) {
            results.push(content.slice(0, 1000));
        }
    }

    if (results.length > 0) return results.slice(0, 500);

    // If no [1] format found, the user said "only these", but currently we have some fallback in case.
    // The user said "I only need you to parse these citations, others don't have to be parsed."
    // So let's stick to the [1] format primarily.
    return [];
}

export function parseCitation(refText) {
    const data = {
        title: '',
        authors: '',
        year: '',
        journal: '',
        url: ''
    };

    // Strip starting markers like "[1]", "1.", etc.
    let text = refText.replace(/^\s*\[?\d{1,3}\]?\.?\s*/, '').trim();

    // Extract URL
    const urlMatch = text.match(/https?:\/\/[^\s,]+/i) || text.match(/doi\.org\/\S+/i);
    if (urlMatch) {
        data.url = urlMatch[0];
        text = text.replace(urlMatch[0], '').trim();
    }

    // Extract Year
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
        data.year = yearMatch[0];
    }

    // Try extracting with "Quotes"
    const quotedMatch = text.match(/["“]([^"”]{10,512})["”]/);
    if (quotedMatch) {
        data.title = quotedMatch[1].trim();
        const parts = text.split(quotedMatch[0]);
        // The authors are usually before the quotes
        data.authors = parts[0]
            .replace(/\(\s*(19|20)\d{2}\s*\)/, '')
            .replace(data.year, '')
            .replace(/[,.\s(]+$/, '').trim();

        // The journal is after the quotes
        data.journal = (parts[1] || '')
            .replace(new RegExp(`\\b${data.year}\\b`, 'g'), '')
            .replace(/^[,\s.]+/, '')
            .replace(/[,\s.]*$/, '')
            .replace(/\(\s*\)/g, '').trim();
    }
    // Try "(Year). Title. " format
    else {
        const parenYearMatch = text.match(/\(\s*(19|20)\d{2}\s*\)\s*\.?\s*/);
        if (parenYearMatch) {
            const parts = text.split(parenYearMatch[0]);
            data.authors = parts[0].trim().replace(/[,.\s]+$/, '');

            const afterYear = parts[1] || '';
            // title is usually up to the first period or question mark
            const titleMatch = afterYear.match(/^([^.?]+[.?])/);
            if (titleMatch) {
                data.title = titleMatch[1].trim().replace(/\.$/, '');
                data.journal = afterYear.substring(titleMatch[0].length).trim()
                    .replace(new RegExp(`\\b${data.year}\\b`, 'g'), '')
                    .replace(/^[,\s.]+/, '')
                    .replace(/[,\s.]*$/, '').trim();
            } else {
                data.title = afterYear;
            }
        }
        // Fallback: Look for the first period that isn't preceded by an initial
        else {
            // Find authors: assume authors are before the first period that isn't part of an initial (like A. or B.)
            // Regex explanation: Look for a period that is NOT preceded by a single letter. 
            // Also requires space after the period to be safe.
            const match = text.match(/(?<!\b[A-Za-z])\.\s+/);
            if (match) {
                const splitIndex = match.index + 1; // +1 to include the period in authors or exclude it cleanly
                data.authors = text.substring(0, splitIndex).trim().replace(/[,\s.]+$/, '').replace(data.year, '');

                const afterAuthors = text.substring(splitIndex + 1).trim();
                // Find title
                const titleMatch = afterAuthors.match(/^([^.?]+[.?])/);
                if (titleMatch) {
                    data.title = titleMatch[1].trim().replace(/\.$/, '');
                    data.journal = afterAuthors.substring(titleMatch[0].length).trim()
                        .replace(new RegExp(`\\b${data.year}\\b`, 'g'), '')
                        .replace(/^[,\s.]+/, '')
                        .replace(/[,\s.]*$/, '').trim();
                } else {
                    data.title = afterAuthors;
                }
            } else {
                data.title = text; // Could not parse
            }
        }
    }

    // Clean up all fields
    data.title = data.title.replace(/[\n\r]+/g, ' ').trim().slice(0, 512);
    if (!data.title) data.title = text.slice(0, 512);

    data.authors = data.authors.replace(/[\n\r]+/g, ' ').replace(/\(\s*\)/g, '').trim().slice(0, 1024);
    data.journal = data.journal?.replace(/[\n\r]+/g, ' ').replace(/\(\s*\)/g, '').trim().slice(0, 512);

    return data;
}
