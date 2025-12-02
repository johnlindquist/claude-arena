// ============================================================================
// Type Definitions
// ============================================================================

export type Command = CreateCommand | ListCommand | DeleteCommand;

export type CreateCommand = {
  readonly type: "create";
  readonly name: string;
};

export type ListCommand = {
  readonly type: "list";
  readonly filter?: string;
};

export type DeleteCommand = {
  readonly type: "delete";
  readonly id: number;
};

export type ParseResult =
  | { readonly success: true; readonly command: Command }
  | { readonly success: false; readonly error: string };
