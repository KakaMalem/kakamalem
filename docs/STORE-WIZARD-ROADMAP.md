# Store Creation Wizard Enhancement Roadmap

## Executive Summary

This roadmap outlines the transformation of Kaka Malem's store creation experience from a technical configuration wizard to an intelligent, human-centered onboarding system that understands business context and automatically configures optimal store settings.

**Current State**: 4-step wizard asking technical questions (store mode, slug, branding, contact)
**Target State**: Intelligent wizard that asks business-type questions and auto-configures the technical aspects

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Industry Research & Best Practices](#industry-research--best-practices)
3. [Business Type Taxonomy](#business-type-taxonomy)
4. [Architecture Design](#architecture-design)
5. [Technical Implementation](#technical-implementation)
6. [Wizard Flow Design](#wizard-flow-design)
7. [AI-Powered Features](#ai-powered-features)
8. [Database Schema Changes](#database-schema-changes)
9. [Implementation Phases](#implementation-phases)
10. [Success Metrics](#success-metrics)

---

## Problem Analysis

### Current Issues

| Issue                                                                        | Impact                                                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Technical terminology (store mode: full, online_only, offline_only, catalog) | Users don't understand what these mean                                     |
| No context about business type                                               | Can't provide relevant defaults or guidance                                |
| Generic setup for all businesses                                             | Travel agency gets same setup as a clothing store                          |
| No industry-specific features                                                | Missing vertical-specific fields (rooms for hotels, seats for restaurants) |
| No guided recommendations                                                    | Users must know what they need upfront                                     |

### User Research Insight

> "68% of organizations using AI-driven onboarding report users reaching full productivity 30% faster" — [Enboarder](https://enboarder.com/blog/ai-onboarding-tool-guide-2026/)

> "Approximately 70% of users abandon apps because of poor onboarding" — [Zluck Solutions](https://zluck.com/reduce-onboarding-friction-for-startups/)

---

## Industry Research & Best Practices

### Key Patterns from Leading Platforms

#### 1. Shopify's Approach

- Personalized onboarding based on business goals
- Core checklist with auto-opening next step
- Progress bar showing remaining steps
- Option to skip and complete later

Source: [Candu - Shopify Onboarding](https://www.candu.ai/blog/shopify-onboarding-flow)

#### 2. Wix ADI (Artificial Design Intelligence)

- AI generates tailored store with a few questions
- Business type detection from description
- 500+ industry-specific templates
- Natural language business description input

Source: [Wix eCommerce](https://www.wix.com/ecommerce/website)

#### 3. Hostinger AI Builder

- Generate e-commerce site by describing business
- Launch in under a minute
- 150+ designer-crafted templates by industry

Source: [Hostinger eCommerce](https://www.hostinger.com/ecommerce-website)

#### 4. GoDaddy

- 100+ mobile-friendly designs by industry
- Type industry to get relevant template
- No tech skills needed approach

Source: [GoDaddy Online Store](https://www.godaddy.com/websites/online-store)

### Multi-Step Form Best Practices

| Practice                        | Why It Works                                                       |
| ------------------------------- | ------------------------------------------------------------------ |
| **Progress Indicators**         | Zeigarnik effect: humans feel uncomfortable with uncompleted tasks |
| **Progressive Disclosure**      | Reveal information gradually when needed                           |
| **Start with Simple Questions** | Build momentum before complex decisions                            |
| **Allow Skip Option**           | Respect users' time while enabling completion later                |
| **Personalization**             | Segment by role/goals for tailored experience                      |
| **Time-to-Value**               | Get users to first achievement within minutes                      |

Source: [Webstacks - Multi-Step Forms](https://www.webstacks.com/blog/multi-step-form), [Eleken - Wizard UI](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained)

### "Good Friction" Principle

> "At Sesame Care, a 25-step intake replaced a 3-step flow. Conversion jumped 40%. Good friction builds confidence and signals quality."

Source: [Ravi Mehta - Onboarding Optimization](https://blog.ravi-mehta.com/p/onboarding-optimization)

**Key Insight**: More steps aren't bad if each step builds confidence and understanding. The wizard should feel like a conversation, not a form.

---

## Business Type Taxonomy

### Primary Categories (Level 1)

```
RETAIL & PRODUCTS
├── Fashion & Apparel
├── Electronics & Gadgets
├── Home & Furniture
├── Beauty & Cosmetics
├── Sports & Outdoors
├── Toys & Games
├── Books & Media
├── Jewelry & Accessories
├── Art & Crafts
└── General Merchandise

FOOD & HOSPITALITY
├── Restaurant
├── Cafe & Bakery
├── Food Delivery
├── Grocery & Supermarket
├── Catering Service
└── Food Truck / Street Food

SERVICES & BOOKINGS
├── Travel Agency
├── Hotel & Accommodation
├── Car Rental
├── Event Services
├── Salon & Spa
├── Fitness & Gym
├── Photography
├── Consulting
└── Repair Services

REAL ESTATE & AUTOMOTIVE
├── Real Estate Agency
├── Car Dealership
├── Property Management
├── Motorcycle Sales
└── Heavy Equipment

B2B & WHOLESALE
├── Wholesale Distribution
├── Manufacturing
├── Raw Materials
├── Office Supplies
└── Industrial Equipment

DIGITAL & CREATIVE
├── Digital Products
├── Online Courses
├── Software / SaaS
├── Freelance Services
└── Content Creation
```

### Business Type Configuration Mapping

Each business type maps to automatic configurations:

```typescript
interface BusinessTypeConfig {
  // Core store settings
  suggestedStoreMode: StoreMode;

  // Category presets
  defaultCategories: string[];

  // Product configuration
  productFields: {
    enableVariants: boolean;
    suggestedVariantOptions: string[]; // e.g., ["Size", "Color"]
    enableInventory: boolean;
    priceType: "fixed" | "variable" | "quote";
    showPricePublicly: boolean;
  };

  // Checkout & ordering
  checkoutConfig: {
    requiresShipping: boolean;
    enableLocalDelivery: boolean;
    enablePickup: boolean;
    enableBooking: boolean;
    enableQuoteRequest: boolean;
  };

  // Customer fields
  customerFields: {
    collectPhone: "required" | "optional" | "hidden";
    collectAddress: "required" | "optional" | "hidden";
    collectCompany: "required" | "optional" | "hidden";
  };

  // Industry-specific features
  features: {
    enableRooms?: boolean; // Hotels
    enableSeats?: boolean; // Restaurants
    enableCalendar?: boolean; // Bookings
    enableTestDrive?: boolean; // Car sales
    enableVirtualTour?: boolean; // Real estate
  };

  // UI/UX
  layout: {
    productCardStyle: "grid" | "list" | "gallery" | "map";
    showStock: boolean;
    showSKU: boolean;
    enableWishlist: boolean;
    enableCompare: boolean;
  };
}
```

### Example Configurations

#### Travel Agency

```typescript
{
  suggestedStoreMode: "catalog",
  defaultCategories: ["International Tours", "Domestic Tours", "Visa Services", "Travel Insurance"],
  productFields: {
    enableVariants: false,
    suggestedVariantOptions: [],
    enableInventory: false,
    priceType: "variable",
    showPricePublicly: true,
  },
  checkoutConfig: {
    requiresShipping: false,
    enableLocalDelivery: false,
    enablePickup: false,
    enableBooking: true,
    enableQuoteRequest: true,
  },
  features: {
    enableCalendar: true,
  },
  layout: {
    productCardStyle: "gallery",
    showStock: false,
    showSKU: false,
    enableWishlist: true,
    enableCompare: true,
  }
}
```

#### Car Dealership

```typescript
{
  suggestedStoreMode: "catalog",
  defaultCategories: ["Sedans", "SUVs", "Trucks", "Vans", "Motorcycles"],
  productFields: {
    enableVariants: false,
    suggestedVariantOptions: [],
    enableInventory: true,
    priceType: "fixed",
    showPricePublicly: true,
  },
  checkoutConfig: {
    requiresShipping: false,
    enableLocalDelivery: false,
    enablePickup: true,
    enableBooking: true,
    enableQuoteRequest: true,
  },
  features: {
    enableTestDrive: true,
  },
  layout: {
    productCardStyle: "gallery",
    showStock: true,
    showSKU: true,
    enableWishlist: true,
    enableCompare: true,
  }
}
```

#### Clothing Store

```typescript
{
  suggestedStoreMode: "online_only",
  defaultCategories: ["Men", "Women", "Kids", "Accessories", "Sale"],
  productFields: {
    enableVariants: true,
    suggestedVariantOptions: ["Size", "Color"],
    enableInventory: true,
    priceType: "fixed",
    showPricePublicly: true,
  },
  checkoutConfig: {
    requiresShipping: true,
    enableLocalDelivery: true,
    enablePickup: true,
    enableBooking: false,
    enableQuoteRequest: false,
  },
  layout: {
    productCardStyle: "grid",
    showStock: true,
    showSKU: false,
    enableWishlist: true,
    enableCompare: false,
  }
}
```

---

## Architecture Design

### State Machine Architecture

Using XState for predictable wizard state management:

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    WIZARD MACHINE                        │
                    └─────────────────────────────────────────────────────────┘
                                              │
            ┌─────────────────────────────────┼─────────────────────────────────┐
            │                                 │                                 │
            ▼                                 ▼                                 ▼
    ┌───────────────┐               ┌───────────────┐               ┌───────────────┐
    │   WELCOME     │──NEXT──▶      │  BUSINESS     │──NEXT──▶      │   BUSINESS    │
    │               │               │    TYPE       │               │    DETAILS    │
    └───────────────┘               └───────────────┘               └───────────────┘
                                          │                               │
                                          │ (parallel)                    │
                                          ▼                               ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │              DYNAMIC QUESTIONS (based on type)          │
                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
                    │  │ Sales   │ │Location │ │Products │ │Customers│ ...   │
                    │  │ Channel │ │ Type    │ │ Type    │ │ Type    │       │
                    │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
                    └─────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                    CONFIGURATION                         │
                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
                    │  │Branding │ │ Contact │ │ Preview │                   │
                    │  └─────────┘ └─────────┘ └─────────┘                   │
                    └─────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                     COMPLETION                           │
                    │           Store Created → Welcome Dashboard              │
                    └─────────────────────────────────────────────────────────┘
```

### Tech Stack Selection

| Component            | Recommended            | Alternative       | Rationale                                                  |
| -------------------- | ---------------------- | ----------------- | ---------------------------------------------------------- |
| **State Machine**    | XState v5              | Zustand + custom  | Visual debugging, parallel states, predictable transitions |
| **Form Handling**    | React Hook Form + Zod  | Formik            | Already in stack, excellent TS support                     |
| **Multi-step Logic** | Custom + @xstate/react | react-step-wizard | Full control, XState integration                           |
| **Animations**       | Framer Motion          | React Spring      | Already in stack, excellent UX                             |
| **Persistence**      | Zustand persist        | localStorage      | Cross-tab sync, easy hydration                             |
| **AI Features**      | Claude API             | OpenAI            | Anthropic ecosystem, better reasoning                      |

### NPM Packages Evaluation

| Package                                                              | Weekly Downloads | Use Case                  | Recommendation           |
| -------------------------------------------------------------------- | ---------------- | ------------------------- | ------------------------ |
| [react-step-wizard](https://www.npmjs.com/package/react-step-wizard) | 23,514           | Simple wizards            | Skip - too simple        |
| [react-multistep](https://www.npmjs.com/package/react-multistep)     | ~5,000           | Headless wizard           | Consider v6 for headless |
| [xstate](https://www.npmjs.com/package/xstate)                       | 800,000+         | State machine             | **Recommended**          |
| [@xstate/react](https://www.npmjs.com/package/@xstate/react)         | 200,000+         | XState React bindings     | **Recommended**          |
| [xstate-wizards](https://github.com/xstate-wizards/xstate-wizards)   | Newer            | XState wizard abstraction | Evaluate for v2          |

Source: [XState Wizards](https://github.com/xstate-wizards/xstate-wizards), [React Multistep](https://github.com/srdjan/react-multistep)

---

## Technical Implementation

### Directory Structure

```
lib/
├── wizard/
│   ├── machine.ts              # XState wizard machine
│   ├── types.ts                # TypeScript interfaces
│   ├── business-types.ts       # Business type taxonomy & configs
│   ├── questions.ts            # Dynamic question definitions
│   ├── config-generator.ts     # Generate store config from answers
│   └── hooks/
│       ├── use-wizard.ts       # Main wizard hook
│       ├── use-wizard-step.ts  # Step-specific logic
│       └── use-wizard-persist.ts # Persistence logic
├── stores/
│   └── wizard-store.ts         # Zustand store for wizard state
└── validations/
    └── wizard-schemas.ts       # Zod schemas per step

components/
├── wizard/
│   ├── WizardProvider.tsx      # Context provider
│   ├── WizardShell.tsx         # Layout wrapper
│   ├── WizardProgress.tsx      # Progress indicator
│   ├── WizardNavigation.tsx    # Next/Back buttons
│   ├── steps/
│   │   ├── WelcomeStep.tsx
│   │   ├── BusinessTypeStep.tsx
│   │   ├── BusinessDetailsStep.tsx
│   │   ├── SalesChannelStep.tsx
│   │   ├── LocationStep.tsx
│   │   ├── ProductsStep.tsx
│   │   ├── BrandingStep.tsx
│   │   ├── ContactStep.tsx
│   │   └── ReviewStep.tsx
│   └── shared/
│       ├── OptionCard.tsx      # Selectable option cards
│       ├── QuestionCard.tsx    # Question with options
│       └── AIAssistant.tsx     # AI helper component

app/
└── dashboard/
    └── new/
        ├── page.tsx            # Wizard entry point
        └── layout.tsx          # Wizard layout
```

### XState Machine Definition

```typescript
// lib/wizard/machine.ts
import { createMachine, assign } from "xstate";
import type { WizardContext, WizardEvent } from "./types";

export const wizardMachine = createMachine({
  id: "storeWizard",
  initial: "welcome",
  context: {
    // Business understanding
    businessType: null,
    businessSubtype: null,
    businessDescription: "",

    // Dynamic answers
    answers: {},

    // Derived configuration
    derivedConfig: null,

    // Store details
    storeName: "",
    storeSlug: "",
    tagline: "",
    logo: null,
    contactEmail: "",
    contactPhone: "",
    currency: "AFN",

    // Meta
    currentQuestionIndex: 0,
    completedSteps: [],
    errors: {},
  },
  states: {
    welcome: {
      on: {
        NEXT: "businessType",
        SKIP: "basicInfo",
      },
    },
    businessType: {
      on: {
        SELECT_TYPE: {
          actions: assign({
            businessType: (_, event) => event.type,
          }),
        },
        NEXT: {
          target: "businessSubtype",
          guard: "hasBusinessType",
        },
        BACK: "welcome",
      },
    },
    businessSubtype: {
      on: {
        SELECT_SUBTYPE: {
          actions: assign({
            businessSubtype: (_, event) => event.subtype,
          }),
        },
        NEXT: {
          target: "dynamicQuestions",
          actions: "generateDynamicQuestions",
        },
        BACK: "businessType",
      },
    },
    dynamicQuestions: {
      initial: "question",
      states: {
        question: {
          on: {
            ANSWER: {
              actions: "recordAnswer",
            },
            NEXT: [
              {
                target: "question",
                guard: "hasMoreQuestions",
                actions: "incrementQuestion",
              },
              {
                target: "#storeWizard.deriveConfig",
              },
            ],
            BACK: [
              {
                target: "question",
                guard: "hasPreviousQuestion",
                actions: "decrementQuestion",
              },
              {
                target: "#storeWizard.businessSubtype",
              },
            ],
            SKIP: {
              actions: "skipQuestion",
              target: "question",
            },
          },
        },
      },
    },
    deriveConfig: {
      invoke: {
        src: "deriveStoreConfig",
        onDone: {
          target: "basicInfo",
          actions: assign({
            derivedConfig: (_, event) => event.data,
          }),
        },
        onError: "basicInfo",
      },
    },
    basicInfo: {
      on: {
        UPDATE_NAME: {
          actions: ["updateName", "generateSlug"],
        },
        UPDATE_SLUG: {
          actions: "updateSlug",
        },
        UPDATE_TAGLINE: {
          actions: "updateTagline",
        },
        NEXT: {
          target: "branding",
          guard: "basicInfoValid",
        },
        BACK: "dynamicQuestions",
      },
    },
    branding: {
      on: {
        UPLOAD_LOGO: {
          actions: "uploadLogo",
        },
        REMOVE_LOGO: {
          actions: "removeLogo",
        },
        UPDATE_HEADER_DISPLAY: {
          actions: "updateHeaderDisplay",
        },
        NEXT: "contact",
        BACK: "basicInfo",
      },
    },
    contact: {
      on: {
        UPDATE_EMAIL: {
          actions: "updateEmail",
        },
        UPDATE_PHONE: {
          actions: "updatePhone",
        },
        UPDATE_CURRENCY: {
          actions: "updateCurrency",
        },
        NEXT: {
          target: "review",
          guard: "contactValid",
        },
        BACK: "branding",
      },
    },
    review: {
      on: {
        EDIT_SECTION: {
          actions: "navigateToSection",
        },
        SUBMIT: "creating",
        BACK: "contact",
      },
    },
    creating: {
      invoke: {
        src: "createStore",
        onDone: "success",
        onError: {
          target: "review",
          actions: assign({
            errors: (_, event) => event.data,
          }),
        },
      },
    },
    success: {
      type: "final",
      data: (context) => ({
        storeSlug: context.storeSlug,
        derivedConfig: context.derivedConfig,
      }),
    },
  },
});
```

### Dynamic Question System

```typescript
// lib/wizard/questions.ts

export interface WizardQuestion {
  id: string;
  question: string;
  description?: string;
  type: "single" | "multi" | "text" | "number";
  options?: QuestionOption[];
  dependsOn?: {
    questionId: string;
    values: string[];
  };
  configImpact: string[]; // Which config fields this affects
  required: boolean;
  skipLabel?: string;
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  recommended?: boolean;
}

// Example questions for different flows
export const baseQuestions: WizardQuestion[] = [
  {
    id: "sales_channel",
    question: "How do you sell your products?",
    description: "This helps us set up the right checkout options",
    type: "multi",
    options: [
      {
        value: "online",
        label: "Online (Website)",
        description: "Customers order through your website",
        icon: "Globe",
        recommended: true,
      },
      {
        value: "in_person",
        label: "In Person (Physical Store)",
        description: "Customers visit your location",
        icon: "Store",
      },
      {
        value: "phone_whatsapp",
        label: "Phone / WhatsApp Orders",
        description: "Customers contact you directly",
        icon: "Phone",
      },
      {
        value: "social_media",
        label: "Social Media",
        description: "Customers order via Instagram, Facebook, etc.",
        icon: "Share2",
      },
    ],
    configImpact: ["storeMode", "checkoutConfig"],
    required: true,
  },
  {
    id: "delivery_method",
    question: "How do you deliver products to customers?",
    type: "multi",
    dependsOn: {
      questionId: "sales_channel",
      values: ["online", "phone_whatsapp"],
    },
    options: [
      {
        value: "shipping",
        label: "Shipping / Courier",
        description: "Ship to customer address",
        icon: "Truck",
      },
      {
        value: "local_delivery",
        label: "Local Delivery",
        description: "You deliver within your area",
        icon: "MapPin",
      },
      {
        value: "pickup",
        label: "Store Pickup",
        description: "Customers pick up from your location",
        icon: "Package",
      },
      {
        value: "digital",
        label: "Digital Download",
        description: "Products delivered electronically",
        icon: "Download",
      },
    ],
    configImpact: [
      "checkoutConfig.requiresShipping",
      "checkoutConfig.enableLocalDelivery",
    ],
    required: true,
  },
  {
    id: "product_variety",
    question: "Do your products come in different options?",
    description: "Like different sizes, colors, or materials",
    type: "single",
    options: [
      {
        value: "yes",
        label: "Yes, with variations",
        description: "e.g., T-shirts in S, M, L or phones in different colors",
        recommended: true,
      },
      {
        value: "no",
        label: "No, single option each",
        description: "Each product is sold as-is",
      },
    ],
    configImpact: ["productFields.enableVariants"],
    required: true,
  },
  {
    id: "price_display",
    question: "How do you want to show prices?",
    type: "single",
    options: [
      {
        value: "fixed",
        label: "Show exact prices",
        description: "Customers see prices immediately",
        recommended: true,
      },
      {
        value: "starting_from",
        label: 'Show "Starting from" prices',
        description: "For products with varying costs",
      },
      {
        value: "contact",
        label: "Contact for price",
        description: "Prices discussed per inquiry",
      },
    ],
    configImpact: [
      "productFields.priceType",
      "productFields.showPricePublicly",
    ],
    required: true,
  },
];

// Business-type specific questions
export const businessTypeQuestions: Record<string, WizardQuestion[]> = {
  travel_agency: [
    {
      id: "travel_services",
      question: "What travel services do you offer?",
      type: "multi",
      options: [
        { value: "tours", label: "Tour Packages", icon: "Map" },
        { value: "flights", label: "Flight Bookings", icon: "Plane" },
        { value: "hotels", label: "Hotel Reservations", icon: "Building" },
        { value: "visa", label: "Visa Services", icon: "FileText" },
        { value: "insurance", label: "Travel Insurance", icon: "Shield" },
      ],
      configImpact: ["defaultCategories", "features"],
      required: true,
    },
    {
      id: "booking_style",
      question: "How do customers book with you?",
      type: "single",
      options: [
        {
          value: "inquiry",
          label: "Send inquiry, you respond with quote",
          recommended: true,
        },
        {
          value: "instant",
          label: "Book and pay instantly online",
        },
        {
          value: "deposit",
          label: "Pay deposit, rest later",
        },
      ],
      configImpact: [
        "checkoutConfig.enableQuoteRequest",
        "checkoutConfig.enableBooking",
      ],
      required: true,
    },
  ],
  car_dealership: [
    {
      id: "vehicle_types",
      question: "What types of vehicles do you sell?",
      type: "multi",
      options: [
        { value: "sedan", label: "Sedans", icon: "Car" },
        { value: "suv", label: "SUVs", icon: "Truck" },
        { value: "truck", label: "Trucks", icon: "Truck" },
        { value: "motorcycle", label: "Motorcycles", icon: "Bike" },
        { value: "commercial", label: "Commercial Vehicles", icon: "Bus" },
      ],
      configImpact: ["defaultCategories"],
      required: true,
    },
    {
      id: "vehicle_condition",
      question: "Do you sell new or used vehicles?",
      type: "single",
      options: [
        { value: "new", label: "New only" },
        { value: "used", label: "Used only" },
        { value: "both", label: "Both new and used", recommended: true },
      ],
      configImpact: ["productFields.customFields"],
      required: true,
    },
    {
      id: "purchase_flow",
      question: "How do customers typically buy from you?",
      type: "single",
      options: [
        {
          value: "visit",
          label: "Visit showroom and negotiate",
          recommended: true,
        },
        {
          value: "inquiry",
          label: "Send inquiry online first",
        },
        {
          value: "reserve",
          label: "Reserve online with deposit",
        },
      ],
      configImpact: ["features.enableTestDrive", "checkoutConfig"],
      required: true,
    },
  ],
  restaurant: [
    {
      id: "dining_options",
      question: "How can customers dine with you?",
      type: "multi",
      options: [
        { value: "dine_in", label: "Dine-in", icon: "UtensilsCrossed" },
        { value: "takeaway", label: "Takeaway", icon: "Package" },
        { value: "delivery", label: "Delivery", icon: "Bike" },
        { value: "reservation", label: "Table Reservations", icon: "Calendar" },
      ],
      configImpact: ["features.enableSeats", "checkoutConfig"],
      required: true,
    },
    {
      id: "menu_style",
      question: "How often does your menu change?",
      type: "single",
      options: [
        { value: "fixed", label: "Fixed menu", recommended: true },
        { value: "daily", label: "Daily specials" },
        { value: "seasonal", label: "Seasonal changes" },
      ],
      configImpact: ["productFields"],
      required: false,
      skipLabel: "Skip, I'll set this up later",
    },
  ],
  real_estate: [
    {
      id: "property_types",
      question: "What types of properties do you deal with?",
      type: "multi",
      options: [
        {
          value: "residential",
          label: "Residential (Houses, Apartments)",
          icon: "Home",
        },
        {
          value: "commercial",
          label: "Commercial (Offices, Shops)",
          icon: "Building",
        },
        { value: "land", label: "Land & Plots", icon: "MapPin" },
        { value: "industrial", label: "Industrial", icon: "Factory" },
      ],
      configImpact: ["defaultCategories"],
      required: true,
    },
    {
      id: "listing_type",
      question: "Are your properties for sale or rent?",
      type: "single",
      options: [
        { value: "sale", label: "For Sale" },
        { value: "rent", label: "For Rent" },
        { value: "both", label: "Both", recommended: true },
      ],
      configImpact: ["productFields.customFields"],
      required: true,
    },
    {
      id: "contact_preference",
      question: "How should interested customers contact you?",
      type: "multi",
      options: [
        { value: "phone", label: "Phone Call", recommended: true },
        { value: "whatsapp", label: "WhatsApp" },
        { value: "form", label: "Inquiry Form" },
        { value: "schedule", label: "Schedule Viewing" },
      ],
      configImpact: [
        "features.enableVirtualTour",
        "checkoutConfig.enableQuoteRequest",
      ],
      required: true,
    },
  ],
};
```

### Configuration Generator

```typescript
// lib/wizard/config-generator.ts

import { businessTypeConfigs } from "./business-types";
import type { WizardContext, StoreConfiguration } from "./types";

export function generateStoreConfig(
  context: WizardContext
): StoreConfiguration {
  // Start with base config for business type
  const baseConfig =
    businessTypeConfigs[context.businessSubtype || context.businessType];

  // Apply answer-based modifications
  const config = { ...baseConfig };

  // Sales channel → Store mode
  const salesChannels = context.answers.sales_channel || [];
  if (salesChannels.includes("online") && salesChannels.includes("in_person")) {
    config.suggestedStoreMode = "full";
  } else if (salesChannels.includes("online")) {
    config.suggestedStoreMode = "online_only";
  } else if (salesChannels.includes("in_person")) {
    config.suggestedStoreMode = "offline_only";
  } else {
    config.suggestedStoreMode = "catalog";
  }

  // Delivery methods
  const deliveryMethods = context.answers.delivery_method || [];
  config.checkoutConfig = {
    ...config.checkoutConfig,
    requiresShipping: deliveryMethods.includes("shipping"),
    enableLocalDelivery: deliveryMethods.includes("local_delivery"),
    enablePickup: deliveryMethods.includes("pickup"),
  };

  // Product variations
  config.productFields.enableVariants =
    context.answers.product_variety === "yes";

  // Price display
  const priceDisplay = context.answers.price_display;
  config.productFields.priceType =
    priceDisplay === "contact"
      ? "quote"
      : priceDisplay === "starting_from"
        ? "variable"
        : "fixed";
  config.productFields.showPricePublicly = priceDisplay !== "contact";

  // Apply business-specific answers
  applyBusinessSpecificConfig(config, context);

  return config;
}

function applyBusinessSpecificConfig(
  config: StoreConfiguration,
  context: WizardContext
): void {
  switch (context.businessType) {
    case "travel_agency":
      if (context.answers.booking_style === "inquiry") {
        config.checkoutConfig.enableQuoteRequest = true;
        config.checkoutConfig.enableBooking = false;
      }
      break;

    case "car_dealership":
      config.features.enableTestDrive =
        context.answers.purchase_flow !== "reserve";
      break;

    case "restaurant":
      config.features.enableSeats =
        context.answers.dining_options?.includes("reservation");
      break;

    case "real_estate":
      config.features.enableVirtualTour =
        context.answers.contact_preference?.includes("schedule");
      break;
  }
}
```

---

## Wizard Flow Design

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Welcome & Intent                                                    │
│                                                                              │
│  "Let's set up your store! First, tell us about your business."             │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ 🏪 I'm      │  │ 💡 Just     │  │ ⚡ I know   │                       │
│  │ starting a  │  │ exploring   │  │ exactly     │                       │
│  │ new business│  │ options     │  │ what I need │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│                                                                              │
│  "Just exploring" → Quick setup with defaults                               │
│  "I know what I need" → Skip to advanced config                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Business Type                                                       │
│                                                                              │
│  "What type of business are you running?"                                   │
│                                                                              │
│  🔍 Search: [Type to search...]                                             │
│                                                                              │
│  Popular categories:                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │ 👕      │ │ 🍔      │ │ 🚗      │ │ ✈️      │ │ 🏠      │              │
│  │ Fashion │ │ Food &  │ │ Auto-   │ │ Travel  │ │ Real    │              │
│  │ & Retail│ │ Dining  │ │ motive  │ │ Agency  │ │ Estate  │              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                              │
│  [See all categories...]                                                     │
│                                                                              │
│  Or describe your business:                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ I sell handmade jewelry and accessories online...                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  [AI will suggest the best category]                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Business Subtype (if applicable)                                    │
│                                                                              │
│  "What kind of fashion business?"                                           │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 👔               │  │ 👗               │  │ 👟               │          │
│  │ Men's Clothing   │  │ Women's Fashion  │  │ Footwear         │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 💍               │  │ 🧒               │  │ 📦               │          │
│  │ Jewelry &        │  │ Kids &           │  │ General          │          │
│  │ Accessories      │  │ Baby Wear        │  │ Clothing Store   │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4-N: Dynamic Questions (based on business type)                        │
│                                                                              │
│  Question 1 of 4                    ━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░     │
│                                                                              │
│  "How do you sell your products?"                                           │
│  Select all that apply                                                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ 🌐 Online (Website)                                   Recommended │   │
│  │   Customers order through your website                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   🏪 In Person (Physical Store)                                     │   │
│  │   Customers visit your location                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ 📱 Phone / WhatsApp Orders                                        │   │
│  │   Customers contact you directly                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [Skip this question]                                    [Back] [Continue]  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP N+1: Store Identity                                                    │
│                                                                              │
│  "Now let's give your store an identity"                                    │
│                                                                              │
│  Store Name                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Kabul Fashion House                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Store URL                                                                   │
│  kakamalem.com/store/ ┌───────────────────────────┐ ✓ Available            │
│                       │ kabul-fashion-house       │                         │
│                       └───────────────────────────┘                         │
│                                                                              │
│  Tagline (optional)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Quality Afghan fashion for modern families                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  💡 AI Suggestion: "Based on your business type, consider emphasizing      │
│     your unique Afghan designs or quality fabrics."                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP N+2: Branding                                                          │
│                                                                              │
│  "Add your store's visual identity"                                         │
│                                                                              │
│  Logo                                        Live Preview                    │
│  ┌─────────────────────┐                    ┌─────────────────────────┐    │
│  │                     │                    │ ┌───────────────────┐   │    │
│  │   [Upload Logo]     │                    │ │ 🏪 Kabul Fashion  │   │    │
│  │   PNG, JPG, SVG     │                    │ │    House          │   │    │
│  │   Max 2MB           │                    │ └───────────────────┘   │    │
│  │                     │                    │                         │    │
│  └─────────────────────┘                    │  Women's | Men's | Kids │    │
│                                             │                         │    │
│  Header Display                             │  [Featured Products]    │    │
│  ○ Logo only                                │                         │    │
│  ● Store name only                          └─────────────────────────┘    │
│  ○ Logo and name                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP N+3: Contact & Currency                                                │
│                                                                              │
│  "How can customers reach you?"                                             │
│                                                                              │
│  Email (for order notifications)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ contact@kabulfashion.com                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Phone / WhatsApp                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ +93 70 123 4567                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Currency                                                                    │
│  ● 🇦🇫 AFN (Afghan Afghani) — Recommended for local customers              │
│  ○ 🇺🇸 USD (US Dollar) — For international customers                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP FINAL: Review & Create                                                 │
│                                                                              │
│  "Review your store setup"                                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📍 Business Type                                           [Edit]   │   │
│  │    Fashion & Retail → Women's Fashion                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 🛒 Sales Channels                                          [Edit]   │   │
│  │    Online store with WhatsApp ordering                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 📦 Delivery Options                                        [Edit]   │   │
│  │    Shipping, Local delivery, Store pickup                           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 🏪 Store Details                                           [Edit]   │   │
│  │    Kabul Fashion House                                              │   │
│  │    kakamalem.com/store/kabul-fashion-house                          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 💰 Currency                                                [Edit]   │   │
│  │    AFN (Afghan Afghani)                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✅ We'll automatically set up:                                      │   │
│  │    • Product variants (Size, Color)                                 │   │
│  │    • Inventory tracking                                             │   │
│  │    • Online checkout with card payments                             │   │
│  │    • Default categories for fashion stores                          │   │
│  │    • Wishlist feature for customers                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                               [Back] [Create My Store →]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## AI-Powered Features

### 1. Business Type Detection from Description

```typescript
// Example prompt for Claude API
const detectBusinessType = async (description: string) => {
  const prompt = `
    Analyze this business description and categorize it:
    "${description}"

    Return JSON with:
    {
      "primaryType": "one of: retail, food_hospitality, services, real_estate, automotive, b2b, digital",
      "subtype": "specific subtype",
      "confidence": 0-1,
      "suggestedCategories": ["category1", "category2"],
      "recommendedFeatures": ["feature1", "feature2"],
      "reasoning": "brief explanation"
    }
  `;

  // Call Claude API
  return await anthropic.messages.create({
    model: "claude-3-haiku", // Fast, cheap for classification
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
};
```

### 2. Intelligent Tagline Suggestions

```typescript
const suggestTagline = async (context: {
  businessType: string;
  storeName: string;
  location?: string;
}) => {
  const prompt = `
    Generate 3 tagline suggestions for an Afghan ${context.businessType}
    named "${context.storeName}"${context.location ? ` in ${context.location}` : ""}.

    Requirements:
    - Keep under 60 characters
    - Culturally appropriate for Afghanistan
    - Professional but friendly
    - Highlight unique value

    Return as JSON array of strings.
  `;

  return await anthropic.messages.create({
    model: "claude-3-haiku",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
};
```

### 3. Smart Default Categories

```typescript
const suggestCategories = async (businessInfo: {
  type: string;
  subtype: string;
  description?: string;
}) => {
  const prompt = `
    Suggest 5-8 product categories for a ${businessInfo.subtype}
    (${businessInfo.type}) in Afghanistan.

    ${businessInfo.description ? `Business description: ${businessInfo.description}` : ""}

    Consider:
    - Local Afghan market preferences
    - Common category structures
    - Dari/Pashto naming where appropriate

    Return JSON: { "categories": [{ "name": "string", "nameLocal"?: "string" }] }
  `;

  return await anthropic.messages.create({
    model: "claude-3-haiku",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
};
```

### 4. Onboarding Assistant Chat

A minimal chat interface for questions during setup:

```typescript
// components/wizard/shared/AIAssistant.tsx
'use client';

export function AIAssistant({ context }: { context: WizardContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const systemPrompt = `
    You are helping a user set up their ${context.businessType} store on Kaka Malem.
    Current step: ${context.currentStep}
    Keep responses brief (2-3 sentences).
    Focus on practical advice for Afghan market.
  `;

  return (
    <div className="fixed bottom-4 right-4">
      <Button onClick={() => setIsOpen(true)}>
        <MessageCircle className="h-5 w-5" />
        Need help?
      </Button>

      {isOpen && (
        <ChatWindow
          systemPrompt={systemPrompt}
          messages={messages}
          onSend={handleSend}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
```

---

## Database Schema Changes

### New Tables

```sql
-- Business type taxonomy
CREATE TABLE business_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_local VARCHAR(255),  -- Dari/Pashto
  parent_id UUID REFERENCES business_types(id),
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business type configurations (JSON blob)
CREATE TABLE business_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type_id UUID REFERENCES business_types(id) ON DELETE CASCADE,
  config JSONB NOT NULL,  -- Full configuration object
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track wizard completion for analytics
CREATE TABLE wizard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  business_type_id UUID REFERENCES business_types(id),
  answers JSONB,  -- All wizard answers
  derived_config JSONB,  -- Generated configuration
  store_id UUID REFERENCES tenants(id),  -- Created store (if completed)
  abandoned_at_step VARCHAR(50),  -- For funnel analysis
  device_type VARCHAR(50),
  referrer VARCHAR(500)
);

-- Wizard question overrides (admin customization)
CREATE TABLE wizard_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type_id UUID REFERENCES business_types(id),
  question_key VARCHAR(100) NOT NULL,
  question_text TEXT NOT NULL,
  question_text_local TEXT,
  options JSONB,
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_type_id, question_key)
);
```

### Tenant Table Additions

```sql
ALTER TABLE tenants ADD COLUMN business_type_id UUID REFERENCES business_types(id);
ALTER TABLE tenants ADD COLUMN business_config JSONB;  -- Merged config from wizard
ALTER TABLE tenants ADD COLUMN wizard_answers JSONB;   -- Original answers for reference
ALTER TABLE tenants ADD COLUMN setup_completed_at TIMESTAMPTZ;
```

---

## Implementation Phases

### Phase 1: Foundation (Sprint 1-2)

**Goal**: Core wizard architecture without AI features

| Task                                             | Priority | Effort |
| ------------------------------------------------ | -------- | ------ |
| Create XState wizard machine                     | P0       | Medium |
| Implement business type taxonomy (database + UI) | P0       | Medium |
| Build dynamic question system                    | P0       | Large  |
| Create step components (all new UI)              | P0       | Large  |
| Zustand persistence layer                        | P1       | Small  |
| Migrate existing wizard to new system            | P0       | Medium |
| Unit tests for config generator                  | P1       | Medium |

**Deliverables**:

- New `/dashboard/new` wizard
- 10+ business types with configurations
- Dynamic questions working
- State persistence (resume wizard)

### Phase 2: Intelligence (Sprint 3-4)

**Goal**: AI-powered features and smart defaults

| Task                                     | Priority | Effort |
| ---------------------------------------- | -------- | ------ |
| Business type detection from description | P0       | Medium |
| Tagline suggestions                      | P1       | Small  |
| Category suggestions                     | P1       | Small  |
| AI Assistant chat widget                 | P2       | Medium |
| Prompt engineering & testing             | P1       | Medium |
| Rate limiting & caching for AI calls     | P1       | Small  |

**Deliverables**:

- AI business type detection
- Smart suggestions throughout wizard
- Optional AI assistant
- Cost-optimized AI usage

### Phase 3: Industry Templates (Sprint 5-6)

**Goal**: Deep customization per industry

| Task                                           | Priority | Effort |
| ---------------------------------------------- | -------- | ------ |
| Travel agency preset (bookings, tours)         | P1       | Medium |
| Car dealership preset (test drives, inventory) | P1       | Medium |
| Restaurant preset (menu, reservations)         | P1       | Medium |
| Real estate preset (listings, viewings)        | P1       | Medium |
| Hotel preset (rooms, availability)             | P2       | Medium |
| Service business preset (appointments)         | P2       | Medium |

**Deliverables**:

- 6+ fully-configured industry templates
- Industry-specific default categories
- Custom fields per industry
- Specialized checkout flows

### Phase 4: Analytics & Optimization (Sprint 7-8)

**Goal**: Measure and improve conversion

| Task                                  | Priority | Effort  |
| ------------------------------------- | -------- | ------- |
| Wizard analytics dashboard            | P1       | Medium  |
| Funnel analysis (drop-off by step)    | P1       | Medium  |
| A/B testing infrastructure            | P2       | Large   |
| Question effectiveness tracking       | P2       | Medium  |
| Conversion optimization based on data | P1       | Ongoing |

**Deliverables**:

- Admin analytics for wizard performance
- Drop-off heatmaps
- Question refinement based on data
- Continuous improvement loop

### Phase 5: Advanced Features (Sprint 9+)

**Goal**: Enterprise-grade features

| Task                                    | Priority | Effort |
| --------------------------------------- | -------- | ------ |
| Multi-language wizard (Dari, Pashto)    | P1       | Large  |
| Bulk store creation (franchise support) | P2       | Large  |
| Template marketplace (user-created)     | P3       | Large  |
| Wizard customization for white-label    | P3       | Medium |
| Import from other platforms             | P2       | Large  |

---

## Success Metrics

### Primary KPIs

| Metric                  | Current  | Target  | Measurement           |
| ----------------------- | -------- | ------- | --------------------- |
| Wizard completion rate  | ~60%     | >85%    | `completed / started` |
| Time to first product   | ~30 min  | <10 min | Analytics tracking    |
| Support tickets (setup) | ~20/week | <5/week | Helpdesk data         |
| User satisfaction       | Unknown  | >4.5/5  | Post-wizard survey    |

### Secondary Metrics

| Metric                   | Description                         |
| ------------------------ | ----------------------------------- |
| Step drop-off rate       | Which steps lose users              |
| AI suggestion acceptance | % of AI suggestions used            |
| Configuration accuracy   | Do users change auto-settings later |
| Return to wizard         | Users who come back to adjust       |

### Tracking Implementation

```typescript
// Analytics events to track
const wizardEvents = {
  WIZARD_STARTED: "wizard_started",
  STEP_VIEWED: "wizard_step_viewed",
  STEP_COMPLETED: "wizard_step_completed",
  QUESTION_ANSWERED: "wizard_question_answered",
  QUESTION_SKIPPED: "wizard_question_skipped",
  AI_SUGGESTION_SHOWN: "wizard_ai_suggestion_shown",
  AI_SUGGESTION_ACCEPTED: "wizard_ai_suggestion_accepted",
  AI_SUGGESTION_REJECTED: "wizard_ai_suggestion_rejected",
  WIZARD_COMPLETED: "wizard_completed",
  WIZARD_ABANDONED: "wizard_abandoned",
  BACK_NAVIGATION: "wizard_back_clicked",
  HELP_REQUESTED: "wizard_help_clicked",
};
```

---

## Technical Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "xstate": "^5.18.0",
    "@xstate/react": "^4.1.0"
  },
  "devDependencies": {
    "@xstate/inspect": "^0.8.0" // For debugging
  }
}
```

### Existing Packages (Already Installed)

- `react-hook-form` + `@hookform/resolvers` - Form handling
- `zod` - Validation
- `framer-motion` - Animations
- `zustand` - State persistence
- `sonner` - Toast notifications

---

## Risk Assessment

| Risk                             | Likelihood | Impact | Mitigation                                     |
| -------------------------------- | ---------- | ------ | ---------------------------------------------- |
| AI costs escalate                | Medium     | Medium | Use Haiku for simple tasks, cache aggressively |
| Users skip questions             | High       | Low    | Sensible defaults, don't require all questions |
| Business types incomplete        | Medium     | Medium | "Other" option with freeform input             |
| Migration breaks existing wizard | Low        | High   | Keep old wizard as fallback during rollout     |
| XState learning curve            | Medium     | Low    | Good documentation, simple machines first      |

---

## Appendix: Competitor Analysis

### Shopify

- **Strengths**: Clear progress, personalized questions, great mobile UX
- **Weaknesses**: Generic for all industries

### Wix

- **Strengths**: AI-powered site generation, 500+ templates
- **Weaknesses**: Can feel overwhelming with options

### Square

- **Strengths**: Industry-specific templates, POS focus
- **Weaknesses**: Limited e-commerce features

### BigCommerce

- **Strengths**: B2B features, enterprise scalability
- **Weaknesses**: Complex setup for small businesses

### Our Differentiation

1. **Afghan market focus** - Local language, AFN currency, WhatsApp integration
2. **Smart defaults** - AI understands Afghan business context
3. **Hybrid model** - Full commerce, POS, or catalog in one platform
4. **Simplicity** - Fewer steps with intelligent automation

---

## References

### UX & Design

- [Webstacks - Multi-Step Form Best Practices](https://www.webstacks.com/blog/multi-step-form)
- [Eleken - Wizard UI Pattern](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained)
- [Candu - Shopify Onboarding](https://www.candu.ai/blog/shopify-onboarding-flow)
- [Eleken - Sign Up Flows](https://www.eleken.co/blog-posts/sign-up-flow)
- [Ping Identity - Frictionless Sign Up](https://www.pingidentity.com/en/resources/blog/post/frictionless-signup.html)

### State Machines

- [XState Documentation](https://xstate.js.org/docs/)
- [XState Wizards](https://github.com/xstate-wizards/xstate-wizards)
- [Kyle Shevlin - XState Guidelines](https://kyleshevlin.com/guidelines-for-state-machines-and-xstate/)
- [First AML - Multi-step Forms with State Machines](https://firstaml.dev/blog/2ldc7qgkjwbg7h2bm3xryc3so6eqb1)

### Form Handling

- [LogRocket - Multi-step Form with RHF + Zod](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/)
- [Build with Matija - RHF + Zustand + Zod Tutorial](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps)
- [React Hook Form Advanced Usage](https://react-hook-form.com/advanced-usage)

### AI & Onboarding

- [Enboarder - AI Onboarding Tools](https://enboarder.com/blog/ai-onboarding-tool-guide-2026/)
- [Userpilot - AI User Onboarding](https://userpilot.com/blog/ai-user-onboarding/)
- [Ravi Mehta - Onboarding Optimization](https://blog.ravi-mehta.com/p/onboarding-optimization)

### E-commerce Platforms

- [Wix eCommerce](https://www.wix.com/ecommerce/website)
- [Hostinger eCommerce](https://www.hostinger.com/ecommerce-website)
- [GoDaddy Online Store](https://www.godaddy.com/websites/online-store)
- [BigCommerce](https://www.bigcommerce.com/articles/ecommerce/ecommerce-website-builder/)
