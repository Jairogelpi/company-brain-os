# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Contact the repository owner privately through GitHub with:

- a short description of the issue;
- reproduction steps or a proof of concept;
- the affected version or commit;
- the potential impact.

We will acknowledge valid reports and coordinate a fix and disclosure timeline.

## Development rules

- Keep secrets in environment variables or GitHub Actions secrets.
- Never commit `.env`, database dumps, uploads or production credentials.
- Review dependency and workflow changes before merging.
- Treat uploaded company knowledge as sensitive business data.
