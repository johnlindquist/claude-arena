# Form Validation System

A type-safe TypeScript form validation system for user registration that uses discriminated unions to make invalid states impossible.

## Overview

This validation system provides:
- **Full form validation** with all fields checked at once
- **Single field validation** for real-time feedback
- **Type-safe results** using discriminated unions
- **Comprehensive error messages** for each field
- **Optional field support** for fields like age
- **Strict type enforcement** for roles (admin | user)

## Core Concepts

### Discriminated Union Pattern

The validation result uses a discriminated union to eliminate invalid state combinations:

```typescript
type ValidationResult =
  | {
      success: true;
      data: ValidRegistrationForm;
    }
  | {
      success: false;
      errors: FieldError[];
    };
```

This means:
- ✓ If `success: true`, you **must** have `data` and **cannot** have `errors`
- ✓ If `success: false`, you **must** have `errors` and **cannot** have `data`

TypeScript enforces this at compile time through type narrowing.

## Validation Rules

### Email
- **Type**: Required string
- **Rule**: Must match email format pattern (user@example.com)
- **Error examples**:
  - "Email must be a string"
  - "Email must be in valid format (e.g., user@example.com)"

### Password
- **Type**: Required string
- **Rules**:
  - Minimum 8 characters
  - Must contain at least one number
- **Error examples**:
  - "Password must be a string"
  - "Password must be at least 8 characters long"
  - "Password must contain at least one number"

### Confirm Password
- **Type**: Required string
- **Rule**: Must match password field
- **Error example**: "Confirm password must match password"

### Age
- **Type**: Optional number
- **Rules** (when provided):
  - Must be a whole number (no decimals)
  - Must be between 18 and 120
- **Valid states**:
  - Undefined (not provided) ✓
  - Null (not provided) ✓
  - Integer between 18-120 ✓
- **Error examples**:
  - "Age must be a whole number"
  - "Age must be between 18 and 120"

### Role
- **Type**: Required string literal
- **Allowed values**: "admin" or "user"
- **Error examples**:
  - "Role must be a string"
  - 'Role must be either "admin" or "user"'

## API Reference

### validateRegistrationForm(form: unknown): ValidationResult

Validates the complete registration form.

**Parameters:**
- `form`: Any value to validate (typically form data object)

**Returns:** Discriminated union result

**Example:**
```typescript
const result = validateRegistrationForm({
  email: "user@example.com",
  password: "secure123",
  confirmPassword: "secure123",
  role: "user"
});

if (result.success) {
  // result.data has type ValidRegistrationForm
  console.log(result.data.email);
} else {
  // result.errors has type FieldError[]
  result.errors.forEach(err => console.log(err.message));
}
```

### validateField(fieldName, value, context?): { success: true } | { success: false; message: string }

Validates a single field. Useful for real-time validation as user types.

**Parameters:**
- `fieldName`: Key of the field to validate
- `value`: The value to validate
- `context` (optional): Additional context (e.g., { password } for confirmPassword)

**Returns:** Simple discriminated union with success status

**Example:**
```typescript
// Validate email as user types
const result = validateField("email", "user@");
if (!result.success) {
  console.log(result.message);
}

// Validate password confirmation with context
const pwResult = validateField("confirmPassword", userInput, {
  password: currentPassword
});
```

## Usage Patterns

### Pattern 1: Full Form Submission

```typescript
function handleSubmit(formData: FormData) {
  const result = validateRegistrationForm({
    email: formData.email,
    password: formData.password,
    confirmPassword: formData.confirmPassword,
    age: formData.age,
    role: formData.role
  });

  if (result.success) {
    // Send validated data to server
    await api.register(result.data);
  } else {
    // Display field-specific errors
    result.errors.forEach(error => {
      showError(error.field, error.message);
    });
  }
}
```

### Pattern 2: Real-time Field Validation

```typescript
function handleEmailChange(email: string) {
  const result = validateField("email", email);

  if (result.success) {
    setEmailError(null);
  } else {
    setEmailError(result.message);
  }
}

function handlePasswordChange(password: string) {
  const result = validateField("password", password);

  if (result.success) {
    setPasswordError(null);
  } else {
    setPasswordError(result.message);
  }
}

function handleConfirmChange(confirm: string) {
  const result = validateField("confirmPassword", confirm, {
    password: currentPassword
  });

  if (result.success) {
    setConfirmError(null);
  } else {
    setConfirmError(result.message);
  }
}
```

### Pattern 3: Type-Safe Data Processing

```typescript
function processUser(data: unknown) {
  const result = validateRegistrationForm(data);

  // Type narrowing makes property access safe
  if (result.success) {
    const { email, password, role, age } = result.data;

    // All properties are properly typed
    return {
      username: email.split("@")[0],
      isAdmin: role === "admin",
      canVote: (age ?? 0) >= 18
    };
  }

  return null;
}
```

### Pattern 4: Progressive Form Validation

```typescript
const form = {
  email: "",
  password: "",
  confirmPassword: "",
  role: "user" as const
};

// Step 1: Validate email only (will fail)
let result = validateRegistrationForm(form);

// Step 2: Add password (will still fail - missing confirmPassword)
form.password = "secure123";
result = validateRegistrationForm(form);

// Step 3: Add confirmPassword (will succeed if password is valid)
form.confirmPassword = "secure123";
result = validateRegistrationForm(form);
```

## Type Definitions

### ValidRegistrationForm
The successfully validated form data.

```typescript
interface ValidRegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  age?: number;
  role: "admin" | "user";
}
```

### FieldError
A validation error for a specific field.

```typescript
interface FieldError {
  field: string;
  message: string;
}
```

### RegistrationForm
The input form data (all fields optional, unvalidated).

```typescript
interface RegistrationForm {
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: number;
  role?: string;
}
```

## Why Discriminated Unions?

Traditional validation approaches often use optional properties:

```typescript
// ❌ BAD: Allows impossible states
type BadResult = {
  success?: boolean;
  data?: Data;
  errors?: Error[];
};

// Can have data AND errors simultaneously!
const bad = { data: {...}, errors: [...] };
```

Discriminated unions eliminate this problem:

```typescript
// ✅ GOOD: Impossible states impossible
type GoodResult =
  | { success: true; data: Data }
  | { success: false; errors: Error[] };

// TypeScript ensures success: true means data exists
const good: GoodResult = { success: true, data: {...} };
// errors would be a type error here ✓
```

## Testing

The validation system includes comprehensive test coverage. Run tests with:

```bash
bunx tsx src/validation.test.ts
```

Test categories:
- **Full form validation**: Valid forms, missing fields, multiple errors
- **Individual field validation**: Email, password, age, role formats
- **Edge cases**: Boundary ages, optional fields, type coercion
- **Type narrowing**: Safe property access after validation

## Examples

See `examples/validation-examples.ts` for 10+ complete examples including:

1. Successful form validation
2. Form with optional fields
3. Error handling
4. Real-time field validation
5. Password confirmation
6. Age validation edge cases
7. Role validation
8. Type-safe result handling
9. Progressive form completion
10. Safe data extraction

Run examples:
```bash
bunx tsx examples/validation-examples.ts
```

## Integration with Forms

### React Example

```typescript
import { validateField, validateRegistrationForm } from './validation';

function RegistrationForm() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as const,
    age: undefined
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));

    // Real-time validation
    const result = validateField(field as any, value, { password: form.password });
    if (result.success) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    } else {
      setErrors(prev => ({ ...prev, [field]: result.message }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = validateRegistrationForm(form);
    if (result.success) {
      // Submit to server
      api.register(result.data);
    } else {
      const errorMap = result.errors.reduce((acc, err) => {
        acc[err.field] = err.message;
        return acc;
      }, {} as Record<string, string>);
      setErrors(errorMap);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form inputs with error display */}
    </form>
  );
}
```

## Best Practices

1. **Always check the discriminator first**
   ```typescript
   // ✓ Good
   if (result.success) {
     use(result.data);
   }

   // ✗ Bad
   use(result.data); // TypeScript error if not checked!
   ```

2. **Use real-time validation for user feedback**
   - Validate individual fields as users type
   - Provide immediate error messages
   - Check full form on submission

3. **Keep validators pure**
   - Validation functions should not have side effects
   - Return results, don't mutate state

4. **Provide context for dependent fields**
   - Pass password when validating confirmPassword
   - Pass current values to field validators

5. **Show field-specific errors**
   - Display error message next to the problematic field
   - Make it clear which validation rule failed

## File Structure

```
src/
├── validation.ts           # Main validation module
├── validation.ts           # Type definitions and exports
└── index.ts               # Public API

examples/
└── validation-examples.ts  # Comprehensive examples
```

## API Exports

```typescript
export { validateRegistrationForm, validateField };
export type { ValidRegistrationForm, FieldError, ValidationResult };
```

## Performance

- **Synchronous**: All validation is synchronous, no async operations
- **Fast**: Simple regex and type checks, O(1) complexity per field
- **No dependencies**: Pure TypeScript, no external libraries
- **Tree-shakeable**: Only import what you need

## Error Handling

The validation system handles various error conditions:

1. **Non-object input**: Returns appropriate error
2. **Missing required fields**: Reports all missing field errors
3. **Type errors**: Clear messages about expected types
4. **Validation failures**: Specific rules that weren't met
5. **Multiple errors**: Collects all errors, not just first one

## Future Enhancements

Potential extensions to the system:
- Async validation (email verification, username availability)
- Custom validators for domain-specific rules
- Internationalization (i18n) for error messages
- Schema-based validation with Zod/Yup
- Field-level meta information (label, placeholder, etc.)

## License

MIT
