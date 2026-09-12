/**
 * Unit tests for @substrate-platform/content — Syndication Engine.
 * Tests RSS 2.0, Atom 1.0, and JSON Feed 1.1 generation, helpers, and Response creation.
 */

import type { FeedChannel } from '@substrate-platform/contracts';
import { describe, expect, it } from 'vitest';
import {
  createFeed,
  escapeXml,
  generateAtom,
  generateJsonFeed,
  generateRss2,
  toRfc822Date,
  toRfc3339Date,
  wrapCdata,
} from '../syndication';

const sampleChannel: FeedChannel = {
  title: 'Engineering & Research',
  description: 'Chronicles of systems, distributed computing, and web architecture.',
  siteUrl: 'https://example.com',
  feedUrl: 'https://example.com/feed.xml',
  language: 'en-US',
  copyright: '2026 Example Corp',
  author: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    url: 'https://example.com/about',
  },
  favicon: 'https://example.com/favicon.ico',
  icon: 'https://example.com/icon.png',
  updatedAt: new Date('2026-03-01T12:00:00Z'),
  items: [
    {
      id: 'https://example.com/posts/future-of-protocols',
      url: 'https://example.com/posts/future-of-protocols',
      title: 'The Future of Web Protocols <Draft>',
      summary: 'Exploring HTTP/3, QUIC & modern syndication paradigms.',
      content:
        '<p>Deep dive into protocols & specifications with <code>nested &lt;code&gt;</code>.</p>',
      publishedAt: new Date('2026-02-28T10:00:00Z'),
      updatedAt: new Date('2026-03-01T11:00:00Z'),
      author: {
        name: 'Alan Turing',
      },
      tags: ['networking', 'protocols'],
      enclosure: {
        url: 'https://example.com/audio/podcast-ep1.mp3',
        type: 'audio/mpeg',
        length: 1234567,
      },
    },
    {
      id: 'https://example.com/posts/second-post',
      url: 'https://example.com/posts/second-post',
      title: 'CDATA Sequences in XML',
      content: '<p>Testing CDATA block with nested ]]> marks.</p>',
      publishedAt: '2026-02-20T08:00:00Z',
    },
  ],
};

describe('Syndication: XML Helpers', () => {
  it('escapes special characters correctly', () => {
    expect(escapeXml('Foo & Bar')).toBe('Foo &amp; Bar');
    expect(escapeXml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
    expect(escapeXml("It's fine")).toBe('It&apos;s fine');
  });

  it('strips invalid XML control characters', () => {
    const withControlChars = 'Hello\u0000\u0008\u001FWorld\u0009Good';
    const escaped = escapeXml(withControlChars);
    expect(escaped).toBe('HelloWorld\tGood');
  });

  it('wraps content in CDATA and escapes nested CDATA terminators', () => {
    const raw = 'Simple text';
    expect(wrapCdata(raw)).toBe('<![CDATA[Simple text]]>');

    const nested = 'Ends with ]]> and continues';
    expect(wrapCdata(nested)).toBe('<![CDATA[Ends with ]]]]><![CDATA[> and continues]]>');
  });
});

describe('Syndication: Date Helpers', () => {
  it('formats dates as RFC 822 / 2822', () => {
    const date = new Date('2026-03-01T12:00:00Z');
    expect(toRfc822Date(date)).toBe('Sun, 01 Mar 2026 12:00:00 GMT');
    expect(toRfc822Date('2026-03-01T12:00:00Z')).toBe('Sun, 01 Mar 2026 12:00:00 GMT');
  });

  it('formats dates as RFC 3339 / ISO 8601', () => {
    const date = new Date('2026-03-01T12:00:00Z');
    expect(toRfc3339Date(date)).toBe('2026-03-01T12:00:00.000Z');
    expect(toRfc3339Date('2026-03-01T12:00:00Z')).toBe('2026-03-01T12:00:00.000Z');
  });

  it('falls back gracefully on invalid dates', () => {
    expect(typeof toRfc822Date('invalid-date')).toBe('string');
    expect(typeof toRfc3339Date('invalid-date')).toBe('string');
  });
});

describe('Syndication: RSS 2.0 Generation', () => {
  it('generates a valid RSS 2.0 XML document', () => {
    const xml = generateRss2(sampleChannel);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain('<title>Engineering &amp; Research</title>');
    expect(xml).toContain(
      '<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />',
    );
    expect(xml).toContain('<language>en-US</language>');
    expect(xml).toContain('<copyright>2026 Example Corp</copyright>');
    expect(xml).toContain('<item>');
    expect(xml).toContain('<title>The Future of Web Protocols &lt;Draft&gt;</title>');
    expect(xml).toContain('<dc:creator>Alan Turing</dc:creator>');
    expect(xml).toContain('<category>networking</category>');
    expect(xml).toContain('<category>protocols</category>');
    expect(xml).toContain(
      '<enclosure url="https://example.com/audio/podcast-ep1.mp3" type="audio/mpeg" length="1234567" />',
    );
    expect(xml).toContain(
      '<content:encoded><![CDATA[<p>Deep dive into protocols & specifications with <code>nested &lt;code&gt;</code>.</p>]]></content:encoded>',
    );
  });
});

describe('Syndication: Atom 1.0 Generation', () => {
  it('generates a valid Atom 1.0 XML document', () => {
    const xml = generateAtom(sampleChannel);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<title>Engineering &amp; Research</title>');
    expect(xml).toContain('<link rel="self" href="https://example.com/feed.xml" />');
    expect(xml).toContain('<link rel="alternate" href="https://example.com" />');
    expect(xml).toContain('<author>\n    <name>Ada Lovelace</name>');
    expect(xml).toContain('<entry>');
    expect(xml).toContain('<title>The Future of Web Protocols &lt;Draft&gt;</title>');
    expect(xml).toContain('<author>\n      <name>Alan Turing</name>\n    </author>');
    expect(xml).toContain(
      '<content type="html"><![CDATA[<p>Deep dive into protocols & specifications with <code>nested &lt;code&gt;</code>.</p>]]></content>',
    );
    expect(xml).toContain('<category term="networking" />');
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/audio/podcast-ep1.mp3" type="audio/mpeg" length="1234567" />',
    );
  });
});

describe('Syndication: JSON Feed 1.1 Generation', () => {
  it('generates a valid JSON Feed 1.1 document', () => {
    const jsonStr = generateJsonFeed(sampleChannel);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(parsed.title).toBe('Engineering & Research');
    expect(parsed.home_page_url).toBe('https://example.com');
    expect(parsed.feed_url).toBe('https://example.com/feed.xml');
    expect(parsed.authors?.[0]?.name).toBe('Ada Lovelace');
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].title).toBe('The Future of Web Protocols <Draft>');
    expect(parsed.items[0].authors?.[0]?.name).toBe('Alan Turing');
    expect(parsed.items[0].attachments?.[0]?.mime_type).toBe('audio/mpeg');
  });
});

describe('Syndication: createFeed Builder & Web Response', () => {
  it('creates builder and generates all formats', () => {
    const feed = createFeed(sampleChannel);
    expect(feed.toRss2()).toContain('<rss version="2.0"');
    expect(feed.toAtom()).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(JSON.parse(feed.toJsonFeed()).version).toBe('https://jsonfeed.org/version/1.1');
  });

  it('produces standard Web Response with correct headers', async () => {
    const feed = createFeed(sampleChannel);

    const rssRes = feed.toResponse('rss');
    expect(rssRes.status).toBe(200);
    expect(rssRes.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8');
    expect(rssRes.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(await rssRes.text()).toContain('<rss version="2.0"');

    const atomRes = feed.toResponse('atom');
    expect(atomRes.headers.get('Content-Type')).toBe('application/atom+xml; charset=utf-8');
    expect(await atomRes.text()).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');

    const jsonRes = feed.toResponse('json', { status: 201 });
    expect(jsonRes.status).toBe(201);
    expect(jsonRes.headers.get('Content-Type')).toBe('application/feed+json; charset=utf-8');
  });

  it('validates schema on createFeed', () => {
    expect(() => {
      createFeed({ title: 123 });
    }).toThrow();
  });
});
