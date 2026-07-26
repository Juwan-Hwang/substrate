/**
 * @substrate/content — Content layer for the Archive subsystem.
 *
 * Handles MDX articles, project metadata, and structured notes.
 */

export type ContentFrontmatter = {
  title: string;
  slug: string;
  date: string;
  excerpt?: string;
  tags?: string[];
  draft?: boolean;
};

export type Article = ContentFrontmatter & {
  body: string;
};

export type Project = {
  name: string;
  description: string;
  url?: string;
  repo?: string;
  status: 'active' | 'archived' | 'experimental';
};

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};
