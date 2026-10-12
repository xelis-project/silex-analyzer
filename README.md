# silex-analyzer

Silex language support for the [XELIS VM](https://github.com/xelis-project/xelis-vm).

Silex is the Rust-inspired language compiled to XVM bytecode. Source files use the
`.slx` extension; compiled modules use `.slxc`.

Compiler-backed analysis and editor assistance for Silex.

## Features

### Syntax highlighting

- Functions, entry points, hooks and receivers (`fn`, `pub fn`, `entry`, `hook`, `fn (v T)`)
- Struct and enum declarations, variants and generics (`Entry<K, V>`, `Result<T, E>`)
- Control flow (`if`, `else`, `for`, `foreach`, `in`, `while`, `break`, `continue`, `return`)
- Pattern matching (`match` / `=>`)
- Closures (`|x: u64| -> u64 { ... }`)
- Built-in types (`bool`, `u8`–`u256`, `string`, `bytes`, `optional<T>`, `range<T>`, `map<K, V>`, `closure`, tuples, arrays)
- Literals: typed and hex/binary numbers (`0x10u64`, `100_000_000u128`), strings, byte strings (`b"Hi"`), booleans, `null`
- Operators: arithmetic, comparison, logical, bitwise, shifts, compound assignment, ternary, ranges, casts (`as`)
- Line and block comments

### IntelliSense

- Hover documentation for keywords, types, values and builtin functions/methods
- Completion for keywords, types, user-defined symbols, free functions, builtin methods and static functions
- Signature help for builtin and user-defined functions
- Document symbols (outline) and workspace symbols for functions, hooks, structs, enums and constants
- Go-to-definition and find-references for user-defined symbols
- Folding ranges for `{ ... }` blocks and `// region` markers
- Receiver-aware method completion based on `let`/`const` type annotations
- Semantic tokens for declarations, builtin calls and methods on top of the grammar
- Occurrence highlighting for the symbol under the cursor

### Diagnostics

- Unmatched and unclosed `()`, `{}` and `[]` (ignoring strings and comments)
- Duplicate declarations, unknown function calls, builtin arity mismatches and unused variables
- Quick fixes for stray brackets and unused `let` bindings, preserving initializer side effects
- Debounced CLI compiler errors for saved and unsaved buffers, with locations in the Problems panel
- Compiler results replace heuristic semantic warnings; unused-variable lint remains active

Install the [Silex CLI](https://github.com/xelis-project/silex-cli):

```bash
cargo install --git https://github.com/xelis-project/silex-cli --bin silex-cli
```

The default executable is `silex-cli`. Set `silex-analyzer.cliPath` to its absolute path if Cargo’s bin directory is absent from VS Code’s PATH (typically `/home/<username>/.cargo/bin/silex-cli`). Compiler checks never run your program or write artifacts into your workspace.

Settings:

- `silex-analyzer.cliPath`: CLI executable path
- `silex-analyzer.diagnostics.enable`: enable diagnostics (default `true`)
- `silex-analyzer.diagnostics.delay`: edit debounce in milliseconds (default `400`)

Run **Silex Analyzer: Check Current File** to refresh diagnostics. CLI execution requires a trusted workspace. If the CLI is missing, local lint and IntelliSense remain available; details appear in the `silex-analyzer` output channel. The current CLI reports its first compiler error as text; errors without a source location appear at the start of the file.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test          # compiles, then runs grammar and language tests
```

Press `F5` to launch the extension host with the example folder.

## Tests

`npm test` runs three suites:

- `test/analyzer.test.cjs` covers compiler error spans, unsaved buffers, cancellation, missing executables and temporary-file cleanup with a fixture CLI.
- `test/grammar.test.cjs` tokenizes real Silex constructs with `vscode-textmate` and asserts scopes.
- `test/language.test.cjs` covers type classification, receiver inference, symbol scanning and builtin data.

Use examples from the [xelis-vm repository](https://github.com/xelis-project/xelis-vm)
(`examples/*.slx`).

## License

BSD 3-Clause. See [LICENSE](LICENSE).
