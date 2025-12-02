// Brand types - parse, don't validate
type Email = string & { readonly __brand: 'Email' };
type ValidPassword = string & { readonly __brand: 'ValidPassword' };
type Role = 'admin' | 'user';
type ValidAge = number & { readonly __brand: 'ValidAge' };

// Raw form input - may contain invalid data
export interface RawRegistrationForm {
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: string | number;
  role?: string;
}

// Parsed/validated form - all fields are valid
export interface RegistrationForm {
  email: Email;
  password: ValidPassword;
  confirmPassword: ValidPassword;
  age?: ValidAge;
  role: Role;
}

// Discriminated union - makes success/failure states impossible to confuse
type ValidationSuccess = {
  readonly success: true;
  readonly data: RegistrationForm;
};

type ValidationFailure = {
  readonly success: false;
  readonly errors: Record<string, string[]>;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

interface FieldValidator<T> {
  validate(value: unknown): string[];
}

// Individual field validators
const emailValidator: FieldValidator<string> = {
  validate(value: unknown): string[] {
    const errors: string[] = [];

    if (typeof value !== "string" || value.trim() === "") {
      errors.push("Email is required");
      return errors;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push("Email must be a valid format (e.g., user@example.com)");
    }

    return errors;
  }
};

const passwordValidator: FieldValidator<string> = {
  validate(value: unknown): string[] {
    const errors: string[] = [];

    if (typeof value !== "string" || value.trim() === "") {
      errors.push("Password is required");
      return errors;
    }

    if (value.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/\d/.test(value)) {
      errors.push("Password must contain at least one number");
    }

    return errors;
  }
};

const roleValidator: FieldValidator<Role> = {
  validate(value: unknown): string[] {
    const errors: string[] = [];

    if (typeof value !== "string" || value.trim() === "") {
      errors.push("Role is required");
      return errors;
    }

    if (value !== "admin" && value !== "user") {
      errors.push('Role must be either "admin" or "user"');
    }

    return errors;
  }
};

const ageValidator: FieldValidator<number> = {
  validate(value: unknown): string[] {
    const errors: string[] = [];

    // Age is optional, so if not provided, it's valid
    if (value === undefined || value === null) {
      return errors;
    }

    if (typeof value !== "number") {
      errors.push("Age must be a number");
      return errors;
    }

    if (!Number.isInteger(value)) {
      errors.push("Age must be a whole number");
      return errors;
    }

    if (value < 18 || value > 120) {
      errors.push("Age must be between 18 and 120");
    }

    return errors;
  }
};

// Validator for confirmPassword (context-dependent)
const createConfirmPasswordValidator = (password: unknown): FieldValidator<string> => {
  return {
    validate(value: unknown): string[] {
      const errors: string[] = [];

      if (typeof value !== "string" || value.trim() === "") {
        errors.push("Confirm password is required");
        return errors;
      }

      if (typeof password !== "string") {
        errors.push("Password must be set before confirming");
        return errors;
      }

      if (value !== password) {
        errors.push("Passwords do not match");
      }

      return errors;
    }
  };
};

// Single field validation
export function validateField(
  field: keyof RawRegistrationForm,
  value: unknown,
  context?: Record<string, unknown>
): string[] {
  switch (field) {
    case "email":
      return emailValidator.validate(value);
    case "password":
      return passwordValidator.validate(value);
    case "confirmPassword":
      return createConfirmPasswordValidator(context?.password).validate(value);
    case "age":
      return ageValidator.validate(value);
    case "role":
      return roleValidator.validate(value);
    default:
      return [];
  }
}

// Full form validation
export function validateRegistrationForm(
  form: unknown
): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Type guard and field extraction
  if (typeof form !== "object" || form === null) {
    return {
      success: false,
      errors: {
        email: ["Form data is required"],
        password: ["Form data is required"],
        confirmPassword: ["Form data is required"],
        role: ["Form data is required"],
      }
    };
  }

  const formData = form as Record<string, unknown>;

  // Validate each field
  const emailErrors = emailValidator.validate(formData.email);
  if (emailErrors.length > 0) {
    errors.email = emailErrors;
  }

  const passwordErrors = passwordValidator.validate(formData.password);
  if (passwordErrors.length > 0) {
    errors.password = passwordErrors;
  }

  const confirmPasswordErrors = createConfirmPasswordValidator(formData.password).validate(
    formData.confirmPassword
  );
  if (confirmPasswordErrors.length > 0) {
    errors.confirmPassword = confirmPasswordErrors;
  }

  const ageErrors = ageValidator.validate(formData.age);
  if (ageErrors.length > 0) {
    errors.age = ageErrors;
  }

  const roleErrors = roleValidator.validate(formData.role);
  if (roleErrors.length > 0) {
    errors.role = roleErrors;
  }

  // If there are any errors, return failure state
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors: {
        email: errors.email ?? [],
        password: errors.password ?? [],
        confirmPassword: errors.confirmPassword ?? [],
        age: errors.age ?? [],
        role: errors.role ?? [],
      }
    };
  }

  // All validations passed - safe to cast to branded types
  const validForm: RegistrationForm = {
    email: formData.email as Email,
    password: formData.password as ValidPassword,
    confirmPassword: formData.confirmPassword as ValidPassword,
    age: formData.age as ValidAge | undefined,
    role: formData.role as Role,
  };

  return {
    success: true,
    data: validForm
  };
}
