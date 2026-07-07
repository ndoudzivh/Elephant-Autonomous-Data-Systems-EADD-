# EADPA — Production Launch Roadmap

## What You Need To Go From "Code Done" → "Live Product Making Money"

---

## PHASE A: Accounts & Services You Need (Day 1-2)

| # | Service | What For | Cost | Link |
|---|---------|----------|------|------|
| 1 | **AWS Account** | Hosting everything (Lambda, S3, DynamoDB, Bedrock) | ~$15-30/month dev | https://aws.amazon.com/free |
| 2 | **Stripe Account** | Accept payments (subscriptions, token metering) | 2.9% + $0.30 per transaction | https://stripe.com |
| 3 | **Domain Name** | e.g. `eadpa.io` or `elephantdata.ai` | ~$12-50/year | https://namecheap.com or https://domains.google |
| 4 | **Vercel** (alternative to AWS for frontend) | Host Next.js frontend (easier than S3+CloudFront) | Free for hobby, $20/month pro | https://vercel.com |
| 5 | **SendGrid / AWS SES** | Transactional emails (welcome, invoices, alerts) | Free tier: 100/day | https://sendgrid.com |
| 6 | **GitHub** (already have) | Code hosting, CI/CD with Actions | Free | https://github.com |
| 7 | **Sentry** | Error tracking and monitoring | Free tier: 5K events/month | https://sentry.io |
| 8 | **PostHog or Mixpanel** | Product analytics (who uses what, conversion funnel) | Free tier available | https://posthog.com |
| 9 | **Crisp or Intercom** | Customer support chat | Free tier for Crisp | https://crisp.chat |

**Total monthly cost to launch: ~$50-100/month** (before any revenue)

---

## PHASE B: Technical Implementation (Week 1-3)

### B1. Authentication (2-3 days)
- [ ] Set up **AWS Cognito** (or Auth0/Clerk) for user sign-up/login
- [ ] Email + password sign-up
- [ ] Google OAuth ("Sign in with Google")
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] JWT token generation for API auth

### B2. Payment Integration — Stripe (3-5 days)
- [ ] Create Stripe account and get API keys
- [ ] Create Products in Stripe Dashboard:
  - Product: "EADPA Pro" → Price: $49/month, $470/year
  - Product: "EADPA Team" → Price: $29/user/month, $278/user/year
- [ ] Implement Stripe Checkout (redirect to Stripe-hosted payment page)
- [ ] Set up Stripe Webhooks to receive:
  - `checkout.session.completed` → activate subscription
  - `invoice.paid` → renew subscription
  - `invoice.payment_failed` → notify user, downgrade after grace period
  - `customer.subscription.deleted` → downgrade to Free
- [ ] Implement metered billing for token overage:
  - Report usage to Stripe via `stripe.subscriptionItems.createUsageRecord()`
- [ ] Build billing portal (Stripe Customer Portal — one line of code)

### B3. Usage Tracking & Metering (2-3 days)
- [ ] Track every AI request: tokens in, tokens out, cost
- [ ] Store in DynamoDB: daily aggregates per workspace
- [ ] Implement rate limiting middleware:
  - Check plan limits before processing each request
  - Return 429 with upgrade CTA when limits hit
- [ ] Build usage dashboard API endpoint

### B4. Domain & SSL (1 day)
- [ ] Buy domain (e.g., `eadpa.io`)
- [ ] Point DNS to CloudFront (frontend) and API Gateway (backend)
- [ ] Set up SSL certificate via AWS ACM (free)
- [ ] Configure custom domain in CloudFront

### B5. Email System (1 day)
- [ ] Set up AWS SES or SendGrid
- [ ] Create email templates:
  - Welcome email
  - Subscription confirmation
  - Usage warning (80% of tokens)
  - Invoice/receipt
  - Password reset

### B6. Production Hardening (2-3 days)
- [ ] Environment variables properly managed (AWS Secrets Manager)
- [ ] Error handling and graceful degradation
- [ ] Request logging (CloudWatch)
- [ ] Set up Sentry for error tracking
- [ ] CORS properly configured for your domain
- [ ] Rate limiting (prevent abuse)
- [ ] Input sanitization (prevent injection attacks)
- [ ] Set up AWS CloudWatch alarms:
  - Lambda errors > 1%
  - API latency > 3 seconds
  - DynamoDB throttling
  - Monthly cost > $X

---

## PHASE C: Frontend Polish (Week 2-3)

### C1. Pricing Page
- [ ] Build `/pricing` page showing all tiers
- [ ] Feature comparison table
- [ ] "Start Free" and "Upgrade to Pro" CTAs
- [ ] Annual vs monthly toggle
- [ ] FAQ section

### C2. Authentication UI
- [ ] Login page
- [ ] Sign-up page
- [ ] Forgot password page
- [ ] Account settings page

### C3. Billing Dashboard
- [ ] Current plan display
- [ ] Usage meter (tokens used / allowance)
- [ ] "Upgrade" button → Stripe Checkout
- [ ] "Manage Billing" button → Stripe Customer Portal
- [ ] Invoice history

### C4. Paywall/Upgrade Prompts
- [ ] Soft paywall when free user hits limit
- [ ] Feature gate messaging (e.g., "Auto-mapping is a Pro feature")
- [ ] Trial banner ("14 days left on your Pro trial")

### C5. Landing Page
- [ ] Hero section (what it does, demo GIF/video)
- [ ] Feature highlights
- [ ] Social proof / testimonials
- [ ] Pricing section
- [ ] CTA: "Start Free — No Credit Card Required"

---

## PHASE D: Go-to-Market (Week 3-4)

### D1. Marketing Website Content
- [ ] Clear value proposition: "Build production data pipelines in 5 minutes through chat"
- [ ] Demo video (screen recording of building a pipeline)
- [ ] Use cases by cloud (AWS, Azure, Snowflake, dbt)
- [ ] Blog post: "Why we built EADPA"

### D2. Launch Channels
- [ ] **Product Hunt** launch (big day-1 visibility)
- [ ] **Hacker News** "Show HN" post
- [ ] **Reddit**: r/dataengineering, r/aws, r/snowflake
- [ ] **LinkedIn**: Posts targeting data engineers
- [ ] **Twitter/X**: Data engineering community
- [ ] **dbt Community Slack**: Share with dbt users
- [ ] **Dev.to / Medium**: Technical blog posts

### D3. Early User Acquisition
- [ ] Offer first 50 users **lifetime 50% off Pro** (urgency + early feedback)
- [ ] Set up referral program: "Invite a colleague, both get 1 month free"
- [ ] Reach out to 10 data engineers directly for beta testing
- [ ] Join data engineering Discord/Slack communities

---

## PHASE E: Legal & Compliance (Week 2-4, parallel)

### E1. Required Legal Documents
- [ ] **Terms of Service** (use a generator like Termly.io, ~$10/month)
- [ ] **Privacy Policy** (required by law, especially with POPIA/GDPR)
- [ ] **Cookie Policy** (if using analytics)
- [ ] **Acceptable Use Policy** (what users can't do)
- [ ] **Data Processing Agreement** (DPA) for enterprise customers

### E2. Business Registration
- [ ] Register as a company (Pty Ltd in South Africa, or LLC in US)
- [ ] Get a business bank account
- [ ] Register with SARS (if South Africa) for tax purposes
- [ ] Consider incorporation in US/Delaware for international SaaS (via Stripe Atlas: https://stripe.com/atlas)

### E3. Compliance
- [ ] POPIA compliance (South Africa) — you're handling user data
- [ ] GDPR compliance (if serving EU users)
- [ ] Data residency: clarify where data is stored (AWS region)
- [ ] Right to deletion: implement "Delete my account" flow

---

## PHASE F: Monitoring & Growth (Ongoing)

### F1. Metrics to Track (set up from day 1)
| Metric | Target | Tool |
|--------|--------|------|
| Sign-ups per week | 50+ | PostHog |
| Free → Pro conversion | 10% | Stripe + PostHog |
| Monthly churn (Pro) | <5% | Stripe |
| Average revenue per user | $40+ | Stripe |
| Time to first pipeline | <5 min | Custom tracking |
| NPS score | 40+ | Survey tool |
| Token usage per user | Monitor | DynamoDB |

### F2. Feature Prioritization (post-launch)
1. Whatever users ask for most (track feature requests)
2. Azure/Snowflake/dbt backends (expand from AWS-only)
3. Team collaboration features (drives Team tier upgrades)
4. Enterprise compliance features (drives enterprise deals)

---

## CRITICAL PATH (Minimum Viable Launch)

If you want to ship the **fastest possible launch**, here's the absolute minimum:

```
Week 1:
  ✓ AWS account + deploy backend
  ✓ Auth (Cognito or Clerk — Clerk is faster, $25/month)
  ✓ Stripe integration (2 plans: Free + Pro at $49/month)
  ✓ Deploy frontend (Vercel — easiest)

Week 2:
  ✓ Landing page with pricing
  ✓ Usage tracking (token counting)
  ✓ Paywall when free limits hit
  ✓ Domain + SSL

Week 3:
  ✓ Polish, test with 5 beta users
  ✓ Fix bugs they find
  ✓ Launch on Product Hunt / LinkedIn
```

**That's it. You're live in 3 weeks.**

---

## Budget Summary

| Item | One-time | Monthly |
|------|----------|---------|
| Domain name | $12-50 | — |
| AWS (hosting) | — | $30-100 |
| Stripe | — | 2.9% of revenue |
| Vercel (frontend) | — | $0-20 |
| Clerk (auth) or Cognito | — | $0-25 |
| SendGrid (email) | — | $0 |
| Sentry (errors) | — | $0 |
| Termly (legal docs) | — | $10 |
| **Total to launch** | **~$50** | **~$60-155/month** |

You'll be profitable with **just 2 Pro subscribers** ($98/month revenue > $60-155 costs).

---

## Questions To Decide Now

1. **Domain name**: What do you want to call it? (eadpa.io? elephantdata.ai? pipelineagent.com?)
2. **Auth provider**: Clerk (fastest, $25/month) vs AWS Cognito (free but more work) vs Auth0?
3. **Frontend hosting**: Vercel (easiest) vs AWS CloudFront (cheapest)?
4. **Company registration**: South Africa (Pty Ltd) or US (LLC via Stripe Atlas)?
5. **Launch date target**: When do you want to be live?
