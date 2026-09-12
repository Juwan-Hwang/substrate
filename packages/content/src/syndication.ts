/**
 * @substrate-platform/content — Universal Web Syndication Engine.
 *
 * High-performance, spec-compliant generators for RSS 2.0, Atom 1.0 (RFC 4287),
 * and JSON Feed v1.1. Native Web Standards (Response) support.
 *
 * Zero external runtime dependencies.
 */

import type { FeedChannel } from '@substrate-platform/contracts';
import { FeedChannelSchema } from '@substrate-platform/contracts';

/**
 * Strips XML 1.0 disallowed control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F).
 * Preserves tab (0x09), newline (0x0A), and carriage return (0x0D).
 */
export function stripXmlControlChars(str: string): string {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f)
    ) {
      continue;
    }
    res += str[i];
  }
  return res;
}

// ── Date Formatting ──────────────────────────────────────────────────

/**
 * Formats a Date or ISO string into RFC 822 / RFC 2822 format (required by RSS 2.0).
 */
export function toRfc822Date(dateOrIso: Date | string): string {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

/**
 * Formats a Date or ISO string into RFC 3339 / ISO 8601 format (required by Atom 1.0 and JSON Feed 1.1).
 */
export function toRfc3339Date(dateOrIso: Date | string): string {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ── XML Helpers ──────────────────────────────────────────────────────

/**
 * Escapes characters for safe inclusion in XML elements and attributes.
 * Also strips control characters that cause parser rejections.
 */
export function escapeXml(str: string): string {
  return stripXmlControlChars(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wraps content in CDATA block, escaping any nested ']]>' sequences.
 */
export function wrapCdata(content: string): string {
  // Strip control characters
  const clean = stripXmlControlChars(content);
  // To nest CDATA, replace ']]>' with ']]]]><![CDATA[>'
  return `<![CDATA[${clean.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

// ── Format Generators ────────────────────────────────────────────────

/**
 * Generates an RSS 2.0 XML document.
 * Compliant with RSS 2.0 Board specification + W3C Feed Validation.
 */
export function generateRss2(channel: FeedChannel): string {
  const channelAuthor = channel.author?.name || '';
  const channelLang = channel.language || 'en';
  const lastBuild = toRfc822Date(channel.updatedAt || channel.items[0]?.publishedAt || new Date());

  const itemsXml = channel.items
    .map((item) => {
      const parts: string[] = [];
      parts.push(`      <title>${escapeXml(item.title)}</title>`);
      parts.push(`      <link>${escapeXml(item.url)}</link>`);
      parts.push(`      <guid isPermaLink="${item.url === item.id}">${escapeXml(item.id)}</guid>`);
      parts.push(`      <pubDate>${toRfc822Date(item.publishedAt)}</pubDate>`);

      if (item.summary) {
        parts.push(`      <description>${escapeXml(item.summary)}</description>`);
      } else if (item.content) {
        parts.push(`      <description>${wrapCdata(item.content)}</description>`);
      }

      if (item.content) {
        parts.push(`      <content:encoded>${wrapCdata(item.content)}</content:encoded>`);
      }

      const authorName = item.author?.name || channelAuthor;
      if (authorName) {
        parts.push(`      <dc:creator>${escapeXml(authorName)}</dc:creator>`);
      }

      if (item.tags && item.tags.length > 0) {
        for (const tag of item.tags) {
          parts.push(`      <category>${escapeXml(tag)}</category>`);
        }
      }

      if (item.enclosure) {
        const len = item.enclosure.length ? ` length="${item.enclosure.length}"` : ' length="0"';
        parts.push(
          `      <enclosure url="${escapeXml(item.enclosure.url)}" type="${escapeXml(item.enclosure.type)}"${len} />`,
        );
      }

      return `    <item>\n${parts.join('\n')}\n    </item>`;
    })
    .join('\n');

  const channelMeta: string[] = [
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.siteUrl)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channelLang)}</language>`,
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml" />`,
    '    <generator>Substrate Syndication Engine</generator>',
  ];

  if (channel.copyright) {
    channelMeta.push(`    <copyright>${escapeXml(channel.copyright)}</copyright>`);
  }
  if (channel.favicon || channel.icon) {
    const img = channel.icon || channel.favicon || '';
    channelMeta.push(
      `    <image>\n      <url>${escapeXml(img)}</url>\n      <title>${escapeXml(channel.title)}</title>\n      <link>${escapeXml(channel.siteUrl)}</link>\n    </image>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
${channelMeta.join('\n')}
${itemsXml}
  </channel>
</rss>`.trim();
}

/**
 * Generates an Atom 1.0 XML document.
 * Compliant with IETF RFC 4287.
 */
export function generateAtom(channel: FeedChannel): string {
  const feedUpdated = toRfc3339Date(
    channel.updatedAt || channel.items[0]?.publishedAt || new Date(),
  );

  const entriesXml = channel.items
    .map((item) => {
      const parts: string[] = [];
      parts.push(`    <id>${escapeXml(item.id)}</id>`);
      parts.push(`    <title>${escapeXml(item.title)}</title>`);
      parts.push(`    <link rel="alternate" href="${escapeXml(item.url)}" />`);
      parts.push(`    <published>${toRfc3339Date(item.publishedAt)}</published>`);
      parts.push(`    <updated>${toRfc3339Date(item.updatedAt || item.publishedAt)}</updated>`);

      const author = item.author || channel.author;
      if (author) {
        parts.push(
          `    <author>\n      <name>${escapeXml(author.name)}</name>${author.email ? `\n      <email>${escapeXml(author.email)}</email>` : ''}${author.url ? `\n      <uri>${escapeXml(author.url)}</uri>` : ''}\n    </author>`,
        );
      }

      if (item.summary) {
        parts.push(`    <summary type="text">${escapeXml(item.summary)}</summary>`);
      }

      if (item.content) {
        parts.push(`    <content type="html">${wrapCdata(item.content)}</content>`);
      }

      if (item.tags && item.tags.length > 0) {
        for (const tag of item.tags) {
          parts.push(`    <category term="${escapeXml(tag)}" />`);
        }
      }

      if (item.enclosure) {
        const len = item.enclosure.length ? ` length="${item.enclosure.length}"` : '';
        parts.push(
          `    <link rel="enclosure" href="${escapeXml(item.enclosure.url)}" type="${escapeXml(item.enclosure.type)}"${len} />`,
        );
      }

      return `  <entry>\n${parts.join('\n')}\n  </entry>`;
    })
    .join('\n');

  const feedMeta: string[] = [
    `  <id>${escapeXml(channel.feedUrl)}</id>`,
    `  <title>${escapeXml(channel.title)}</title>`,
    `  <subtitle>${escapeXml(channel.description)}</subtitle>`,
    `  <updated>${feedUpdated}</updated>`,
    `  <link rel="alternate" href="${escapeXml(channel.siteUrl)}" />`,
    `  <link rel="self" href="${escapeXml(channel.feedUrl)}" />`,
    '  <generator>Substrate Syndication Engine</generator>',
  ];

  if (channel.author) {
    feedMeta.push(
      `  <author>\n    <name>${escapeXml(channel.author.name)}</name>${channel.author.email ? `\n    <email>${escapeXml(channel.author.email)}</email>` : ''}${channel.author.url ? `\n    <uri>${escapeXml(channel.author.url)}</uri>` : ''}\n  </author>`,
    );
  }
  if (channel.icon) {
    feedMeta.push(`  <logo>${escapeXml(channel.icon)}</logo>`);
  }
  if (channel.favicon) {
    feedMeta.push(`  <icon>${escapeXml(channel.favicon)}</icon>`);
  }
  if (channel.copyright) {
    feedMeta.push(`  <rights>${escapeXml(channel.copyright)}</rights>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
${feedMeta.join('\n')}
${entriesXml}
</feed>`.trim();
}

/**
 * Generates a JSON Feed document.
 * Compliant with JSON Feed Specification v1.1.
 */
export function generateJsonFeed(channel: FeedChannel): string {
  const jsonObject: Record<string, unknown> = {
    version: 'https://jsonfeed.org/version/1.1',
    title: channel.title,
    home_page_url: channel.siteUrl,
    feed_url: channel.feedUrl,
    description: channel.description,
    language: channel.language || 'en',
  };

  if (channel.favicon) jsonObject.favicon = channel.favicon;
  if (channel.icon) jsonObject.icon = channel.icon;

  if (channel.author) {
    jsonObject.authors = [
      {
        name: channel.author.name,
        url: channel.author.url,
        avatar: channel.author.avatar,
      },
    ];
  }

  jsonObject.items = channel.items.map((item) => {
    const itemObj: Record<string, unknown> = {
      id: item.id,
      url: item.url,
      title: item.title,
      date_published: toRfc3339Date(item.publishedAt),
    };

    if (item.updatedAt) {
      itemObj.date_modified = toRfc3339Date(item.updatedAt);
    }
    if (item.summary) {
      itemObj.summary = item.summary;
    }
    if (item.content) {
      itemObj.content_html = item.content;
    }
    if (item.image) {
      itemObj.image = item.image;
    }
    if (item.tags && item.tags.length > 0) {
      itemObj.tags = item.tags;
    }
    if (item.author) {
      itemObj.authors = [
        {
          name: item.author.name,
          url: item.author.url,
          avatar: item.author.avatar,
        },
      ];
    }
    if (item.enclosure) {
      itemObj.attachments = [
        {
          url: item.enclosure.url,
          mime_type: item.enclosure.type,
          size_in_bytes: item.enclosure.length,
        },
      ];
    }

    return itemObj;
  });

  return JSON.stringify(jsonObject, null, 2);
}

// ── High-Level Feed Builder ──────────────────────────────────────────

export type FeedFormat = 'rss' | 'atom' | 'json';

export interface FeedBuilder {
  /** The validated FeedChannel configuration. */
  readonly channel: FeedChannel;
  /** Serialize as RSS 2.0 XML. */
  toRss2(): string;
  /** Serialize as Atom 1.0 XML. */
  toAtom(): string;
  /** Serialize as JSON Feed v1.1. */
  toJsonFeed(): string;
  /**
   * Generates a native Web standard Response object with correct Content-Type and caching headers.
   * Ideal for Next.js Route Handlers, Cloudflare Workers, Hono, and Node/Bun HTTP handlers.
   */
  toResponse(format: FeedFormat, init?: ResponseInit): Response;
}

const MIME_TYPES: Record<FeedFormat, string> = {
  rss: 'application/rss+xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
  json: 'application/feed+json; charset=utf-8',
};

const DEFAULT_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Creates a validated Web Syndication Feed builder.
 */
export function createFeed(input: unknown): FeedBuilder {
  const channel = FeedChannelSchema.parse(input);

  return {
    channel,
    toRss2() {
      return generateRss2(channel);
    },
    toAtom() {
      return generateAtom(channel);
    },
    toJsonFeed() {
      return generateJsonFeed(channel);
    },
    toResponse(format: FeedFormat, init?: ResponseInit) {
      let body: string;
      if (format === 'rss') {
        body = generateRss2(channel);
      } else if (format === 'atom') {
        body = generateAtom(channel);
      } else {
        body = generateJsonFeed(channel);
      }

      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', MIME_TYPES[format]);
      }
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', DEFAULT_CACHE_CONTROL);
      }

      return new Response(body, {
        ...init,
        status: init?.status ?? 200,
        headers,
      });
    },
  };
}
