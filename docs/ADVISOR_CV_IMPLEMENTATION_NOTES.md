# Advisor CV implementation notes

The advisor application now requires a verified PDF or DOCX CV before submission can enter the administrator review queue. Files are stored in a private Supabase Storage bucket and are downloaded through short-lived signed links.
