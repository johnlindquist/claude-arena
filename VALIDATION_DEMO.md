# Form Validation System - Complete Guide

A TypeScript form validation system for user registration that uses **discriminated unions** to make invalid states impossible.

## Key Features

✅ **Discriminated Union Results** - `success: true | false` makes it impossible to access data without checking validity first
✅ **Field-Specific Errors** - Know exactly which fields failed and why
✅ **Handles Optional Fields** - Age is optional, others are required
✅ **Single Field Validation** - Real-time validation as user types
✅ **Type-Safe** - TypeScript ensures you handle all cases

## Type Definitions

```typescript
// Validated data - can only exist if validation succeeded
export interface ValidRegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  age?: number;
  role: "admin" | "user";
}

// Validation result - discriminated union
export type ValidationResult =
  | { success: true; data: ValidRegistrationForm }
  | { success: false; errors: FieldError[] };

// Single field result
type SingleFieldResult =
  | { success: true }
  | { success: false; message: string };
```

## Usage Examples

### Full Form Validation

```typescript
import { validateRegistrationForm } from "./validation";

// Valid form
const validResult = validateRegistrationForm({
  email: "user@example.com",
  password: "secure123",
  confirmPassword: "secure123",
  age: 25,
  role: "user"
});

if (validResult.success) {
  // TypeScript knows validResult.data exists and is properly typed
  const { email, password, role, age } = validResult.data;
  console.log(`User: ${email}, Role: ${role}, Age: ${age}`);
  // age is optional: age? number | undefined
}

// Invalid form
const invalidResult = validateRegistrationForm({
  email: "not-an-email",
  password: "short",
  confirmPassword: "mismatch",
  age: 10,
  role: "superuser"
});

if (!invalidResult.success) {
  // TypeScript knows invalidResult.errors exists
  invalidResult.errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
  // Output:
  // email: Email must be in valid format (e.g., user@example.com)
  // password: Password must be at least 8 characters long
  // confirmPassword: Passwords do not match
  // age: Age must be between 18 and 120
  // role: Role must be either "admin" or "user"
}
```

### Single Field Validation (Real-time)

Useful for instant feedback as users type:

```typescript
import { validateField } from "./validation";

// Validate email field
const emailResult = validateField("email", "test@example.com");
if (emailResult.success) {
  console.log("Email is valid!");
}

// Validate password with feedback
const passwordResult = validateField("password", "weak");
if (!passwordResult.success) {
  console.log(`Error: ${passwordResult.message}`);
  // "Error: Password must be at least 8 characters long"
}

// Validate confirm password (needs context)
const confirmResult = validateField("confirmPassword", "secure123", {
  password: "secure123"
});
if (confirmResult.success) {
  console.log("Passwords match!");
}
```

### Field-Specific Error Messages

```typescript
import { validateSingleFieldWithErrors, getFieldErrorMessages } from "./validation";

const formData = {
  email: "invalid",
  password: "short",
  confirmPassword: "nomatch",
  role: "admin"
};

// Get all errors for a specific field
const emailErrors = getFieldErrorMessages("email", formData);
console.log(emailErrors);
// ["Email must be in valid format (e.g., user@example.com)"]

// With full context
const errors = validateSingleFieldWithErrors("password", "p@ssw0rd", formData);
console.log(errors);
// { isValid: true, errors: [] }
```

## Validation Rules

### Email
- **Required**
- Must be valid email format (contains @ and domain)
- Examples: ✅ `user@example.com`, ✅ `admin@company.co.uk`
- Examples: ❌ `notanemail`, ❌ `user@`, ❌ `user @example.com`

### Password
- **Required**
- Must be at least 8 characters long
- Must contain at least one number
- Examples: ✅ `secure123`, ✅ `MyP@ss1`
- Examples: ❌ `short1`, ❌ `nNumbersHere`, ❌ `1234567` (no letters)

### Confirm Password
- **Required**
- Must match password exactly
- Examples: ✅ (matches password field)
- Examples: ❌ `different123`

### Age (Optional)
- If provided, must be a whole number between 18-120
- Can be `undefined` or omitted
- Examples: ✅ `25`, ✅ `undefined`, ✅ omitted
- Examples: ❌ `17`, ❌ `150`, ❌ `25.5`

### Role
- **Required**
- Must be exactly `"admin"` or `"user"`
- Case-sensitive
- Examples: ✅ `"admin"`, ✅ `"user"`
- Examples: ❌ `"Admin"`, ❌ `"moderator"`, ❌ `"superuser"`

## Architecture Highlights

### Discriminated Unions
The result type uses discriminated unions to guarantee type safety:

```typescript
const result = validateRegistrationForm(data);

// This WORKS - TypeScript knows success is true
if (result.success) {
  console.log(result.data.email); // ✅ No error
}

// This WON'T compile - data doesn't exist on error
if (!result.success) {
  console.log(result.data.email); // ❌ TypeScript error!
}
```

### Parser Pattern
Each field has a dedicated parser function that throws on invalid input:

```typescript
// Parser functions handle all validation logic
function parseEmail(value: unknown): string { ... }
function parsePassword(value: unknown): string { ... }
function parseConfirmPassword(value: unknown, password: string): string { ... }
function parseAge(value: unknown): number | undefined { ... }
function parseRole(value: unknown): "admin" | "user" { ... }
```

### Error Collection
All errors are collected before returning, so users get complete feedback:

```typescript
// Single validation failure shows only that error
{ success: false, errors: [{ field: "email", message: "..." }] }

// Multiple failures show all errors at once
{
  success: false,
  errors: [
    { field: "email", message: "..." },
    { field: "password", message: "..." },
    { field: "confirmPassword", message: "..." }
  ]
}
```

## Edge Cases Handled

✅ `null` or non-object input → Returns error
✅ Missing fields (undefined) → Returns error for required fields
✅ Empty strings `""` → Treated as missing
✅ Whitespace-only strings → Trimmed, then checked
✅ Age = 0, 17, 121 → All rejected correctly
✅ Age = 18, 120 → Boundary conditions accepted
✅ Floating point age like 25.5 → Rejected (must be integer)
✅ Role with different casing → Rejected (`"Admin"` vs `"admin"`)

## Type-Safe Usage Pattern

```typescript
import {
  validateRegistrationForm,
  validateField,
  type ValidationResult,
  type ValidRegistrationForm,
  type FieldError
} from "./validation";

function submitForm(formData: unknown) {
  const result = validateRegistrationForm(formData);

  // The type system forces you to handle both cases
  if (result.success) {
    // result.data is ValidRegistrationForm here
    return registerUser(result.data);
  } else {
    // result.errors is FieldError[] here
    return showErrors(result.errors);
  }
}

function registerUser(data: ValidRegistrationForm) {
  // All fields are guaranteed to be valid
  console.log(`Registered: ${data.email}, Role: ${data.role}`);
}

function showErrors(errors: FieldError[]) {
  errors.forEach(({ field, message }) => {
    console.log(`${field}: ${message}`);
  });
}
```

## Testing

The validation system includes comprehensive test coverage for:
- ✅ Valid forms (with and without optional fields)
- ✅ Invalid emails (missing, wrong format)
- ✅ Invalid passwords (too short, no number)
- ✅ Password mismatches
- ✅ Invalid ages (too young, too old, not integer)
- ✅ Invalid roles (wrong values)
- ✅ Multiple errors at once
- ✅ Single field validation
- ✅ Edge cases and boundaries

## Files

- `src/validation.ts` - Main validation system (exported functions and types)
- `src/formValidation.test.ts` - Comprehensive test suite with vitest
- `VALIDATION_DEMO.md` - This guide

## Summary

This validation system demonstrates professional TypeScript patterns:
- **Discriminated unions** for type safety
- **Parser pattern** for clean validation logic
- **Error collection** for complete user feedback
- **Optional fields** handled correctly
- **Type narrowing** to prevent invalid states
- **Comprehensive testing** of edge cases
