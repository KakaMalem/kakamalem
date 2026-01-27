# Order Management Refactor Plan

## Executive Summary

This document outlines a comprehensive refactor of the order details and order creation pages to achieve enterprise-level UX for digitally illiterate users while eliminating redundancies and adding missing functionality.

---

## Current Issues Identified

### 1. Payment Over-Collection Display (104% Scenario)

**Root Cause:** When order total is reduced (via discount) after payments are recorded, `paid > total`, causing percentage > 100%.

**Current Code (line 107):**

```typescript
const paidPercentage = total > 0 ? (paid / total) * 100 : isPaid ? 100 : 0;
```

**Solution:** Handle overpayment as "credit" or "refund due" rather than showing >100%.

### 2. Redundant Information Display

Order totals appear in **5 different locations**:

- Order header area
- Order items section (bottom summary)
- Payment section (as total reference)
- Refund section (for calculation)
- Total adjustment popover (for preview)

### 3. Missing Discount During Creation

Currently, discounts can only be applied after order creation via `OrderTotalAdjustment` component. The offline sales form has no upfront discount capability.

### 4. Scattered UI Components

Payment-related logic spread across:

- `order-payment-section.tsx`
- `order-refund.tsx`
- `order-total-adjustment.tsx`
- `order-shipping-adjustment.tsx`

---

## Refactor Todo List

### Phase 1: Foundation & Data Layer (Critical)

- [ ] **1.1 Create unified commerce types**
  - Create `lib/types/order-management.ts` with strict TypeScript types
  - Define `OrderFinancials` interface consolidating all money fields
  - Add `PaymentState` type with overpayment handling
  - Add discriminated unions for order states

- [ ] **1.2 Fix overpayment display logic**
  - Show "Credit: X AFN" when paid > total instead of >100%
  - Add visual indicator for refund-due state
  - Cap progress bar at 100%, show credit separately
  - Add server action to process overpayment refund

- [ ] **1.3 Consolidate order calculations**
  - Create `lib/utils/order-calculations.ts`
  - Single source of truth for: subtotal, discount, shipping, tax, total, balance
  - Handle all edge cases (refunds, adjustments, overpayments)
  - Add Zod runtime validation for financial data

### Phase 2: Order Creation UX Overhaul

- [ ] **2.1 Add discount support to offline sales form**
  - Add discount input field (amount or percentage toggle)
  - Quick discount buttons: 5%, 10%, 15%, 20%, custom
  - Show real-time total update with discount preview
  - Reason field for discount (optional, for audit)

- [ ] **2.2 Implement stepped checkout wizard**
  - Step 1: Select products (current product search)
  - Step 2: Review & discount (apply discounts, see totals)
  - Step 3: Payment (full/partial/pay later)
  - Step 4: Confirmation (receipt preview)
  - Add visual progress indicator with large touch targets

- [ ] **2.3 Add large-format POS mode**
  - Create `/dashboard/[slug]/pos` route for dedicated POS
  - Landscape-optimized layout for tablets
  - Extra-large buttons (minimum 48px touch targets)
  - Numpad for amount entry (no keyboard required)
  - Sound feedback for actions (optional, toggleable)

- [ ] **2.4 Implement smart product search**
  - Add barcode/SKU quick scan input
  - Recent products section (last 10 sold)
  - Favorites/quick-access products per staff
  - Category-based quick filters

### Phase 3: Order Details Page Consolidation

- [ ] **3.1 Create unified OrderSummaryCard component**
  - Single card showing all financial info
  - Collapsible breakdown (subtotal, shipping, tax, discount)
  - Clear total with payment status
  - Remove duplicate totals from other sections

- [ ] **3.2 Implement OrderActionsPanel**
  - Consolidate all adjustment actions into one panel
  - Sections: Payment, Shipping, Discounts, Refunds
  - Use Accordion pattern for organization
  - Context-aware: show only relevant actions per order state

- [ ] **3.3 Create visual OrderTimeline component**
  - Horizontal timeline showing order lifecycle
  - Events: created, paid, processing, shipped, delivered
  - Click event to see details in popover
  - Color-coded status indicators

- [ ] **3.4 Add OrderQuickView sheet**
  - For mobile: full-screen sheet with essential info
  - Large action buttons at bottom
  - Swipe gestures for common actions
  - Pull-to-refresh for updates

### Phase 4: Enterprise UX Patterns for Illiterate Users

- [ ] **4.1 Implement visual status system**
  - Large color-coded status cards (not just badges)
  - Icon-based status indicators (checkmark, truck, box, etc.)
  - Status descriptions in simple language
  - Consider Dari/Pashto translations for status

- [ ] **4.2 Add confirmation dialogs with previews**
  - Before any financial action, show "before vs after" preview
  - Large confirm/cancel buttons
  - Use red for destructive, green for additive actions
  - Add "undo" capability within 10 seconds of action

- [ ] **4.3 Implement guided action flows**
  - Step-by-step guides for complex actions
  - Progress indicators showing completion
  - "Are you sure?" with consequences explained
  - Success animations (confetti for paid, checkmark for shipped)

- [ ] **4.4 Add haptic/audio feedback**
  - Optional sound effects for key actions
  - Success: pleasant chime
  - Error: distinct warning tone
  - Can be toggled in store settings

- [ ] **4.5 Create simplified mobile view**
  - Card-based layout (one action per screen)
  - Bottom-sheet actions instead of dropdowns
  - Sticky header with order number and status
  - FAB (floating action button) for primary action

### Phase 5: Component Library Improvements

- [ ] **5.1 Create MoneyInput component**
  - Format as user types (1000 -> 1,000)
  - Currency symbol display
  - Min/max validation with visual feedback
  - Quick amount buttons (+100, +500, +1000)

- [ ] **5.2 Create StatusSelector component**
  - Visual grid of status options
  - Disabled states for invalid transitions
  - Confirmation before status change
  - Show what will happen on selection

- [ ] **5.3 Create PaymentMethodPicker component**
  - Large icon buttons for each method
  - Selected state clearly visible
  - Support for custom payment methods per tenant

- [ ] **5.4 Create ReceiptPreview component**
  - Real-time receipt preview before print
  - Customizable receipt template
  - QR code for digital receipt option

### Phase 6: Performance & Polish

- [ ] **6.1 Implement optimistic updates**
  - Update UI immediately on action
  - Rollback on server error
  - Show loading state only for network-dependent actions

- [ ] **6.2 Add skeleton loaders**
  - Create `OrderDetailsSkeleton` component
  - Match exact layout of loaded state
  - Reduce perceived loading time

- [ ] **6.3 Implement keyboard shortcuts**
  - `P` - Record payment
  - `S` - Change status
  - `R` - Process refund
  - `Ctrl+P` - Print receipt
  - Show shortcuts in tooltips

- [ ] **6.4 Add offline capability**
  - Queue actions when offline
  - Show offline indicator
  - Sync when connection restored
  - Use service worker for caching

---

## Recommended Third-Party Libraries

### Already Using (Keep)

- **sonner** - Toast notifications
- **lucide-react** - Icons
- **@radix-ui** - Headless components
- **zod** - Validation

### Recommended Additions

| Library               | Purpose                          | Why                                           |
| --------------------- | -------------------------------- | --------------------------------------------- |
| `react-number-format` | Currency/number input formatting | Better than manual formatting, handles locale |
| `framer-motion`       | Animations                       | Smooth transitions, gesture support           |
| `@dnd-kit/core`       | Drag and drop                    | Reorder items in cart, intuitive for touch    |
| `use-sound`           | Audio feedback                   | Optional sound effects for actions            |
| `react-hotkeys-hook`  | Keyboard shortcuts               | Better than manual event handling             |
| `vaul`                | Mobile drawers                   | Better sheet/drawer UX on mobile              |
| `cmdk`                | Command palette                  | Quick actions via Ctrl+K                      |

### For Future Consideration

- `react-to-print` - Better print control
- `qrcode.react` - QR codes for receipts
- `react-confetti` - Success celebrations

---

## File Structure After Refactor

```
components/dashboard/orders/
├── order-details/
│   ├── order-summary-card.tsx      # Unified financial summary
│   ├── order-actions-panel.tsx     # Consolidated actions
│   ├── order-timeline.tsx          # Visual lifecycle
│   ├── order-items-list.tsx        # Items display
│   └── order-quick-view.tsx        # Mobile sheet
├── order-creation/
│   ├── checkout-wizard.tsx         # Stepped creation flow
│   ├── product-selector.tsx        # Product search & selection
│   ├── discount-editor.tsx         # Discount application
│   ├── payment-collector.tsx       # Payment recording
│   └── receipt-preview.tsx         # Pre-print preview
├── shared/
│   ├── money-input.tsx             # Formatted currency input
│   ├── status-selector.tsx         # Visual status picker
│   ├── payment-method-picker.tsx   # Payment method selection
│   └── confirmation-dialog.tsx     # Before/after preview dialog
├── pos/
│   ├── pos-layout.tsx              # Full-screen POS layout
│   ├── numpad.tsx                  # Touch numpad
│   └── quick-products.tsx          # Favorites & recent
└── legacy/                         # Old components (to deprecate)
    ├── order-payment-section.tsx
    ├── order-refund.tsx
    └── ...
```

---

## Migration Strategy

### Phase 1-2: Parallel Development

- Build new components alongside existing
- Feature flag to toggle between old/new
- Test with subset of users

### Phase 3: Gradual Rollout

- Enable new UI for new stores first
- Collect feedback and iterate
- Train existing users with guided tour

### Phase 4: Deprecation

- Remove legacy components
- Update documentation
- Clean up feature flags

---

## Success Metrics

1. **Task Completion Rate**: % of orders created without errors
2. **Time to Complete**: Average time to record a sale
3. **Error Rate**: Payment errors, status errors per 1000 orders
4. **User Satisfaction**: NPS from store owners
5. **Support Tickets**: Reduction in order-related support requests

---

## Priority Order

| Priority | Task                           | Impact | Effort |
| -------- | ------------------------------ | ------ | ------ |
| P0       | Fix overpayment display (104%) | High   | Low    |
| P0       | Add discount to offline sales  | High   | Medium |
| P1       | Consolidate order summary      | Medium | Medium |
| P1       | Visual status system           | High   | Medium |
| P1       | Confirmation dialogs           | High   | Low    |
| P2       | POS mode                       | Medium | High   |
| P2       | Checkout wizard                | Medium | High   |
| P3       | Offline capability             | Low    | High   |
| P3       | Keyboard shortcuts             | Low    | Low    |

---

## Implemented Changes (Phase 1)

### Completed

1. **Fixed 104% overpayment display** - [order-payment-section.tsx](../components/dashboard/orders/order-payment-section.tsx)
   - Now shows "Credit: X AFN" instead of >100%
   - Progress bar capped at 100%
   - Blue "Overpaid" status badge
   - Clear credit indicator for customer refund

2. **Added discount to offline sales** - [record-sale-form.tsx](../components/dashboard/offline-sales/record-sale-form.tsx)
   - Collapsible discount section in cart summary
   - Toggle between percentage and fixed amount
   - Quick buttons: 5%, 10%, 15%, 20%
   - Real-time total calculation
   - Available on both desktop and mobile views

3. **Created unified calculation utilities** - [order-calculations.ts](../lib/utils/order-calculations.ts)
   - `parseOrderFinancials()` - Parse string amounts from DB
   - `calculatePaymentState()` - Derive payment status, overpayment, etc.
   - `getPaymentStatusConfig()` - Status labels and colors
   - `calculateDiscount()` - Percentage or fixed discount
   - `roundMoney()`, `moneyEquals()` - Financial precision helpers

4. **Created MoneyInput component** - [money-input.tsx](../components/ui/money-input.tsx)
   - Formats numbers as user types (1000 → 1,000)
   - Currency suffix display
   - Optional quick amount buttons
   - Large touch targets (40-48px)

5. **Created OrderSummaryCard** - [order-summary-card.tsx](../components/dashboard/orders/order-summary-card.tsx)
   - Unified financial display with payment progress
   - Collapsible price breakdown
   - Integrated shipping/total adjustment buttons
   - Payment actions section

6. **Created ConfirmationDialog** - [confirmation-dialog.tsx](../components/ui/confirmation-dialog.tsx)
   - Before/after comparison view
   - Variant styles (default, destructive, warning)
   - Loading state support
   - `useConfirmationDialog()` hook for programmatic use

7. **Improved touch targets**
   - Quantity controls: 32px → 40px
   - Payment method buttons: Added min-h-16, larger icons
   - Full/Later buttons: h-11 (44px)
   - Status select: h-10 (40px)
   - Input fields: h-11 with text-base

---

## Questions to Resolve

1. Should overpayment auto-create a refund record or show as store credit?
2. What discount reasons should be predefined? (Loyalty, Negotiation, Damaged, etc.)
3. Should staff have different discount limits than owners?
4. Is multi-language (Dari/Pashto) status text needed immediately?
5. Should POS mode require a PIN for each transaction?
