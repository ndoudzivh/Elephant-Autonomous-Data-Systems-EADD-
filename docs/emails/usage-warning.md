# Usage Warning Email (80% of token allowance)

**Subject:** Heads up — you've used 80% of your monthly tokens

---

Hi {{first_name}},

Just a friendly heads up: you've used **{{tokens_used}}** of your **{{tokens_allowance}}** monthly token allowance ({{percentage}}%).

At your current pace, you'll hit your limit around **{{estimated_date}}**.

**What happens when you hit the limit:**
{{#if free_tier}}
- Your conversations will pause until next month (resets {{reset_date}})
- All your pipelines and generated code remain accessible
- You can still download and use everything you've already generated
{{/if}}
{{#if pro_tier}}
- Additional usage is charged at $3/1M input tokens + $15/1M output tokens
- No interruption to your service
- You can set a spending cap in [Settings → Billing](https://app.eadd.ai/settings/billing)
{{/if}}

**Want more tokens?**
{{#if free_tier}}
[Upgrade to Pro](https://eadd.ai/pricing) → 2M tokens/month (20x more) + all cloud backends for $49/month.
{{/if}}
{{#if pro_tier}}
Your usage looks healthy. If you're consistently exceeding your allowance, consider the [Team plan](https://eadd.ai/pricing) for 5M tokens/month.
{{/if}}

— The EADD Team
