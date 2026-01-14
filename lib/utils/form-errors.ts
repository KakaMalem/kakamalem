import { toast } from "sonner";
import { ZodError } from "zod";

/**
 * Field label mapping for user-friendly error messages
 * Add field names here to customize how they appear in error toasts
 */
const FIELD_LABELS: Record<string, string> = {
  // Common fields
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm Password",
  currentPassword: "Current Password",
  newPassword: "New Password",
  phone: "Phone",
  address: "Address",
  city: "City",
  state: "State",
  country: "Country",
  postalCode: "Postal Code",
  zipCode: "ZIP Code",

  // Product fields
  price: "Price",
  compareAtPrice: "Compare at Price",
  sku: "SKU",
  barcode: "Barcode",
  quantity: "Quantity",
  weight: "Weight",
  description: "Description",
  shortDescription: "Short Description",
  categoryId: "Category",

  // Store fields
  slug: "Store URL",
  storeName: "Store Name",
  storeDescription: "Store Description",
  currency: "Currency",
  timezone: "Timezone",

  // Social links
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  telegram: "Telegram",

  // SEO fields
  metaTitle: "Meta Title",
  metaDescription: "Meta Description",
  ogImage: "OG Image",

  // Customer fields
  firstName: "First Name",
  lastName: "Last Name",
  fullName: "Full Name",
  notes: "Notes",

  // Sale fields
  discountType: "Discount Type",
  discountValue: "Discount Value",
  startDate: "Start Date",
  endDate: "End Date",
  minPurchase: "Minimum Purchase",
  maxUses: "Maximum Uses",
};

/**
 * Get a user-friendly label for a field name
 */
function getFieldLabel(fieldName: string): string {
  // Check if we have a custom label
  if (FIELD_LABELS[fieldName]) {
    return FIELD_LABELS[fieldName];
  }

  // Convert camelCase to Title Case
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Error types for categorization
 */
type ErrorCategory = "required" | "invalid" | "other";

interface CategorizedError {
  field: string;
  label: string;
  message: string;
  category: ErrorCategory;
}

/**
 * Categorize an error based on its message
 */
function categorizeError(field: string, message: string): CategorizedError {
  const label = getFieldLabel(field);
  const lowerMessage = message.toLowerCase();

  // Check for required/empty errors
  if (
    lowerMessage.includes("required") ||
    lowerMessage.includes("cannot be empty") ||
    lowerMessage.includes("is required") ||
    lowerMessage.includes("must not be empty") ||
    message === "Required"
  ) {
    return { field, label, message, category: "required" };
  }

  // Check for invalid format errors
  if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("must be") ||
    lowerMessage.includes("should be") ||
    lowerMessage.includes("at least") ||
    lowerMessage.includes("too short") ||
    lowerMessage.includes("too long")
  ) {
    return { field, label, message, category: "invalid" };
  }

  return { field, label, message, category: "other" };
}

/**
 * Show a smart toast for form validation errors
 * Summarizes multiple errors in a user-friendly way
 */
export function showFormErrors(
  errors: Record<string, string | undefined> | ZodError
): void {
  // Convert ZodError to record format if needed
  let errorRecord: Record<string, string>;

  if (errors instanceof ZodError) {
    errorRecord = {};
    errors.issues.forEach((issue) => {
      const field = issue.path.join(".");
      if (!errorRecord[field]) {
        errorRecord[field] = issue.message;
      }
    });
  } else {
    errorRecord = Object.fromEntries(
      Object.entries(errors).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    );
  }

  const errorEntries = Object.entries(errorRecord);

  if (errorEntries.length === 0) return;

  // Categorize all errors
  const categorized = errorEntries.map(([field, message]) =>
    categorizeError(field, message)
  );

  const requiredErrors = categorized.filter((e) => e.category === "required");
  const invalidErrors = categorized.filter((e) => e.category === "invalid");
  const otherErrors = categorized.filter((e) => e.category === "other");

  // Build the toast message
  const parts: string[] = [];

  // Handle required fields
  if (requiredErrors.length > 0) {
    if (requiredErrors.length === 1) {
      parts.push(`${requiredErrors[0].label} is required`);
    } else if (requiredErrors.length <= 3) {
      const fieldNames = requiredErrors.map((e) => e.label).join(", ");
      parts.push(`${fieldNames} are required`);
    } else {
      const firstTwo = requiredErrors
        .slice(0, 2)
        .map((e) => e.label)
        .join(", ");
      parts.push(
        `${firstTwo} and ${requiredErrors.length - 2} more fields are required`
      );
    }
  }

  // Handle invalid fields
  if (invalidErrors.length > 0) {
    if (invalidErrors.length === 1) {
      // Show specific message for single invalid field
      parts.push(`${invalidErrors[0].label}: ${invalidErrors[0].message}`);
    } else if (invalidErrors.length <= 2) {
      // Show specific messages for 2 invalid fields
      invalidErrors.forEach((e) => {
        parts.push(`${e.label}: ${e.message}`);
      });
    } else {
      // Summarize multiple invalid fields
      const fieldNames = invalidErrors
        .slice(0, 2)
        .map((e) => e.label)
        .join(", ");
      parts.push(
        `${fieldNames} and ${invalidErrors.length - 2} more fields have invalid values`
      );
    }
  }

  // Handle other errors
  otherErrors.forEach((e) => {
    parts.push(`${e.label}: ${e.message}`);
  });

  // Show the toast
  if (parts.length === 1) {
    toast.error(parts[0]);
  } else {
    // Use toast with description for multiple errors
    toast.error("Please fix the following errors", {
      description: parts.join(" • "),
      duration: 5000,
    });
  }
}

/**
 * Show a simple error toast with a title and optional description
 */
export function showError(message: string, description?: string): void {
  toast.error(message, description ? { description } : undefined);
}

/**
 * Show a success toast
 */
export function showSuccess(message: string, description?: string): void {
  toast.success(message, description ? { description } : undefined);
}

/**
 * Scroll to the first error field in a form
 * @param errors - Object with field names as keys
 * @param fieldIdMap - Optional mapping of field names to DOM element IDs
 */
export function scrollToFirstError(
  errors: Record<string, string | undefined>,
  fieldIdMap?: Record<string, string>
): void {
  const errorFields = Object.keys(errors).filter(
    (key) => errors[key] !== undefined
  );

  if (errorFields.length === 0) return;

  const firstErrorField = errorFields[0];
  const elementId = fieldIdMap?.[firstErrorField] ?? firstErrorField;
  const element = document.getElementById(elementId);

  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => element.focus(), 300);
  }
}

/**
 * Combined function to show form errors and scroll to first error
 */
export function handleFormErrors(
  errors: Record<string, string | undefined> | ZodError,
  fieldIdMap?: Record<string, string>
): void {
  // Convert ZodError to record if needed
  let errorRecord: Record<string, string | undefined>;

  if (errors instanceof ZodError) {
    errorRecord = {};
    errors.issues.forEach((issue) => {
      const field = issue.path.join(".");
      if (!errorRecord[field]) {
        errorRecord[field] = issue.message;
      }
    });
  } else {
    errorRecord = errors;
  }

  showFormErrors(errorRecord);
  scrollToFirstError(errorRecord, fieldIdMap);
}
