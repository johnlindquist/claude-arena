# Form Validation Quick Reference

## Import

```typescript
import {
  validateRegistrationForm,
  validateField,
  validateSingleFieldWithErrors,
  getFieldErrorMessages,
  type ValidationResult,
  type ValidRegistrationForm,
  type FieldError,
  type RegistrationForm
} from "./validation";
```

## Validate Entire Form

```typescript
const result = validateRegistrationForm(formData);

if (result.success) {
  // result.data: ValidRegistrationForm
  // All fields are guaranteed valid
  console.log(result.data.email);
} else {
  // result.errors: FieldError[]
  result.errors.forEach(err => {
    console.log(`${err.field}: ${err.message}`);
  });
}
```

## Validate Single Field

```typescript
const result = validateField("email", "test@example.com");

if (result.success) {
  console.log("Email is valid");
} else {
  // result.message contains error
  console.log(`Error: ${result.message}`);
}
```

## Real-Time Field Validation (with password context)

```typescript
const passwordResult = validateField("password", "secure123");
const confirmResult = validateField("confirmPassword", "secure123", {
  password: "secure123"
});
```

## Get Error Messages for a Field

```typescript
const errors = getFieldErrorMessages("email", formData);
errors.forEach(msg => console.log(msg));

// Or with error details
const result = validateSingleFieldWithErrors("email", "invalid", formData);
if (!result.isValid) {
  result.errors.forEach(err => console.log(err.message));
}
```

## Validation Rules at a Glance

| Field | Status | Rules |
|-------|--------|-------|
| **email** | Required | Valid format (user@domain.tld) |
| **password** | Required | 8+ chars, ≥1 number |
| **confirmPassword** | Required | Must match password |
| **age** | Optional | 18-120, whole number |
| **role** | Required | "admin" \| "user" |

## Error Examples

```
❌ "Email must be a string"
❌ "Email is required"
❌ "Email must be in valid format (e.g., user@example.com)"

❌ "Password must be a string"
❌ "Password is required"
❌ "Password must be at least 8 characters long"
❌ "Password must contain at least one number"

❌ "Confirm password must be a string"
❌ "Confirm password is required"
❌ "Passwords do not match"

❌ "Age must be a whole number"
❌ "Age must be between 18 and 120"

❌ "Role must be a string"
❌ "Role is required"
❌ "Role must be either \"admin\" or \"user\""
```

## Type Definitions

```typescript
// Input type (can have missing/invalid values)
interface RegistrationForm {
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: number;
  role?: string;
}

// Output type (only valid data)
interface ValidRegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  age?: number;
  role: "admin" | "user";
}

// Result type (discriminated union)
type ValidationResult =
  | { success: true; data: ValidRegistrationForm }
  | { success: false; errors: FieldError[] };

// Single field result
type SingleFieldResult =
  | { success: true }
  | { success: false; message: string };

// Error type
interface FieldError {
  field: string;
  message: string;
}
```

## Common Patterns

### React Component with Real-Time Validation

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;

  const result = validateField(name as keyof ValidRegistrationForm, value, {
    password: formData.password
  });

  if (result.success) {
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  } else {
    setErrors(prev => ({ ...prev, [name]: result.message }));
  }
};
```

### Form Submission

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  const result = validateRegistrationForm(formData);

  if (result.success) {
    // All data is valid and properly typed
    await api.registerUser(result.data);
  } else {
    // Display all errors
    const errorMap = Object.fromEntries(
      result.errors.map(err => [err.field, err.message])
    );
    setErrors(errorMap);
  }
};
```

### API Route Handler

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const result = validateRegistrationForm(body);

  if (!result.success) {
    return Response.json(
      { errors: result.errors },
      { status: 400 }
    );
  }

  // result.data is guaranteed valid here
  const user = await createUser(result.data);
  return Response.json(user);
}
```

## Testing Examples

```typescript
// Valid case
const valid = validateRegistrationForm({
  email: "user@example.com",
  password: "secure123",
  confirmPassword: "secure123",
  role: "user"
});
expect(valid.success).toBe(true);
if (valid.success) {
  expect(valid.data.email).toBe("user@example.com");
}

// Invalid case
const invalid = validateRegistrationForm({
  email: "bad",
  password: "123"
});
expect(invalid.success).toBe(false);
if (!invalid.success) {
  expect(invalid.errors.length).toBeGreaterThan(0);
  expect(invalid.errors[0].field).toBe("email");
}
```

## Type Narrowing

```typescript
function processResult(result: ValidationResult) {
  // Type is ValidationResult (could be either)
  console.log(result.success); // OK

  // ✅ Correct - type narrows here
  if (result.success) {
    console.log(result.data.email);     // OK
    console.log(result.errors);         // ❌ Error!
  }

  // ✅ Correct - type narrows here
  if (!result.success) {
    console.log(result.errors);         // OK
    console.log(result.data.email);     // ❌ Error!
  }
}
```

## Pro Tips

1. **Always check the discriminant** - Check `result.success` before accessing data
2. **Use type narrowing** - Let TypeScript's control flow narrow your types
3. **Collect errors** - Users see all problems at once, better UX
4. **Optional age field** - Only validate if provided, can be undefined
5. **Case-sensitive role** - Role must be exactly "admin" or "user"
6. **Whitespace handling** - Email and role trim whitespace automatically
7. **Type-safe submission** - The validated data type is your source of truth

## When to Use Which Function

| Function | Use Case |
|----------|----------|
| `validateRegistrationForm` | Form submission, API input validation |
| `validateField` | Real-time field validation, onChange handlers |
| `validateSingleFieldWithErrors` | Need error array instead of message string |
| `getFieldErrorMessages` | Extract just the error messages for a field |

## File Reference

- **Main code**: `src/validation.ts`
- **Tests**: `src/formValidation.test.ts`
- **Detailed guide**: `VALIDATION_DEMO.md`
- **Architecture**: `VALIDATION_IMPLEMENTATION.md`
- **Quick ref**: This file

---

**Key Principle**: Use the TypeScript type system to make invalid states impossible, not error handling to recover from them.
