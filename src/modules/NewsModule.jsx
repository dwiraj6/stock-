/* MODULE · WHAT THE MODEL DOESN'T SEE
   ────────────────────────────────────────────────────────────────
   Real coverage of this company, verbatim, attributed, linked.

   It sits immediately after the score breakdown on purpose. The
   score is built from price history and reported fundamentals; these
   headlines are not in it and cannot be. Putting them here turns the
   feed into part of the product's argument — the same admission the
   calibration grid makes about its three misses — rather than a
   widget bolted to the side.

   Headlines are NEVER rewritten or summarised. The publisher's own
   title, the publisher's name, and a working link. Anything else
   would be putting words in their mouth. */

import { RuleMark, Chevron } from '../components/marks/Marks.jsx';

const WAVE = 40; // matches the calibration grid's stagger

export default function NewsModule({ news, symbol, animate = true }) {
  const items = news?.items ?? [];
  const failed = news && news.ok === false;
  const a = news?.audit ?? { fetched: items.length, tooOld: 0, offTopic: 0, duplicate: 0, trimmed: 0 };

  return (
    <section aria-labelledby="news-eyebrow">
      <p className="eyebrow" id="news-eyebrow">
        What the model doesn’t see
      </p>

      <p
        className="font-body prose-measure"
        style={{ fontSize: 'var(--text-lead)', marginTop: 18 }}
      >
        The score above reads price history and reported fundamentals. It does not read
        any of this.
      </p>

      {/* ── the list ── */}
      {items.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '32px 0 0',
            padding: 0,
            maxWidth: 820,
          }}
        >
          {items.map((n, i) => (
            <li
              key={n.url}
              style={{
                borderTop: '1px solid var(--color-rule)',
                animation: animate
                  ? `pl-fade-up 300ms var(--ease-out) ${i * WAVE}ms both`
                  : 'none',
                '--pl-rise': '8px',
              }}
            >
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pl-news-row"
                style={{
                  display: 'block',
                  padding: '18px 0',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  className="flex items-baseline"
                  style={{ gap: 16, justifyContent: 'space-between' }}
                >
                  <span
                    className="font-body"
                    style={{ fontSize: '1.0625rem', lineHeight: 1.5, color: 'var(--color-ink)' }}
                  >
                    {n.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className="pl-news-chevron"
                    style={{ flexShrink: 0, color: 'var(--color-graphite)', paddingTop: 4 }}
                  >
                    <Chevron dir="right" size={10} />
                  </span>
                </div>
                <div
                  className="font-data flex items-center"
                  style={{
                    gap: 10,
                    marginTop: 8,
                    fontSize: '0.75rem',
                    color: 'var(--color-graphite)',
                  }}
                >
                  <span>{n.publisher}</span>
                  <RuleMark width={10} />
                  <span>{n.ageLabel}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* ── nothing survived the filter ──
          An empty feed is stated, not hidden. Wrong-company news is
          worse than no news, so a discard is the filter working. */}
      {items.length === 0 && (
        <p
          className="font-body prose-measure"
          style={{
            marginTop: 28,
            fontSize: '1rem',
            color: 'var(--color-graphite)',
            borderTop: '1px solid var(--color-rule)',
            paddingTop: 18,
          }}
        >
          {failed
            ? 'The news feed could not be reached. Nothing else on this page depends on it.'
            : a.fetched > 0
              ? `${a.fetched} headlines were fetched for ${symbol} and none of them were actually about the company, so none are shown. Wrong-company news is worse than no news.`
              : `No recent coverage of ${symbol} was found. Headlines that mention the ticker but are about something else are discarded rather than shown.`}
        </p>
      )}

      {/* ── provenance ── */}
      {news && (
        <p
          className="font-data"
          style={{
            marginTop: 20,
            fontSize: '0.75rem',
            color: 'var(--color-graphite)',
            lineHeight: 1.7,
            borderTop: items.length > 0 ? '1px solid var(--color-rule)' : 'none',
            paddingTop: items.length > 0 ? 18 : 0,
          }}
        >
          {items.length > 0 && (
            <>
              {/* The breakdown is itemised rather than rolled into one
                  "discarded" figure: saying 102 items were rejected as
                  off-topic when most were simply trimmed by the 8-item
                  cap would be a claim the filter never made. */}
              Showing {items.length} of {a.fetched} fetched
              {news.sources?.length ? ` · ${news.sources.join(' + ')}` : ''}
              <br />
              {[
                a.offTopic > 0 ? `${a.offTopic} not about this company` : null,
                a.tooOld > 0 ? `${a.tooOld} older than 30 days` : null,
                a.duplicate > 0 ? `${a.duplicate} duplicates` : null,
                a.trimmed > 0 ? `${a.trimmed} beyond the ${items.length}-item cap` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              <br />
            </>
          )}
          Headlines are the publisher’s own words, unedited. Plumbline does not summarise
          or interpret them.
        </p>
      )}
    </section>
  );
}
