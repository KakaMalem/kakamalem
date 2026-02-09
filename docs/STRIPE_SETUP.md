# Stripe Setup Guide

This guide covers setting up Stripe for Kaka Malem, including company formation and banking for users in countries where Stripe isn't directly available (like Afghanistan).

## Overview

Stripe is used for:

1. **International store payments** - Customers paying in USD, EUR, GBP, etc.
2. **Pro subscriptions** - Store owners upgrading to Pro plan

Since Stripe doesn't operate in Afghanistan, you'll need a company in a supported country.

## Recommended Setup: UK Ltd + Wise Business

This is the most cost-effective fully-remote option.

### Total Cost (Year 1)

| Item                   | Cost                     |
| ---------------------- | ------------------------ |
| UK Company formation   | £50-100 ($65-130)        |
| Virtual office address | £50-150/year ($65-195)   |
| Wise Business account  | Free                     |
| Stripe account         | Free                     |
| Annual accounting      | £200-400/year ($260-520) |
| **Total**              | **~$400-850**            |

---

## Step 1: Form a UK Limited Company

### Option A: 1st Formations (Recommended)

Website: https://www.1stformations.co.uk

1. Go to 1st Formations
2. Choose "Digital Package" (~£53) - includes:
   - Company formation
   - Registered office address (required by UK law)
   - Digital documents
3. Fill in details:
   - **Company name**: Your choice (e.g., "Kaka Malem Ltd" or "Your Name Trading Ltd")
   - **Director**: Your name, address, nationality
   - **Shareholder**: Usually yourself (100%)
   - **SIC Code**: 47910 (Retail sale via mail order or internet)
4. Upload:
   - Passport scan
   - Proof of address (utility bill, bank statement)
5. Pay and wait 24-48 hours

### Option B: Companies House Direct

Website: https://www.gov.uk/limited-company-formation

- Cheapest option (£12)
- But you need a UK address for "registered office"
- More manual process

### What You'll Receive

- Certificate of Incorporation
- Memorandum of Association
- Company number (for tax/banking)
- Authentication code (for filing)

---

## Step 2: Open Wise Business Account

Wise (formerly TransferWise) is the easiest bank account to open remotely.

### Process

1. Go to https://wise.com/business
2. Click "Open a business account"
3. Select "United Kingdom" as country
4. Choose "Limited company"
5. Enter company details:
   - Company name (exactly as registered)
   - Company number
   - Registered address
6. Add your personal details as director
7. Upload documents:
   - Certificate of Incorporation
   - Your passport
   - Proof of your address
8. Wait 1-3 business days for verification

### What You Get

- **GBP account** with UK sort code + account number
- **EUR account** with IBAN
- **USD account** with routing + account number
- Debit card (optional, ships internationally)

### Fees

- Account opening: Free
- Receiving money: Free
- Currency conversion: ~0.5-1% (much better than banks)
- Sending money: Small fee based on amount

---

## Step 3: Set Up Stripe

### Create Stripe Account

1. Go to https://stripe.com
2. Click "Start now"
3. Sign up with your email
4. Select "United Kingdom" as country

### Business Verification

1. **Business type**: Private limited company
2. **Company details**:
   - Legal name (from Certificate of Incorporation)
   - Company number
   - Registered address
   - Website: https://kakamalem.com
3. **Personal details** (as director):
   - Full name
   - Date of birth
   - Home address
   - Last 4 digits of national ID (passport number works)
4. **Bank account**:
   - Use your Wise GBP account details
   - Sort code + Account number

### Verification Documents

Stripe may request:

- Certificate of Incorporation
- Passport
- Proof of address
- Proof of business (screenshot of your website)

### Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://kakamalem.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.refunded`
4. Copy the webhook signing secret

### Create Pro Subscription Product

1. Go to Stripe Dashboard → Products
2. Click "Add product"
3. Fill in:
   - **Name**: Kaka Malem Pro
   - **Description**: Unlimited products, priority support
4. Add pricing:
   - **Price**: 1,100 AFN/month (or USD equivalent ~$12-15)
   - **Billing period**: Monthly
   - **Currency**: USD (recommended for international)
5. Copy the Price ID (starts with `price_`)

---

## Step 4: Configure Environment Variables

Add these to your `.env` file on the VPS:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
```

### Get Your Keys

1. **Publishable Key**: Dashboard → Developers → API keys → Publishable key
2. **Secret Key**: Dashboard → Developers → API keys → Secret key (click to reveal)
3. **Webhook Secret**: Dashboard → Developers → Webhooks → Your endpoint → Signing secret
4. **Price ID**: Dashboard → Products → Your product → Price ID

### GitHub Secrets

Add to your repository (Settings → Secrets → Actions):

| Secret Name              | Value         |
| ------------------------ | ------------- |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |

---

## Step 5: Test the Integration

### Test Mode

Before going live, test with Stripe test keys:

- Use `pk_test_...` and `sk_test_...` keys
- Test card: `4242 4242 4242 4242` (any future expiry, any CVC)

### Test Scenarios

1. **Store payment flow**:
   - Add product to cart
   - Checkout with Stripe
   - Use test card
   - Verify order marked as paid

2. **Pro subscription**:
   - Go to billing page
   - Click upgrade to Pro
   - Complete payment
   - Verify subscription active

3. **Webhook events**:
   - Check `/api/webhooks/stripe` receives events
   - Verify database updates correctly

### Stripe CLI (Local Testing)

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
```

---

## Ongoing Compliance

### UK Company Requirements

1. **Confirmation Statement** (annual): £13
   - Due once per year
   - Confirm company details are correct
   - File at Companies House

2. **Annual Accounts**:
   - Due 9 months after financial year end
   - Small company: Simplified accounts
   - Use an online accountant (Crunch, FreeAgent) ~£200-400/year

3. **Corporation Tax Return**:
   - Due 12 months after financial year end
   - 25% on profits (19% if profits under £50K)
   - File with HMRC

### Recommended Accountants (Remote-Friendly)

- **Crunch** (crunch.co.uk) - From £35/month
- **FreeAgent** (freeagent.com) - From £19/month + accountant
- **Xero** (xero.com) - Software only, find your own accountant

---

## Troubleshooting

### Wise Account Rejected

- Ensure company documents match exactly
- Try again with clearer document scans
- Contact Wise support with your use case

### Stripe Verification Stuck

- Ensure website is live and shows business activity
- Add privacy policy and terms of service
- Respond promptly to any document requests

### Payments Not Working

1. Check Stripe Dashboard for errors
2. Verify webhook is receiving events
3. Check `.env` has correct keys
4. Ensure webhook secret matches

### Subscription Not Updating

1. Check webhook logs in Stripe Dashboard
2. Verify `tenantId` is in subscription metadata
3. Check database for subscription status

---

## Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Wise Business Help**: https://wise.com/help/business
- **UK Companies House**: https://www.gov.uk/government/organisations/companies-house
- **HMRC (UK Tax)**: https://www.gov.uk/government/organisations/hm-revenue-customs
