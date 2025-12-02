# Form Validation System Guide

This guide demonstrates the form validation system implementation using TypeScript with discriminated unions and brand types.

## Overview

The validation system provides:
- **Type-safe validation** with discriminated unions (success vs failure states)
- **Brand types** to ensure values have been validated before use
- **Field-specific error messages** with support for multiple errors per field
- **Single-field and full-form validation** capabilities
- **Optional field support** (age field is optional)

## Core Types

```typescript
// Brand types ensure values have been validated
type Email = string & { readonly __brand: "Email" };
type ValidPassword = string & { readonly __brand: "ValidPassword" };
type ValidAge = number & { readonly __brand: "ValidAge" };
type Role = "admin" | "user";

// Success state with parsed data
type ValidationSuccess = {
  readonly success: true;
  readonly data: RegistrationForm;
};

// Failure state with field-specific errors
type ValidationFailure = {
  readonly success: false;
  readonly errors: Record<string, string[]>;
};

// Discriminated union - ensures you can't mix states
export type ValidationResult = ValidationSuccess | ValidationFailure;
```

## Usage Examples

### Full Form Validation

```typescript
import { validateRegistrationForm } from "./formValidation";

// Valid form
const validResult = validateRegistrationForm({
  email: "user@example.com",
  password: "securePass123",
  confirmPassword: "securePass123",
  age: 25,
  role: "user"
});

if (validResult.success) {
  // TypeScript knows validResult.data exists and is properly typed
  const { email, password, role, age } = validResult.data;
  console.log("Processing registration for:", email);
  // age is either ValidAge or null (since it's optional)
} else {
  // TypeScript knows validResult.errors exists
  console.error("Validation errors:", validResult.errors);
  // errors.email, errors.password, etc. are available
}
```

### Single Field Validation (Real-time)

```typescript
import { validateField } from "./formValidation";

// Validate email as user types
const emailErrors = validateField("email", userInput);
if (emailErrors.length > 0) {
  displayErrorMessages(emailErrors);
}
```

### Type-Safe Pattern Matching

```typescript
function processForm(result: ValidationResult) {
  // Discriminated union ensures type safety
  switch (result.success) {
    case true:
      // Inside this block, result.data is guaranteed to exist
      return submitForm(result.data);

    case false:
      // Inside this block, result.errors is guaranteed to exist
      displayErrors(result.errors);
      break;
  }
}
```

## Validation Rules

### Email
- **Required**: Must be provided
- **Format**: Must match email pattern (user@domain.extension)

### Password
- **Required**: Must be provided
- **Length**: Minimum 8 characters
- **Complexity**: Must contain at least one number

### Confirm Password
- **Required**: Must be provided
- **Match**: Must exactly match password field

### Age (Optional)
- **Optional**: Can be omitted (null is valid)
- **Range**: If provided, must be between 18-120
- **Type**: Must be a whole number

### Role
- **Required**: Must be provided
- **Values**: Must be exactly "admin" or "user"

## Error Handling Examples

### Single Field Error
```typescript
const result = validateRegistrationForm({
  email: "invalid-email",
  password: "securePass123",
  confirmPassword: "securePass123",
  role: "user"
});

// result.success === false
// result.errors.email === ["Email must be a valid format (e.g., user@example.com)"]
```

### Multiple Field Errors
```typescript
const result = validateRegistrationForm({
  email: "invalid",
  password: "weak",
  confirmPassword: "nomatch",
  age: 200,
  role: "superuser"
});

// result.success === false
// result.errors contains field-specific error arrays
```

### Optional Field Omitted
```typescript
const result = validateRegistrationForm({
  email: "user@example.com",
  password: "securePass123",
  confirmPassword: "securePass123",
  role: "user"
  // age is omitted
});

if (result.success) {
  console.log(result.data.age); // null
}
```

## Type Benefits

### 1. Discriminated Union Type Safety
Cannot accidentally have both success and failure in same object - TypeScript enforces one or the other.

### 2. Brand Types Prevent Misuse
```typescript
function sendEmail(email: Email) {
  // email is guaranteed to be validated
}

const result = validateRegistrationForm({ /* ... */ });
if (result.success) {
  sendEmail(result.data.email);  //  OK - guaranteed validated
}
```

### 3. Exhaustive Checking
TypeScript enforces handling both success and failure cases.

## Files Overview

- **`src/formValidation.ts`**: Core validation implementation with types, validators, and main functions
- **`src/formValidation.test.ts`**: Comprehensive test suite covering all validation scenarios
- **`FORM_VALIDATION_GUIDE.md`**: This guide with usage examples and best practices