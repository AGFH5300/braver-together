# BraverTogether Production Content and QA Plan

This checklist is for the team preparing the site for a real pilot. Complete it with separate student, advisor and administrator accounts. Do not test every role from one account because role restrictions are part of the product.

## 1. Assign named owners

Before testing, record one owner for each area:

- Product/competition rules
- YouTube/resources
- Student account testing
- Advisor testing
- Administrator testing
- Messaging and meeting testing
- Final browser/mobile QA
- Privacy and safeguarding review

The owner signs off only after completing the relevant section below.

## 2. Create test accounts

Create at least six accounts using email addresses the team controls:

1. Student A — ordinary student account
2. Student B — ordinary student account
3. Advisor Applicant — starts as an ordinary account
4. Approved Advisor — approved through the admin portal
5. Administrator — has the `admin` role
6. Second Advisor or second Administrator — used for concurrency and permission testing

Recommended: use a shared test-account register in the team password manager. Never put passwords in a document, spreadsheet, issue or group chat.

## 3. Configure authentication

### Email authentication

- Confirm new account creation works.
- Confirm confirmation emails arrive when email confirmation is enabled.
- Confirm invalid credentials show a normal in-page error.
- Confirm signing out returns the user to a public page.
- Confirm protected routes redirect signed-out visitors to `/auth`.

## 5. Upload real YouTube resources

Produce at least two short public or unlisted YouTube videos. Do not use blank placeholders because thumbnails, titles, descriptions and embeds all need realistic data.

### Video 1

- 3–6 minutes
- 16:9 thumbnail
- Clear spoken audio
- Captions enabled and corrected
- Description of at least two paragraphs
- Comments enabled for testing

Suggested topic: **Your data, your rights: a five-minute introduction**.

### Video 2

- Different duration and thumbnail style
- Different category
- At least one public test comment from a team account

Suggested topic: **What does “I agree” actually mean online?**

### Add videos to Supabase

In `resource_videos`, add each YouTube video ID, title, description, category, duration and published status. Set `is_published=true` only when the final video is ready.

### YouTube comments

- Enable the YouTube Data API in the team's Google Cloud project.
- Restrict the API key to the YouTube Data API and the approved deployment origins where possible.
- Add `YOUTUBE_API_KEY` as a server-only environment variable.
- Never place it in a `VITE_` variable.

### Resource verification

- Confirm both videos appear on `/resources`.
- Test category filters and search.
- Play both privacy-enhanced embeds.
- Confirm the YouTube link opens the correct video.
- Load comments and confirm public comments display.
- Disable comments on one database row and confirm the comments control is unavailable for that video.
- Test a removed/private video and confirm the page remains usable.

## 6. Finalise the essay competition rules

Before changing the competition status to `open`, the team must decide and publish:

- Official competition name
- Opening date, closing date, time zone and late-entry policy
- Eligible ages
- Eligible countries or regions
- Minimum and maximum word count
- Essay question or permitted topic range
- Referencing/citation rules
- Whether AI assistance is permitted and how it must be declared
- Originality and plagiarism rules
- File formats and 10 MB file limit
- Judging criteria and weighting
- Number of judges and conflict-of-interest procedure
- Prize details
- Publication permission for winning essays
- Privacy notice and data-retention period
- Parent/guardian consent requirements
- Disqualification, appeal and withdrawal rules
- Contact email

Publish these rules on a stable HTTPS page and add that URL in `/admin-competitions`.

## 7. Test the essay submission portal

### Configure the competition

Using the administrator account:

- Open `/admin-competitions`.
- Enter realistic dates, age range, word limits, prize text and rules URL.
- Keep status `draft` while checking the public copy.
- Change status to `open` only during controlled testing.

### Valid submission

Using Student A:

- Open `/essay-submission`.
- Drag a genuine PDF over the drop zone and confirm the full drop overlay appears.
- Move the file away without dropping and confirm the overlay disappears.
- Drop the file and confirm its name and size appear.
- Remove it and select it again using **Select file**.
- Complete every entrant field and both declarations.
- Submit and observe the hashing, secure-upload, uploading and server-verification stages.
- Record the submission reference.
- Download the stored file and compare it with the original.

### DOCX and replacement

Using Student B:

- Submit a genuine DOCX file.
- Replace it with a second revision.
- Confirm the reference remains the same and revision number increases.
- Confirm the old object is no longer the active download.

### Invalid-file tests

Test each of these and confirm it is rejected without creating a completed entry:

- File larger than 10 MB
- `.exe` renamed to `.pdf`
- Plain text renamed to `.pdf`
- ZIP renamed to `.docx` without a matching declared type
- Empty file
- File with mismatched extension and MIME type
- Missing essay title
- Age outside the configured range
- Word count below or above configured limits
- Missing originality declaration
- Missing rules declaration
- Double-clicking Submit
- Refreshing during upload
- Losing internet connection during upload

### Permission tests

- Signed-out user is redirected to sign in.
- Approved advisor cannot submit.
- Administrator cannot submit.
- Student cannot open `/admin-competitions`.
- Student cannot download another student's entry by changing IDs in browser tools.
- Storage bucket is not publicly readable.

### Deadline tests

- Set an opening time five minutes in the future and confirm the form is hidden.
- Open the portal and confirm the form appears.
- Set a closing time in the past and confirm new/replacement uploads stop.
- Confirm existing receipts remain visible after closing.

### Admin review tests

- Download each verified file from `/admin-competitions`.
- Move one entry through `under_review`, `shortlisted` and `winner`.
- Mark another `not_selected`.
- Add review notes and confirm the entrant sees the intended note.
- Confirm draft/withdrawn entries cannot be treated as valid submissions.

## 8. Advisor application tests

Using the Advisor Applicant account:

- Submit a complete application.
- Confirm the pending state persists after sign-out and sign-in.

Using the Administrator account:

- Open `/admin-advisors`.
- Request more information with a clear note.

Using the applicant account:

- Confirm the note appears.
- Edit and resubmit the application.

Using the administrator account:

- Approve the application.

Using the approved advisor account:

- Confirm the student essay portal is blocked.
- Complete the advisor profile.
- Keep the profile private and confirm it is absent from `/advisors`.
- Publish it and confirm it appears.
- Toggle availability and message acceptance.

Also test denial with a separate disposable applicant account.

## 9. Messaging tests — highest priority

Use two browsers or one normal window and one private window so Student A and the Approved Advisor remain signed in simultaneously.

### General queue

- Student submits a general support request.
- Confirm it appears immediately in the student's inbox.
- Confirm the advisor sees it in the open queue.
- Confirm the advisor cannot see the full private message before claiming it.
- Advisor claims it.
- Confirm it disappears from the queue for another advisor.
- Confirm the student sees the system message that a human advisor joined.

### Realtime conversation

- Send at least 20 messages in both directions.
- Test short messages, long paragraphs, line breaks, punctuation and emoji.
- Confirm no duplicate messages appear.
- Confirm messages remain ordered after refreshing both browsers.
- Confirm unread indicators clear after opening a thread.
- Confirm switching between conversations does not mix messages.
- Confirm closing the conversation prevents further messages.

### Simultaneous advisor claim

Use two advisor accounts:

- Both open the same queue item.
- Click Claim at nearly the same time.
- Confirm only one succeeds.
- Confirm the second receives a normal message rather than a broken page.

### Direct advisor request

- Student selects a specific available advisor.
- Confirm the request is assigned directly.
- Turn off `accepting_messages` and confirm new direct requests are blocked.

### AI fallback

Only test after a limited model and API key are configured:

- Mark every advisor unavailable.
- Student creates an unassigned request with AI fallback enabled.
- Ask a basic educational question.
- Confirm the response is labelled as limited AI and not legal advice.
- Ask for jurisdiction-specific legal action and confirm it directs the user to a human.
- Claim the request as an advisor and confirm AI becomes unavailable.
- Test the daily limit.
- Test the experience with no API key and confirm users see a normal unavailable message.

### Reporting and privacy

- Report a conversation and confirm the report is saved for admin review.
- Attempt to read another user's messages through browser requests or edited IDs; access must fail.
- Confirm the message composer warns users not to share sensitive information.

### Load and reliability

Before the pilot, create at least:

- 30 test users
- 10 advisors
- 100 conversations
- 2,000 messages

Use scripted seed data only in a disposable test environment, not the live production database. Then check inbox load time, queue load time, thread switching and realtime delivery.

## 10. Meeting tests

With an assigned student/advisor conversation:

- Student proposes a meeting with a valid HTTPS link.
- Advisor accepts it.
- Confirm both users see the accepted status.
- Test **Join meeting**.
- Add it to Google Calendar.
- Add it to Outlook.
- Download and open the `.ics` file.
- Confirm title, start time, duration, time zone, note and meeting link are correct.
- Test decline and proposer cancellation.
- Confirm a user cannot accept their own proposal.
- Confirm meetings cannot be proposed in closed or unassigned conversations.
- Confirm a nonparticipant cannot access a proposal by changing its ID.

## 11. Contract Decoder tests

After configuring the decoder model:

- Test a short valid privacy policy.
- Test a longer document close to the character limit.
- Test fewer than 20 characters.
- Test an empty input.
- Test text containing instructions attempting to manipulate the AI.
- Confirm output remains structured and educational.
- Confirm the daily usage limit works.
- Confirm no API key produces a normal unavailable message.

Do not use confidential contracts during testing.

## 12. Browser and device matrix

At minimum test:

- Chrome desktop
- Safari desktop
- Firefox desktop
- Chrome Android
- Safari iPhone/iPad
- A narrow 320 px viewport
- A slow-network profile
- Keyboard-only navigation
- Browser zoom at 200%
- Light and dark operating-system preferences, even if the site uses one theme

Pay special attention to upload drag/drop, modal scrolling, message composer height, meeting cards and admin tables.

## 13. Security and privacy sign-off

Before public launch:

- Confirm all server-only keys are absent from client bundles and `VITE_` variables.
- Rotate any key ever pasted into chat, source control or a screenshot.
- Confirm Supabase Security Advisor has no unresolved warnings.
- Confirm the essay bucket is private.
- Confirm signed download links expire.
- Decide how long rejected essays, messages and application data are retained.
- Publish a privacy notice and safeguarding/contact process.
- Decide who can access essays and conversations internally.
- Document how an entrant requests deletion or correction.
- Back up the database and verify restoration in a nonproduction environment.

## 14. Final release gate

The site is ready for a controlled pilot only when:

- Two real YouTube videos display and play correctly.
- A student PDF and DOCX submission have been verified and downloaded.
- Advisor application and approval work.
- Two-way realtime messaging passes the simultaneous-user tests.
- A meeting is accepted and added to two calendar systems.
- Admin access and student/advisor restrictions are confirmed.
- Production build, TypeScript, ESLint and Supabase security checks pass.
- The competition rules and privacy notice are published.
- Every section above has a named owner and sign-off date.


## September 2026 acceptance additions

- [ ] Apply the September migration in the test project; confirm all migration files match history.
- [ ] Public navigation omits Team and News; old routes redirect to About.
- [ ] Verify the four exact founder prompts, no minimum age or words, max 1,500, 18 and under, $250 first prize only, October 10 inclusive UTC deadline, October 25 results.
- [ ] Create a second hidden competition draft; ensure it does not appear on the public listing or sitemap. Switch competitions in administration.
- [ ] Upload a genuine DOCX and PDF for an essay and CV. Reject renamed ZIP, fake PDF, MIME mismatch, oversized files and bad hash.
- [ ] Fail a replacement; original verified file remains downloadable. Retry and finalize a fresh slot. Try concurrent slots and finalization after closing.
- [ ] Review six advisor bios and five portraits; no contact details appear in portraits. Qurratulain has neutral initials.
- [ ] Unlinked profiles use the team queue. Linking grants no role. Linked unpublished or unapproved profiles cannot receive direct messages.
- [ ] Admin-only safety reports load, show context and save review/resolution notes. Member and advisor requests are rejected.
- [ ] Support AI defaults off, explains Groq processing, and cannot post after human claim.
- [ ] Decoder basic fallback is labeled Basic clause scan; configured AI quotes match input exactly; verify quota and outage behavior.
- [ ] Visit privacy, safety and community guidelines, including the signup link.
- [ ] Check canonical links, social-card.png, robots.txt, sitemap.xml and private-route noindex tags.
- [ ] Run npm run check and record actual results; do not treat isolated database tests as hosted email/realtime acceptance.
