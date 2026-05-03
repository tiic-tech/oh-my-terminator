## ADDED Requirements

### Requirement: NodeType enumeration defines all graph node types

The system SHALL define a `NodeType` enum with exactly four values: `DIRECTORY`, `FILE`, `MODULE`, `EXTERNAL`.

#### Scenario: NodeType contains all required values
- **WHEN** the NodeType enum is referenced
- **THEN** it contains DIRECTORY, FILE, MODULE, and EXTERNAL values

### Requirement: EdgeType enumeration defines all relationship types

The system SHALL define an `EdgeType` enum with exactly seven values: `CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `RE_EXPORTS`, `DYNAMIC_IMPORTS`.

#### Scenario: EdgeType contains all required values
- **WHEN** the EdgeType enum is referenced
- **THEN** it contains CONTAINS, IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, RE_EXPORTS, and DYNAMIC_IMPORTS values

### Requirement: GraphNode interface defines node structure

The system SHALL define a `GraphNode` interface with the following required fields:
- `id`: string, unique identifier following format rules
- `type`: NodeType
- `path`: string, relative path for DIRECTORY/FILE/MODULE, module name for EXTERNAL
- `name`: string, display name
- `metadata`: optional object with kind, jsDoc, complexity, loc, isExported, deprecated, testFile, lastModifiedCommit, changeFrequency

#### Scenario: Node ID format follows type-specific rules
- **WHEN** a DIRECTORY node is created
- **THEN** its id follows format "DIRECTORY:relativePath"

#### Scenario: Node ID format for FILE type
- **WHEN** a FILE node is created
- **THEN** its id follows format "FILE:relativePath"

#### Scenario: Node ID format for MODULE type
- **WHEN** a MODULE node is created
- **THEN** its id follows format "MODULE:filePath#exportName"

#### Scenario: Node ID format for EXTERNAL type
- **WHEN** an EXTERNAL node is created
- **THEN** its id follows format "EXTERNAL:packageName"

### Requirement: GraphEdge interface defines edge structure

The system SHALL define a `GraphEdge` interface with the following required fields:
- `from`: string, source node ID
- `to`: string, target node ID
- `type`: EdgeType
- `metadata`: optional object with line, isDynamic, importSpecifier, coChangeCount

#### Scenario: Edge connects two valid nodes
- **WHEN** an edge is created
- **THEN** it references valid source and target node IDs

### Requirement: CodeGraph class manages nodes and edges

The system SHALL implement a `CodeGraph` class with the following data structures:
- `nodes`: Map<string, GraphNode>
- `edges`: GraphEdge[]
- `inEdges`: Map<string, GraphEdge[]> (reverse index: target node ID → incoming edges)
- `outEdges`: Map<string, GraphEdge[]> (forward index: source node ID → outgoing edges)
- `commitHash`: string
- `timestamp`: number

#### Scenario: CodeGraph initializes empty structures
- **WHEN** a new CodeGraph instance is created
- **THEN** nodes, edges, inEdges, outEdges are empty; commitHash and timestamp are set

### Requirement: addNode method adds nodes and maintains indexes

The system SHALL implement `addNode(node: GraphNode): void` that adds a node to the nodes Map and initializes empty arrays in inEdges and outEdges for that node ID.

#### Scenario: Adding a node updates nodes map
- **WHEN** addNode is called with a valid GraphNode
- **THEN** the node exists in the nodes Map with its ID as key

#### Scenario: Adding a node initializes edge indexes
- **WHEN** addNode is called
- **THEN** inEdges and outEdges Maps have empty arrays for the node ID

### Requirement: addEdge method adds edges and maintains indexes

The system SHALL implement `addEdge(edge: GraphEdge): void` that adds an edge to edges array and updates both outEdges (for source) and inEdges (for target).

#### Scenario: Adding edge updates forward index
- **WHEN** addEdge is called with edge {from: "A", to: "B"}
- **THEN** outEdges.get("A") contains the edge

#### Scenario: Adding edge updates reverse index
- **WHEN** addEdge is called with edge {from: "A", to: "B"}
- **THEN** inEdges.get("B") contains the edge

### Requirement: removeNode method removes nodes and cleans up edges

The system SHALL implement `removeNode(id: string): void` that removes the node from nodes Map, removes all edges where the node is source or target, and cleans up inEdges/outEdges indexes.

#### Scenario: Removing node deletes from nodes map
- **WHEN** removeNode is called with an existing node ID
- **THEN** the node no longer exists in the nodes Map

#### Scenario: Removing node removes related edges
- **WHEN** removeNode is called on node "A" that has outgoing edges to "B"
- **THEN** those edges are removed from the edges array

#### Scenario: Removing node cleans up indexes
- **WHEN** removeNode is called on node "A"
- **THEN** inEdges and outEdges no longer contain entries for "A"

### Requirement: removeEdgesForFile removes file-related edges

The system SHALL implement `removeEdgesForFile(filePath: string): void` that removes all edges where either source or target is a FILE or MODULE node with the given file path.

#### Scenario: Removing edges for file clears imports
- **WHEN** removeEdgesForFile is called with "src/utils.ts"
- **THEN** all IMPORTS edges involving FILE:src/utils.ts are removed

#### Scenario: Removing edges for file clears module edges
- **WHEN** removeEdgesForFile is called with "src/utils.ts"
- **THEN** all edges involving MODULE nodes under that file path are removed

### Requirement: toJSON serializes graph to JSON format

The system SHALL implement `toJSON(): SerializedCodeGraph` that converts nodes Map to array format and returns a JSON-serializable object with nodes, edges, commitHash, timestamp.

#### Scenario: Serialization produces valid JSON
- **WHEN** toJSON is called on a graph with nodes and edges
- **THEN** it returns an object that can be JSON.stringify'd without errors

#### Scenario: Serialization converts Map to array
- **WHEN** toJSON is called on a graph with nodes Map
- **THEN** nodes are serialized as [string, GraphNode][] array format

### Requirement: fromJSON deserializes JSON to CodeGraph

The system SHALL implement `static fromJSON(data: SerializedCodeGraph): CodeGraph` that reconstructs the graph from serialized format, restoring nodes Map, edges array, and rebuilding inEdges/outEdges indexes.

#### Scenario: Deserialization restores nodes map
- **WHEN** fromJSON is called with valid serialized data
- **THEN** the resulting CodeGraph has all nodes restored in the nodes Map

#### Scenario: Deserialization rebuilds indexes
- **WHEN** fromJSON is called with serialized data containing edges
- **THEN** inEdges and outEdges indexes are correctly rebuilt

#### Scenario: Round-trip serialization preserves data
- **WHEN** a CodeGraph is serialized with toJSON then deserialized with fromJSON
- **THEN** the resulting graph is identical to the original