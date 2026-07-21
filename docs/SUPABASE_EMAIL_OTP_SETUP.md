# Supabase email OTP setup

The member signup flow uses `signInWithOtp`, a six-digit email code, `verifyOtp`, and then `updateUser` to set the password after verification.

For hosted Supabase, configure **Authentication → Email Templates → Magic Link** so the message includes the `{{ .Token }}` variable. Supabase sends a magic link when the template uses `{{ .ConfirmationURL }}` and sends a six-digit OTP when it uses `{{ .Token }}`.

Suggested subject:

```text
{{ .Token }} is your BraverTogether verification code
```

Suggested HTML body:

```html
<h2>Verify your BraverTogether email</h2>
<p>Enter this six-digit code to continue creating your member account:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
  {{ .Token }}
</p>
<p>
  This code expires soon. If you did not request it, you can ignore this email.
</p>
```

Keep email confirmation enabled. Set an appropriately short OTP expiry and retain Supabase's rate limits. Test the hosted template in Replit before any Render deployment.
