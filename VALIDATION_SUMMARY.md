# Form Validation System

A comprehensive TypeScript form validation system for user registration with proper type safety and field-specific error reporting.

## Files

- **`src/validation.ts`** - Main validation module with all validation logic
- **`src/validation.example.ts`** - Comprehensive examples showing all use cases

## Features

### ✅ Type-Safe Validation

Uses **discriminated unions** to make invalid states impossible:

```typescript
type ValidationResult =
  | { success: true; data: ValidRegistrationForm }
  | { success: false; errors: FieldError[] };
```

### ✅ Full-Form Validation

Validates entire form with all field errors in one call:

```typescript
const result = validateRegistrationForm({
  email: "user@example.com",
  password: "MyPassword123",
  confirmPassword: "MyPassword123",
  age: 25,
  role: "admin",
});

if (result.success) {
  // All fields are valid and properly typed
  console.log(result.data.email); // TypeScript knows it's a string
} else {
  // Get all validation errors
  result.errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
}
```

### ✅ Single-Field Validation

Validate individual fields in real-time as the user types:

```typescript
const result = validateField("email", "user@example.com");
// { success: true } | { success: false; message: string }
```

With detailed error reporting:

```typescript
const result = validateSingleFieldWithErrors("email", "invalid");
// { isValid: false, errors: [{ field: "email", message: "..." }] }
```

### ✅ Cross-Field Validation

Handles dependencies between fields (e.g., confirmPassword must match password):

```typescript
validateField("confirmPassword", userInput, {
  password: formData.password,
});
```

### ✅ Optional Fields

Age is optional; validation only runs if provided:

```typescript
const form = {
  email: "user@example.com",
  password: "Password123",
  confirmPassword: "Password123",
  role: "user",
  // age is omitted - this is valid
};

validateRegistrationForm(form); // ✓ Passes
```

## Validation Rules

### Email
- ✓ Required
- ✓ Must be valid format (user@example.com)
- ✓ Trimmed of whitespace

### Password
- ✓ Required
- ✓ At least 8 characters
- ✓ Must contain at least one number

### Confirm Password
- ✓ Required
- ✓ Must match password exactly

### Age (Optional)
- ✓ If provided: must be between 18-120
- ✓ Must be a whole number
- ✓ Can be omitted

### Role
- ✓ Required
- ✓ Must be exactly "admin" or "user"

## Field Error Structure

```typescript
interface FieldError {
  field: string;
  message: string;
}
```

## API Reference

### `validateRegistrationForm(form: RegistrationForm): ValidationResult`

Main validation function. Validates all fields and returns either validated data or all errors.

### `validateField(fieldName, value, context?): { success: boolean } | { success: boolean; message: string }`

Validates a single field. Returns a simple success/failure result.

### `validateSingleFieldWithErrors(fieldName, value, formData?): { isValid: boolean; errors: FieldError[] }`

Validates a single field with detailed error information.

### `getFieldErrorMessages(fieldName, form): string[]`

Convenience function to get all error messages for a field.

## Usage Example

```typescript
import { validateRegistrationForm } from "./validation";

// In a form handler
const handleSubmit = (formData) => {
  const result = validateRegistrationForm(formData);

  if (result.success) {
    // Form is valid - send to server
    await submitForm(result.data);
  } else {
    // Display errors
    const errorMap = new Map();
    result.errors.forEach(error => {
      if (!errorMap.has(error.field)) {
        errorMap.set(error.field, []);
      }
      errorMap.get(error.field).push(error.message);
    });

    // errorMap now has field -> messages[] for rendering
  }
};
```

## Type Exports

```typescript
// Input form (may have invalid values)
interface RegistrationForm {
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: number;
  role?: string;
}

// Valid, typed form data (only after successful validation)
interface ValidRegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  age?: number;
  role: "admin" | "user"; // Literal type
}

// Validation result (discriminated union)
type ValidationResult = /* ... */;

// Field error
interface FieldError {
  field: string;
  message: string;
}
```

## Benefits

- **Type Safety**: Discriminated unions prevent handling invalid states
- **Clear Success/Failure**: `success` field makes intent obvious
- **Field-Specific Errors**: Know exactly which field failed and why
- **Real-Time Validation**: Single-field validators for responsive UX
- **Cross-Field Validation**: Handles dependencies like password matching
- **Optional Fields**: Age field is optional but validated when present
- **Trimming**: Automatically trims whitespace from string fields
- **Literal Types**: Role is typed as `"admin" | "user"`, not just `string`
