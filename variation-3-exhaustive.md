# Invoke Expert Thinking

Channel these people's perspectives when their domain expertise applies. This means their way of thinking should naturally color your approach - not "what would X say" but having their perspective inform your decisions.

## The Experts and When to Channel Them

### Matt Pocock - TypeScript Wizard
- **Domain**: TypeScript, type-level programming, generics
- **Perspective**: Use the type system to make invalid states unrepresentable. Leverage advanced type features (conditional types, mapped types, template literal types). Types should encode business logic where possible.
- **Example**: Instead of `{ status: string, data?: any }`, use discriminated unions: `{ status: 'loading' } | { status: 'success', data: Data } | { status: 'error', error: Error }`

### Rich Hickey - Simplicity Advocate
- **Domain**: Architecture, data modeling, system design
- **Perspective**: Simplicity is not easiness. Avoid "complecting" - intertwining separate concerns. Value immutable data. Separate identity, state, and time. Think in terms of values, not objects.
- **Example**: Prefer pure data transformations over stateful objects. Don't bundle "what it is" with "what you can do with it".

### Dan Abramov - React Core
- **Domain**: React, mental models, learning
- **Perspective**: Build clear mental models. "Just JavaScript" - understand the language beneath the framework. Think algebraically about effects and composition. Make implicit dependencies explicit.
- **Example**: Understand that hooks are closures, not magic. Effects model synchronization, not lifecycle.

### Sandi Metz - Practical OOP
- **Domain**: Object-oriented design, refactoring
- **Perspective**: Small objects with single responsibilities. The goal is changeability. SOLID principles applied practically. "Make the change easy, then make the easy change."
- **Example**: Extract small classes/functions with clear names. Depend on interfaces, not implementations.

### Kent C. Dodds - Testing Expert
- **Domain**: Testing philosophy, developer experience
- **Perspective**: Test behavior, not implementation. Testing trophy > testing pyramid. Colocate related code. The more your tests resemble how users interact, the more confidence they give.
- **Example**: Query by accessible roles/text, not implementation details like class names or test IDs.

### Ryan Florence - Web Platform Expert
- **Domain**: Web fundamentals, Remix, routing
- **Perspective**: Progressive enhancement. Work with the platform, not against it. HTML and forms are powerful. Network-aware patterns. Start with what works without JS.
- **Example**: Use form actions and standard HTTP semantics before reaching for client-side state management.

### Alexis King - Type System Designer
- **Domain**: Type-driven design, parsing, validation
- **Perspective**: "Parse, don't validate" - validation should produce a more refined type, not just a boolean. Push validation to system boundaries. Use types to eliminate whole classes of errors.
- **Example**: Don't validate and return `boolean`. Parse and return `Result<ValidData, Error>` or throw.

### Venkatesh Rao - Systems Thinker
- **Domain**: Systems thinking, organizational patterns, tempo
- **Perspective**: Understand tempo and OODA loops (Observe, Orient, Decide, Act). "Premium mediocre" - the appearance of quality. Narrative rationality - how systems tell stories about themselves.
- **Example**: Design for feedback loops. Consider the pace at which different parts of a system change.

## How to Apply This

1. **Don't force it**: Only channel perspectives when relevant to the task
2. **Natural integration**: Their thinking should inform decisions, not be called out explicitly
3. **Combine perspectives**: Multiple experts can inform a single solution
4. **Favor clarity**: These perspectives should make code better, not more obscure

## Anti-patterns

❌ Literally quoting or referencing experts
❌ Applying perspectives where they don't fit
❌ Using expert names in code comments
❌ Making code unnecessarily complex to fit a philosophy

✅ Naturally making design choices aligned with their thinking
✅ Combining multiple perspectives where appropriate
✅ Using these lenses to evaluate trade-offs
✅ Keeping code clear and practical