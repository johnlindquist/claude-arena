import {
  validateRegistrationForm,
  validateField,
  RegistrationForm,
  ValidationResult,
  RawRegistrationForm
} from "./formValidation";

describe("Form Validation System", () => {
  describe("validateField", () => {
    describe("email field", () => {
      it("should validate valid email", () => {
        const errors = validateField("email", "user@example.com");
        expect(errors).toEqual([]);
      });

      it("should reject empty email", () => {
        const errors = validateField("email", "");
        expect(errors).toContain("Email is required");
      });

      it("should reject invalid email format", () => {
        const errors = validateField("email", "invalid-email");
        expect(errors).toContain("Email must be a valid format (e.g., user@example.com)");
      });

      it("should reject email without domain", () => {
        const errors = validateField("email", "user@");
        expect(errors).toContain("Email must be a valid format (e.g., user@example.com)");
      });

      it("should reject non-string values", () => {
        const errors = validateField("email", 123);
        expect(errors).toContain("Email is required");
      });
    });

    describe("password field", () => {
      it("should validate strong password", () => {
        const errors = validateField("password", "SecurePass123");
        expect(errors).toEqual([]);
      });

      it("should reject empty password", () => {
        const errors = validateField("password", "");
        expect(errors).toContain("Password is required");
      });

      it("should reject password shorter than 8 characters", () => {
        const errors = validateField("password", "Pass12");
        expect(errors).toContain("Password must be at least 8 characters long");
      });

      it("should reject password without numbers", () => {
        const errors = validateField("password", "NoNumbersHere");
        expect(errors).toContain("Password must contain at least one number");
      });

      it("should accept password with numbers and 8+ chars", () => {
        const errors = validateField("password", "12345678");
        expect(errors).toEqual([]);
      });

      it("should accept password at minimum length with number", () => {
        const errors = validateField("password", "Pass1234");
        expect(errors).toEqual([]);
      });
    });

    describe("confirmPassword field", () => {
      it("should validate matching passwords", () => {
        const errors = validateField(
          "confirmPassword",
          "SecurePass123",
          { password: "SecurePass123" }
        );
        expect(errors).toEqual([]);
      });

      it("should reject mismatched passwords", () => {
        const errors = validateField(
          "confirmPassword",
          "DifferentPass123",
          { password: "SecurePass123" }
        );
        expect(errors).toContain("Passwords do not match");
      });

      it("should reject empty confirmPassword", () => {
        const errors = validateField(
          "confirmPassword",
          "",
          { password: "SecurePass123" }
        );
        expect(errors).toContain("Confirm password is required");
      });

      it("should reject when password context is missing", () => {
        const errors = validateField("confirmPassword", "SecurePass123");
        expect(errors).toContain("Password must be set before confirming");
      });
    });

    describe("age field", () => {
      it("should allow undefined age (optional field)", () => {
        const errors = validateField("age", undefined);
        expect(errors).toEqual([]);
      });

      it("should allow null age (optional field)", () => {
        const errors = validateField("age", null);
        expect(errors).toEqual([]);
      });

      it("should validate age in valid range", () => {
        const errors = validateField("age", 25);
        expect(errors).toEqual([]);
      });

      it("should validate minimum age", () => {
        const errors = validateField("age", 18);
        expect(errors).toEqual([]);
      });

      it("should validate maximum age", () => {
        const errors = validateField("age", 120);
        expect(errors).toEqual([]);
      });

      it("should reject age below 18", () => {
        const errors = validateField("age", 17);
        expect(errors).toContain("Age must be between 18 and 120");
      });

      it("should reject age above 120", () => {
        const errors = validateField("age", 121);
        expect(errors).toContain("Age must be between 18 and 120");
      });

      it("should reject non-integer age", () => {
        const errors = validateField("age", 25.5);
        expect(errors).toContain("Age must be a whole number");
      });

      it("should reject non-number age", () => {
        const errors = validateField("age", "25");
        expect(errors).toContain("Age must be a number");
      });
    });

    describe("role field", () => {
      it("should validate 'admin' role", () => {
        const errors = validateField("role", "admin");
        expect(errors).toEqual([]);
      });

      it("should validate 'user' role", () => {
        const errors = validateField("role", "user");
        expect(errors).toEqual([]);
      });

      it("should reject empty role", () => {
        const errors = validateField("role", "");
        expect(errors).toContain("Role is required");
      });

      it("should reject invalid role", () => {
        const errors = validateField("role", "superadmin");
        expect(errors).toContain('Role must be either "admin" or "user"');
      });

      it("should reject non-string role", () => {
        const errors = validateField("role", 123);
        expect(errors).toContain("Role is required");
      });
    });
  });

  describe("validateRegistrationForm", () => {
    it("should validate a complete valid form", () => {
      const form: RawRegistrationForm = {
        email: "user@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        age: 25,
        role: "user"
      };

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
        expect(result.data.password).toBe("SecurePass123");
      }
    });

    it("should validate form without optional age field", () => {
      const form: RawRegistrationForm = {
        email: "user@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        role: "admin"
      };

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.age).toBeUndefined();
      }
    });

    it("should return validation errors for invalid form", () => {
      const form = {
        email: "invalid-email",
        password: "weak1",
        confirmPassword: "different",
        age: 150,
        role: "superadmin"
      };

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email.length).toBeGreaterThan(0);
        expect(result.errors.password.length).toBeGreaterThan(0);
        expect(result.errors.confirmPassword.length).toBeGreaterThan(0);
        expect(result.errors.age.length).toBeGreaterThan(0);
        expect(result.errors.role.length).toBeGreaterThan(0);
      }
    });

    it("should return errors for missing required fields", () => {
      const form = {};

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toContain("Email is required");
        expect(result.errors.password).toContain("Password is required");
        expect(result.errors.confirmPassword).toContain("Confirm password is required");
        expect(result.errors.role).toContain("Role is required");
      }
    });

    it("should handle null input gracefully", () => {
      const result = validateRegistrationForm(null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toContain("Form data is required");
      }
    });

    it("should handle non-object input gracefully", () => {
      const result = validateRegistrationForm("not an object");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toContain("Form data is required");
      }
    });

    it("should accumulate multiple errors per field", () => {
      const form = {
        email: "user@example.com",
        password: "short",
        confirmPassword: "different",
        role: "user" as Role
      };

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password.length).toBeGreaterThan(1);
        expect(result.errors.password).toContain("Password must be at least 8 characters long");
        expect(result.errors.password).toContain("Password must contain at least one number");
      }
    });

    it("should validate form with minimum age (18)", () => {
      const form: RawRegistrationForm = {
        email: "user@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        age: 18,
        role: "user"
      };

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(true);
    });

    it("should validate form with maximum age (120)", () => {
      const form: RawRegistrationForm = {
        email: "user@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        age: 120,
        role: "admin"
      };

      const result = validateRegistrationForm(form);
      expect(result.success).toBe(true);
    });

    it("should properly type the data on success", () => {
      const form: RawRegistrationForm = {
        email: "user@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        role: "user"
      };

      const result = validateRegistrationForm(form);
      if (result.success) {
        const { email, password, confirmPassword, age, role } = result.data;
        expect(typeof email).toBe("string");
        expect(typeof password).toBe("string");
        expect(typeof confirmPassword).toBe("string");
        expect(typeof role).toBe("string");
        expect(age).toBeUndefined();
      }
    });
  });
});
