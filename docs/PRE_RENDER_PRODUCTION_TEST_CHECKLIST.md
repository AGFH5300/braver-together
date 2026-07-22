# BraverTogether Pre-Render Production Test Checklist

Complete this checklist in Replit/local development before any Render deployment. Render is the final deployment step only after every required item below is signed off.

## 0. Test-control rules

- Keep the essay competition in `draft` except during controlled submission tests.
- Use test accounts and test content only.
- Do not test every role from one account.
- Do not paste service-role, AI or YouTube keys into source code, screenshots, chat or browser fields.
- Use at least two browsers or one normal and one private window for realtime tests.
- Record the tester, date, browser and pass/fail result for each section.

## 1. Pull and validate the code

```bash
git branch --show-current
git rev-parse HEAD
npm ci --include=dev
npm run check
npm run dev -- --host 0.0.0.0 --port 5000
```

Required result:

- production build passes
- route generation passes
- TypeScript passes
- ESLint passes
- no deprecated TanStack server-function warnings
- no missing CSRF middleware warning

## 2. Required environment variables

Confirm these exist in Replit Secrets:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_GOOGLE_AUTH_ENABLED=false
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional integrations can remain absent during the first pass:

```dotenv
YOUTUBE_API_KEY=
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
AI_STRUCTURED_OUTPUTS=true
SUPPORT_AI_API_KEY=
SUPPORT_AI_BASE_URL=
SUPPORT_AI_MODEL=
DECODER_AI_API_KEY=
DECODER_AI_BASE_URL=
DECODER_AI_MODEL=
DECODER_AI_STRUCTURED_OUTPUTS=true
AI_RATE_LIMIT_SALT=
```

Security checks:

- no service-role or secret key begins with `VITE_`
- browser source does not contain server-only keys
- browser network responses do not return server-only keys
- `.env` is not committed

## 3. Test accounts

Create and label these accounts:

1. Student A
2. Student B
3. Advisor Applicant A
4. Advisor Applicant B for denial/more-information tests
5. Approved Advisor A
6. Approved Advisor B for simultaneous claiming
7. Administrator
8. Unrelated User for permission testing

Use email addresses controlled by the team and a password manager.

Create the Administrator account as an ordinary account first. Then, in Supabase SQL Editor, replace the email below and run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id, role) do nothing;
```

Sign out and back in after assigning the role. Keep the administrator account separate from student and advisor-applicant accounts.

## 4. Public navigation and layout

Desktop widths: 1280, 1440, 1920 and 2048 pixels.

- every navigation label remains on one line
- `Ask an Advisor`, `Contract Decoder`, `Apply to be an Advisor` and `Join or sign in` do not wrap
- no header control overlaps another
- the desktop menu changes to the mobile menu at the intended breakpoint
- mobile menu opens, closes and scrolls properly
- keyboard focus is visible on all navigation controls
- footer links work
- active-route styling is correct
- 200% browser zoom remains usable

## 5. Public pages

Signed out, test:

- `/`
- `/about`
- `/team`
- `/resources`
- `/news`
- `/advisors`
- `/competitions`
- `/decoder`
- `/auth`
- `/advisor-signup` redirects to ordinary member authentication

Check:

- no raw JSON or stack traces
- no implementation-facing comments
- loading and empty states are user-friendly
- links and buttons are visually identifiable
- mobile and desktop layouts do not overflow

## 6. Regular user authentication

Using Student A:

- open `/auth`
- open the advisor explanation modal and choose `Sign in to continue`
- confirm `/auth?mode=signin` opens with the Sign in tab selected
- switch between the Create account and Sign in tabs and confirm the URL and visible form stay synchronized
- enter a full name and email to start regular member signup
- verify missing community-rules acceptance is rejected
- verify a six-digit email OTP is sent
- verify Gmail, Outlook and default email-app shortcuts work
- verify incomplete and invalid OTPs are rejected
- verify OTP paste/autofill works
- verify the resend control has a cooldown and sends a new code
- verify Change email returns to the editable name/email step
- after verification, create and confirm a password
- verify both password visibility toggles
- verify the five-level password-strength meter changes as the password improves
- verify mismatched passwords are rejected
- refresh before setting the password and confirm the flow recovers at the password step
- verify successful password setup signs the member in automatically
- sign in with correct credentials
- sign in with incorrect credentials and confirm an in-page error
- refresh and confirm the session persists
- sign out and confirm protected routes redirect to `/auth`
- browser Back does not leave a button stuck
- disabled Google sign-in shows normal explanatory copy and never raw JSON

Protected-route checks while signed out:

- `/messages`
- `/meetings`
- `/profile`
- `/essay-submission`
- `/advisor-application`
- `/admin-advisors`
- `/admin-competitions`

## 7. Member-first advisor application

Using Advisor Applicant A:

- create one ordinary member account through `/auth`
- click `Apply to be an Advisor` from the authenticated desktop header
- repeat from the mobile menu, `/advisors`, footer and regular auth page
- confirm signed-out entry points first show the advisor explanation modal
- confirm the modal offers ordinary member account creation and ordinary sign-in
- confirm neither action adds advisor intent or advisor-specific UI to `/auth`
- confirm `/advisor-signup` redirects to ordinary member signup and never shows a second signup form
- sign in with the existing member account through the modal
- confirm the same account reaches `/advisor-application`

Before and after submitting the application, manually open:

- `/messages`
- `/meetings`
- `/profile`
- `/essay-submission`

Expected result:

- applicant accounts keep the normal member experience while draft, pending, more-information or denied
- account controls show member messages, meetings and profile
- the application control shows the correct application status
- advisor-only queue, availability and public-profile controls remain hidden until approval
- `/admin-advisors` and `/admin-competitions` remain unavailable
- approval changes the account controls to the advisor navigation after the onboarding event or a fresh sign-in

Fresh-account advisor path:

- open the public advisor explanation modal while signed out
- choose Create member account
- confirm the ordinary `/auth?mode=signup` page opens
- create a member account in the same OTP-first form used by every other user
- verify the email OTP and set the password
- sign in
- use `Apply to be an Advisor` from the signed-in member navigation
- confirm no separate advisor-applicant account is created

## 8. Advisor application fields

Check every field:

- full name required
- email required and valid
- organisation optional
- role/course optional
- location/time zone optional
- HTTPS profile URL only
- at least one focus area
- experience minimum 40 characters
- motivation minimum 40 characters
- availability optional
- maximum lengths enforced

Visual checks:

- experience textarea has a useful minimum height
- motivation textarea has a useful minimum height
- availability textarea has a useful minimum height
- textareas can be resized vertically
- placeholders are not clipped
- long text remains readable

## 9. Advisor CV upload

Valid uploads:

- drag a genuine PDF over the drop zone
- confirm the full overlay appears
- drag away and confirm the overlay disappears
- drop the PDF
- confirm name and size appear
- remove the file
- select it again with `Select file`
- submit the complete application
- observe hashing, secure-slot creation, upload and server verification stages
- confirm pending status after success
- confirm account controls show `Application under review` alongside normal member controls
- confirm `/messages`, `/meetings`, `/profile` and `/essay-submission` remain available as member features
- confirm advisor queue, advisor availability, public-advisor publishing and admin routes remain unavailable until approval
- download the current CV and compare it with the original

Repeat with a genuine DOCX.

Replacement:

- receive a `more information` decision
- edit the form
- attach a replacement CV
- resubmit
- confirm the new CV is active
- confirm the old CV is no longer the active admin download

Text-only resubmission:

- with an already verified CV, update text without selecting a new file
- confirm resubmission succeeds and keeps the existing CV

Invalid upload tests:

- empty file
- file larger than 5 MB
- `.exe` renamed `.pdf`
- text file renamed `.pdf`
- invalid ZIP renamed `.docx`
- PDF renamed `.docx`
- DOCX renamed `.pdf`
- mismatched MIME and extension
- double-click Submit
- refresh during upload
- disconnect internet during upload

Expected result:

- no invalid file becomes an active CV
- a failed replacement does not delete the previous verified CV
- no draft/failed application appears in the admin review queue
- the `advisor-cvs` bucket is private
- direct public storage URLs fail
- signed download links expire

## 10. Advisor administration

Using Administrator:

- open `/admin-advisors`
- confirm draft/incomplete applications are absent
- filter pending, more-information, approved and denied states
- select an application
- confirm all application details appear
- download the verified CV
- open the applicant profile URL
- use the contact email link
- add a review note
- request more information
- confirm the applicant sees the note
- deny Advisor Applicant B with a note
- attempt approval without a CV and confirm it is blocked
- approve Advisor Applicant A with a CV
- confirm review actions persist after refresh
- confirm an ordinary user cannot access the admin route or functions

## 11. Approved advisor profile

Using Approved Advisor A:

- sign out and back in after approval
- confirm onboarding gate is no longer active
- open `/profile`
- confirm the account is shown as approved
- add headline, biography and focus areas
- verify biography textarea size and resizing
- add an HTTPS booking URL
- test invalid non-HTTPS booking URL
- set availability to available, busy and offline
- toggle accepting messages
- keep profile private and confirm it is absent from `/advisors`
- publish profile and confirm it appears
- unpublish and confirm removal
- set maximum active conversations to minimum and maximum allowed values

## 12. Student essay competition

Using Administrator:

- keep competition `draft`
- configure realistic title, summary, dates, age range, word range, prize and HTTPS rules link
- review `/competitions` publicly
- temporarily set status `open` for controlled tests only

Using Student A:

- submit a genuine PDF
- test drag overlay, drag leave, drop, remove and select-file controls
- observe every upload stage
- record submission reference and revision
- download and compare stored file

Using Student B:

- submit a genuine DOCX
- replace it with a second revision
- confirm reference remains the same and revision increments

Invalid essay tests:

- empty file
- file larger than 10 MB
- renamed executable/text/ZIP
- MIME mismatch
- missing required entrant fields
- age outside range
- word count outside range
- missing declarations
- double submit
- refresh/offline during upload

Role checks:

- advisor cannot submit
- administrator cannot submit
- unrelated student cannot download another entry
- essay bucket remains private

Deadline checks:

- before opening time
- during open period
- after closing time
- replacement blocked after closing
- existing receipt remains visible

Return competition to `draft` or `closed` immediately after testing.

## 13. Advisor messaging — highest priority

Use three simultaneous sessions:

- Student A
- Approved Advisor A
- Approved Advisor B

General queue:

- Student A submits a general request
- it appears immediately in Student A's inbox
- both advisors see the queue item
- private message content is hidden before claim
- both advisors click Claim nearly simultaneously
- exactly one succeeds
- the other receives a normal already-claimed message
- the item disappears from the second advisor's queue
- the student sees the human-advisor system message

Realtime thread:

- send at least 20 messages in each direction
- include one-word messages, long paragraphs, line breaks, emoji and rapid messages
- send while the other browser is on another page
- confirm immediate delivery
- confirm no duplicates
- confirm chronological ordering
- refresh both browsers and confirm persistence
- verify unread indicators appear and clear
- switch rapidly between conversations and confirm messages never mix
- verify mobile composer height and scrolling
- close the conversation and confirm further messages are blocked

Direct advisor request:

- publish Advisor A and set available/accepting
- Student A starts a direct request
- confirm direct assignment
- disable accepting messages
- confirm another direct request is blocked
- test available, busy and offline display

Privacy and reports:

- alter conversation IDs in browser requests
- attempt to fetch another user's messages
- report a conversation
- confirm the report is saved
- confirm ordinary users cannot read reports
- confirm privacy warnings are visible

Reliability:

- background the browser and return
- temporarily disconnect and reconnect
- open multiple tabs for the same account
- confirm no duplicate realtime subscriptions or messages

## 14. AI fallback

Leave AI variables absent for the first pass:

- confirm support AI shows a normal unavailable message
- confirm Contract Decoder shows a normal unavailable message
- confirm no configuration details or JSON are exposed

After configuring a limited model:

- mark all advisors unavailable
- create an unassigned request with AI fallback enabled
- ask a basic educational question
- confirm AI labelling and disclaimer
- ask for jurisdiction-specific legal action
- confirm human handoff is required
- have an advisor claim the request
- confirm AI stops
- test daily limit
- test prompt injection attempts

Contract Decoder:

- empty input
- under 20 characters
- normal privacy policy
- long input near the limit
- prompt-injection text
- daily limit
- structured output shape
- no fabricated contract wording

## 15. Meetings

With an assigned open conversation:

- student proposes a meeting
- advisor proposes a separate meeting
- use valid date, time, duration, time zone, note and HTTPS meeting link
- other participant accepts
- both users see accepted status in realtime
- test Join meeting
- add to Google Calendar
- add to Outlook
- download and open `.ics`
- verify title, time, duration, time zone, note and URL
- test decline
- test proposer cancellation
- confirm proposer cannot accept their own proposal
- confirm unrelated user cannot access proposal
- confirm closed or unassigned conversations cannot create meetings

## 16. Substack/news

Publish two genuine Substack articles with different:

- title lengths
- authors where possible
- cover images
- structures
- publication dates

Test `/news`:

- newest first
- correct title, author, date, excerpt and image
- links open the correct articles
- incognito works
- mobile cards work
- long titles do not overflow
- cached fallback shows saved posts instead of a technical error

## 17. YouTube/resources

Upload two real public or unlisted videos with:

- different durations
- different thumbnails
- captions
- descriptions
- different resource categories
- at least one public test comment

Add both rows to `resource_videos`.

Test `/resources`:

- search
- category filtering
- privacy-enhanced playback
- correct YouTube links
- comments with `YOUTUBE_API_KEY`
- comments disabled for one row
- removed/private video failure state
- mobile layout

## 18. Browser, accessibility and network matrix

Test:

- Chrome desktop
- Safari desktop
- Firefox desktop
- Chrome Android
- Safari iPhone/iPad
- 320 px viewport
- tablet viewport
- slow 3G/network throttling
- offline/reconnect
- keyboard-only navigation
- screen-reader labels on icon buttons
- 200% zoom
- light and dark operating-system preferences

Focus on:

- header navigation
- advisor and essay drop zones
- textarea heights
- modals
- message composer
- meeting cards
- admin tables
- long names and filenames

## 19. Security and privacy

- Supabase Security Advisor has no unresolved findings
- private CV and essay buckets are not public
- signed URLs expire
- RLS blocks cross-account reads
- service-role key is server-only
- applicant cannot self-approve
- applicant cannot claim conversations
- ordinary user cannot invoke admin review functions
- invalid file headers are rejected
- failed uploads are cleaned up
- previous verified files survive failed replacements
- CSRF protection remains enabled for server functions
- privacy notice is published
- safeguarding/contact process is published
- data-retention periods are decided for CVs, applications, essays, messages and reports
- deletion/correction request process is documented

## 20. Final Replit sign-off

Do not deploy to Render until all are true:

- `npm run check` passes on the final branch
- all required environment variables work in Replit
- regular signup/sign-in works
- advisor applicants remain normal members through draft, pending, more-information and denied states, with advisor-only tools unavailable until approval
- valid PDF and DOCX CV uploads work
- invalid CV files fail safely
- admin can download and review CVs
- advisor approval and profile publishing work
- PDF and DOCX essay submissions work
- realtime messaging and simultaneous claiming pass
- privacy/RLS tests pass
- meeting acceptance and calendar exports pass
- two Substack posts display
- two YouTube videos display
- browser/mobile matrix passes
- no raw JSON, stack trace or secret appears to users
- competition is returned to `draft` or `closed`
- every section has a named tester and sign-off date

## 21. Render deployment — only after all previous sections pass

At that point only:

1. merge the final PR
2. update local/Replit to `main`
3. repeat `npm run check`
4. copy the verified environment variables to Render
5. use `npm ci --include=dev && npm run build` as build command
6. use `npm start` as start command
7. deploy latest `main`
8. run a short production smoke test with one test account
9. keep the real essay competition closed until the public launch decision
