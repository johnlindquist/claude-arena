# Validation API Reference

## Public Exports

### Types

#### `ValidationResult`
Discriminated union representing validation outcome.

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

#### `ValidRegistrationForm`
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

#### `FieldError`
Individual field validation error.

```typescript
interface FieldError {
  field: string;
  message: string;
}
```

#### `RegistrationForm`
Input form data type (unvalidated).

```typescript
interface RegistrationForm {
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: number;
  role?: string;
}
```

### Functions

#### `validateRegistrationForm(form: unknown): ValidationResult`

Validates the complete registration form.

**Parameters:**
- `form: unknown` - Any value to validate (typically form object)

**Returns:**
- `{ success: true; data: ValidRegistrationForm }` - All validations passed
- `{ success: false; errors: FieldError[] }` - One or more validations failed

**Example:**
```typescript
const result = validateRegistrationForm(formData);

if (result.success) {
  // result.data is ValidRegistrationForm
  const { email, password, role } = result.data;
} else {
  // result.errors is FieldError[]
  result.errors.forEach(err => console.log(err.message));
}
```

#### `validateField(fieldName: keyof ValidRegistrationForm, value: unknown, context?: { password?: string }): { success: true } | { success: false; message: string }`

Validates a single field for real-time feedback.

**Parameters:**
- `fieldName` - The field to validate
- `value` - The value to validate
- `context.password` (optional) - Password for confirmPassword validation

**Returns:**
- `{ success: true }` - Field is valid
- `{ success: false; message: string }` - Field is invalid with error message

**Example:**
```typescript
// Real-time email validation
const result = validateField("email", userInput);
if (!result.success) {
  setError(result.message);
}

// Confirm password validation with context
const pwResult = validateField("confirmPassword", input, {
  password: currentPassword
});
```

#### `validateSingleFieldWithErrors(fieldName: string, value: unknown, formData?: RegistrationForm): { isValid: boolean; errors: FieldError[] }`

Single field validation returning detailed error array.

**Parameters:**
- `fieldName` - Field name to validate
- `value` - Value to validate
- `formData` (optional) - Full form for context

**Returns:**
- `{ isValid: true; errors: [] }` - Field is valid
- `{ isValid: false; errors: FieldError[] }` - Field invalid with detailed errors

#### `getFieldErrorMessages(fieldName: string, form: RegistrationForm): string[]`

Get all error messages for a specific field.

**Parameters:**
- `fieldName` - Field to get errors for
- `form` - Form data

**Returns:**
- Array of error message strings

## Usage Patterns

### Pattern 1: Form Submission Handler

```typescript
import { validateRegistrationForm } from './src/validation';

function handleSubmit(formData: unknown) {
  const result = validateRegistrationForm(formData);

  if (result.success) {
    // Process validated data
    sendToServer(result.data);
  } else {
    // Display errors
    displayErrors(result.errors);
  }
}
```

### Pattern 2: Real-time Field Validation

```typescript
import { validateField } from './src/validation';

function handleFieldChange(field: string, value: string) {
  const result = validateField(field, value, { password });

  if (result.success) {
    clearError(field);
  } else {
    showError(field, result.message);
  }
}
```

### Pattern 3: Type-Safe Data Processing

```typescript
import { validateRegistrationForm } from './src/validation';
import type { ValidRegistrationForm } from './src/validation';

function processValidated(data: unknown): ProcessResult {
  const validation = validateRegistrationForm(data);

  if (!validation.success) {
    return { ok: false, errors: validation.errors };
  }

  // validation.data is fully typed as ValidRegistrationForm
  const user = createUser(validation.data);
  return { ok: true, user };
}
```

### Pattern 4: React Component

```typescript
import { useState } from 'react';
import { validateField, validateRegistrationForm } from './src/validation';

export function RegistrationForm() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as const,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // Real-time validation
    const result = validateField(name, value, { password: form.password });
    if (result.success) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    } else {
      setErrors(prev => ({ ...prev, [name]: result.message }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = validateRegistrationForm(form);
    if (result.success) {
      // Submit result.data to server
      submitForm(result.data);
    } else {
      // Collect and display errors
      const errorMap = result.errors.reduce((acc, err) => {
        acc[err.field] = err.message;
        return acc;
      }, {} as Record<string, string>);
      setErrors(errorMap);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="email"
        type="email"
        value={form.email}
        onChange={handleFieldChange}
      />
      {errors.email && <span className="error">{errors.email}</span>}

      <input
        name="password"
        type="password"
        value={form.password}
        onChange={handleFieldChange}
      />
      {errors.password && <span className="error">{errors.password}</span>}

      <input
        name="confirmPassword"
        type="password"
        value={form.confirmPassword}
        onChange={handleFieldChange}
      />
      {errors.confirmPassword && <span className="error">{errors.confirmPassword}</span>}

      <select name="role" value={form.role} onChange={handleFieldChange}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      {errors.role && <span className="error">{errors.role}</span>}

      <button type="submit">Register</button>
    </form>
  );
}
```

## Validation Rules Reference

### Email Field
- **Required**: Yes
- **Type**: String
- **Rule**: Must match email format regex
- **Example valid**: `user@example.com`, `admin@company.co.uk`
- **Example invalid**: `not-an-email`, `user@`, `@example.com`

### Password Field
- **Required**: Yes
- **Type**: String
- **Rules**:
  - Minimum 8 characters
  - Must contain at least one number (0-9)
- **Example valid**: `MyPass123`, `secure456password`
- **Example invalid**: `short1` (too short), `nohumber` (no number)

### Confirm Password Field
- **Required**: Yes
- **Type**: String
- **Rule**: Must exactly match password field
- **Note**: Requires password field value for validation
- **Example**: If password is `test123`, confirmPassword must be exactly `test123`

### Age Field
- **Required**: No (optional)
- **Type**: Number
- **Rules** (when provided):
  - Must be a whole number (integer)
  - Must be between 18 and 120 inclusive
- **Valid**: `undefined`, `null`, `18`, `50`, `120`
- **Invalid**: `17` (too young), `121` (too old), `25.5` (not integer)

### Role Field
- **Required**: Yes
- **Type**: String (literal)
- **Allowed values**: `"admin"`, `"user"` (exactly)
- **Example valid**: `"admin"`, `"user"`
- **Example invalid**: `"moderator"`, `"ADMIN"`, `"User"`

## Error Messages

The validation system provides specific error messages for each scenario:

### Email
- "Email must be a string"
- "Email must be in valid format (e.g., user@example.com)"

### Password
- "Password must be a string"
- "Password must be at least 8 characters long"
- "Password must contain at least one number"

### Confirm Password
- "Confirm password must be a string"
- "Confirm password must match password"

### Age
- "Age must be a whole number"
- "Age must be between 18 and 120"

### Role
- "Role must be a string"
- 'Role must be either "admin" or "user"'

### Form-level
- "Form data must be an object"

## Type Narrowing Examples

```typescript
import { validateRegistrationForm } from './src/validation';

const result = validateRegistrationForm(formData);

// Before narrowing: type is ValidationResult (union)
// result.success could be true or false
// result.data and result.errors both might not exist

if (result.success) {
  // After narrowing: TypeScript knows success is true
  // Therefore result.data definitely exists
  // And result.errors definitely does NOT exist

  const { email, password, confirmPassword, role, age } = result.data;
  // ✓ All these properties are available

  // ✗ This would be a TypeScript error:
  // result.errors.forEach(...);
} else {
  // After narrowing: TypeScript knows success is false
  // Therefore result.errors definitely exists
  // And result.data definitely does NOT exist

  result.errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });

  // ✗ This would be a TypeScript error:
  // result.data.email
}
```

## Performance Characteristics

| Aspect | Details |
|--------|---------|
| **Execution** | Synchronous |
| **Complexity** | O(n) where n = number of fields being validated |
| **Single field** | O(1) constant time |
| **Full form** | ~O(1) - fixed number of fields |
| **Memory** | Minimal - only stores errors array |
| **Dependencies** | Zero external dependencies |
| **Bundle size** | ~3KB minified |
| **Tree-shakeable** | Yes - import only what you need |

## Error Handling Strategy

The validation system gracefully handles various error conditions:

1. **Non-object input**: Returns form-level error
2. **Missing required fields**: Includes field-level error
3. **Type mismatches**: Clear message about expected type
4. **Validation failures**: Specific rule that wasn't met
5. **Multiple errors**: All errors collected in one response

## Discriminated Union Pattern

This API uses the **discriminated union** pattern for type safety:

```typescript
type Result =
  | { success: true; data: Data }
  | { success: false; errors: Error[] };

// TypeScript enforces at compile time:
const result: Result = ...;

if (result.success) {
  // Inside this block: result is
  // { success: true; data: Data }
  const data = result.data;  // ✓ OK
  const errors = result.errors;  // ✗ TypeScript error
} else {
  // Inside this block: result is
  // { success: false; errors: Error[] }
  const errors = result.errors;  // ✓ OK
  const data = result.data;  // ✗ TypeScript error
}
```

## Import Statements

```typescript
// Import functions
import { validateRegistrationForm, validateField } from './src/validation';

// Import types
import type {
  ValidationResult,
  ValidRegistrationForm,
  FieldError,
  RegistrationForm,
} from './src/validation';

// Import everything
import { validateRegistrationForm, validateField } from './src/validation';
import type { ValidationResult, ValidRegistrationForm } from './src/validation';
```

## Complete Example

```typescript
import {
  validateRegistrationForm,
  validateField,
} from './src/validation';
import type { ValidRegistrationForm } from './src/validation';

// Example 1: Form submission
function handleFormSubmit(formData: unknown) {
  const result = validateRegistrationForm(formData);

  if (result.success) {
    console.log('Valid registration:', result.data);
    // Send to server: result.data has full type information
    api.register(result.data);
  } else {
    console.log('Validation errors:');
    result.errors.forEach(error => {
      console.log(`  ${error.field}: ${error.message}`);
    });
  }
}

// Example 2: Real-time validation
function handleEmailInput(email: string) {
  const result = validateField('email', email);

  if (result.success) {
    console.log('Email is valid');
  } else {
    console.log('Email error:', result.message);
  }
}

// Example 3: Type-safe processing
function processUser(data: unknown): ValidRegistrationForm | null {
  const result = validateRegistrationForm(data);

  if (result.success) {
    return result.data;  // Fully typed as ValidRegistrationForm
  }

  return null;
}
```

## Compatibility

- **TypeScript**: 4.5+
- **JavaScript**: ES2020+ (for Number.isInteger, nullish coalescing)
- **Node.js**: 14+
- **Browsers**: All modern browsers (uses standard JavaScript)
- **React**: 16.8+ (hooks)
- **Vue**: 3+ (composition API)
- **Frameworks**: Framework-agnostic (use anywhere)

## See Also

- `VALIDATION_GUIDE.md` - Comprehensive usage guide
- `examples/validation-examples.ts` - 10+ complete examples
- `IMPLEMENTATION_SUMMARY.md` - Design rationale and benefits
