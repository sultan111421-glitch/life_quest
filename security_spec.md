# LIFE QUEST Security Specification (Zero-Trust Privacy & Social Architecture)

## 1. Data Invariants
1. **Strict Private Ownership & PII Isolation**:
   - `/users/{userId}`, `/users/{userId}/activities/{activityId}`, and `/users/{userId}/dailyLogs/{dateKey}` belong strictly to `request.auth.uid == userId` with `request.auth.token.email_verified == true` for writes.
   - Private PII (`email`, personal notes, daily activity entries, religious/spiritual records, sleep/health metrics, private goals) NEVER leave `/users/{userId}` and CANNOT be stored in `/publicProfiles`, `/usernames`, `/leaderboards`, or `/challenges`.
2. **Private-by-Default & Granular Visibility Enforcement**:
   - `/publicProfiles/{userId}` defaults to `visibility: 'private'`.
   - `allow get` on `/publicProfiles/{userId}` succeeds ONLY if `isOwner(userId)`, `resource.data.visibility == 'public'`, or (`resource.data.visibility == 'friends'` AND `exists(/databases/$(database)/documents/users/$(userId)/friends/$(request.auth.uid))`).
   - `allow list` on `/publicProfiles` ONLY returns `visibility == 'public'` or the caller's own doc — never blanket `isSignedIn()`.
   - `/usernames/{username}` blocks both `get` and `list` if `resource.data.visibility == 'private'` (unless caller is the owner), making Private accounts undiscoverable in search.
3. **Leaderboard Opt-In & Instant Revocation**:
   - `/leaderboards/{userId}` is OFF by default. Other signed-in users can only `get`/`list` entries where `resource.data.optedIn == true`.
   - Leaderboard `categoryScores` maps strictly forbid `'spiritual'` and `'health'` keys at the rule level (`!('spiritual' in data.categoryScores) && !('health' in data.categoryScores)`).
   - Owners can delete or set `optedIn: false` on `/leaderboards/{userId}` at any time for instant revocation.
4. **Friend Request State Machine & Atomic Friend Edges**:
   - `/friendRequests/{requestId}` requires deterministic ID `{fromUid}_{toUid}`, `fromUid != toUid`, and terminal state locking once `'accepted'` or `'declined'`.
   - Creating `/users/{userId}/friends/{friendUid}` requires a matching `/friendRequests/{requestId}` in `'accepted'` state (`get()` or `getAfter()`), preventing forged friend edges.
   - Either participant can delete `/users/{userId}/friends/{friendUid}` to unfriend cleanly.
5. **Immutable Identity, Temporal Integrity & Shadow-Field Blocking**:
   - All documents validate `uid == request.auth.uid`, immutable `uid` and `createdAt`, `createdAt == request.time` on create, `updatedAt == request.time` on create/update, strict `.size()` bounds, `hasAll` + `hasOnly` on create, and `affectedKeys().hasOnly(...)` on every update branch.
6. **Private Friends Groups, Membership & Zero-Bypass Sharing Controls**:
   - `/groups/{groupId}` defaults to `isPrivate: true`, stores a bounded `memberUids` list (`size() <= 50`), and enforces `allow get` / `allow list` strictly to members (`request.auth.uid in existing().memberUids` / `isGroupMember(groupId)`).
   - `/groups/{groupId}/members/{memberUid}` separates roles: only `creator` can promote/demote `'admin'` vs `'member'`; creators cannot be stripped or removed by admins; joining requires either a verified accepted `/groupInvitations/{groupId}_{uid}` (`getAfter()`) or an active `/groupInviteLinks/{code}` (`get()`), never arbitrary self-addition or self-escalation to `'admin'`/`'creator'`.
   - `/groups/{groupId}/sharedProgress/{memberUid}` defaults to `sharingEnabled: false`, is readable only by group members when `sharingEnabled == true`, and is writable **only** by `memberUid == request.auth.uid` (group admins cannot edit or read unshared/revoked fields, and `spiritual` / `health` categories are banned at the rule level).
   - `/groupInviteLinks/{code}` disables `allow list` completely so invite codes cannot be enumerated or scraped.

## 2. The "Dirty Dozen" & Group Security Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Private/Social Read**: Read `/users/userA/dailyLogs/2026-11-13` or `/publicProfiles/userB` with `auth == null`.
2. **Private Account Profile Snooping**: User B attempts `get` on `/publicProfiles/privateUserA` where `visibility == 'private'`.
3. **Friends-Only Profile Snooping by Stranger**: Stranger User C (no friend edge in `/users/friendsOnlyUserB/friends/userC`) attempts `get` on `/publicProfiles/friendsOnlyUserB`.
4. **Private Username Search Bypass**: User B reads `/usernames/private_user` where `visibility == 'private'`.
5. **Shadow PII / Email Leak on Public Profile**: User A creates `/publicProfiles/userA` injecting `email: "a@example.com"` or `isAdmin: true`.
6. **Religious / Health Category Injection on Leaderboard & Groups**: User A creates `/leaderboards/userA` or `/groups/grp1/sharedProgress/userA` with `spiritual` or `health` category keys.
7. **Non-Opted-In Leaderboard & Revoked Group Share Read**: User B attempts `get` on `/leaderboards/userA` where `optedIn == false`, or `/groups/grp1/sharedProgress/userA` where `sharingEnabled == false`.
8. **Forged Friend Edge or Self-Promoted Group Admin**: User B creates `/users/userA/friends/userB` without an accepted friend request, or creates `/groups/grp1/members/userB` with `role: 'admin'` / `'creator'`.
9. **Terminal Friend Request & Group Invitation Tampering**: User A updates `/friendRequests/userA_userB` or `/groupInvitations/grp1_userB` after it reached `'declined'` back to `'accepted'`.
10. **Cross-User Daily Log / Group SharedProgress Override by Admin**: Group Admin User A attempts to write or enable `/groups/grp1/sharedProgress/userB` or read `/users/userB/dailyLogs/2026-11-13`.
11. **Non-Member Private Group Access & Invite Link Enumeration**: Stranger User C reads `/groups/grp1`, lists `/groupInviteLinks`, or reads `/groups/grp1/challenges/ch1`.
12. **Resource Exhaustion / ID Poisoning**: User A writes `/users/userA/activities/bad$id!` or sets a 5,000-character `bio` / `title`.

