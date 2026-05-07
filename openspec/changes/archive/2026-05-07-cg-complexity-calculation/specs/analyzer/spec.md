## MODIFIED Requirements

### Requirement: Parser registry
The system SHALL provide `ParserRegistry` for extensible parser selection.

#### Scenario: Register new parser
- **WHEN** system registers parser via `registry.register(parser)`
- **THEN** parser is available for all its declared extensions
- **AND** parser includes complexity calculation if implemented

#### Scenario: Select parser by extension
- **WHEN** system needs to parse file with extension `.ts`
- **THEN** `registry.getParser('.ts')` returns TypeScriptParser
- **AND** TypeScriptParser calculates complexity for MODULE nodes

#### Scenario: Unknown extension handled
- **WHEN** file has extension with no registered parser
- **THEN** system logs warning and skips the file
- **AND** no complexity calculation attempted

### Requirement: Integration with C1-C4
The system SHALL correctly integrate existing CodeGraph components.

#### Scenario: C3 Parser integration
- **WHEN** TypeScriptParser processes file
- **THEN** IMPORTS, RE_EXPORTS edges added, EXTERNAL nodes created for external deps
- **AND** MODULE nodes created with complexity metadata populated

#### Scenario: C4 ModuleExtractor integration
- **WHEN** TypeScriptParser processes file
- **THEN** MODULE nodes created for exported symbols with EXPORTS edges
- **AND** MODULE node kind is determined by detectKind() function
- **AND** each MODULE node with kind='function' or 'component' includes `metadata.complexity` field

#### Scenario: MODULE creation scope
- **WHEN** TypeScriptParser processes file with various exports
- **THEN** MODULE nodes created ONLY for exported symbols
- **AND** non-exported (private) symbols do NOT create MODULE nodes
- **AND** nested functions inside exported functions do NOT create separate MODULE nodes
- **AND** class methods do NOT create separate MODULE nodes

#### Scenario: Complexity metadata populated
- **WHEN** MODULE node has kind='function' or kind='component'
- **THEN** `metadata.complexity` field is populated with calculated value
- **AND** MODULE node with kind='class' has NO complexity metadata
- **AND** MODULE node with kind='interface' has NO complexity metadata
- **AND** MODULE node with kind='type' has NO complexity metadata
- **AND** MODULE node with kind='variable' has NO complexity metadata