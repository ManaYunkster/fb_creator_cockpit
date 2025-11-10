import { log } from '../services/loggingService';

export interface FilePurpose {
  id: string;
  label: string;
  description: string;
  contextPrefix: string;
  scopePrefix: string;
}

export const FILE_PURPOSES: FilePurpose[] = [
  {
    id: 'general-global',
    label: 'Global Document (All contexts)',
    description: 'A general-purpose document, such as notes or research, available to all tools.',
    contextPrefix: 'general',
    scopePrefix: 'global',
  },
  {
    id: 'content-global-brand',
    label: 'Brand (Global)',
    description: 'A foundational document describing brand voice, tone, or strategy.',
    contextPrefix: 'content',
    scopePrefix: 'global',
  },
  {
    id: 'content-global-author',
    label: 'Author Information (Global)',
    description: 'A document containing biographical or origin information about the author.',
    contextPrefix: 'content',
    scopePrefix: 'global',
  },
  {
    id: 'instrux-spa',
    label: 'Instructions (Social Post Assistant)',
    description: 'A set of direct instructions for how the Social Post Assistant should behave.',
    contextPrefix: 'instrux',
    scopePrefix: 'spa',
  },
  {
    id: 'instrux-chat',
    label: 'Instructions (Chat Assistant)',
    description: 'A set of direct instructions for how the Chat Assistant should behave.',
    contextPrefix: 'instrux',
    scopePrefix: 'chat',
  },
  {
    id: 'instrux-qf',
    label: 'Instructions (Quotes & Callbacks)',
    description: 'A set of direct instructions for how the Quotes & Callbacks tool should behave.',
    contextPrefix: 'instrux',
    scopePrefix: 'qf',
  },
  {
    id: 'reference-spa',
    label: 'Reference (Social Post Assistant)',
    description: 'Reference material or a knowledge base for the Social Post Assistant (e.g., writing guides).',
    contextPrefix: 'reference',
    scopePrefix: 'spa',
  },
  {
    id: 'reference-chat',
    label: 'Reference (Chat Assistant)',
    description: 'Reference material or a knowledge base for the Chat Assistant.',
    contextPrefix: 'reference',
    scopePrefix: 'chat',
  },
  {
    id: 'reference-qf',
    label: 'Reference (Quotes & Callbacks)',
    description: 'Reference material or a knowledge base for the Quotes & Callbacks tool.',
    contextPrefix: 'reference',
    scopePrefix: 'qf',
  },
  {
    id: 'corpus-posts',
    label: 'Corpus: Posts',
    description: 'A file containing post data, generated from the Substack corpus upload.',
    contextPrefix: 'corpus',
    scopePrefix: 'posts',
  },
  {
    id: 'corpus-delivers',
    label: 'Corpus: Delivers',
    description: 'A file containing delivery data, generated from the Substack corpus upload.',
    contextPrefix: 'corpus',
    scopePrefix: 'delivers',
  },
  {
    id: 'corpus-opens',
    label: 'Corpus: Opens',
    description: 'A file containing open data, generated from the Substack corpus upload.',
    contextPrefix: 'corpus',
    scopePrefix: 'opens',
  },
  {
    id: 'corpus-subscribers',
    label: 'Corpus: Subscribers',
    description: 'A file containing subscriber data, generated from the Substack corpus upload.',
    contextPrefix: 'corpus',
    scopePrefix: 'subscribers',
  },
  {
    id: 'reg-test',
    label: 'Test (internal)',
    description: 'A file specifically for use in an automated regression test.',
    contextPrefix: 'reg-test',
    scopePrefix: 'internal',
  },
];

/**
 * Builds the internal, prefixed filename based on the original file and a selected purpose.
 * @param fileName The original filename string.
 * @param purposeId The ID of the purpose selected by the user.
 * @returns The constructed internal filename, e.g., "__cc_content_global__brand-brief.md".
 */
export const buildInternalFileName = (fileName: string, purposeId: string): string => {
  const purpose = FILE_PURPOSES.find(p => p.id === purposeId);
  if (!purpose || (!purpose.contextPrefix && !purpose.scopePrefix)) {
    return fileName;
  }
  return `__cc_${purpose.contextPrefix}_${purpose.scopePrefix}__${fileName}`;
};

/**
 * Parses an internal filename into its components.
 * @param internalName The internal filename, e.g., "__cc_content_global__brand-brief.md".
 * @returns An object with context, scope, and originalName, or null if it doesn't match.
 */
export const parseInternalFileName = (internalName: string) => {
  const regex = /__cc_(\w+)_([\w-]+)__(.*)/;
  const match = internalName.match(regex);
  if (match) {
    return {
      context: match[1],
      scope: match[2],
      originalName: match[3],
    };
  }
  log.info(`Could not parse internal filename: "${internalName}"`);
  return null;
};

/**
 * Determines the UI profile for a context document based on its internal filename.
 * @param id The internal filename (e.g., __cc_content_global__author-bio.md).
 * @returns The profile string (e.g., "Author Persona").
 */
export const getProfileFromId = (id: string): string => {
    const parts = parseInternalFileName(id);
    if (!parts) {
        // Fallback for any non-prefixed files that might exist
        return 'General';
    }

    switch (parts.context) {
        case 'content':
            // Differentiate between author and brand within the 'content' context
            if (parts.originalName.toLowerCase().includes('author')) {
                return 'Author Persona';
            }
            return 'Brand Voice';
        case 'instrux':
            return 'Tool Instruction';
        case 'reference':
            return 'Reference Material';
        case 'general':
        default:
            return 'General';
    }
};
