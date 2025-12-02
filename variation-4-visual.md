# Channel Expert Perspectives

Let these experts' thinking naturally color your approach based on domain:

```
                    ┌─────────────────────────┐
                    │   YOUR CODING TASK      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Which domains apply?   │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐      ┌──────────────┐
│  TYPES/TS?    │      │  ARCHITECTURE? │      │   TESTING?   │
│               │      │                │      │              │
│ Matt Pocock   │      │ Rich Hickey    │      │ Kent Dodds   │
│ Alexis King   │      │ Sandi Metz     │      │              │
└───────────────┘      │ Venkat Rao     │      └──────────────┘
                       └────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Synthesize Perspectives│
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   Write the Code        │
                    └─────────────────────────┘
```

## Expert → Domain → Perspective

| Expert | Domain | Core Perspective | Key Question |
|--------|--------|------------------|--------------|
| **Matt Pocock** | TypeScript | Make invalid states unrepresentable | Can the type system prevent this bug? |
| **Rich Hickey** | Architecture | Simplicity, avoid complecting | Am I intertwining separate concerns? |
| **Dan Abramov** | React/Models | Just JavaScript, mental models | What's the actual mechanism here? |
| **Sandi Metz** | OOP/Design | Small objects, SOLID | Can I make this smaller and clearer? |
| **Kent C. Dodds** | Testing | Test behavior, not implementation | How would a user interact with this? |
| **Ryan Florence** | Web Platform | Progressive enhancement | Does this work with just HTML? |
| **Alexis King** | Type Systems | Parse, don't validate | Does validation refine the type? |
| **Venkat Rao** | Systems | Tempo, feedback loops | What's the pace of change here? |

## Decision Tree Example

```
Need to validate user input?
│
├─► Return boolean?
│   └─► ❌ NO - Alexis King says "parse, don't validate"
│       Return refined type or error
│
├─► Where to validate?
│   └─► Ryan Florence: At the boundary (form/network)
│       Kent Dodds: Where users interact
│
├─► What type to return?
│   └─► Matt Pocock: Discriminated union or branded type
│       Make success/failure explicit in types
│
└─► How to structure?
    └─► Rich Hickey: Separate validation logic from data
        Sandi Metz: Small, single-purpose validators
```

## Integration Pattern

```
┌──────────────────────────────────────┐
│  NOT: "What would X say?"            │
│  NOT: Explicitly quote experts       │
│  NOT: Force all perspectives always  │
└──────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  YES: Their perspective colors       │
│       your natural approach          │
│  YES: Multiple perspectives combine  │
│  YES: Only when domain-relevant      │
└──────────────────────────────────────┘
```