# Security Specification - Leksikon App

## 1. Data Invariants
- Words must have a word, category, and definition.
- Etymology and examples are optional but must be strings if present.
- Statistics can only be incremented, never decremented or set to arbitrary values.
- Only the verified administrator (yokotenkaizen@gmail.com) can manage the word database.

## 2. The "Dirty Dozen" Payloads (Red Team Tests)
1. **Unauthorized Word Creation**: Anonymous user attempting to POST to `/words/test`.
2. **Admin Impersonation**: Authenticated user (non-admin) trying to PUT to `/words/test`.
3. **Ghost Field Injection**: Admin trying to add an `isAdmin: true` field to a word document.
4. **ID Poisoning**: User trying to create a word with a 2MB string as its ID.
5. **Stats Reset**: User trying to set `totalSearches` to `0`.
6. **Stats Overflow**: User trying to update status with a massive `1GB` string instead of a number.
7. **Malformed Word Data**: Admin creating a word where `definition` is a `boolean`.
8. **Malicious Array Injection**: Admin adding 10,000 strings to the `examples` array to cause "Denial of Wallet".
9. **Unverified Admin Access**: User with email `yokotenkaizen@gmail.com` but `email_verified: false` trying to edit.
10. **Shadow Key Update**: User trying to update `updatedAt` to a past date (spoofing content age).
11. **Stat Hijacking**: User trying to change the document structure of `stats/global`.
12. **Blanket Read Attack**: Trying to list all words without a limit (already handled by app but rules should enforce safety).

## 3. Test Runner Strategy
- We will verify that all write attempts by non-privileged users are blocked.
- We will verify that updates to stats are strictly restricted to numeric increments.
