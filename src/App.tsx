import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import * as $rdf from 'rdflib'
import './App.css'

type MembersSearchResponse = {
  items?: MemberSearchItem[]
  totalResults?: number
}

type MemberSearchItem = {
  value: {
    id: number
    nameListAs?: string
    nameDisplayAs?: string
    nameFullTitle?: string
    nameAddressAs?: string
    gender?: string
    latestParty?: {
      name?: string
      backgroundColour?: string
      foregroundColour?: string
    }
    latestHouseMembership?: {
      membershipFrom?: string
      house?: number
    }
    thumbnailUrl?: string
  }
}

type ODataMemberLookupResponse = {
  value?: Array<{
    LocalId: string
    PersonGivenName?: string
    PersonFamilyName?: string
    MemberMnisId?: string
  }>
}

type PortraitUrlResponse = {
  value?: string
}

type ResolvedMember = {
  membersApiId: number
  memberMnisId: string
  rdfLocalId: string
  rdfUri: string
}

type GraphNodeData = {
  id: string
  label: string
  kind: 'named' | 'blank' | 'literal'
  iri?: string
  value?: string
  datatype?: string
  language?: string
  types: string[]
}

type GraphEdgeData = {
  id: string
  source: string
  target: string
  predicate: string
  predicateLabel: string
}

type GraphModel = {
  elements: ElementDefinition[]
  nodes: Record<string, GraphNodeData>
  edges: Record<string, GraphEdgeData>
  statementsByNode: Record<string, $rdf.Statement[]>
  statementCount: number
}

type SelectedDetails = {
  node: GraphNodeData
  incoming: $rdf.Statement[]
  outgoing: $rdf.Statement[]
}

type GraphTerm = $rdf.Statement['subject'] | $rdf.Statement['object']

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const SCHEMA_NAME = 'https://id.parliament.uk/schema/name'
const PARLIAMENT_BASE = 'https://id.parliament.uk/'

function App() {
  const [query, setQuery] = useState('Truss')
  const [searchResults, setSearchResults] = useState<MemberSearchItem[]>([])
  const [searchTotal, setSearchTotal] = useState<number | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedMember, setSelectedMember] = useState<MemberSearchItem | null>(null)
  const [resolvedMember, setResolvedMember] = useState<ResolvedMember | null>(null)
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null)
  const [portraitError, setPortraitError] = useState<string | null>(null)

  const [rdfGraph, setRdfGraph] = useState<GraphModel | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('Search for a member to load their RDF graph.')

  const graphRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)

  useEffect(() => {
    if (!graphRef.current || !rdfGraph) {
      return
    }

    cyRef.current?.destroy()

    const cy = cytoscape({
      container: graphRef.current,
      elements: rdfGraph.elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#233d4d',
            label: 'data(label)',
            color: '#f6f0e8',
            'font-size': '10px',
            'font-family': 'IBM Plex Sans, sans-serif',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 'mapData(weight, 1, 12, 34, 70)',
            height: 'mapData(weight, 1, 12, 34, 70)',
            'border-width': '2px',
            'border-color': '#f3efe6',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[kind = "literal"]',
          style: {
            'background-color': '#9e2a2b',
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'node[kind = "blank"]',
          style: {
            'background-color': '#6c584c',
            shape: 'diamond',
          },
        },
        {
          selector: 'node.selected',
          style: {
            'border-color': '#ffb703',
            'border-width': '4px',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.6,
            'line-color': '#758b97',
            'target-arrow-color': '#758b97',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(predicateLabel)',
            'font-size': '8px',
            color: '#f3efe6',
            'text-background-color': '#10212b',
            'text-background-opacity': 0.88,
            'text-background-padding': '2px',
            'text-rotation': 'autorotate',
            'text-margin-y': -4,
            'overlay-opacity': 0,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: 80000,
        idealEdgeLength: 130,
        edgeElasticity: 80,
        fit: true,
        padding: 28,
      },
    })

    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id()
      setSelectedNodeId(nodeId)
    })

    cyRef.current = cy

    const firstNode = cy.nodes().first()
    if (firstNode.length > 0) {
      setSelectedNodeId(firstNode.id())
    }

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [rdfGraph])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selectedNodeId) {
      return
    }

    highlightSelectedNode(cy, selectedNodeId)
  }, [selectedNodeId])

  const selectedDetails = useMemo<SelectedDetails | null>(() => {
    if (!rdfGraph || !selectedNodeId) {
      return null
    }

    const node = rdfGraph.nodes[selectedNodeId]
    if (!node) {
      return null
    }

    const statements = rdfGraph.statementsByNode[selectedNodeId] ?? []
    const outgoing = statements.filter((statement) => termToNodeId(statement.subject) === selectedNodeId)
    const incoming = statements.filter((statement) => termToNodeId(statement.object) === selectedNodeId)

    return { node, incoming, outgoing }
  }, [rdfGraph, selectedNodeId])

  const runSearch = useCallback(async (nextQuery?: string) => {
    const term = (nextQuery ?? query).trim()
    setQuery(term)
    setSearchLoading(true)
    setSearchError(null)

    try {
      const url = new URL('https://members-api.parliament.uk/api/Members/Search')
      if (term.length > 0) {
        url.searchParams.set('Name', term)
      }
      url.searchParams.set('IsCurrentMember', 'false')
      url.searchParams.set('take', '10')

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}.`)
      }

      const data = (await response.json()) as MembersSearchResponse
      setSearchResults(data.items ?? [])
      setSearchTotal(data.totalResults ?? 0)
      setStatusText(`Loaded ${data.items?.length ?? 0} search results from the Members API.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed.'
      setSearchError(message)
      setSearchResults([])
      setSearchTotal(null)
      setStatusText('Member search failed.')
    } finally {
      setSearchLoading(false)
    }
  }, [query])

  useEffect(() => {
    void runSearch('Truss')
  }, [runSearch])

  async function handleSelectMember(member: MemberSearchItem) {
    setSelectedMember(member)
    setResolvedMember(null)
    setPortraitUrl(null)
    setPortraitError(null)
    setRdfGraph(null)
    setGraphError(null)
    setGraphLoading(true)
    setSelectedNodeId(null)
    setStatusText(`Resolving identifiers for ${member.value.nameDisplayAs ?? member.value.nameListAs ?? 'selected member'}...`)

    try {
      const resolved = await resolveMemberIdentifiers(member.value.id)
      setResolvedMember(resolved)
      setStatusText(`Resolved RDF URI ${resolved.rdfUri}. Loading JSON-LD graph...`)

      const [graph, portrait] = await Promise.all([
        fetchMemberGraph(resolved.rdfUri),
        fetchPortraitUrl(member.value.id).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Portrait lookup failed.'
          setPortraitError(message)
          return null
        }),
      ])

      setRdfGraph(graph)
      setPortraitUrl(portrait)
      setStatusText(`Rendered ${graph.statementCount} RDF triples for ${member.value.nameDisplayAs ?? member.value.nameListAs}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the selected member.'
      setGraphError(message)
      setStatusText(message)
    } finally {
      setGraphLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <p className="eyebrow">UK Parliament Linked Data Prototype</p>
        <div className="hero-copy">
          <div>
            <h1>MP RDF Graph Viewer</h1>
            <p className="lede">
              Search for a parliamentarian, resolve the linked-data identifier, and inspect their RDF graph as an in-browser network.
            </p>
          </div>
          <div className="status-card">
            <span className="status-label">Status</span>
            <p>{statusText}</p>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="control-panel">
          <form
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault()
              void runSearch()
            }}
          >
            <label htmlFor="member-search">Member Search</label>
            <div className="search-row">
              <input
                id="member-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by surname or full name"
              />
              <button type="submit" disabled={searchLoading}>
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
            <p className="hint">Source: `members-api.parliament.uk/api/Members/Search`</p>
            {searchError ? <p className="error-text">{searchError}</p> : null}
          </form>

          <div className="result-summary">
            <span>Results</span>
            <strong>{searchTotal ?? '—'}</strong>
          </div>

          <div className="results-list">
            {searchResults.map((result) => {
              const isActive = selectedMember?.value.id === result.value.id
              return (
                <button
                  type="button"
                  key={result.value.id}
                  className={`member-card${isActive ? ' active' : ''}`}
                  onClick={() => void handleSelectMember(result)}
                >
                  <span className="member-name">{result.value.nameDisplayAs ?? result.value.nameListAs}</span>
                  <span className="member-meta">{result.value.latestParty?.name ?? 'Unknown party'}</span>
                  <span className="member-meta">{houseLabel(result.value.latestHouseMembership?.house)}</span>
                  <span className="member-meta">{result.value.latestHouseMembership?.membershipFrom ?? 'No current seat'}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="graph-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Graph</p>
              <h2>Resource network</h2>
            </div>
            {resolvedMember ? (
              <dl className="identifier-list">
                <div>
                  <dt>Members API ID</dt>
                  <dd>{resolvedMember.membersApiId}</dd>
                </div>
                <div>
                  <dt>MNIS ID</dt>
                  <dd>{resolvedMember.memberMnisId}</dd>
                </div>
                <div>
                  <dt>RDF Local ID</dt>
                  <dd>{resolvedMember.rdfLocalId}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          {graphError ? <p className="error-text padded">{graphError}</p> : null}
          {graphLoading ? <p className="padded">Loading graph…</p> : null}
          {!graphLoading && !rdfGraph ? (
            <p className="padded muted">Select a member to render their RDF graph.</p>
          ) : null}
          <div ref={graphRef} className="graph-canvas" />
        </section>

        <aside className="detail-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Inspect</p>
              <h2>Node details</h2>
            </div>
          </div>

          {portraitUrl ? (
            <figure className="portrait-frame">
              <img src={portraitUrl} alt={selectedMember?.value.nameDisplayAs ?? 'Member portrait'} />
            </figure>
          ) : null}
          {portraitError ? <p className="muted">Portrait unavailable: {portraitError}</p> : null}

          {selectedDetails ? (
            <>
              <div className="detail-block">
                <h3>{selectedDetails.node.label}</h3>
                <p className="term-kind">{selectedDetails.node.kind}</p>
                <p className="term-value">{selectedDetails.node.iri ?? selectedDetails.node.value}</p>
                {selectedDetails.node.datatype ? <p className="term-value">Datatype: {selectedDetails.node.datatype}</p> : null}
                {selectedDetails.node.language ? <p className="term-value">Lang: {selectedDetails.node.language}</p> : null}
              </div>

              <div className="detail-block">
                <h3>RDF Types</h3>
                {selectedDetails.node.types.length > 0 ? (
                  <ul className="chips">
                    {selectedDetails.node.types.map((type) => (
                      <li key={type}>{compactIri(type)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No explicit rdf:type triples.</p>
                )}
              </div>

              <StatementList title="Outgoing triples" statements={selectedDetails.outgoing} />
              <StatementList title="Incoming triples" statements={selectedDetails.incoming} />
            </>
          ) : (
            <p className="muted">Click a graph node to inspect its triples.</p>
          )}
        </aside>
      </main>
    </div>
  )
}

function StatementList({ title, statements }: { title: string; statements: $rdf.Statement[] }) {
  return (
    <div className="detail-block">
      <h3>{title}</h3>
      {statements.length > 0 ? (
        <ul className="statement-list">
          {statements.map((statement, index) => (
            <li key={`${statement.subject.value}-${statement.predicate.value}-${statement.object.value}-${index}`}>
              <code>{compactIri(statement.predicate.value)}</code>
              <span>{termToDisplay(statement.object)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No triples in this direction.</p>
      )}
    </div>
  )
}

async function resolveMemberIdentifiers(membersApiId: number): Promise<ResolvedMember> {
  const url = new URL('https://api.parliament.uk/odata/Member')
  url.searchParams.set('$filter', `MemberMnisId eq '${membersApiId}'`)
  url.searchParams.set('$select', 'LocalId,MemberMnisId,PersonGivenName,PersonFamilyName')
  url.searchParams.set('$top', '1')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`OData lookup failed with status ${response.status}.`)
  }

  const data = (await response.json()) as ODataMemberLookupResponse
  const match = data.value?.[0]
  if (!match?.LocalId || !match.MemberMnisId) {
    throw new Error('Unable to resolve the RDF identifier from the selected member.')
  }

  return {
    membersApiId,
    memberMnisId: match.MemberMnisId,
    rdfLocalId: match.LocalId,
    rdfUri: `${PARLIAMENT_BASE}${match.LocalId}`,
  }
}

async function fetchPortraitUrl(membersApiId: number): Promise<string | null> {
  const response = await fetch(`https://members-api.parliament.uk/api/Members/${membersApiId}/PortraitUrl`)
  if (!response.ok) {
    throw new Error(`Portrait lookup failed with status ${response.status}.`)
  }

  const data = (await response.json()) as PortraitUrlResponse
  return data.value ?? null
}

async function fetchMemberGraph(rdfUri: string): Promise<GraphModel> {
  const url = new URL('https://api.parliament.uk/query/resource')
  url.searchParams.set('uri', rdfUri)
  url.searchParams.set('format', 'application/ld+json')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`RDF fetch failed with status ${response.status}.`)
  }

  const text = await response.text()
  const store = $rdf.graph()

  await new Promise<void>((resolve, reject) => {
    $rdf.parse(text, store, rdfUri, 'application/ld+json', (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

  const statements = store.statementsMatching(undefined, undefined, undefined, undefined)
  if (statements.length === 0) {
    throw new Error('The RDF response contained no statements.')
  }

  return buildGraphModel(store, statements)
}

function buildGraphModel(store: $rdf.IndexedFormula, statements: $rdf.Statement[]): GraphModel {
  const nodeMap = new Map<string, GraphNodeData>()
  const edgeMap = new Map<string, GraphEdgeData>()
  const statementsByNode = new Map<string, $rdf.Statement[]>()
  const labelCache = new Map<string, string>()
  const typeMap = new Map<string, Set<string>>()
  const weightMap = new Map<string, number>()

  for (const statement of statements) {
    if (statement.predicate.value === RDF_TYPE) {
      const nodeId = termToNodeId(statement.subject)
      if (!typeMap.has(nodeId)) {
        typeMap.set(nodeId, new Set())
      }
      typeMap.get(nodeId)!.add(statement.object.value)
    }
  }

  for (const statement of statements) {
    const subjectId = termToNodeId(statement.subject)
    const objectId = termToNodeId(statement.object)

    const subjectNode = ensureNode(store, statement.subject, typeMap, labelCache)
    const objectNode = ensureNode(store, statement.object, typeMap, labelCache)

    nodeMap.set(subjectId, subjectNode)
    nodeMap.set(objectId, objectNode)

    statementsByNode.set(subjectId, [...(statementsByNode.get(subjectId) ?? []), statement])
    statementsByNode.set(objectId, [...(statementsByNode.get(objectId) ?? []), statement])

    weightMap.set(subjectId, (weightMap.get(subjectId) ?? 0) + 1)
    weightMap.set(objectId, (weightMap.get(objectId) ?? 0) + 1)

    const edgeId = `${subjectId}::${statement.predicate.value}::${objectId}::${edgeMap.size}`
    edgeMap.set(edgeId, {
      id: edgeId,
      source: subjectId,
      target: objectId,
      predicate: statement.predicate.value,
      predicateLabel: compactIri(statement.predicate.value),
    })
  }

  const elements: ElementDefinition[] = []
  for (const node of nodeMap.values()) {
    elements.push({
      data: {
        id: node.id,
        label: truncate(node.label, 52),
        kind: node.kind,
        weight: Math.min(weightMap.get(node.id) ?? 1, 12),
      },
      classes: '',
    })
  }

  for (const edge of edgeMap.values()) {
    elements.push({
      data: edge,
    })
  }

  return {
    elements,
    nodes: Object.fromEntries([...nodeMap.entries()]),
    edges: Object.fromEntries([...edgeMap.entries()]),
    statementsByNode: Object.fromEntries([...statementsByNode.entries()]),
    statementCount: statements.length,
  }
}

function ensureNode(
  store: $rdf.IndexedFormula,
  term: GraphTerm,
  typeMap: Map<string, Set<string>>,
  labelCache: Map<string, string>,
): GraphNodeData {
  const id = termToNodeId(term)
  const types = [...(typeMap.get(id) ?? new Set<string>())]

  if (term.termType === 'Literal') {
    return {
      id,
      label: term.value,
      kind: 'literal',
      value: term.value,
      datatype: 'datatype' in term && term.datatype ? term.datatype.value : undefined,
      language: 'language' in term ? term.language : undefined,
      types,
    }
  }

  if (term.termType === 'BlankNode') {
    return {
      id,
      label: `_:${term.value}`,
      kind: 'blank',
      iri: undefined,
      types,
    }
  }

  const iri = term.value
  let label = labelCache.get(iri)
  if (!label) {
    label = lookupLabel(store, iri) ?? compactIri(iri)
    labelCache.set(iri, label)
  }

  return {
    id,
    label,
    kind: 'named',
    iri,
    types,
  }
}

function lookupLabel(store: $rdf.IndexedFormula, iri: string): string | null {
  const subject = $rdf.sym(iri)
  const preferred = [RDFS_LABEL, SCHEMA_NAME]

  for (const predicate of preferred) {
    const match = store.any(subject, $rdf.sym(predicate), undefined)
    if (match?.termType === 'Literal') {
      return match.value
    }
  }

  return null
}

function termToNodeId(term: GraphTerm): string {
  if (term.termType === 'NamedNode') {
    return `named:${term.value}`
  }
  if (term.termType === 'BlankNode') {
    return `blank:${term.value}`
  }
  if (term.termType === 'Literal') {
    const datatype = 'datatype' in term && term.datatype ? term.datatype.value : ''
    const language = 'language' in term ? term.language : ''
    return `literal:${term.value}|${datatype}|${language}`
  }
  return `${term.termType}:${term.value}`
}

function termToDisplay(term: GraphTerm): string {
  if (term.termType === 'Literal') {
    return truncate(term.value, 120)
  }
  return compactIri(term.value)
}

function compactIri(value: string): string {
  if (value.startsWith(PARLIAMENT_BASE)) {
    return value.slice(PARLIAMENT_BASE.length)
  }
  if (value.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#')) {
    return `rdf:${value.split('#')[1]}`
  }
  if (value.startsWith('http://www.w3.org/2000/01/rdf-schema#')) {
    return `rdfs:${value.split('#')[1]}`
  }
  if (value.includes('#')) {
    return value.split('#').pop() ?? value
  }
  if (value.endsWith('/')) {
    const trimmed = value.slice(0, -1)
    return trimmed.split('/').pop() ?? value
  }
  return value.split('/').pop() ?? value
}

function houseLabel(house?: number): string {
  if (house === 1) {
    return 'House of Commons'
  }
  if (house === 2) {
    return 'House of Lords'
  }
  return 'Unknown house'
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function highlightSelectedNode(cy: Core, nodeId: string) {
  cy.elements().removeClass('selected')
  const node = cy.$id(nodeId)
  if (node.length > 0) {
    node.addClass('selected')
    node.connectedEdges().addClass('selected')
  }
}

export default App
