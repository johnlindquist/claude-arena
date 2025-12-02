# Form Validation System - Quick Start

## Files Created

1. **`src/validation.ts`** - Complete validation module (323 lines)
2. **`src/validation.example.ts`** - Comprehensive usage examples
3. **`VALIDATION_SUMMARY.md`** - Full documentation
4. **`QUICK_START.md`** - This file

## Basic Usage

```typescript
import { validateRegistrationForm } from "./src/validation";

// Validate entire form
const result = validateRegistrationForm({
  email: "user@example.com",
  password: "MyPassword123",
  confirmPassword: "MyPassword123",
  age: 25,
  role: "admin",
});

if (result.success) {
  // ✅ Type-safe validated data
  console.log(result.data.email); // string
  console.log(result.data.role);  // "admin" | "user"
} else {
  // ❌ Array of field errors
  result.errors.forEach(error => {
    console.error(`${error.field}: ${error.message}`);
  });
}
```

## Real-Time Field Validation

```typescript
import { validateField, validateSingleFieldWithErrors } from "./src/validation";

// Simple result (true/false)
const emailResult = validateField("email", userInput);

// Detailed error info
const emailWithErrors = validateSingleFieldWithErrors("email", userInput);
if (!emailWithErrors.isValid) {
  displayError(emailWithErrors.errors[0].message);
}
```

## Validation Rules Summary

| Field | Required | Rules |
|-------|----------|-------|
| **email** | ✅ | Valid format (user@example.com), trimmed |
| **password** | ✅ | 8+ chars, at least 1 number |
| **confirmPassword** | ✅ | Must match password |
| **age** | ❌ | If provided: 18-120, whole number |
| **role** | ✅ | Either "admin" or "user" |

## Key Features

### 1️⃣ Discriminated Union Result
```typescript
// Result is either success OR failure - can't be both
type ValidationResult =
  | { success: true; data: ValidRegistrationForm }
  | { success: false; errors: FieldError[] }
```

### 2️⃣ Type-Safe After Validation
```typescript
if (result.success) {
  // TypeScript knows result.data.email is a string
  // TypeScript knows result.data.role is "admin" | "user"
  // This prevents runtime errors!
}
```

### 3️⃣ Field-Specific Errors
```typescript
// Each error tells you exactly which field and why
errors: [
  { field: "email", message: "Email must be in valid format..." },
  { field: "password", message: "Password must be at least 8 characters..." },
]
```

### 4️⃣ Optional Fields
```typescript
// Age is optional - form is valid without it
const form = {
  email: "user@example.com",
  password: "Password123",
  confirmPassword: "Password123",
  role: "user",
  // age omitted - OK!
};
```

### 5️⃣ Cross-Field Validation
```typescript
// confirmPassword is validated against password
validateField("confirmPassword", userInput, {
  password: formData.password,
});
```

## API Functions

### `validateRegistrationForm(form)`
Validates the entire form and returns all errors.
- Returns: `{ success: true; data } | { success: false; errors }`

### `validateField(fieldName, value, context?)`
Validates a single field in real-time.
- Returns: `{ success: true } | { success: false; message }`

### `validateSingleFieldWithErrors(fieldName, value, formData?)`
Validates a single field with detailed error structure.
- Returns: `{ isValid: boolean; errors: FieldError[] }`

### `getFieldErrorMessages(fieldName, form)`
Gets all error messages for a field as strings.
- Returns: `string[]`

## Example: React Form

```typescript
import { useState } from "react";
import { validateSingleFieldWithErrors } from "./src/validation";

function RegisterForm() {
  const [form, setForm] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // Real-time validation
    const validation = validateSingleFieldWithErrors(name, value, form);
    setFieldErrors(prev => ({
      ...prev,
      [name]: validation.errors,
    }));
  };

  return (
    <form>
      <input
        name="email"
        onChange={handleFieldChange}
        aria-invalid={fieldErrors.email?.length > 0}
      />
      {fieldErrors.email?.map((err, i) => (
        <p key={i} className="error">{err.message}</p>
      ))}
    </form>
  );
}
```

## Testing

The validation system is thoroughly tested with:
- Valid form submission
- Optional field handling
- Email format validation
- Password strength validation
- Cross-field validation (password matching)
- Age range validation (18-120)
- Role constraint validation ("admin" | "user")
- Multiple simultaneous errors
- Edge cases (trimming, null handling, boundaries)

## Type Safety Benefits

✅ **After validation succeeds**, TypeScript knows:
- `email` is a non-empty string
- `password` is at least 8 characters with a number
- `confirmPassword` matches password
- `role` is exactly "admin" or "user" (not just any string)
- `age` is undefined OR between 18-120

❌ **Before validation**, the form could be:
- Missing fields
- Invalid email format
- Password too weak
- Passwords don't match
- Invalid role value
- Age out of range

This prevents entire classes of bugs!

## Next Steps

1. Import validation functions into your forms
2. Call `validateRegistrationForm` on form submission
3. Use `validateField` for real-time validation feedback
4. Type safety automatically prevents invalid states
