/**
 * Form validation system for user registration
 * Uses discriminated unions to make invalid states impossible
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validated form data - only contains values that have passed validation
 */
export interface ValidRegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  age?: number;
  role: "admin" | "user";
}

/**
 * Field-specific validation error
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Validation result - discriminated union making success/failure clear
 */
export type ValidationResult =
  | {
      success: true;
      data: ValidRegistrationForm;
    }
  | {
      success: false;
      errors: FieldError[];
    };

/**
 * Input form data (may have invalid values)
 */
export interface RegistrationForm {
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: number;
  role?: string;
}

// ============================================================================
// Parser Functions
// ============================================================================

function parseEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Email must be a string");
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("Email is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error("Email must be in valid format (e.g., user@example.com)");
  }

  return trimmed;
}

function parsePassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Password must be a string");
  }

  if (value === "") {
    throw new Error("Password is required");
  }

  if (value.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  if (!/\d/.test(value)) {
    throw new Error("Password must contain at least one number");
  }

  return value;
}

function parseConfirmPassword(
  value: unknown,
  password: string
): string {
  if (typeof value !== "string") {
    throw new Error("Confirm password must be a string");
  }

  if (value === "") {
    throw new Error("Confirm password is required");
  }

  if (value !== password) {
    throw new Error("Passwords do not match");
  }

  return value;
}

function parseAge(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw new Error("Age must be a whole number");
  }

  if (num < 18 || num > 120) {
    throw new Error("Age must be between 18 and 120");
  }

  return num;
}

function parseRole(value: unknown): "admin" | "user" {
  if (typeof value !== "string") {
    throw new Error("Role must be a string");
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("Role is required");
  }

  if (trimmed !== "admin" && trimmed !== "user") {
    throw new Error('Role must be either "admin" or "user"');
  }

  return trimmed as "admin" | "user";
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validates a user registration form
 * @param form - The form data to validate (can have any shape)
 * @returns ValidationResult with parsed data or field errors
 */
export function validateRegistrationForm(form: unknown): ValidationResult {
  // Type guard: ensure we have an object
  if (typeof form !== "object" || form === null) {
    return {
      success: false,
      errors: [{ field: "email", message: "Form data must be an object" }],
    };
  }

  const record = form as Record<string, unknown>;
  const errors: FieldError[] = [];

  // Validate email (required)
  let email: string;
  try {
    email = parseEmail(record.email);
  } catch (err) {
    errors.push({
      field: "email",
      message: err instanceof Error ? err.message : "Invalid email",
    });
  }

  // Validate password (required)
  let password: string;
  try {
    password = parsePassword(record.password);
  } catch (err) {
    errors.push({
      field: "password",
      message: err instanceof Error ? err.message : "Invalid password",
    });
  }

  // Validate confirmPassword (required) - depends on password
  let confirmPassword: string;
  try {
    confirmPassword = parseConfirmPassword(
      record.confirmPassword,
      password || ""
    );
  } catch (err) {
    errors.push({
      field: "confirmPassword",
      message: err instanceof Error ? err.message : "Invalid confirm password",
    });
  }

  // Validate age (optional)
  let age: number | undefined;
  try {
    age = parseAge(record.age);
  } catch (err) {
    errors.push({
      field: "age",
      message: err instanceof Error ? err.message : "Invalid age",
    });
  }

  // Validate role (required)
  let role: "admin" | "user";
  try {
    role = parseRole(record.role);
  } catch (err) {
    errors.push({
      field: "role",
      message: err instanceof Error ? err.message : "Invalid role",
    });
  }

  // Return errors if any validation failed
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // All validations passed - return parsed data
  return {
    success: true,
    data: {
      email,
      password,
      confirmPassword,
      age,
      role,
    },
  };
}

// ============================================================================
// Single-Field Validation
// ============================================================================

/**
 * Validates a single field
 * Useful for real-time validation as user types
 */
export function validateField(
  fieldName: keyof ValidRegistrationForm,
  value: unknown,
  context?: { password?: string }
): { success: true } | { success: false; message: string } {
  try {
    switch (fieldName) {
      case "email":
        parseEmail(value);
        break;
      case "password":
        parsePassword(value);
        break;
      case "confirmPassword":
        parseConfirmPassword(value, context?.password || "");
        break;
      case "age":
        parseAge(value);
        break;
      case "role":
        parseRole(value);
        break;
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Validation failed",
    };
  }
}

/**
 * Validate a single field with full error details
 * Useful for real-time validation and getting field-specific errors
 * @param fieldName - The name of the field to validate
 * @param value - The value to validate
 * @param formData - Optional full form data for cross-field validation
 * @returns Object with isValid flag and errors array
 */
export function validateSingleFieldWithErrors(
  fieldName: string,
  value: unknown,
  formData?: RegistrationForm
): { isValid: boolean; errors: FieldError[] } {
  const result = validateField(fieldName as keyof ValidRegistrationForm, value, {
    password: formData?.password,
  });

  if (result.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: [{ field: fieldName, message: (result as { success: false; message: string }).message }],
  };
}

/**
 * Get all error messages for a specific field
 * @param fieldName - The field name to get errors for
 * @param form - The form data
 * @returns Array of error messages for that field
 */
export function getFieldErrorMessages(fieldName: string, form: RegistrationForm): string[] {
  const result = validateSingleFieldWithErrors(fieldName, form[fieldName as keyof RegistrationForm], form);
  return result.errors.map((err) => err.message);
}

