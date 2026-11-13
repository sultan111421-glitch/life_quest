import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const specPath = path.resolve(process.cwd(), 'security_spec.md');

const rules = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  firestore: Record<string, unknown>;
};
const spec = fs.readFileSync(specPath, 'utf8');

test('firestore.rules starts with default-deny safety net and matches every blueprint collection', () => {
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  const requiredMatches = [
    'match /users/{userId}',
    'match /activities/{activityId}',
    'match /dailyLogs/{dateKey}',
    'match /friends/{friendUid}',
    'match /publicProfiles/{userId}',
    'match /usernames/{username}',
    'match /friendRequests/{requestId}',
    'match /leaderboards/{userId}',
    'match /challenges/{challengeId}',
    'match /participants/{participantUid}',
    'match /groups/{groupId}',
    'match /members/{memberUid}',
    'match /sharedProgress/{memberUid}',
    'match /feed/{feedId}',
    'match /groupInvitations/{inviteId}',
    'match /groupInviteLinks/{inviteCode}',
  ];

  for (const m of requiredMatches) {
    assert.ok(rules.includes(m), `Missing rules block for ${m}`);
  }
  assert.equal(Object.keys(blueprint.firestore).length, 18);
});

test('Dirty Dozen and Group security invariants are explicitly enforced in firestore.rules and documented in security_spec.md', () => {
  // 1. Private users never listed in /users
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
  // 2. Public profiles enforce private/friends/public server-side
  assert.match(rules, /existing\(\)\.visibility == 'public'/);
  assert.match(rules, /existing\(\)\.visibility == 'friends' && isFriendOf\(userId\)/);
  // 3. Usernames hide private accounts
  assert.match(rules, /existing\(\)\.visibility != 'private'/);
  // 4. Leaderboards require optedIn == true for others and forbid spiritual/health keys
  assert.match(rules, /existing\(\)\.optedIn == true/);
  assert.match(rules, /!\('spiritual' in data\.categoryScores\)/);
  assert.match(rules, /!\('health' in data\.categoryScores\)/);
  // 5. Friend edges require accepted friend request via getAfter
  assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/friendRequests\//);
  // 6. Terminal friend request lock
  assert.match(rules, /existing\(\)\.status == 'pending'/);
  // 7. Verified email + request.time temporal integrity
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  // 8. Friends Groups invariants: membership-gated access, owner-only sharedProgress, spiritual/health blocked, non-listable invite links, creator-only admin promotion
  assert.match(rules, /match \/groups\/\{groupId\}[\s\S]*allow list: if isSignedIn\(\) && \(request\.auth\.uid in existing\(\)\.memberUids\);/);
  assert.match(rules, /match \/sharedProgress\/\{memberUid\}[\s\S]*isVerifiedOwner\(memberUid\)/);
  assert.match(rules, /!data\.sharedCategories\.hasAny\(\['spiritual', 'health'\]\)/);
  assert.match(rules, /!\('spiritual' in data\.categorySummaries\)/);
  assert.match(rules, /!\('health' in data\.categorySummaries\)/);
  assert.match(rules, /match \/groupInviteLinks\/\{inviteCode\}[\s\S]*allow list: if false;/);
  assert.match(rules, /isGroupCreator\(groupId\)[\s\S]*existing\(\)\.role != 'creator'[\s\S]*incoming\(\)\.role in \['admin', 'member'\]/);
  assert.match(rules, /data\.imageUrl\.matches\('\^data:image\/\(png\|jpeg\|webp\);base64,\[A-Za-z0-9\+\/=\]\+\$'\)/);
  // 9. All 12 Dirty Dozen cases documented in security_spec.md
  for (let i = 1; i <= 12; i++) {
    assert.ok(spec.includes(`${i}. **`), `Missing Dirty Dozen case #${i} in security_spec.md`);
  }
});
