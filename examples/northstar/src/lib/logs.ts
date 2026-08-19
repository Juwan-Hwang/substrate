/**
 * Static mission log corpus for the Northstar example site.
 *
 * Northstar is a fictional interstellar exploration technology journal.
 * The content is entirely original and has no connection to any real
 * person, organisation, or existing project. The shape mirrors
 * `SearchableDoc` so the same records can feed both the Orama search
 * index and the mission log routes.
 */

export type MissionLog = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  body: string;
};

export const logs: MissionLog[] = [
  {
    slug: 'plasma-containment-field-tuning',
    title: 'Plasma Containment Field Tuning at Europa Station',
    date: '2026-07-14',
    excerpt:
      'Calibrating the toroidal field coils for a 40% reduction in drift-induced micro-breaches during sustained fusion burn.',
    tags: ['propulsion', 'fusion', 'engineering'],
    body: `The eighth generation of toroidal containment coils deployed at Europa Station exhibits a measurable drift in field symmetry after approximately 72 hours of sustained operation. The drift is small — less than 0.3% of nominal field strength — but it is enough to produce micro-breaches at the plasma-wall interface, which in turn trigger automated burn-curtailment sequences.

We traced the root cause to thermal expansion in the copper stabiliser segments. The previous coil design used a symmetric winding pattern that assumed uniform thermal distribution; the Europa coolant loop, which runs through the station's ice Harvesting infrastructure, introduces an asymmetric cold spot at the 270-degree segment.

The fix is a dynamic compensation algorithm that adjusts each coil's current in real time based on distributed thermocouple readings. Early results show micro-breach frequency dropping from 2.1 per burn-hour to 0.4 — still not zero, but a dramatic improvement in sustained operation windows.`,
  },
  {
    slug: 'autonomous-navigation-deep-field',
    title: 'Autonomous Navigation in the Deep Field',
    date: '2026-06-28',
    excerpt:
      'How the Northstar probe uses pulsar timing arrays for self-positioning beyond the heliopause, with no Earth-based telemetry.',
    tags: ['navigation', 'autonomy', 'pulsars'],
    body: `Beyond the heliopause, conventional navigation breaks down. Solar reference frames lose meaning, Earth-based telemetry has a round-trip latency exceeding 36 hours, and star trackers saturate from the uniformity of the stellar background at galactic-pole orientations.

The Northstar probe carries a pulsar timing array — a compact X-ray detector that observes millisecond pulsars and cross-correlates their pulse arrival times against an onboard ephemeris. The technique is conceptually similar to GPS, but the "satellites" are neutron stars scattered across the galaxy, and the "ephemeris" is a model of their spin-down rates maintained to nanosecond precision.

In deep-field testing, the array achieved a positioning accuracy of ±4 km at a distance of 120 AU — sufficient for trajectory corrections that keep the probe within its mission corridor without any Earth intervention. The system's limiting factor is not detector sensitivity but the stability of the onboard atomic clock, which drifts by approximately 3 microseconds per year.`,
  },
  {
    slug: 'ice-harvesting-rotary-trenchers',
    title: 'Ice Harvesting with Rotary Trenchers',
    date: '2026-05-30',
    excerpt:
      'Field report on the third-generation rotary trenchers used for water-ice extraction on the Euroan surface, and what broke.',
    tags: ['operations', 'hardware', 'europa'],
    body: `The third-generation rotary trencher was designed to cut 1.2-metre-deep channels into Europan ice at a rate of 8 metres per hour. In practice, the best sustained rate we achieved was 5.2 metres per hour, and two of the six units suffered cutter-head seal failures within the first 40 hours of operation.

The ice itself is not the problem — at 95 K it is harder than granite, but the cutters are diamond-coated and handle it well. The problem is the brine inclusions. Europa's ice is laced with pockets of liquid brine that remain fluid at temperatures well below the bulk freezing point due to dissolved magnesium and sodium perchlorate. When a cutter head encounters a brine pocket, the liquid flashes into vapour at the cutter-ice interface, producing a pressure spike that the current seal design cannot withstand.

The next iteration will use a vented cutter head with a pressure-relief channel machined into the housing. We expect this to eliminate the seal failures entirely, at the cost of a slight reduction in cutting efficiency due to the reduced thermal mass at the cutting face.`,
  },
  {
    slug: 'quantum-entanglement-comm-latency',
    title: 'Quantum Entanglement Communication: Latency Realities',
    date: '2026-04-15',
    excerpt:
      'Why entanglement-based communication does not eliminate latency — and what it actually does that classical radio cannot.',
    tags: ['communications', 'quantum', 'physics'],
    body: `There is a persistent misconception that quantum entanglement can transmit information faster than light. It cannot. The no-communication theorem is unambiguous: a measurement on one half of an entangled pair reveals correlation, but it does not transmit any information to the other half until a classical channel is used to compare results.

What entanglement does provide is a shared cryptographic key that is provably impossible to intercept without detection. The Northstar deep-field probe uses an entanglement-based key distribution system (E91 protocol) to secure its command uplink. The probe and the ground station share a stream of entangled photon pairs generated by a source launched into a medium Earth orbit. Measurements on each end produce correlated bits that serve as one-time pad keys.

The classical channel — a conventional radio link — still carries the actual command data, with the quantum key providing a cryptographic layer that is information-theoretically secure. The latency of the classical link is unchanged, but the security guarantee is stronger than any algorithmic encryption can provide.`,
  },
];

/** Look up a single mission log by its slug. */
export function getLog(slug: string): MissionLog | undefined {
  return logs.find((log) => log.slug === slug);
}

/** Every slug in the corpus — used to prerender mission log routes. */
export function getAllSlugs(): string[] {
  return logs.map((log) => log.slug);
}
